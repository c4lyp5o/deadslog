export default deadslog;
/**
 * Logger configuration object.
 */
export type LoggerConfig = {
    /**
     * - Configuration for console output.
     */
    consoleOutput: {
        enabled: boolean;
        coloredCoding: boolean;
    };
    /**
     * - Configuration for file output.
     */
    fileOutput: {
        enabled: boolean;
        logFilePath: string;
        rotate: boolean;
        maxLogSize: number;
        maxLogFiles: number;
        onMaxLogFilesReached: string;
    };
    /**
     * - Function to format log messages.
     */
    formatter: Function;
    /**
     * - Minimum log level to log.
     */
    minLevel: string;
    /**
     * - Configuration for filters.
     */
    filters: {
        include: string;
        exclude: string;
    };
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
declare function deadslog({ consoleOutput, fileOutput, formatter, minLevel, filters, }?: LoggerConfig): {
    /**
     * - Log a trace-level message.
     */
    trace: (msg: any) => void;
    /**
     * - Log a debug-level message.
     */
    debug: (msg: any) => void;
    /**
     * - Log an info-level message.
     */
    info: (msg: any) => void;
    /**
     * - Log a success-level message.
     */
    success: (msg: any) => void;
    /**
     * - Log a warning-level message.
     */
    warn: (msg: any) => void;
    /**
     * - Log an error-level message.
     */
    error: (msg: any) => void;
    /**
     * - Log a fatal-level message.
     */
    fatal: (msg: any) => void;
    /**
     * - Flush all queued log messages to file.
     */
    flush: () => Promise<void>;
    /**
     * - Clean up resources and close the logger.
     */
    destroy: () => Promise<void>;
    /**
     * - Get current file writing operations metrics of the logger.
     */
    getMetrics: (msg: any) => void;
};
