import { describe, it, expect, afterEach, afterAll, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import deadslog from "../index.js";

const mainTestDir = path.join(process.cwd(), "test", "logtest");
const tempDir = path.join(process.cwd(), "test", "logtest", "test1");
const tempDir2 = path.join(process.cwd(), "test", "logtest", "test2");
const tempDir3 = path.join(process.cwd(), "test", "logtest", "test3");
const tempDir4 = path.join(process.cwd(), "test", "logtest", "test4");
const tempDir5 = path.join(process.cwd(), "test", "logtest", "test5");
const tempDir6 = path.join(process.cwd(), "test", "logtest", "test6");
const tempDir7 = path.join(process.cwd(), "test", "logtest", "test7");
const tempDir8 = path.join(process.cwd(), "test", "logtest", "test8");
const tempDir9 = path.join(process.cwd(), "test", "logtest", "test9");
const tempDir10 = path.join(process.cwd(), "test", "logtest", "test10");
const tempDir11 = path.join(process.cwd(), "test", "logtest", "test11");

const logFilePath = path.join(tempDir, "test-output.log");
const logFilePath2 = path.join(tempDir2, "test-output.log");
const logFilePath3 = path.join(tempDir3, "test-output.log");
const logFilePath4 = path.join(tempDir4, "test-output.log");
const logFilePath5 = path.join(tempDir5, "test-output.log");
const logFilePath6 = path.join(tempDir6, "test-output.log");
const logFilePath7 = path.join(tempDir7, "test-output.log");
const logFilePath8 = path.join(tempDir8, "test-output.log");
const logFilePath9 = path.join(tempDir9, "test-output.log");
const logFilePath10 = path.join(tempDir10, "test-output.log");
const logFilePath11 = path.join(tempDir11, "test-output.log");

afterEach(async () => {
	vi.restoreAllMocks();
});

afterAll(async () => {
	try {
		if (fs.existsSync(mainTestDir)) {
			await fs.promises.rm(mainTestDir, { recursive: true });
		}
	} catch (err) {
		console.error("Error during test cleanup:", err);
	}
});

describe("deadslog tests", () => {
	it("logs to console if called without config", () => {
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});
		const log = deadslog();

		log.debug("Hidden debug message");
		log.info("Hello, world!");

		expect(spy).not.toHaveBeenCalledWith(expect.stringMatching(/\[DEBUG\]/));
		expect(spy).toHaveBeenCalledWith(
			expect.stringMatching(/\[INFO\].* Hello, world!/),
		);
	});

	it("logs to console if console output is enabled", () => {
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});
		const log = deadslog({
			consoleOutput: { enabled: true, coloredCoding: false },
			minLevel: "info",
		});

		log.debug("Hidden debug message");
		log.info("Hello, world!");

		expect(spy).not.toHaveBeenCalledWith(expect.stringMatching(/\[DEBUG\]/));
		expect(spy).toHaveBeenCalledWith(
			expect.stringMatching(/\[INFO\].* Hello, world!/),
		);
	});

	it("handles undefined messages gracefully", () => {
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});
		const log = deadslog({ consoleOutput: { enabled: true } });

		log.info(undefined);

		expect(spy).toHaveBeenCalledWith(
			expect.stringContaining("[Message is undefined]"),
		);

		log.destroy();
	});

	it("handles non-stringifiable objects gracefully", () => {
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});
		const log = deadslog({ consoleOutput: { enabled: true } });

		const circularObject = {};
		circularObject.circularRef = circularObject;

		log.info(circularObject);

		expect(spy).toHaveBeenCalledWith(
			expect.stringContaining("[Non-serializable object]"),
		);

		log.destroy();
	});

	it("formats a string message correctly", () => {
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});
		const log = deadslog({ consoleOutput: { enabled: true } });

		log.info("Test string message");

		expect(spy).toHaveBeenCalledWith(
			expect.stringContaining("Test string message"),
		);

		log.destroy();
	});

	it("uses custom formatter when provided", async () => {
		const log = deadslog({
			consoleOutput: { enabled: true },
			minLevel: "info",
			formatter: (level, message) =>
				`CUSTOM: ${level.toUpperCase()} - ${message}`,
		});

		const spy = vi.spyOn(console, "log").mockImplementation(() => {});
		log.info("Formatted!");

		expect(spy.mock.calls[0][0]).toMatch(/CUSTOM: INFO - Formatted!/);

		await log.destroy();
	});

	it("supports all log levels", () => {
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});
		const log = deadslog({
			minLevel: "trace",
			consoleOutput: { enabled: true, coloredCoding: false },
		});

		log.trace("Trace");
		log.debug("Debug");
		log.info("Info");
		log.warn("Warn");
		log.error("Error");
		log.fatal("Fatal");

		expect(spy).toHaveBeenCalledWith(
			expect.stringMatching(/\[TRACE\].* Trace/),
		);
		expect(spy).toHaveBeenCalledWith(
			expect.stringMatching(/\[DEBUG\].* Debug/),
		);
		expect(spy).toHaveBeenCalledWith(expect.stringMatching(/\[INFO\].* Info/));
		expect(spy).toHaveBeenCalledWith(expect.stringMatching(/\[WARN\].* Warn/));
		expect(spy).toHaveBeenCalledWith(
			expect.stringMatching(/\[ERROR\].* Error/),
		);
		expect(spy).toHaveBeenCalledWith(
			expect.stringMatching(/\[FATAL\].* Fatal/),
		);

		log.destroy();
	});

	it("ignores logs below minLevel in both console and file", async () => {
		const log = deadslog({
			minLevel: "error",
			consoleOutput: { enabled: true },
			fileOutput: { enabled: true, logFilePath: logFilePath2 },
		});

		const spy = vi.spyOn(console, "log").mockImplementation(() => {});
		log.warn("This should be ignored");
		log.error("This should appear");

		await new Promise((r) => setTimeout(r, 10));
		await log.destroy();

		const contents = fs.readFileSync(logFilePath2, "utf8");
		expect(contents).toMatch(/This should appear/);
		expect(contents).not.toMatch(/This should be ignored/);
		expect(spy).toHaveBeenCalledWith(
			expect.stringMatching(/This should appear/),
		);
		expect(spy).not.toHaveBeenCalledWith(
			expect.stringMatching(/This should be ignored/),
		);
	});

	it("writes to file if file output is enabled", async () => {
		const log = deadslog({
			consoleOutput: { enabled: false },
			fileOutput: { enabled: true, logFilePath },
		});

		log.info("File test message");

		await new Promise((resolve) => setTimeout(resolve, 10));
		await log.destroy();

		const contents = fs.readFileSync(logFilePath, "utf8");
		expect(contents).toMatch(/File test message/);
	});

	it("rotates when max file size is reached", async () => {
		const log = deadslog({
			consoleOutput: { enabled: false },
			fileOutput: {
				enabled: true,
				logFilePath: logFilePath3,
				rotate: true,
				maxLogSize: 50,
				maxLogFiles: 2,
				onMaxLogFilesReached: "deleteOld",
			},
		});

		log.info("Message 1");
		log.info("Message 2");
		log.info("Message 3");
		log.info("Message 4");
		log.info("Message 3");

		await new Promise((resolve) => setTimeout(resolve, 50));
		await log.destroy();

		expect(fs.existsSync(path.join(tempDir3, "test-output.1.log"))).toBe(true);
	});

	it("deletes old logs when max log files are reached", async () => {
		const log = deadslog({
			consoleOutput: { enabled: false },
			fileOutput: {
				enabled: true,
				logFilePath: logFilePath4,
				rotate: true,
				maxLogSize: 50,
				maxLogFiles: 2,
				onMaxLogFilesReached: "deleteOld",
			},
		});

		log.info("Message 1");
		log.info("Message 2");
		log.info("Message 3");
		log.info("Message 4");
		log.info("Message 5");
		log.info("Message 6");
		log.info("Message 7");
		log.info("Message 8");
		log.info("Message 9");
		log.info("Message 10");

		await new Promise((resolve) => setTimeout(resolve, 50));
		await log.destroy();

		// Check that only 2 files exist
		expect(fs.existsSync(path.join(tempDir4, "test-output.1.log"))).toBe(true);
		expect(fs.existsSync(path.join(tempDir4, "test-output.2.log"))).toBe(true);
	});

	it("archives old logs when max log files are reached", async () => {
		const log = deadslog({
			consoleOutput: { enabled: false },
			fileOutput: {
				enabled: true,
				logFilePath: logFilePath5,
				rotate: true,
				maxLogSize: 50,
				maxLogFiles: 2,
				onMaxLogFilesReached: "archiveOld",
			},
		});

		log.info("Log for compression");
		log.info("Log for compression");
		log.info("Log for compression");
		log.info("Log for compression");
		log.info("Log for compression");

		await new Promise((resolve) => setTimeout(resolve, 50));
		await log.destroy();

		expect(fs.existsSync(path.join(tempDir5, "test-output.1.log.gz"))).toBe(
			true,
		);
	});

	it("should rotate and gzip old log files synchronously", async () => {
		const logger = deadslog({
			consoleOutput: { enabled: false },
			fileOutput: {
				enabled: true,
				logFilePath: logFilePath11,
				rotate: true,
				maxLogSize: 50, // small for quick rotation
				maxLogFiles: 2,
				onMaxLogFilesReached: "archiveOld",
			},
		});

		// Write many log entries to exceed size threshold
		for (let i = 0; i < 50; i++) {
			await logger.info("A".repeat(10));
		}

		await logger.destroy();

		// Check the rotated and compressed files exist
		const rotated1 = path.join(tempDir11, "test-output.1.log.gz");
		const rotated2 = path.join(tempDir11, "test-output.2.log.gz");

		expect(fs.existsSync(rotated1)).toBe(true);
		expect(fs.existsSync(rotated2)).toBe(true);

		// Check original file is recreated and writable
		expect(fs.existsSync(logFilePath11)).toBe(true);
		expect(() => fs.appendFileSync(logFilePath11, "more logs")).not.toThrow();
	});

	it("flushes queued logs on destroy", async () => {
		const log = deadslog({
			consoleOutput: { enabled: false },
			fileOutput: { enabled: true, logFilePath: logFilePath6 },
		});

		// Log several messages quickly
		for (let i = 0; i < 10; i++) log.info(`Flush test ${i}`);

		await new Promise((resolve) => setTimeout(resolve, 50));
		await log.destroy();

		const contents = fs.readFileSync(logFilePath6, "utf8");
		expect(contents).toMatch(/Flush test 9/);
	});

	it("flushes all logs before destroy is complete", async () => {
		const log = deadslog({
			consoleOutput: { enabled: false },
			fileOutput: { enabled: true, logFilePath: logFilePath10 },
		});

		// Log multiple messages
		for (let i = 0; i < 5; i++) {
			log.info(`Flush test message ${i}`);
		}

		// Destroy and wait for flush
		await new Promise((resolve) => setTimeout(resolve, 50));
		await log.destroy();

		const contents = fs.readFileSync(logFilePath10, "utf8");
		for (let i = 0; i < 5; i++) {
			expect(contents).toMatch(new RegExp(`Flush test message ${i}`));
		}
	});

	it("handles multiple loggers writing concurrently", async () => {
		const log1 = deadslog({
			consoleOutput: { enabled: false },
			fileOutput: { enabled: true, logFilePath: logFilePath7 },
		});
		const log2 = deadslog({
			consoleOutput: { enabled: false },
			fileOutput: { enabled: true, logFilePath: logFilePath7 },
		});

		// Simulate concurrent logging
		log1.info("Message from logger 1");
		log2.info("Message from logger 2");

		await new Promise((resolve) => setTimeout(resolve, 50));
		await log1.destroy();
		await log2.destroy();

		const contents = fs.readFileSync(logFilePath7, "utf8");
		expect(contents).toMatch(/Message from logger 1/);
		expect(contents).toMatch(/Message from logger 2/);
	});

	it("handles high throughput logging without crashing", async () => {
		const log = deadslog({
			consoleOutput: { enabled: false },
			fileOutput: { enabled: true, logFilePath: logFilePath8 },
		});

		const logMessages = Array(1000).fill("High throughput test message");

		// Simulate high throughput logging
		// biome-ignore lint/complexity/noForEach: prefer forEach for testing
		logMessages.forEach((msg) => log.info(msg));

		await new Promise((resolve) => setTimeout(resolve, 50));
		await log.destroy();

		const contents = fs.readFileSync(logFilePath8, "utf8");
		expect(contents).toMatch(/High throughput test message/);
	});

	it("handles log rotation during high throughput", async () => {
		const log = deadslog({
			consoleOutput: { enabled: false },
			fileOutput: {
				enabled: true,
				logFilePath: logFilePath9,
				rotate: true,
				maxLogSize: 50,
				maxLogFiles: 2,
				onMaxLogFilesReached: "archiveOld",
			},
		});

		// Generate enough logs to exceed max log size and trigger rotation
		for (let i = 0; i < 100; i++) {
			log.info(`High throughput message ${i}`);
		}

		await new Promise((resolve) => setTimeout(resolve, 50));
		await log.destroy();

		// Check if rotation occurred and archived logs exist
		expect(fs.existsSync(path.join(tempDir9, "test-output.1.log.gz"))).toBe(
			true,
		);
	});
});
