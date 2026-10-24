/**
 * A dead simple logger module for Node.js.
 * Provides console and file-based logging with support for log rotation, custom formatting, and colored output.
 *
 * @module deadslog
 */

import tty from "node:tty";
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
 * @property {boolean} [coloredCoding=false] Whether console output uses colors (on by default only when `consoleOutput` itself is omitted).
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
 * @property {RotationStrategy} [onMaxLogFilesReached] How rotated files are kept (required when `rotate` is true).
 *  Either way the oldest file is deleted once `maxLogFiles` is exceeded.
 *  - `"deleteOld"`: rotated files are kept as plain text (`app.1.log`, `app.2.log`, ...)
 *  - `"archiveOld"`: rotated files are gzipped (`app.1.log.gz`, `app.2.log.gz`, ...)
 *
 * @property {QueueFullStrategy} [onQueueFull="drop"] What to do when the internal write queue is full.
 *  - `"drop"`: drop the message silently (counted in `droppedMessages`)
 *  - `"block"`: apply backpressure (wait until queue has room or until timeout)
 * @property {number} [queueFullTimeoutMs=5000] Max time to wait for queue space in `"block"` mode; `0` waits indefinitely.
 * @property {number} [maxQueueSize=100000] Maximum number of queued file writes before `onQueueFull` applies.
 */

/**
 * Formatter function signature.
 *
 * Should return a single formatted log line (without a trailing newline).
 *
 * @callback LogFormatter
 * @param {string} level Uppercase level string (e.g. "INFO", "ERROR")
 * @param {string} message The log arguments, already serialized and joined with spaces
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
 * @property {number} bytesWritten Total bytes written to file.
 * @property {number} queueHighWaterMark Max observed queue size.
 * @property {number} writeFailures Messages that failed to reach the file (includes drops and circuit-breaker rejections).
 * @property {number} averageWriteTime Moving average write latency in ms.
 * @property {number[]} writeLatencies Most recent write latencies in ms (up to 100).
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
 * Logging methods are fire-and-forget: they never throw. They are typed `void` so un-awaited
 * calls stay lint-clean, but each returns a promise that never rejects.
 * Awaiting one waits until that line is written to file (or has failed). Internal failures
 * are reported via `getMetrics()` and internal console errors.
 *
 * After 5 consecutive messages fail to reach the file, file writes pause for 30 seconds
 * (messages are rejected and counted in `writeFailures`), then the next write is retried.
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
 * @property {() => Promise<void>} destroy Flush and close the underlying file stream. Log calls made afterwards are ignored.
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
// Honours NO_COLOR, FORCE_COLOR and TERM.
const hasColors = tty.WriteStream.prototype.hasColors?.() ?? false;
// SGR [open, close] pairs per level, innermost first.
const levelStyles = {
	trace: [
		[40, 49],
		[92, 39],
	],
	debug: [[90, 39]],
	info: [[34, 39]],
	success: [[32, 39]],
	warn: [[33, 39]],
	error: [[31, 39]],
	fatal: [
		[31, 39],
		[47, 49],
	],
};
const paint = (text, styles) =>
	hasColors
		? styles.reduce((s, [open, close]) => `\x1b[${open}m${s}\x1b[${close}m`, text)
		: text;
// Only the level word is colored, so every tag can be built once up front.
const levelTags = Object.fromEntries(
	levelOrder.map((level) => {
		const upper = level.toUpperCase();
		return [
			level,
			{
				upper,
				plain: `[${upper}]`,
				colored: `[${paint(upper, levelStyles[level])}]`,
			},
		];
	}),
);
const maxFileSystemFailures = 5;
const circuitResetMs = 30000;
const latencyWindow = 100;
const maxBatchBytes = 64 * 1024;
const pad = (n, w = 2) => String(n).padStart(w, "0");
// Bursts log many lines per millisecond, so the formatted string is reused until the clock moves.
let lastStampMs = -1;
let lastStamp = "";
const timestampNow = () => {
	const ms = Date.now();
	if (ms !== lastStampMs) {
		const now = new Date(ms);
		lastStampMs = ms;
		lastStamp =
			`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
			`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.` +
			`${pad(now.getMilliseconds(), 3)}`;
	}
	return lastStamp;
};
const defaultFormatter = (level, message) =>
	`[${level}] [${timestampNow()}] - ${String(message)}`;
const assert = (cond, msg) => {
	if (!cond) throw new Error(msg);
};
const isObject = (v) => v !== null && typeof v === "object";
const ignoreENOENT = (e) => {
	if (e?.code !== "ENOENT") throw e;
};

const stringifyArg = (a) => {
	if (a instanceof Error) return a.stack || a.toString();
	if (typeof a === "string") return a;
	if (typeof a === "bigint") return `${a}n`;
	if (!isObject(a)) return String(a);

	// Track only the current ancestor chain so shared (non-circular) references still serialize.
	const ancestors = [];
	try {
		return JSON.stringify(a, function (_k, v) {
			if (typeof v === "bigint") return `${v}n`;
			if (!isObject(v)) return v;
			while (ancestors.length > 0 && ancestors.at(-1) !== this) ancestors.pop();
			if (ancestors.includes(v)) return "[Circular Reference]";
			ancestors.push(v);
			return v;
		});
	} catch {
		return "[Non-serializable]";
	}
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
	assert(isObject(consoleOutput), "consoleOutput must be an object.");
	assert(
		typeof consoleOutput.enabled === "boolean",
		"consoleOutput.enabled must be a boolean.",
	);
	const colored = consoleOutput.coloredCoding ?? false;
	if (consoleOutput.enabled) {
		assert(
			typeof colored === "boolean",
			"consoleOutput.coloredCoding must be a boolean.",
		);
	}
	assert(isObject(fileOutput), "fileOutput must be an object.");
	assert(
		typeof fileOutput.enabled === "boolean",
		"fileOutput.enabled must be a boolean.",
	);
	const {
		rotate = false,
		onQueueFull = "drop",
		queueFullTimeoutMs = 5000,
		maxQueueSize = 100000,
		maxLogSize,
		maxLogFiles,
		onMaxLogFilesReached,
	} = fileOutput;
	if (fileOutput.enabled) {
		assert(
			fileOutput.logFilePath,
			"File logging is enabled but no log file path provided.",
		);
		assert(
			typeof fileOutput.logFilePath === "string",
			"fileOutput.logFilePath must be a string.",
		);
		assert(typeof rotate === "boolean", "fileOutput.rotate must be a boolean.");
		assert(
			onQueueFull === "drop" || onQueueFull === "block",
			'fileOutput.onQueueFull must be "drop" or "block".',
		);
		assert(
			typeof queueFullTimeoutMs === "number" && queueFullTimeoutMs >= 0,
			"fileOutput.queueFullTimeoutMs must be a non-negative number.",
		);
		assert(
			typeof maxQueueSize === "number" &&
				Number.isFinite(maxQueueSize) &&
				maxQueueSize >= 1,
			"fileOutput.maxQueueSize must be a positive finite number.",
		);
		if (rotate) {
			assert(
				typeof maxLogSize === "number" && maxLogSize >= 1,
				"Invalid maxLogSize value for file rotation.",
			);
			assert(
				typeof maxLogFiles === "number" && maxLogFiles >= 1,
				"Invalid maxLogFiles value for file rotation.",
			);
			assert(
				typeof onMaxLogFilesReached === "string",
				"Invalid onMaxFilesReached for file rotation.",
			);
			assert(
				validStrategies.includes(onMaxLogFilesReached),
				`Invalid value for onMaxLogFilesReached: "${onMaxLogFilesReached}". ` +
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
	assert(isObject(filters), "filters must be an object.");
	const compileFilter = (key) => {
		const source = filters[key];
		if (typeof source === "undefined") return null;
		assert(typeof source === "string", `filters.${key} must be a string.`);
		try {
			return new RegExp(source);
		} catch (e) {
			throw new Error(`filters.${key} is not a valid RegExp: ${e.message}`);
		}
	};
	const includePattern = compileFilter("include");
	const excludePattern = compileFilter("exclude");

	// initialization
	const minLevelIndex = levelOrder.indexOf(minLevel);
	const logFilePath = fileOutput.enabled
		? resolve(fileOutput.logFilePath)
		: null;
	let fileStream = null;
	let openPromise = null;
	const writeQueue = [];
	let queueHead = 0;
	// Queue slots promised to woken "block" waiters that have not pushed yet.
	let reservedSlots = 0;
	const queueWaiters = [];
	const inflight = new Set();
	let isProcessingQueue = false;
	let isRotating = false;
	let currentFileBytes = 0;
	let lastFileError = null;
	let droppedMessages = 0;
	let fileSystemFailures = 0;
	let circuitRetryAt = 0;
	let isDestroyed = false;
	let writeLatencySum = 0;
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

	const getQueueLength = () => writeQueue.length - queueHead;
	const isQueueFull = () =>
		queueWaiters.length > 0 ||
		getQueueLength() + reservedSlots >= maxQueueSize;

	const notifyQueueWaiters = () => {
		while (
			queueWaiters.length > 0 &&
			getQueueLength() + reservedSlots < maxQueueSize
		) {
			reservedSlots++;
			queueWaiters.shift()();
		}
	};

	const dequeue = () => {
		const item = writeQueue[queueHead++];
		if (queueHead === writeQueue.length) {
			writeQueue.length = 0;
			queueHead = 0;
		} else if (queueHead > 1024 && queueHead * 2 > writeQueue.length) {
			writeQueue.splice(0, queueHead);
			queueHead = 0;
		}
		notifyQueueWaiters();
		return item;
	};

	const openFileStream = async () => {
		await mkdir(dirname(logFilePath), { recursive: true });
		try {
			currentFileBytes = (await stat(logFilePath)).size;
		} catch (e) {
			ignoreENOENT(e);
			await writeFile(logFilePath, "", "utf8");
			currentFileBytes = 0;
		}

		const stream = createWriteStream(logFilePath, { flags: "a" });
		stream.on("error", (e) => {
			lastFileError = e;
			console.error("[deadslog/system] Logging stream error");
		});
		fileStream = stream;
	};

	const ensureFileStream = () => {
		// `writable` is false once the stream has ended, errored or been destroyed.
		if (fileStream?.writable) return;
		openPromise ??= openFileStream().finally(() => {
			openPromise = null;
		});
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

	const rotateLogs = async () => {
		isRotating = true;
		try {
			await closeFileStream();

			const { dir, name, ext } = parse(logFilePath);
			const suffix = onMaxLogFilesReached === "archiveOld" ? ".gz" : "";
			const rotatedPath = (i) => join(dir, `${name}.${i}${ext}${suffix}`);

			await unlink(rotatedPath(maxLogFiles)).catch(ignoreENOENT);
			for (let i = maxLogFiles - 1; i >= 1; i--) {
				await rename(rotatedPath(i), rotatedPath(i + 1)).catch(ignoreENOENT);
			}

			if (suffix) {
				await pipeline(
					createReadStream(logFilePath),
					createGzip(),
					createWriteStream(rotatedPath(1)),
				);
			} else {
				await rename(logFilePath, rotatedPath(1));
			}

			await writeFile(logFilePath, "", "utf8");
			currentFileBytes = 0;
			metrics.rotations++;
		} catch (e) {
			lastFileError = e;
			console.error("[deadslog/system] Error during log rotation");
		} finally {
			isRotating = false;
		}
	};

	const recordWrite = (bytes, latency, now) => {
		metrics.messagesLogged++;
		metrics.bytesWritten += bytes;
		metrics.lastWriteTime = now;
		metrics.writeLatencies.push(latency);
		writeLatencySum += latency;
		if (metrics.writeLatencies.length > latencyWindow) {
			writeLatencySum -= metrics.writeLatencies.shift();
		}
		metrics.averageWriteTime = writeLatencySum / metrics.writeLatencies.length;
	};

	const recordFailure = (e, count) => {
		lastFileError = e;
		metrics.writeFailures += count;
		fileSystemFailures += count;
		if (fileSystemFailures >= maxFileSystemFailures) {
			circuitRetryAt = Date.now() + circuitResetMs;
		}
	};

	// After too many consecutive failures, reject writes until the cooldown passes;
	// the next write after that is a trial that either resets or re-opens the circuit.
	const isCircuitOpen = () =>
		fileSystemFailures >= maxFileSystemFailures && Date.now() < circuitRetryAt;

	// Takes as many queued lines as fit in one write without crossing the rotation limit.
	const takeBatch = () => {
		const batch = [];
		let bytes = 0;
		while (getQueueLength() > 0 && bytes < maxBatchBytes) {
			const next = writeQueue[queueHead].bytes;
			if (
				batch.length > 0 &&
				rotate &&
				currentFileBytes + bytes + next >= maxLogSize
			)
				break;
			batch.push(dequeue());
			bytes += next;
		}
		return batch;
	};

	const writeBatch = (batch) => {
		let chunk = "";
		for (const { message } of batch) chunk += `${message}\n`;
		return new Promise((resolve, reject) => {
			fileStream.write(chunk, (e) => (e ? reject(e) : resolve()));
		});
	};

	const processWriteQueue = async () => {
		isProcessingQueue = true;

		try {
			while (getQueueLength() > 0) {
				if (isCircuitOpen()) {
					metrics.writeFailures++;
					dequeue().reject(
						new Error(
							"Too many file system failures; logging paused until the circuit breaker resets.",
						),
					);
					continue;
				}

				let batch = [];
				try {
					await ensureFileStream();
					if (
						rotate &&
						currentFileBytes > 0 &&
						currentFileBytes + writeQueue[queueHead].bytes >= maxLogSize
					) {
						await rotateLogs();
						await ensureFileStream();
					}
					if (!fileStream?.writable)
						throw new Error("File stream is not writable.");

					batch = takeBatch();
					await writeBatch(batch);

					fileSystemFailures = 0;
					const now = Date.now();
					for (const item of batch) {
						currentFileBytes += item.bytes;
						recordWrite(item.bytes, now - item.startTime, now);
						item.resolve();
					}
				} catch (e) {
					if (batch.length === 0) batch = [dequeue()];
					recordFailure(e, batch.length);
					console.error("[deadslog/system] Error writing to log file");
					await closeFileStream().catch(() => {});
					for (const item of batch) item.reject(e);
				}
			}
		} finally {
			isProcessingQueue = false;
		}
	};

	const waitForQueueSpace = () =>
		new Promise((resolve, reject) => {
			let timer = null;
			const waiter = () => {
				clearTimeout(timer);
				resolve();
			};

			if (queueFullTimeoutMs > 0) {
				timer = setTimeout(() => {
					queueWaiters.splice(queueWaiters.indexOf(waiter), 1);
					reject(new Error("Timed out waiting for log queue space."));
				}, queueFullTimeoutMs);
			}

			queueWaiters.push(waiter);
		});

	const pushWrite = (message, startTime) =>
		new Promise((resolve, reject) => {
			writeQueue.push({
				message,
				bytes: Buffer.byteLength(message, "utf8") + 1,
				startTime,
				resolve,
				reject,
			});
			metrics.queueHighWaterMark = Math.max(
				metrics.queueHighWaterMark,
				getQueueLength(),
			);
			if (isProcessingQueue) return;
			processWriteQueue().catch((e) => {
				lastFileError = e;
				console.error("[deadslog/system] Queue processor failed");
			});
		});

	const enqueueWrite = (message, startTime) => {
		if (!isQueueFull()) return pushWrite(message, startTime);
		if (onQueueFull !== "block") {
			droppedMessages++;
			metrics.writeFailures++;
			return Promise.reject(
				new Error("Write queue is full. Log message dropped."),
			);
		}
		return waitForQueueSpace().then(() => {
			reservedSlots--;
			return pushWrite(message, startTime);
		});
	};

	const done = Promise.resolve();

	const onLogError = (e) => {
		lastFileError = e;
		console.error("[deadslog/system] Log write failed");
	};

	// File writes are tracked until they settle, so flush() can simply await them.
	const track = (p) => {
		const tracked = p.then(
			() => {
				inflight.delete(tracked);
			},
			(e) => {
				inflight.delete(tracked);
				onLogError(e);
			},
		);
		inflight.add(tracked);
		return tracked;
	};

	// Formatting and console output are synchronous; only file writes allocate promises.
	const log = (level, args) => {
		if (isDestroyed) return done;

		const tag = levelTags[level];
		let formatted;
		try {
			formatted = formatter(
				tag.upper,
				args.length === 1
					? stringifyArg(args[0])
					: args.map(stringifyArg).join(" "),
			);

			if (excludePattern?.test(formatted)) return done;
			if (includePattern && !includePattern.test(formatted)) return done;

			if (consoleOutput.enabled) {
				console.log(
					colored ? formatted.replace(tag.plain, tag.colored) : formatted,
				);
			}
		} catch (e) {
			onLogError(e);
			return done;
		}

		if (!fileOutput.enabled) return done;
		const line = formatted.includes("\n")
			? formatted.replace(/\r?\n/g, "\\n")
			: formatted;
		return track(enqueueWrite(line, Date.now()));
	};

	const skip = () => done;
	const levelMethods = Object.fromEntries(
		levelOrder.map((level, i) => [
			level,
			i < minLevelIndex ? skip : (...args) => log(level, args),
		]),
	);

	const LoggerInstance = {
		...levelMethods,
		flush: async () => {
			while (inflight.size > 0) await Promise.all(inflight);
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
				writeLatencies: [...metrics.writeLatencies],
				currentQueueSize: getQueueLength(),
				isProcessingQueue,
				isRotating,
				droppedMessages,
				lastFileError: lastFileError
					? String(lastFileError.message ?? lastFileError)
					: null,
				currentFileBytes,
			};
		},
	};

	return LoggerInstance;
};

export default deadslog;
