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
 * @typedef {"trace"|"debug"|"info"|"success"|"warn"|"error"|"fatal"} LogLevel
 */

/**
 * @typedef {"deleteOld"|"archiveOld"} RotationStrategy
 */

/**
 * @typedef {"drop"|"block"} QueueFullStrategy
 */

/**
 * Console output configuration.
 * @typedef {Object} ConsoleOutputConfig
 * @property {boolean} enabled Whether to log to console.
 * @property {boolean} [coloredCoding=true] Whether console output uses colors.
 */

/**
 * File output configuration.
 * @typedef {Object} FileOutputConfig
 * @property {boolean} enabled Whether to log to a file.
 * @property {string|null} logFilePath Path to the log file.
 *
 * @property {boolean} [rotate=false] Whether to rotate log files once they reach `maxLogSize`.
 * @property {number} [maxLogSize] Max file size (bytes) before rotation (required when `rotate` is true).
 * @property {number} [maxLogFiles] Max number of rotated files to keep (required when `rotate` is true).
 * @property {RotationStrategy} [onMaxLogFilesReached] Strategy when max rotated files is reached.
 *
 * @property {QueueFullStrategy} [onQueueFull="drop"] What to do when the internal write queue is full.
 *  - `"drop"`: reject immediately (message dropped; increments droppedMessages metric)
 *  - `"block"`: apply backpressure (wait until queue has room or until timeout)
 * @property {number} [queueFullTimeoutMs=5000] Max time to wait for queue space in `"block"` mode.
 * @property {number} [maxQueueSize=100000] Maximum number of queued file writes before `onQueueFull` applies.
 */

/**
 * Formatter function signature.
 *
 * Should return a single formatted log line (without a trailing newline).
 *
 * @callback LogFormatter
 * @param {string} level Uppercase level string (e.g. "INFO", "ERROR")
 * @param {any} message The message/payload to format
 * @returns {string}
 */

/**
 * Optional include/exclude filters applied to the *formatted* log line.
 * @typedef {Object} LogFilters
 * @property {string} [include] RegExp string. If provided, only matching lines are logged.
 * @property {string} [exclude] RegExp string. If provided, matching lines are skipped.
 */

/**
 * Logger configuration object.
 * @typedef {Object} LoggerConfig
 * @property {ConsoleOutputConfig} [consoleOutput]
 * @property {FileOutputConfig} [fileOutput]
 * @property {LogFormatter} [formatter]
 * @property {LogLevel} [minLevel="info"] Minimum level to log.
 * @property {LogFilters} [filters]
 */

/**
 * Metrics returned by `getMetrics()` when file output is enabled.
 * @typedef {Object} LoggerMetrics
 * @property {number} messagesLogged Total messages successfully written to file.
 * @property {number} bytesWritten Total bytes written to file (approx).
 * @property {number} queueHighWaterMark Max observed queue size.
 * @property {number} writeFailures Total file write failures (includes drops).
 * @property {number} averageWriteTime Moving average write latency in ms.
 * @property {number} rotations Number of file rotations performed.
 * @property {number} lastWriteTime Unix ms timestamp of last successful write.
 * @property {number} droppedMessages Number of dropped messages due to full queue (drop mode).
 * @property {string|null} lastFileError Last seen file-related error message (if any).
 * @property {number} currentFileBytes Current in-memory byte count for active log file.
 * @property {number} currentQueueSize Current queued writes waiting to be processed.
 * @property {boolean} isProcessingQueue Whether the queue worker is active.
 * @property {boolean} isRotating Whether rotation is in progress.
 */

/**
 * Logger instance returned by {@link deadslog}.
 *
 * Logging methods are fire-and-forget (they do not throw); internal failures are reported
 * via `getMetrics()` and internal console errors.
 *
 * Each log method supports variadic arguments like `console.log`.
 * Example: `logger.error("something failed", e, { requestId })`
 *
 * @typedef {Object} LoggerInstance
 * @property {(...args:any[]) => void} trace Log a trace-level message.
 * @property {(...args:any[]) => void} debug Log a debug-level message.
 * @property {(...args:any[]) => void} info Log an info-level message.
 * @property {(...args:any[]) => void} success Log a success-level message.
 * @property {(...args:any[]) => void} warn Log a warning-level message.
 * @property {(...args:any[]) => void} error Log an error-level message.
 * @property {(...args:any[]) => void} fatal Log a fatal-level message.
 * @property {() => Promise<void>} flush Wait until all queued writes (and in-flight log calls) complete.
 * @property {() => Promise<void>} destroy Flush and close the underlying file stream.
 * @property {() => (LoggerMetrics | string)} getMetrics Get file writer metrics, or a message if file output is disabled.
 */

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
const colorMap = {
	trace: (s) => greenBright(bgBlack(s)),
	debug: gray,
	info: blue,
	success: green,
	warn: yellow,
	error: red,
	fatal: (s) => bgWhite(red(s)),
	default: white,
};
const pad = (n, w = 2) => String(n).padStart(w, "0");
const timestampNow = () => {
	const now = new Date();
	return (
		`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
		`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.` +
		`${pad(now.getMilliseconds(), 3)}`
	);
};
const defaultFormatter = (level, message) =>
	`[${level}] [${timestampNow()}] - ${String(message)}`;
const assert = (cond, msg) => {
	if (!cond) throw new Error(msg);
};
const ignoreENOENT = (e) => {
	if (e?.code !== "ENOENT") throw e;
};

/**
 * Creates a logger instance.
 * @param {LoggerConfig} [config]
 * @returns {LoggerInstance}
 */
const deadslog = ({
	consoleOutput = { enabled: true, coloredCoding: true },
	fileOutput = { enabled: false },
	formatter = defaultFormatter,
	minLevel = "info",
	filters = {},
} = {}) => {
	// --- validate ---
	assert(
		!consoleOutput || typeof consoleOutput === "object",
		"consoleOutput must be an object.",
	);
	assert(
		typeof consoleOutput.enabled === "boolean",
		"consoleOutput.enabled must be a boolean.",
	);
	if (
		consoleOutput.enabled &&
		typeof consoleOutput.coloredCoding !== "undefined"
	) {
		assert(
			typeof consoleOutput.coloredCoding === "boolean",
			"consoleOutput.coloredCoding must be a boolean.",
		);
	}
	assert(
		!fileOutput || typeof fileOutput === "object",
		"fileOutput must be an object.",
	);
	assert(
		typeof fileOutput.enabled === "boolean",
		"fileOutput.enabled must be a boolean.",
	);
	if (fileOutput.enabled) {
		assert(
			fileOutput.logFilePath,
			"File logging is enabled but no log file path provided.",
		);
		assert(
			typeof fileOutput.logFilePath === "string",
			"fileOutput.logFilePath must be a string.",
		);
		const rotate = fileOutput.rotate ?? false;
		const onQueueFull = fileOutput.onQueueFull ?? "drop";
		const queueFullTimeoutMs = fileOutput.queueFullTimeoutMs ?? 5000;
		assert(typeof rotate === "boolean", "fileOutput.rotate must be a boolean.");
		assert(
			onQueueFull === "drop" || onQueueFull === "block",
			'fileOutput.onQueueFull must be "drop" or "block".',
		);
		assert(
			typeof queueFullTimeoutMs === "number" && queueFullTimeoutMs >= 0,
			"fileOutput.queueFullTimeoutMs must be a non-negative number.",
		);
		if (typeof fileOutput.maxQueueSize !== "undefined") {
			assert(
				typeof fileOutput.maxQueueSize === "number" &&
					Number.isFinite(fileOutput.maxQueueSize) &&
					fileOutput.maxQueueSize >= 1,
				"fileOutput.maxQueueSize must be a positive finite number.",
			);
		}
		if (rotate) {
			assert(
				typeof fileOutput.maxLogSize === "number" && fileOutput.maxLogSize >= 1,
				"Invalid maxLogSize value for file rotation.",
			);
			assert(
				typeof fileOutput.maxLogFiles === "number" &&
					fileOutput.maxLogFiles >= 1,
				"Invalid maxLogFiles value for file rotation.",
			);
			assert(
				typeof fileOutput.onMaxLogFilesReached === "string",
				"Invalid onMaxFilesReached for file rotation.",
			);
			assert(
				validStrategies.includes(fileOutput.onMaxLogFilesReached),
				`Invalid value for onMaxLogFilesReached: "${fileOutput.onMaxLogFilesReached}". ` +
					`Valid values are: ${validStrategies.join(", ")}.`,
			);
		}
	}
	if (typeof formatter !== "function") {
		console.warn("Formatter passed is not a function. Using default formatter");
		formatter = defaultFormatter;
	}
	assert(typeof minLevel === "string", "minLevel must be a string.");
	assert(
		levelOrder.includes(minLevel),
		`Invalid value for minLevel: ${minLevel}. Valid levels are: ${levelOrder.join(", ")}.`,
	);
	let includePattern = null;
	let excludePattern = null;
	if (typeof filters.include !== "undefined") {
		assert(
			typeof filters.include === "string",
			"filters.include must be a string.",
		);
		try {
			includePattern = new RegExp(filters.include);
		} catch (e) {
			throw new Error(`filters.include is not a valid RegExp: ${e.message}`);
		}
	}
	if (typeof filters.exclude !== "undefined") {
		assert(
			typeof filters.exclude === "string",
			"filters.exclude must be a string.",
		);
		try {
			excludePattern = new RegExp(filters.exclude);
		} catch (e) {
			throw new Error(`filters.exclude is not a valid RegExp: ${e.message}`);
		}
	}

	// initialization
	const minLevelIndex = levelOrder.indexOf(minLevel.toLowerCase());
	const rotate = fileOutput.enabled ? (fileOutput.rotate ?? false) : false;
	const logFilePath = fileOutput.enabled
		? resolve(fileOutput.logFilePath)
		: null;
	const maxLogSize = rotate ? fileOutput.maxLogSize : null;
	const onQueueFull = fileOutput.enabled
		? (fileOutput.onQueueFull ?? "drop")
		: "drop";
	const queueFullTimeoutMs = fileOutput.enabled
		? (fileOutput.queueFullTimeoutMs ?? 5000)
		: 5000;
	const maxQueueSize = fileOutput.enabled
		? (fileOutput.maxQueueSize ?? 100000)
		: 100000;
	let fileStream = null;
	let openPromise = null;
	const writeQueue = [];
	let queueHead = 0;
	let isProcessingQueue = false;
	let pendingLogs = 0;
	let isRotating = false;
	let currentFileBytes = 0;
	let lastFileError = null;
	let droppedMessages = 0;
	let queueWaiters = [];
	let fileSystemFailures = 0;
	const maxFileSystemFailures = 5;
	let isDestroyed = false;
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

	const buildPayloadFromArgs = (args) =>
		args
			.map((a) => {
				if (a instanceof Error) return a.stack || a.toString();
				if (a === null) return "null";
				if (a === undefined) return "undefined";
				if (typeof a === "bigint") return `${a}n`;
				if (typeof a === "string") return a;
				if (typeof a !== "object") return String(a);

				const seen = new WeakSet();
				try {
					return JSON.stringify(a, (_k, v) => {
						if (typeof v === "bigint") return `${v}n`;
						if (typeof v === "object" && v) {
							if (seen.has(v)) return "[Circular Reference]";
							seen.add(v);
						}
						return v;
					});
				} catch {
					return "[Non-serializable]";
				}
			})
			.join(" ");

	const getQueueLength = () => writeQueue.length - queueHead;

	const notifyQueueWaiters = () => {
		if (queueWaiters.length === 0) return;
		if (getQueueLength() < maxQueueSize) {
			const waiters = queueWaiters;
			queueWaiters = [];
			for (const w of waiters) w.resolve();
		}
	};

	const openFileStream = async () => {
		if (!fileOutput.enabled) return;
		if (fileStream && !fileStream.writableEnded) return;

		const logFileDir = dirname(logFilePath);
		await mkdir(logFileDir, { recursive: true });
		try {
			const st = await stat(logFilePath);
			currentFileBytes = st.size;
		} catch (e) {
			if (e?.code === "ENOENT") {
				await writeFile(logFilePath, "", "utf8");
				currentFileBytes = 0;
			} else {
				throw e;
			}
		}

		const stream = createWriteStream(logFilePath, { flags: "a" });
		stream.on("error", (e) => {
			lastFileError = e;
			fileSystemFailures++;
			console.error("[deadslog/system] Logging stream error");
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
				} catch (e) {
					lastFileError = e;
					throw e;
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
			streamToClose.end((e) => (e ? reject(e) : resolve()));
		});
	};

	const shiftRotatedFiles = async ({ dir, name, ext, max, suffix }) => {
		for (let i = max - 1; i >= 1; i--) {
			const src = join(dir, `${name}.${i}${ext}${suffix}`);
			const dest = join(dir, `${name}.${i + 1}${ext}${suffix}`);
			try {
				await rename(src, dest);
			} catch (e) {
				ignoreENOENT(e);
			}
		}
	};

	const rotateLogs = async (force = false) => {
		if (!rotate || isRotating || !logFilePath) return;

		isRotating = true;
		try {
			if (!force && currentFileBytes < maxLogSize) return;

			metrics.rotations++;
			await closeFileStream();

			const { dir, name, ext } = parse(logFilePath);

			if (fileOutput.onMaxLogFilesReached === "deleteOld") {
				const oldest = join(dir, `${name}.${fileOutput.maxLogFiles}${ext}`);
				try {
					await unlink(oldest);
				} catch (e) {
					ignoreENOENT(e);
				}

				await shiftRotatedFiles({
					dir,
					name,
					ext,
					max: fileOutput.maxLogFiles,
					suffix: "",
				});

				await rename(logFilePath, join(dir, `${name}.1${ext}`));
				await writeFile(logFilePath, "", "utf8");
				currentFileBytes = 0;
			} else {
				const oldest = join(dir, `${name}.${fileOutput.maxLogFiles}${ext}.gz`);
				try {
					await unlink(oldest);
				} catch (e) {
					ignoreENOENT(e);
				}

				await shiftRotatedFiles({
					dir,
					name,
					ext,
					max: fileOutput.maxLogFiles,
					suffix: ".gz",
				});

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
		} catch (e) {
			lastFileError = e;
			console.error("[deadslog/system] Error during log rotation");
			try {
				if (fileOutput.enabled && !fileStream) await ensureFileStream();
			} catch {
				console.error(
					"[deadslog/system] Failed to reopen stream after rotation",
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
						rotate &&
						currentFileBytes > 0 &&
						currentFileBytes + lineBytes >= maxLogSize
					)
						await rotateLogs(true);

					await ensureFileStream();
					if (!fileStream || fileStream.writableEnded) {
						fileSystemFailures++;
						lastFileError =
							lastFileError ?? new Error("File stream is closed.");
						reject(lastFileError);
						continue;
					}

					await new Promise((resolve, reject) => {
						fileStream.write(`${message}\n`, (e) =>
							e ? reject(e) : resolve(),
						);
					});

					fileSystemFailures = 0;
					currentFileBytes += lineBytes;
					writeMetrics(message);
					latencyMetrics(startTime);
					resolve();
				} catch (e) {
					lastFileError = e;
					fileSystemFailures++;
					metrics.writeFailures++;
					console.error("[deadslog/system] Error writing to log file");

					try {
						await closeFileStream();
					} catch {
						// ignore
					}

					reject(e);
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
			let timer = null;

			if (queueFullTimeoutMs > 0) {
				timer = setTimeout(() => {
					timer = null;
					reject(new Error("Timed out waiting for log queue space."));
				}, queueFullTimeoutMs);
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
			if (onQueueFull === "block") {
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
			processWriteQueue().catch((e) => {
				lastFileError = e;
				console.error("[deadslog/system] Queue processor failed");
			});
		});
	};

	const log = async (msgLevel, ...args) => {
		if (isDestroyed) return;

		pendingLogs++;
		try {
			const msgLevelIndex = levelOrder.indexOf(msgLevel);
			if (msgLevelIndex < minLevelIndex) return;

			const upperLevel = msgLevel.toUpperCase();
			const combinedMessage = buildPayloadFromArgs(args);
			const formatted = formatter(upperLevel, combinedMessage);

			if (excludePattern?.test(formatted)) return;
			if (includePattern && !includePattern.test(formatted)) return;

			if (consoleOutput.enabled) {
				if (consoleOutput.coloredCoding) {
					const colorFn = colorMap[msgLevel] || colorMap.default;
					const bracketedLevel = `[${upperLevel}]`;
					const coloredBracket = `[${colorFn(upperLevel)}]`;
					console.log(formatted.replace(bracketedLevel, coloredBracket));
				} else {
					console.log(formatted);
				}
			}

			if (!fileOutput.enabled) return;

			try {
				await ensureFileStream();
			} catch (e) {
				lastFileError = e;
				throw e;
			}

			const fileFormatted = formatted.replace(/\r?\n/g, "\\n");
			return enqueueWrite(fileFormatted, Date.now());
		} finally {
			pendingLogs--;
		}
	};

	const safe = (p) =>
		Promise.resolve(p).catch((e) => {
			lastFileError = e;
			console.error("[deadslog/system] Log write failed");
		});

	const LoggerInstance = {
		trace: (...args) => safe(log("trace", ...args)),
		debug: (...args) => safe(log("debug", ...args)),
		info: (...args) => safe(log("info", ...args)),
		success: (...args) => safe(log("success", ...args)),
		warn: (...args) => safe(log("warn", ...args)),
		error: (...args) => safe(log("error", ...args)),
		fatal: (...args) => safe(log("fatal", ...args)),
		flush: async () => {
			while (
				pendingLogs > 0 ||
				getQueueLength() > 0 ||
				isProcessingQueue ||
				isRotating
			)
				await new Promise((resolve) => setTimeout(resolve, 25));
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
