export default deadslog;
export type LogLevel = "trace" | "debug" | "info" | "success" | "warn" | "error" | "fatal";
export type RotationStrategy = "deleteOld" | "archiveOld";
export type QueueFullStrategy = "drop" | "block";
/**
 * Console output configuration.
 */
export type ConsoleOutputConfig = {
    /**
     * Whether to log to console.
     */
    enabled: boolean;
    /**
     * Whether console output uses colors.
     */
    coloredCoding?: boolean;
};
/**
 * File output configuration.
 */
export type FileOutputConfig = {
    /**
     * Whether to log to a file.
     */
    enabled: boolean;
    /**
     * Path to the log file.
     */
    logFilePath: string | null;
    /**
     * Whether to rotate log files once they reach `maxLogSize`.
     */
    rotate?: boolean;
    /**
     * Max file size (bytes) before rotation (required when `rotate` is true).
     */
    maxLogSize?: number;
    /**
     * Max number of rotated files to keep (required when `rotate` is true).
     */
    maxLogFiles?: number;
    /**
     * Strategy when max rotated files is reached.
     */
    onMaxLogFilesReached?: RotationStrategy;
    /**
     * What to do when the internal write queue is full.
     * - `"drop"`: reject immediately (message dropped; increments droppedMessages metric)
     * - `"block"`: apply backpressure (wait until queue has room or until timeout)
     */
    onQueueFull?: QueueFullStrategy;
    /**
     * Max time to wait for queue space in `"block"` mode.
     */
    queueFullTimeoutMs?: number;
    /**
     * Maximum number of queued file writes before `onQueueFull` applies.
     */
    maxQueueSize?: number;
};
/**
 * Formatter function signature.
 *
 * Should return a single formatted log line (without a trailing newline).
 */
export type LogFormatter = (level: string, message: any) => string;
/**
 * Optional include/exclude filters applied to the *formatted* log line.
 */
export type LogFilters = {
    /**
     * RegExp string. If provided, only matching lines are logged.
     */
    include?: string;
    /**
     * RegExp string. If provided, matching lines are skipped.
     */
    exclude?: string;
};
/**
 * Logger configuration object.
 */
export type LoggerConfig = {
    consoleOutput?: ConsoleOutputConfig;
    fileOutput?: FileOutputConfig;
    formatter?: LogFormatter;
    /**
     * Minimum level to log.
     */
    minLevel?: LogLevel;
    filters?: LogFilters;
};
/**
 * Metrics returned by `getMetrics()` when file output is enabled.
 */
export type LoggerMetrics = {
    /**
     * Total messages successfully written to file.
     */
    messagesLogged: number;
    /**
     * Total bytes written to file (approx).
     */
    bytesWritten: number;
    /**
     * Max observed queue size.
     */
    queueHighWaterMark: number;
    /**
     * Total file write failures (includes drops).
     */
    writeFailures: number;
    /**
     * Moving average write latency in ms.
     */
    averageWriteTime: number;
    /**
     * Number of file rotations performed.
     */
    rotations: number;
    /**
     * Unix ms timestamp of last successful write.
     */
    lastWriteTime: number;
    /**
     * Number of dropped messages due to full queue (drop mode).
     */
    droppedMessages: number;
    /**
     * Last seen file-related error message (if any).
     */
    lastFileError: string | null;
    /**
     * Current in-memory byte count for active log file.
     */
    currentFileBytes: number;
    /**
     * Current queued writes waiting to be processed.
     */
    currentQueueSize: number;
    /**
     * Whether the queue worker is active.
     */
    isProcessingQueue: boolean;
    /**
     * Whether rotation is in progress.
     */
    isRotating: boolean;
};
/**
 * Logger instance returned by {@link deadslog}.
 *
 * Logging methods are fire-and-forget (they do not throw); internal failures are reported
 * via `getMetrics()` and internal console errors.
 *
 * Each log method supports variadic arguments like `console.log`.
 * Example: `logger.error("something failed", e, { requestId })`
 */
export type LoggerInstance = {
    /**
     * Log a trace-level message.
     */
    trace: (...args: any[]) => void;
    /**
     * Log a debug-level message.
     */
    debug: (...args: any[]) => void;
    /**
     * Log an info-level message.
     */
    info: (...args: any[]) => void;
    /**
     * Log a success-level message.
     */
    success: (...args: any[]) => void;
    /**
     * Log a warning-level message.
     */
    warn: (...args: any[]) => void;
    /**
     * Log an error-level message.
     */
    error: (...args: any[]) => void;
    /**
     * Log a fatal-level message.
     */
    fatal: (...args: any[]) => void;
    /**
     * Wait until all queued writes (and in-flight log calls) complete.
     */
    flush: () => Promise<void>;
    /**
     * Flush and close the underlying file stream.
     */
    destroy: () => Promise<void>;
    /**
     * Get file writer metrics, or a message if file output is disabled.
     */
    getMetrics: () => (LoggerMetrics | string);
};
/**
 * Creates a logger instance.
 * @param {LoggerConfig} [config]
 * @returns {LoggerInstance}
 */
declare function deadslog({ consoleOutput, fileOutput, formatter, minLevel, filters, }?: LoggerConfig): LoggerInstance;
