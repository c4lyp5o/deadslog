import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";

const deadslog = ({ logFilePath = null } = {}) => {
	let logToFile = false;
	let fileStream = null;
	if (logFilePath) {
		const invalidChars = [
			"/",
			"..",
			"~",
			" ",
			"`",
			"$",
			"&",
			"|",
			";",
			"!",
			"@",
			"#",
			"%",
			"^",
			"*",
		];
		for (const char of invalidChars) {
			if (logFilePath.includes(char)) {
				throw new Error(`File path contains invalid character: ${char}`);
			}
		}
		const dir = path.dirname(logFilePath);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
		if (!fs.existsSync(logFilePath)) {
			fs.writeFileSync(logFilePath, "", "utf8");
		}
		logToFile = true;
		fileStream = fs.createWriteStream(logFilePath, { flags: "a" });
	}

	const writeToFile = (message) => {
		if (logToFile && fileStream) {
			fileStream.write(`${message}\n`);
		}
	};

	const loggerInstance = {
		info: (message) => {
			const logMessage = chalk.blue(
				`[INFO] [${new Date().toISOString()}] ${message}`,
			);
			console.log(logMessage);
			writeToFile(logMessage);
		},
		warn: (message) => {
			const logMessage = chalk.yellow(
				`[WARN] [${new Date().toISOString()}] ${message}`,
			);
			console.log(logMessage);
			writeToFile(logMessage);
		},
		error: (message) => {
			const logMessage = chalk.red(
				`[ERROR] [${new Date().toISOString()}] ${message}`,
			);
			console.log(logMessage);
			writeToFile(logMessage);
		},
		destroy: () => {
			if (fileStream) {
				fileStream.end();
			}
		},
	};

	process.on("SIGINT", () => {
		if (loggerInstance) {
			loggerInstance.destroy();
		}
		process.exit();
	});

	return loggerInstance;
};

export default deadslog;
