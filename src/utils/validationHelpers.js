// Helper functions for validation
const validateType = (key, value, expectedType, errorMessage) => {
	// biome-ignore lint/suspicious/useValidTypeof: returning only string as expectedType
	if (typeof value !== expectedType) {
		throw new Error(errorMessage || `${key} must be a ${expectedType}.`);
	}
};

const validateRequired = (key, value, errorMessage) => {
	if (!value) {
		throw new Error(errorMessage || `${key} is required.`);
	}
};

const validateBoolean = (key, value) => validateType(key, value, "boolean");

const validateNumber = (key, value, minValue) => {
	validateType(key, value, "number");
	if (value < minValue) {
		throw new Error(`${key} must be greater than or equal to ${minValue}.`);
	}
};

const validateString = (key, value) => validateType(key, value, "string");

const validateEnum = (key, value, validValues) => {
	if (!validValues.includes(value)) {
		throw new Error(
			`${key} must be one of: ${validValues.join(", ")}. Received: ${value}`,
		);
	}
};

// Main validation function
const validateConfig = (config) => {
	const {
		consoleOutput,
		fileOutput,
		formatter,
		minLevel,
		validStrategies,
		levelOrder,
	} = config;

	// Console output validation
	if (consoleOutput) {
		validateType(
			"consoleOutput",
			consoleOutput,
			"object",
			"Invalid consoleOutput configuration.",
		);
		if (consoleOutput.enabled !== undefined)
			validateBoolean("consoleOutput.enabled", consoleOutput.enabled);
		if (consoleOutput.coloredCoding !== undefined)
			validateBoolean(
				"consoleOutput.coloredCoding",
				consoleOutput.coloredCoding,
			);
	}

	// File output validation
	if (fileOutput) {
		validateType(
			"fileOutput",
			fileOutput,
			"object",
			"Invalid fileOutput configuration.",
		);
		if (fileOutput.enabled !== undefined) {
			validateBoolean("fileOutput.enabled", fileOutput.enabled);

			if (fileOutput.enabled) {
				validateRequired(
					"fileOutput.logFilePath",
					fileOutput.logFilePath,
					"File logging is enabled but no log file path provided.",
				);
				validateString("fileOutput.logFilePath", fileOutput.logFilePath);

				const logFilePath = resolve(fileOutput.logFilePath);
				const logFileDir = dirname(logFilePath);

				try {
					if (!existsWithRetry(logFileDir)) mkdirWithRetry(logFileDir);
					if (!statWithRetry(logFileDir).isDirectory()) {
						throw new Error(`Path ${logFileDir} is not a directory.`);
					}
					if (!existsWithRetry(logFilePath))
						writeFileWithRetry(logFilePath, "");
				} catch (err) {
					throw new Error(
						`Failed to initialize log file or directory: ${err.message}. Ensure the paths are valid and writable.`,
					);
				}
			}

			if (fileOutput.rotate) {
				validateBoolean("fileOutput.rotate", fileOutput.rotate);
				validateNumber("fileOutput.maxLogSize", fileOutput.maxLogSize, 1);
				validateNumber("fileOutput.maxLogFiles", fileOutput.maxLogFiles, 1);
				validateString(
					"fileOutput.onMaxLogFilesReached",
					fileOutput.onMaxLogFilesReached,
				);
				validateEnum(
					"fileOutput.onMaxLogFilesReached",
					fileOutput.onMaxLogFilesReached,
					validStrategies,
				);
			}
		}
	}

	// Formatter validation
	if (typeof formatter !== "function") {
		config.formatter = defaultFormatter;
	}

	// Log level validation
	validateString("minLevel", minLevel);
	validateEnum("minLevel", minLevel.toLowerCase(), levelOrder);
};

export default validateConfig;
