import {
	greenBright,
	gray,
	blue,
	green,
	yellow,
	red,
	white,
	bgBlack,
	bgWhite,
} from "yoctocolors";
import { stat, unlink, rename, writeFile } from "node:fs/promises";
import { parse, join, resolve, dirname } from "node:path";
import { gzipSync } from "node:zlib";
import {
	mkdirWithRetry,
	readFileWithRetry,
	writeFileWithRetry,
	createWriteStreamWithRetry,
	existsWithRetry,
	statWithRetry,
} from "./utils/fileHelpers.js";
// Default formatter function
const defaultFormatter = (level, message) => {
	switch (typeof message) {
		case "undefined":
			return `[${level}] [${new Date().toISOString()}] [Message is undefined]`;
		case "object":
			try {
				return `[${level}] [${new Date().toISOString()}] ${JSON.stringify(message)}`;
			} catch (err) {
				return `[${level}] [${new Date().toISOString()}] [Non-serializable object]`;
			}
		default:
			return `[${level}] [${new Date().toISOString()}] ${message.toString()}`;
	}
};
// constants
const MAX_QUEUE_SIZE = 100000; // Maximum size of the write queue
const validStrategies = ["deleteOld", "archiveOld"];
const levelOrder = [
	"trace",
	"debug",
	"info",
	"success",
	"warn",
	"error",
	"fatal",
];
// Color mapping and compose
const compose = (f, g) => (x) => f(g(x));
const colorMap = {
	trace: compose(greenBright, bgBlack),
	debug: gray,
	info: blue,
	success: green,
	warn: yellow,
	error: red,
	fatal: compose(bgWhite, red),
	default: white,
};
// Global cleanup
let cleanupAttached = false;
const activeLoggers = new Set();
const attachGlobalCleanup = () => {
	if (cleanupAttached) return;
	const cleanup = async () => {
		for (const logger of activeLoggers) {
			await logger.destroy?.();
		}
	};
	process.once("exit", cleanup);
	process.once("SIGINT", () => {
		cleanup().then(() => process.exit(0));
	});
	process.once("SIGTERM", () => {
		cleanup().then(() => process.exit(0));
	});

	cleanupAttached = true;
};
/**
 * Logger Instance
 * @typedef {Object} LoggerInstance
 * @property {Function} debug - Log a debug message.
 * @property {Function} info - Log an info message.
 * @property {Function} success - Log a success message.
 * @property {Function} warn - Log a warning message.
 * @property {Function} error - Log an error message.
 * @property {Function} destroy - Clean up resources.
 */
const deadslog = ({
	consoleOutput = { enabled: true, coloredCoding: true },
	fileOutput = {
		enabled: null,
		logFilePath: null,
		rotate: null,
		maxLogSize: null,
		maxLogFiles: null,
		onMaxLogFilesReached: null,
	},
	formatter = defaultFormatter,
	minLevel = "info",
} = {}) => {
	if (consoleOutput && typeof consoleOutput !== "object")
		throw new Error("Invalid consoleOutput configuration.");
	if (consoleOutput.enabled && typeof consoleOutput.enabled !== "boolean")
		throw new Error("consoleOutput.enabled must be a boolean.");
	if (
		consoleOutput.coloredCoding &&
		typeof consoleOutput.coloredCoding !== "boolean"
	)
		throw new Error("consoleOutput.coloredCoding must be a boolean.");
	if (fileOutput && typeof fileOutput !== "object")
		throw new Error("Invalid fileOutput configuration.");
	if (fileOutput.enabled && typeof fileOutput.enabled !== "boolean")
		throw new Error("fileOutput.enabled must be a boolean.");
	if (fileOutput.enabled) {
		if (!fileOutput.logFilePath)
			throw new Error("File logging is enabled but no log file path provided.");
		if (typeof fileOutput.logFilePath !== "string")
			throw new Error("fileOutput.logFilePath must be a string.");
		if (fileOutput.rotate && typeof fileOutput.rotate !== "boolean")
			throw new Error("fileOutput.rotate must be a boolean.");
		if (fileOutput.rotate) {
			if (
				!fileOutput.maxLogSize ||
				typeof fileOutput.maxLogSize !== "number" ||
				fileOutput.maxLogSize < 1
			)
				throw new Error("Invalid maxLogSize for file rotation.");
			if (
				!fileOutput.maxLogFiles ||
				typeof fileOutput.maxLogFiles !== "number" ||
				fileOutput.maxLogFiles < 1
			)
				throw new Error("Invalid maxLogFiles for file rotation.");
			if (
				!fileOutput.onMaxLogFilesReached ||
				typeof fileOutput.onMaxLogFilesReached !== "string"
			)
				throw new Error("Invalid onMaxFilesReached for file rotation.");
			if (!validStrategies.includes(fileOutput.onMaxLogFilesReached))
				throw new Error(
					`Invalid value for onMaxLogFilesReached: "${fileOutput.onMaxLogFilesReached}". ` +
						`Valid values are: ${validStrategies.join(", ")}.`,
				);
		}
	}
	if (typeof formatter !== "function") formatter = defaultFormatter;
	if (typeof minLevel !== "string")
		throw new Error("minLevel must be a string.");
	if (!levelOrder.includes(minLevel))
		throw new Error(
			`Invalid value for minLevel: ${minLevel}. Valid levels are: ${levelOrder.join(", ")}.`,
		);

	// initialization
	let logFilePath = null;
	let fileStream = null;
	let isRotating = false;
	let isProcessingQueue = false;
	const writeQueue = [];
	const minLevelIndex = levelOrder.indexOf(minLevel.toLowerCase());

	if (fileOutput.enabled) {
		logFilePath = resolve(fileOutput.logFilePath);
		const logFileDir = dirname(logFilePath);
		try {
			if (!existsWithRetry(logFileDir)) {
				mkdirWithRetry(logFileDir);
			}
			if (!statWithRetry(logFileDir).isDirectory()) {
				throw new Error(`Path ${logFileDir} is not a directory.`);
			}
			if (!existsWithRetry(logFilePath)) {
				writeFileWithRetry(logFilePath, "");
			}
		} catch (err) {
			throw new Error(
				`Failed to initialize log file or directory: ${err.message}. Ensure the paths are valid and writable.`,
			);
		}
		fileStream = createWriteStreamWithRetry(logFilePath, { flags: "a" });
		fileStream.on("error", (err) => {
			console.error("[deadslog/system] Logging stream error:", err);
		});
	}

	// Add logic to handle file rotation based on maxSize and maxFile
	const rotateLogs = async () => {
		if (isRotating) return;
		isRotating = true;

		try {
			let stats;
			try {
				stats = await stat(logFilePath);
			} catch (err) {
				if (err.code === "ENOENT") return; // File doesn't exist, no need to rotate
				throw err;
			}

			if (stats.size < fileOutput.maxLogSize) return;

			const { dir, name, ext } = parse(logFilePath);

			if (fileOutput.onMaxLogFilesReached === "deleteOld") {
				const oldest = join(dir, `${name}.${fileOutput.maxLogFiles}${ext}`);
				try {
					await unlink(oldest);
				} catch (err) {
					if (err.code !== "ENOENT") throw err;
				}

				for (let i = fileOutput.maxLogFiles - 1; i >= 1; i--) {
					const src = join(dir, `${name}.${i}${ext}`);
					const dest = join(dir, `${name}.${i + 1}${ext}`);
					try {
						await rename(src, dest);
					} catch (err) {
						if (err.code !== "ENOENT") throw err;
					}
				}

				const newLogFile = join(dir, `${name}.1${ext}`);
				await rename(logFilePath, newLogFile);
			}

			if (fileOutput.onMaxLogFilesReached === "archiveOld") {
				const oldest = join(dir, `${name}.${fileOutput.maxLogFiles}${ext}.gz`);
				try {
					await unlink(oldest);
				} catch (err) {
					if (err.code !== "ENOENT") throw err;
				}

				for (let i = fileOutput.maxLogFiles - 1; i >= 1; i--) {
					const src = join(dir, `${name}.${i}${ext}.gz`);
					const dest = join(dir, `${name}.${i + 1}${ext}.gz`);
					try {
						await rename(src, dest);
					} catch (err) {
						if (err.code !== "ENOENT") throw err;
					}
				}

				const compressedPath = join(dir, `${name}.1${ext}.gz`);
				const inputBuffer = readFileWithRetry(logFilePath);
				const compressedBuffer = gzipSync(inputBuffer);
				await writeFile(compressedPath, compressedBuffer);
			}

			fileStream.end();
			await writeFile(logFilePath, "", "utf8");
			fileStream = createWriteStreamWithRetry(logFilePath, { flags: "a" });
			fileStream.on("error", (err) => {
				console.error(
					"[deadslog/system] Logging stream error after rotation:",
					err,
				);
			});
		} catch (err) {
			console.error("[deadslog/system] Error during log rotation:", err);
		} finally {
			isRotating = false;
			processWriteQueue();
		}
	};

	// Write Queue Processor
	const processWriteQueue = async () => {
		if (isProcessingQueue) return;
		isProcessingQueue = true;

		while (writeQueue.length > 0) {
			const { message, resolve, reject } = writeQueue.shift();
			try {
				if (!fileStream || fileStream.writableEnded) {
					console.warn(
						"[deadslog/system] Attempted to write to closed file stream.",
					);
					reject(new Error("File stream is closed."));
					return;
				}
				if (fileOutput.rotate) await rotateLogs();
				fileStream.write(`${message}\n`, (err) => {
					if (err) {
						console.error("[deadslog/system] Error writing to log file:", err);
						return reject(err);
					}
					resolve();
				});
			} catch (err) {
				console.error(
					"[deadslog/system] Unexpected error during log write:",
					err,
				);
				reject(err);
			}
		}

		isProcessingQueue = false;
	};

	// File Writer
	const writeToFile = (message) => {
		if (!fileStream) {
			console.warn(
				"[deadslog/system] Attempted to write to log file but file stream is closed.",
			);
			return Promise.reject(new Error("File stream is closed."));
		}

		if (writeQueue.length >= MAX_QUEUE_SIZE) {
			return Promise.reject(
				new Error("Write queue is full. Log message dropped."),
			);
		}

		return new Promise((resolve, reject) => {
			writeQueue.push({ message, resolve, reject });
			processWriteQueue();
		});
	};

	const log = async (msgLevel, message) => {
		const msgLevelIndex = levelOrder.indexOf(msgLevel);
		if (msgLevelIndex < minLevelIndex) return;

		const formatted = formatter(msgLevel.toUpperCase(), message);

		if (consoleOutput.enabled) {
			const outputMessage = consoleOutput.coloredCoding
				? colorMap[msgLevel](formatted)
				: colorMap.default(formatted);
			console.log(outputMessage);
		}

		if (fileOutput.enabled) {
			await writeToFile(formatted);
		}
	};

	const loggerInstance = {
		trace: (msg) => log("trace", msg),
		debug: (msg) => log("debug", msg),
		info: (msg) => log("info", msg),
		success: (msg) => log("success", msg),
		warn: (msg) => log("warn", msg),
		error: (msg) => log("error", msg),
		fatal: (msg) => log("fatal", msg),
		flush: async () => {
			if (!fileStream || writeQueue.length === 0) return;

			const pendingWrites = [...writeQueue];
			writeQueue.length = 0;

			await Promise.allSettled(
				pendingWrites.map(async ({ message }) => {
					try {
						return await writeToFile(message);
					} catch (err) {
						console.error("[deadslog/system] Flush write error:", err);
					}
				}),
			);

			fileStream.end();
			fileStream = createWriteStreamWithRetry(logFilePath, {
				flags: "a",
			});
		},
		destroy: async () => {
			await loggerInstance.flush();
			if (fileStream) {
				fileStream.end();
				fileStream = null;
			}
			activeLoggers.delete(loggerInstance);
		},
	};

	activeLoggers.add(loggerInstance);
	attachGlobalCleanup();

	return loggerInstance;
};

export default deadslog;
