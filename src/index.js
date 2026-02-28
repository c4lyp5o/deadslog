/**
 * A dead simple logger module for Node.js.
 * Provides console and file-based logging with support for log rotation, custom formatting, and colored output.
 *
 * @module deadslog
 */

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
import { createReadStream, createWriteStream } from "node:fs";
import { stat, unlink, rename, writeFile, mkdir } from "node:fs/promises";
import { parse, join, resolve, dirname } from "node:path";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";

/**
 * Default formatter function for log messages.
 * @param {string} level - The log level (e.g., "info", "error").
 * @param {any} message - The log message, which can be of any type.
 * @returns {string} - A formatted log message string.
 */
const defaultFormatter = (level, message) => {
	const now = new Date();

	const pad = (n, w = 2) => String(n).padStart(w, "0");
	const timestamp =
		`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
		`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.` +
		`${pad(now.getMilliseconds(), 3)}`;

	if (message instanceof Error) {
		const payload = {
			message: message.message,
			name: message.name,
			stack: message.stack,
			cause: message.cause,
		};
		return `[${level}] [${timestamp}] - ${JSON.stringify(payload)}`;
	}

	switch (typeof message) {
		case "undefined":
			return `[${level}] [${timestamp}] - [Message is undefined]`;
		case "object":
			if (message === null) {
				return `[${level}] [${timestamp}] - null`;
			}
			try {
				const cache = new Set();
				const stringified = JSON.stringify(message, (key, value) => {
					if (typeof value === "object" && value !== null) {
						if (cache.has(value)) return "[Circular Reference]";
						cache.add(value);
					}
					if (value instanceof Error) {
						return {
							message: value.message,
							name: value.name,
							stack: value.stack,
							cause: value.cause,
						};
					}
					return value;
				});

				return `[${level}] [${timestamp}] - ${stringified}`;
			} catch (err) {
				return `[${level}] [${timestamp}] - [Non-serializable object: ${err?.message ?? String(err)}]`;
			}
		default:
			return `[${level}] [${timestamp}] - ${message.toString()}`;
	}
};

// Constants
/**
 * Maximum size of the write queue.
 * @constant {number}
 */
const DEFAULT_MAX_QUEUE_SIZE = 100000;

/**
 * Valid strategies for handling max log files.
 * @constant {string[]}
 */
const validStrategies = ["deleteOld", "archiveOld"];

/**
 * Order of log levels.
 * @constant {string[]}
 */
const levelOrder = [
	"trace",
	"debug",
	"info",
	"success",
	"warn",
	"error",
	"fatal",
];

/**
 * Composes two functions to apply transformations.
 * @param {Function} f - The first function.
 * @param {Function} g - The second function.
 * @returns {Function} - A composed function.
 */
const compose = (f, g) => (x) => f(g(x));

/**
 * Map of log levels to their respective colors.
 * @constant {Object}
 */
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

/**
 * Logger configuration object.
 * @typedef {Object} LoggerConfig
 * @property {Object} consoleOutput - Configuration for console output.
 * @property {boolean} consoleOutput.enabled - Whether console output is enabled.
 * @property {boolean} consoleOutput.coloredCoding - Whether to use colored output in the console.
 * @property {Object} fileOutput - Configuration for file output.
 * @property {boolean} fileOutput.enabled - Whether file output is enabled.
 * @property {string} fileOutput.logFilePath - Path to the log file.
 * @property {boolean} fileOutput.rotate - Whether to rotate log files.
 * @property {number} fileOutput.maxLogSize - Maximum size of a log file before rotation.
 * @property {number} fileOutput.maxLogFiles - Maximum number of log files to retain.
 * @property {string} fileOutput.onMaxLogFilesReached - Strategy for handling max log files.
 * @property {string} fileOutput.onQueueFull - Strategy for handling a full write queue.
 * @property {number} fileOutput.queueFullTimeoutMs - Timeout in milliseconds for handling a full write queue.
 * @property {Function} formatter - Function to format log messages.
 * @property {string} minLevel - Minimum log level to log.
 * @property {Object} filters - Configuration for filters.
 * @property {string} filters.include - Word filter to include in log.
 * @property {string} filters.exclude - Word filter to exclude in log.
 */

/**
 * Creates a logger instance.
 * @param {LoggerConfig} config - Configuration for the logger.
 * @returns {LoggerInstance}
 */
const deadslog = ({
	consoleOutput = { enabled: true, coloredCoding: true },
	fileOutput = {
		enabled: false,
		logFilePath: null,
		rotate: null,
		maxLogSize: null,
		maxLogFiles: null,
		onMaxLogFilesReached: null,
		onQueueFull: "drop",
		queueFullTimeoutMs: 5000,
		maxQueueSize: undefined,
	},
	formatter = defaultFormatter,
	minLevel = "info",
	filters = {},
} = {}) => {
	// console output configuration
	if (consoleOutput && typeof consoleOutput !== "object")
		throw new Error("consoleOutput must be an object.");
	if (typeof consoleOutput.enabled !== "boolean")
		throw new Error("consoleOutput.enabled must be a boolean.");
	if (consoleOutput.enabled) {
		if (typeof consoleOutput.coloredCoding !== "undefined")
			if (typeof consoleOutput.coloredCoding !== "boolean")
				throw new Error("consoleOutput.coloredCoding must be a boolean.");
	}
	// file output configuration
	if (fileOutput && typeof fileOutput !== "object")
		throw new Error("fileOutput must be an object.");
	if (typeof fileOutput.enabled !== "boolean")
		throw new Error("fileOutput.enabled must be a boolean.");
	if (fileOutput.enabled) {
		if (!fileOutput.logFilePath)
			throw new Error("File logging is enabled but no log file path provided.");
		if (typeof fileOutput.logFilePath !== "string")
			throw new Error("fileOutput.logFilePath must be a string.");
		if (typeof fileOutput.rotate !== "undefined") {
			// rotate configuration
			if (typeof fileOutput.rotate !== "boolean")
				throw new Error("fileOutput.rotate must be a boolean.");
			if (
				typeof fileOutput.maxLogSize !== "number" ||
				fileOutput.maxLogSize < 1
			)
				throw new Error("Invalid maxLogSize value for file rotation.");
			if (
				typeof fileOutput.maxLogFiles !== "number" ||
				fileOutput.maxLogFiles < 1
			)
				throw new Error("Invalid maxLogFiles value for file rotation.");
			if (typeof fileOutput.onMaxLogFilesReached !== "string")
				throw new Error("Invalid onMaxFilesReached for file rotation.");
			if (!validStrategies.includes(fileOutput.onMaxLogFilesReached))
				throw new Error(
					`Invalid value for onMaxLogFilesReached: "${fileOutput.onMaxLogFilesReached}". ` +
						`Valid values are: ${validStrategies.join(", ")}.`,
				);
		}
		if (typeof fileOutput.onQueueFull !== "undefined") {
			if (
				fileOutput.onQueueFull !== "drop" &&
				fileOutput.onQueueFull !== "block"
			)
				throw new Error('fileOutput.onQueueFull must be "drop" or "block".');
		}
		if (typeof fileOutput.queueFullTimeoutMs !== "undefined") {
			if (
				typeof fileOutput.queueFullTimeoutMs !== "number" ||
				fileOutput.queueFullTimeoutMs < 0
			)
				throw new Error(
					"fileOutput.queueFullTimeoutMs must be a non-negative number.",
				);
		}
		if (typeof fileOutput.maxQueueSize !== "undefined") {
			if (
				typeof fileOutput.maxQueueSize !== "number" ||
				!Number.isFinite(fileOutput.maxQueueSize) ||
				fileOutput.maxQueueSize < 1
			) {
				throw new Error(
					"fileOutput.maxQueueSize must be a positive finite number.",
				);
			}
		}
	}
	// formatter configuration
	if (typeof formatter !== "function") {
		console.warn("Formatter passed is not a function. Using default formatter");
		formatter = defaultFormatter;
	}
	// minLevel configuration
	if (typeof minLevel !== "string")
		throw new Error("minLevel must be a string.");
	if (!levelOrder.includes(minLevel))
		throw new Error(
			`Invalid value for minLevel: ${minLevel}. Valid levels are: ${levelOrder.join(", ")}.`,
		);
	// filters configuration
	let includePattern = null;
	let excludePattern = null;
	if (typeof filters.include !== "undefined") {
		if (typeof filters.include !== "string")
			throw new Error("filters.include must be a string.");
		try {
			includePattern = new RegExp(filters.include);
		} catch (e) {
			throw new Error(`filters.include is not a valid RegExp: ${e.message}`);
		}
	}
	if (typeof filters.exclude !== "undefined") {
		if (typeof filters.exclude !== "string")
			throw new Error("filters.exclude must be a string.");
		try {
			excludePattern = new RegExp(filters.exclude);
		} catch (e) {
			throw new Error(`filters.exclude is not a valid RegExp: ${e.message}`);
		}
	}

	// initialization
	let logFilePath = null;
	let fileStream = null;
	let openPromise = null;

	let isRotating = false;
	let isProcessingQueue = false;

	const writeQueue = [];
	let queueHead = 0;

	let pendingLogs = 0;
	let isDestroyed = false;

	const minLevelIndex = levelOrder.indexOf(minLevel.toLowerCase());

	let fileSystemFailures = 0;
	const maxFileSystemFailures = 5;

	let currentFileBytes = 0;
	let lastFileError = null;
	let droppedMessages = 0;
	let queueWaiters = [];

	const maxQueueSize = fileOutput.enabled
		? (fileOutput.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE)
		: DEFAULT_MAX_QUEUE_SIZE;

	// metrics
	const metrics = {
		messagesLogged: 0,
		bytesWritten: 0,
		queueHighWaterMark: 0,
		writeFailures: 0,
		averageWriteTime: 0,
		rotations: 0,
		lastWriteTime: 0,
		writeLatencies: [],
		_writeLatencySum: 0,
	};

	const getQueueLength = () => writeQueue.length - queueHead;

	const notifyQueueWaiters = () => {
		if (queueWaiters.length === 0) return;
		const len = getQueueLength();
		if (len < maxQueueSize) {
			const waiters = queueWaiters;
			queueWaiters = [];
			for (const w of waiters) w.resolve();
		}
	};

	const openFileStream = async () => {
		if (!fileOutput.enabled) return;
		if (fileStream && !fileStream.writableEnded) return;

		logFilePath = resolve(fileOutput.logFilePath);
		const logFileDir = dirname(logFilePath);

		await mkdir(logFileDir, { recursive: true });
		try {
			const st = await stat(logFilePath);
			currentFileBytes = st.size;
		} catch (err) {
			if (err?.code === "ENOENT") {
				await writeFile(logFilePath, "", "utf8");
				currentFileBytes = 0;
			} else {
				throw err;
			}
		}

		const stream = createWriteStream(logFilePath, { flags: "a" });
		stream.on("error", (err) => {
			lastFileError = err;
			fileSystemFailures++;
			console.error("[deadslog/system] Logging stream error:", err);
		});

		fileStream = stream;
	};

	const ensureFileStream = async () => {
		if (!fileOutput.enabled) return;
		if (fileStream && !fileStream.writableEnded) return;

		if (!openPromise) {
			openPromise = (async () => {
				try {
					await openFileStream();
				} catch (err) {
					lastFileError = err;
					throw err;
				} finally {
					openPromise = null;
				}
			})();
		}

		return openPromise;
	};

	const closeFileStream = async () => {
		if (openPromise) await openPromise;
		if (!fileStream) return;
		const streamToClose = fileStream;
		fileStream = null;
		await new Promise((resolve, reject) => {
			streamToClose.end((err) => (err ? reject(err) : resolve()));
		});
	};

	const maybeRotateLogs = async () => {
		if (!fileOutput.enabled || !fileOutput.rotate) return;
		if (isRotating) return;
		if (!logFilePath) return;

		isRotating = true;
		try {
			if (currentFileBytes < fileOutput.maxLogSize) return;

			metrics.rotations++;

			await closeFileStream();

			const { dir, name, ext } = parse(logFilePath);

			if (fileOutput.onMaxLogFilesReached === "deleteOld") {
				const oldest = join(dir, `${name}.${fileOutput.maxLogFiles}${ext}`);
				try {
					await unlink(oldest);
				} catch (err) {
					if (err?.code !== "ENOENT") throw err;
				}

				for (let i = fileOutput.maxLogFiles - 1; i >= 1; i--) {
					const src = join(dir, `${name}.${i}${ext}`);
					const dest = join(dir, `${name}.${i + 1}${ext}`);
					try {
						await rename(src, dest);
					} catch (err) {
						if (err?.code !== "ENOENT") throw err;
					}
				}

				const newLogFile = join(dir, `${name}.1${ext}`);
				await rename(logFilePath, newLogFile);
				await writeFile(logFilePath, "", "utf8");
				currentFileBytes = 0;
			} else if (fileOutput.onMaxLogFilesReached === "archiveOld") {
				const oldest = join(dir, `${name}.${fileOutput.maxLogFiles}${ext}.gz`);
				try {
					await unlink(oldest);
				} catch (err) {
					if (err?.code !== "ENOENT") throw err;
				}

				for (let i = fileOutput.maxLogFiles - 1; i >= 1; i--) {
					const src = join(dir, `${name}.${i}${ext}.gz`);
					const dest = join(dir, `${name}.${i + 1}${ext}.gz`);
					try {
						await rename(src, dest);
					} catch (err) {
						if (err?.code !== "ENOENT") throw err;
					}
				}

				const compressedPath = join(dir, `${name}.1${ext}.gz`);
				await pipeline(
					createReadStream(logFilePath),
					createGzip(),
					createWriteStream(compressedPath),
				);

				await writeFile(logFilePath, "", "utf8");
				currentFileBytes = 0;
			}

			await ensureFileStream();
		} catch (err) {
			lastFileError = err;
			console.error("[deadslog/system] Error during log rotation:", err);
			try {
				if (fileOutput.enabled && !fileStream) await ensureFileStream();
			} catch (e) {
				console.error(
					"[deadslog/system] Failed to reopen stream after rotation:",
					e,
				);
			}
		} finally {
			isRotating = false;
		}
	};

	const writeMetrics = (message) => {
		metrics.messagesLogged++;
		metrics.bytesWritten += message.length + 1;
		metrics.queueHighWaterMark = Math.max(
			metrics.queueHighWaterMark,
			getQueueLength(),
		);
	};

	const latencyMetrics = (startTime) => {
		const latency = Date.now() - startTime;
		metrics.writeLatencies.push(latency);
		metrics._writeLatencySum += latency;
		if (metrics.writeLatencies.length > 100) {
			const removed = metrics.writeLatencies.shift();
			metrics._writeLatencySum -= removed;
		}
		metrics.averageWriteTime =
			metrics.writeLatencies.length === 0
				? 0
				: metrics._writeLatencySum / metrics.writeLatencies.length;

		metrics.lastWriteTime = Date.now();
	};

	const processWriteQueue = async () => {
		if (isProcessingQueue) return;
		isProcessingQueue = true;

		try {
			while (getQueueLength() > 0) {
				if (fileSystemFailures >= maxFileSystemFailures) {
					while (getQueueLength() > 0) {
						const item = writeQueue[queueHead++];
						item.reject(
							new Error(
								"Too many file system failures; logging disabled until stream recovers.",
							),
						);
					}
					writeQueue.length = 0;
					queueHead = 0;
					notifyQueueWaiters();
					break;
				}

				const { message, startTime, resolve, reject } = writeQueue[queueHead++];

				if (queueHead > 1024 && queueHead * 2 > writeQueue.length) {
					writeQueue.splice(0, queueHead);
					queueHead = 0;
				}

				try {
					const lineBytes = Buffer.byteLength(message, "utf8") + 1;

					if (
						fileOutput.rotate &&
						currentFileBytes + lineBytes >= fileOutput.maxLogSize
					) {
						currentFileBytes = fileOutput.maxLogSize; // ensure maybeRotateLogs triggers
						await maybeRotateLogs();
					}

					await ensureFileStream();
					if (!fileStream || fileStream.writableEnded) {
						fileSystemFailures++;
						lastFileError =
							lastFileError ?? new Error("File stream is closed.");
						reject(lastFileError);
						continue;
					}

					await new Promise((res, rej) => {
						fileStream.write(`${message}\n`, (err) => (err ? rej(err) : res()));
					});

					fileSystemFailures = 0;
					currentFileBytes += lineBytes;
					writeMetrics(message);
					latencyMetrics(startTime);
					resolve();
				} catch (err) {
					lastFileError = err;
					fileSystemFailures++;
					metrics.writeFailures++;
					console.error("[deadslog/system] Error writing to log file:", err);

					try {
						await closeFileStream();
					} catch {
						// ignore
					}

					reject(err);
					notifyQueueWaiters();
				}
			}
		} finally {
			isProcessingQueue = false;
			notifyQueueWaiters();
		}
	};

	const waitForQueueSpace = async () => {
		if (getQueueLength() < maxQueueSize) return;

		await new Promise((resolve, reject) => {
			const timeoutMs = fileOutput.queueFullTimeoutMs ?? 5000;
			let timer = null;

			if (timeoutMs > 0) {
				timer = setTimeout(() => {
					timer = null;
					reject(new Error("Timed out waiting for log queue space."));
				}, timeoutMs);
			}

			queueWaiters.push({
				resolve: () => {
					if (timer) clearTimeout(timer);
					resolve();
				},
			});
		});
	};

	const enqueueWrite = async (message, startTime) => {
		if (getQueueLength() >= maxQueueSize) {
			if (fileOutput.onQueueFull === "block") {
				await waitForQueueSpace();
			} else {
				droppedMessages++;
				metrics.writeFailures++;
				lastFileError =
					lastFileError ??
					new Error("Write queue is full. Log message dropped.");
				return Promise.reject(lastFileError);
			}
		}

		return new Promise((resolve, reject) => {
			writeQueue.push({ message, startTime, resolve, reject });
			processWriteQueue().catch((err) => {
				lastFileError = err;
				console.error("[deadslog/system] Queue processor failed:", err);
			});
		});
	};

	const log = async (msgLevel, message) => {
		if (isDestroyed) return;

		pendingLogs++;
		try {
			const msgLevelIndex = levelOrder.indexOf(msgLevel);
			if (msgLevelIndex < minLevelIndex) return;

			const upperLevel = msgLevel.toUpperCase();
			const formatted = formatter(upperLevel, message);

			if (excludePattern?.test(formatted)) return;
			if (includePattern && !includePattern.test(formatted)) return;

			if (consoleOutput.enabled) {
				if (consoleOutput.coloredCoding) {
					const colorFn = colorMap[msgLevel] || colorMap.default;
					const bracketedLevel = `[${upperLevel}]`;
					const coloredBracket = `[${colorFn(upperLevel)}]`;
					const outputMessage = formatted.replace(
						bracketedLevel,
						coloredBracket,
					);
					console.log(outputMessage);
				} else {
					console.log(formatted);
				}
			}

			if (!fileOutput.enabled) return;

			try {
				await ensureFileStream();
			} catch (err) {
				lastFileError = err;
				throw err;
			}

			const startTime = Date.now();
			return enqueueWrite(formatted, startTime);
		} finally {
			pendingLogs--;
		}
	};

	/**
	 * Logger instance with logging methods for various levels.
	 *
	 * @typedef {Object} LoggerInstance
	 * @property {(msg: any) => void} trace - Log a trace-level message.
	 * @property {(msg: any) => void} debug - Log a debug-level message.
	 * @property {(msg: any) => void} info - Log an info-level message.
	 * @property {(msg: any) => void} success - Log a success-level message.
	 * @property {(msg: any) => void} warn - Log a warning-level message.
	 * @property {(msg: any) => void} error - Log an error-level message.
	 * @property {(msg: any) => void} fatal - Log a fatal-level message.
	 * @property  {() => Promise<void>} flush - Flush all queued log messages to file.
	 * @property  {() => Promise<void>} destroy - Clean up resources and close the logger.
	 * @property {(msg: any) => void} getMetrics - Get current file writing operations metrics of the logger.
	 */

	const safe = (p) => {
		return Promise.resolve(p).catch((err) => {
			console.error("[deadslog/system] Log write failed:", err);
		});
	};

	const LoggerInstance = {
		trace: (msg) => safe(log("trace", msg)),
		debug: (msg) => safe(log("debug", msg)),
		info: (msg) => safe(log("info", msg)),
		success: (msg) => safe(log("success", msg)),
		warn: (msg) => safe(log("warn", msg)),
		error: (msg) => safe(log("error", msg)),
		fatal: (msg) => safe(log("fatal", msg)),
		flush: async () => {
			while (
				pendingLogs > 0 ||
				getQueueLength() > 0 ||
				isProcessingQueue ||
				isRotating
			) {
				await new Promise((resolve) => setTimeout(resolve, 25));
			}
		},
		destroy: async () => {
			if (isDestroyed) return;
			isDestroyed = true;
			await LoggerInstance.flush();
			await closeFileStream();
		},
		getMetrics: () => {
			if (!fileOutput.enabled)
				return "fileOutput is disabled. No metrics available";
			return {
				...metrics,
				currentQueueSize: getQueueLength(),
				isProcessingQueue,
				isRotating,
				droppedMessages,
				lastFileError: lastFileError
					? String(lastFileError?.message ?? lastFileError)
					: null,
				currentFileBytes,
			};
		},
	};

	return LoggerInstance;
};

export default deadslog;
