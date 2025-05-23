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
import { stat, unlink, rename, writeFile } from "node:fs/promises";
import { parse, join, resolve, dirname } from "node:path";
import { gzipSync } from "node:zlib";
import {
	existsWithRetry,
	statWithRetry,
	mkdirWithRetry,
	readFileWithRetry,
	writeFileWithRetry,
	createWriteStreamWithRetry,
} from "./utils/fileHelpers.js";

/**
 * Default formatter function for log messages.
 * @param {string} level - The log level (e.g., "info", "error").
 * @param {any} message - The log message, which can be of any type.
 * @returns {string} - A formatted log message string.
 */
const defaultFormatter = (level, message) => {
	const timestamp = new Date().toISOString();

	switch (typeof message) {
		case "undefined":
			return `[${level}] [${timestamp}] - [Message is undefined]`;
		case "object":
			if (message === null) {
				return `[${level}] [${timestamp}] - null`;
			}
			try {
				// Handle circular references
				const cache = new Set();
				const stringified = JSON.stringify(message, (key, value) => {
					if (typeof value === "object" && value !== null) {
						if (cache.has(value)) {
							return "[Circular Reference]";
						}
						cache.add(value);
					}

					// Special handling for Error objects
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
				return `[${level}] [${timestamp}] - [Non-serializable object: ${err.message}]`;
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
const MAX_QUEUE_SIZE = 100000;

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

// Global cleanup
/**
 * Whether the global cleanup has been attached.
 * @constant {boolean}
 */
let cleanupAttached = false;

/**
 * A set of active logger instances for cleanup.
 * @constant {Set<Object>}
 */
const activeLoggers = new Set();

/**
 * Attaches global cleanup handlers for logger instances.
 */
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
		// rotate configuration
		if (typeof fileOutput.rotate !== "undefined") {
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
	if (filters && typeof filters !== "object")
		throw new Error("filters must be an object.");
	if (typeof filters.include !== "undefined") {
		if (typeof filters.include !== "string")
			throw new Error("filters.include must be a string.");
	}
	if (typeof filters.exclude !== "undefined") {
		if (typeof filters.exclude !== "string")
			throw new Error("filters.exclude must be a string.");
	}

	// initialization
	let logFilePath = null;
	let fileStream = null;
	let fileSystemFailures = 0;
	let circuitOpen = false;
	const circuitResetTimeout = 30000;
	let isRotating = false;
	let isProcessingQueue = false;
	const writeQueue = [];
	const minLevelIndex = levelOrder.indexOf(minLevel.toLowerCase());
	const includePattern = filters.include ? new RegExp(filters.include) : null;
	const excludePattern = filters.exclude ? new RegExp(filters.exclude) : null;

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
	};

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

	const processWriteQueue = async () => {
		if (isProcessingQueue) return;
		isProcessingQueue = true;

		while (writeQueue.length > 0) {
			const { message, resolve, reject } = writeQueue.shift();
			if (fileOutput.rotate) await rotateLogs();
			try {
				if (!fileStream || fileStream.writableEnded) {
					console.warn(
						"[deadslog/system] Attempted to write to closed file stream.",
					);
					reject(new Error("File stream is closed."));
					continue;
				}

				fileStream.write(`${message}\n`, (err) => {
					if (err) {
						console.error("[deadslog/system] Error writing to log file:", err);
						fileSystemFailures++;

						if (fileSystemFailures >= 5) {
							circuitOpen = true;
							console.error(
								"[deadslog/system] Circuit breaker opened due to file system failures",
							);

							// Try to reset circuit after delay
							setTimeout(() => {
								console.info(
									"[deadslog/system] Attempting to reset circuit breaker",
								);
								circuitOpen = false;
								fileSystemFailures = 0;

								// Try to reopen the stream
								try {
									if (fileStream) fileStream.end();
									fileStream = createWriteStreamWithRetry(logFilePath, {
										flags: "a",
									});
									fileStream.on("error", (err) => {
										console.error(
											"[deadslog/system] Logging stream error:",
											err,
										);
										fileSystemFailures++;
									});
									console.info(
										"[deadslog/system] Circuit breaker reset successful",
									);
								} catch (err) {
									console.error(
										"[deadslog/system] Failed to reset circuit breaker:",
										err,
									);
									// Will try again on next write attempt
								}
							}, circuitResetTimeout); // Wait 30 seconds before resetting
						}

						reject(err);
						return;
					}
					fileSystemFailures = 0;
					resolve();
				});
			} catch (err) {
				console.error(
					"[deadslog/system] Unexpected error during log write:",
					err,
				);
				fileSystemFailures++;
				reject(err);
			}
		}

		isProcessingQueue = false;
	};

	const writeMetrics = (message) => {
		metrics.messagesLogged++;
		metrics.bytesWritten += message.length + 1;
		metrics.queueHighWaterMark = Math.max(
			metrics.queueHighWaterMark,
			writeQueue.length,
		);
	};

	const latencyMetrics = (startTime) => {
		const latency = Date.now() - startTime;
		metrics.writeLatencies.push(latency);
		if (metrics.writeLatencies.length > 100) {
			metrics.writeLatencies.shift();
		}
		metrics.averageWriteTime =
			metrics.writeLatencies.reduce((a, b) => a + b, 0) /
			metrics.writeLatencies.length;
		metrics.lastWriteTime = Date.now();
	};

	const writeToFile = (message, startTime) => {
		return new Promise((resolve, reject) => {
			writeQueue.push({
				message,
				resolve: () => {
					writeMetrics(message);
					latencyMetrics(startTime);
					resolve();
				},
				reject: (err) => {
					metrics.writeFailures++;
					reject(err);
				},
			});
			processWriteQueue();
		});
	};

	const log = async (msgLevel, message) => {
		const msgLevelIndex = levelOrder.indexOf(msgLevel);
		if (msgLevelIndex < minLevelIndex) return;

		const upperLevel = msgLevel.toUpperCase();
		const formatted = formatter(upperLevel, message);

		if (excludePattern?.test(formatted)) return;
		if (includePattern && !includePattern.test(formatted)) return;

		if (consoleOutput.enabled) {
			if (consoleOutput.coloredCoding) {
				const levelStr = upperLevel;
				const levelIndex = formatted.indexOf(levelStr);
				let outputMessage;
				if (levelIndex !== -1) {
					const before = formatted.slice(0, levelIndex);
					const after = formatted.slice(levelIndex + levelStr.length);
					const colorFn = colorMap[msgLevel] || colorMap.default;
					outputMessage = before + colorFn(levelStr) + after;
				} else {
					outputMessage = colorMap.default(formatted);
				}
				console.log(outputMessage);
			} else {
				console.log(formatted);
			}
		}

		if (fileOutput.enabled) {
			if (circuitOpen) {
				return Promise.reject(
					new Error("Circuit breaker open: Too many file system failures"),
				);
			}

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

			const startTime = Date.now();

			try {
				writeToFile(formatted, startTime);
			} catch (err) {
				console.error("[deadslog] Failed to write log to file:", err);
			}
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
	const LoggerInstance = {
		trace: (msg) => log("trace", msg),
		debug: (msg) => log("debug", msg),
		info: (msg) => log("info", msg),
		success: (msg) => log("success", msg),
		warn: (msg) => log("warn", msg),
		error: (msg) => log("error", msg),
		fatal: (msg) => log("fatal", msg),
		flush: async () => {
			if (!fileStream || LoggerInstance._isFlushing) return;
			LoggerInstance._isFlushing = true;
			try {
				while (writeQueue.length > 0) {
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
				}
			} finally {
				LoggerInstance._isFlushing = false;
			}
		},
		destroy: async () => {
			LoggerInstance._isDestroyed = true;
			if (LoggerInstance._isDestroyed) {
				try {
					await LoggerInstance.flush();
					if (fileStream) {
						await new Promise((resolve, reject) => {
							fileStream.end((err) => (err ? reject(err) : resolve()));
						});
						fileStream = null;
					}
					activeLoggers.delete(LoggerInstance);
				} catch (error) {
					console.error("[deadslog/system] Error during destroy:", error);
					throw error;
				} finally {
					LoggerInstance._isDestroyed = false;
				}
			}
		},
		getMetrics: () => {
			if (!fileOutput.enabled)
				return "fileOutput is disabled. No metrics available";
			return {
				...metrics,
				currentQueueSize: writeQueue.length,
				isProcessingQueue,
				isRotating,
				isFlushing: LoggerInstance._isFlushing || false,
			};
		},
	};

	activeLoggers.add(LoggerInstance);
	attachGlobalCleanup();

	return LoggerInstance;
};

export default deadslog;
