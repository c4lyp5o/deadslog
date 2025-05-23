import { describe, it, expect, afterEach, afterAll, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import deadslog from "../src/index.js";

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
const tempDir12 = path.join(process.cwd(), "test", "logtest", "test12");
const tempDir13 = path.join(process.cwd(), "test", "logtest", "test13");
const tempDir14 = path.join(process.cwd(), "test", "logtest", "test14");
const tempDir15 = path.join(process.cwd(), "test", "logtest", "test15");
const tempDir16 = path.join(process.cwd(), "test", "logtest", "test16");
const tempDir17 = path.join(process.cwd(), "test", "logtest", "test17");
const tempDir18 = path.join(process.cwd(), "test", "logtest", "test18");
const tempDir19 = path.join(process.cwd(), "test", "logtest", "test19");
const tempDir20 = path.join(process.cwd(), "test", "logtest", "test20");

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
const logFilePath12 = path.join(tempDir12, "test-output.log");
const logFilePath13 = path.join(tempDir13, "test-output.log");
const logFilePath14 = path.join(tempDir14, "test-output.log");
const logFilePath15 = path.join(tempDir15, "test-output.log");
const logFilePath16 = path.join(tempDir16, "test-output.log");
const logFilePath17 = path.join(tempDir17, "test-output.log");
const logFilePath18 = path.join(tempDir18, "test-output.log");
const logFilePath19 = path.join(tempDir19, "test-output.log");
const logFilePath20 = path.join(tempDir20, "test-output.log");

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
		const logger = deadslog();
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});

		logger.debug("Hidden debug message");
		logger.info("Hello, world!");

		expect(spy).not.toHaveBeenCalledWith(expect.stringMatching(/\[DEBUG\]/));
		const infoCall = spy.mock.calls.find(
			(call) => call[0].includes("INFO") && call[0].includes("Hello, world!"),
		);
		expect(infoCall).toBeTruthy();
	});

	it("logs to console if console output is enabled", () => {
		const logger = deadslog({
			consoleOutput: { enabled: true, coloredCoding: false },
			minLevel: "info",
		});
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});

		logger.debug("Hidden debug message");
		logger.info("Hello, world!");

		expect(spy).not.toHaveBeenCalledWith(expect.stringMatching(/\[DEBUG\]/));
		const infoCall = spy.mock.calls.find(
			(call) => call[0].includes("INFO") && call[0].includes("Hello, world!"),
		);
		expect(infoCall).toBeTruthy();
	});

	it("handles undefined messages gracefully", () => {
		const logger = deadslog({ consoleOutput: { enabled: true } });
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});

		logger.info(undefined);

		expect(spy).toHaveBeenCalledWith(
			expect.stringContaining("[Message is undefined]"),
		);

		logger.destroy();
	});

	it("handles non-stringifiable objects gracefully", () => {
		const logger = deadslog({ consoleOutput: { enabled: true } });
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});

		const circularObject = {};
		circularObject.circularRef = circularObject;

		logger.info(circularObject);

		const infoCall = spy.mock.calls.find((call) =>
			call[0].includes("[Circular Reference]"),
		);
		expect(infoCall).toBeTruthy();

		logger.destroy();
	});

	it("formats a string message correctly", () => {
		const logger = deadslog({ consoleOutput: { enabled: true } });
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});

		logger.info("Test string message");

		expect(spy).toHaveBeenCalledWith(
			expect.stringContaining("Test string message"),
		);

		logger.destroy();
	});

	it("uses custom formatter when provided", async () => {
		const logger = deadslog({
			consoleOutput: { enabled: true },
			minLevel: "info",
			formatter: (level, message) =>
				`CUSTOM: ${level.toUpperCase()} - ${message}`,
		});
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});

		logger.info("Formatted!");

		const infoCall = spy.mock.calls.find(
			(call) => call[0].includes("INFO") && call[0].includes("Formatted!"),
		);
		expect(infoCall).toBeTruthy();

		await logger.destroy();
	});

	it("supports all log levels", () => {
		const logger = deadslog({
			minLevel: "trace",
			consoleOutput: { enabled: true, coloredCoding: false },
		});
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});

		logger.trace("Trace");
		logger.debug("Debug");
		logger.info("Info");
		logger.warn("Warn");
		logger.error("Error");
		logger.fatal("Fatal");

		const infoCallTrace = spy.mock.calls.find(
			(call) => call[0].includes("TRACE") && call[0].includes("Trace"),
		);
		expect(infoCallTrace).toBeTruthy();

		const infoCallDebug = spy.mock.calls.find(
			(call) => call[0].includes("DEBUG") && call[0].includes("Debug"),
		);
		expect(infoCallDebug).toBeTruthy();

		const infoCallInfo = spy.mock.calls.find(
			(call) => call[0].includes("INFO") && call[0].includes("Info"),
		);
		expect(infoCallInfo).toBeTruthy();

		const infoCallWarn = spy.mock.calls.find(
			(call) => call[0].includes("WARN") && call[0].includes("Warn"),
		);
		expect(infoCallWarn).toBeTruthy();

		const infoCallError = spy.mock.calls.find(
			(call) => call[0].includes("ERROR") && call[0].includes("Error"),
		);
		expect(infoCallError).toBeTruthy();

		const infoCallFatal = spy.mock.calls.find(
			(call) => call[0].includes("FATAL") && call[0].includes("Fatal"),
		);
		expect(infoCallFatal).toBeTruthy();

		logger.destroy();
	});

	it("ignores logs below minLevel in both console and file", async () => {
		const logger = deadslog({
			minLevel: "error",
			consoleOutput: { enabled: true },
			fileOutput: { enabled: true, logFilePath: logFilePath2 },
		});
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});

		logger.warn("This should be ignored");
		logger.error("This should appear");

		await new Promise((r) => setTimeout(r, 10));
		await logger.destroy();

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
		const logger = deadslog({
			consoleOutput: { enabled: false },
			fileOutput: { enabled: true, logFilePath },
		});

		logger.info("File test message");

		await new Promise((resolve) => setTimeout(resolve, 10));
		await logger.destroy();

		const contents = fs.readFileSync(logFilePath, "utf8");
		expect(contents).toMatch(/File test message/);
	});

	it("rotates when max file size is reached", async () => {
		const logger = deadslog({
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

		logger.info("Message 1");
		logger.info("Message 2");
		logger.info("Message 3");
		logger.info("Message 4");
		logger.info("Message 3");

		await new Promise((resolve) => setTimeout(resolve, 50));
		await logger.destroy();

		expect(fs.existsSync(path.join(tempDir3, "test-output.1.log"))).toBe(true);
	});

	it("deletes old logs when max log files are reached", async () => {
		const logger = deadslog({
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

		logger.info("Message 1");
		logger.info("Message 2");
		logger.info("Message 3");
		logger.info("Message 4");
		logger.info("Message 5");
		logger.info("Message 6");
		logger.info("Message 7");
		logger.info("Message 8");
		logger.info("Message 9");
		logger.info("Message 10");

		await new Promise((resolve) => setTimeout(resolve, 50));
		await logger.destroy();

		// Check that only 2 files exist
		expect(fs.existsSync(path.join(tempDir4, "test-output.1.log"))).toBe(true);
		expect(fs.existsSync(path.join(tempDir4, "test-output.2.log"))).toBe(true);
	});

	it("archives old logs when max log files are reached", async () => {
		const logger = deadslog({
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

		logger.info("Log for compression");
		logger.info("Log for compression");
		logger.info("Log for compression");
		logger.info("Log for compression");
		logger.info("Log for compression");

		await new Promise((resolve) => setTimeout(resolve, 50));
		await logger.destroy();

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
			logger.info("A".repeat(10));
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
		const logger = deadslog({
			consoleOutput: { enabled: false },
			fileOutput: { enabled: true, logFilePath: logFilePath6 },
		});

		// Log several messages quickly
		for (let i = 0; i < 10; i++) logger.info(`Flush test ${i}`);

		await new Promise((resolve) => setTimeout(resolve, 50));
		await logger.destroy();

		const contents = fs.readFileSync(logFilePath6, "utf8");
		expect(contents).toMatch(/Flush test 9/);
	});

	it("flushes all logs before destroy is complete", async () => {
		const logger = deadslog({
			consoleOutput: { enabled: false },
			fileOutput: { enabled: true, logFilePath: logFilePath10 },
		});

		// Log multiple messages
		for (let i = 0; i < 5; i++) {
			logger.info(`Flush test message ${i}`);
		}

		// Destroy and wait for flush
		await new Promise((resolve) => setTimeout(resolve, 50));
		await logger.destroy();

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
		const logger = deadslog({
			consoleOutput: { enabled: false },
			fileOutput: { enabled: true, logFilePath: logFilePath8 },
		});

		const logMessages = Array(1000).fill("High throughput test message");

		// Simulate high throughput logging
		// biome-ignore lint/complexity/noForEach: prefer forEach for testing
		logMessages.forEach((msg) => logger.info(msg));

		await new Promise((resolve) => setTimeout(resolve, 50));
		await logger.destroy();

		const contents = fs.readFileSync(logFilePath8, "utf8");
		expect(contents).toMatch(/High throughput test message/);
	});

	it("handles log rotation during high throughput", async () => {
		const logger = deadslog({
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
			logger.info(`High throughput message ${i}`);
		}

		await new Promise((resolve) => setTimeout(resolve, 50));
		await logger.destroy();

		// Check if rotation occurred and archived logs exist
		expect(fs.existsSync(path.join(tempDir9, "test-output.1.log.gz"))).toBe(
			true,
		);
	});

	it("flushes all logs even if new logs are added during flush", async () => {
		const logger = deadslog({
			consoleOutput: { enabled: false },
			fileOutput: { enabled: true, logFilePath: logFilePath12 },
		});

		// Log some messages
		for (let i = 0; i < 5; i++) logger.info(`Flush test ${i}`);

		// Start flush, but add more logs while flushing
		const flushPromise = logger.flush();
		for (let i = 5; i < 10; i++) logger.info(`Flush test ${i}`);
		await flushPromise;
		await logger.destroy();

		const contents = fs.readFileSync(logFilePath12, "utf8");
		// All messages 0-9 should be present
		for (let i = 0; i < 10; i++) {
			expect(contents).toMatch(new RegExp(`Flush test ${i}`));
		}
	});

	it("prevents reentrant flush calls", async () => {
		const logger = deadslog({
			consoleOutput: { enabled: false },
			fileOutput: { enabled: true, logFilePath: logFilePath13 },
		});

		const flushSpy = vi.spyOn(logger, "flush");

		logger.info("A message");
		await Promise.all([logger.flush(), logger.flush(), logger.flush()]);
		expect(flushSpy).toHaveBeenCalledTimes(3); // Called, but only one should execute internally

		await logger.destroy();
	});

	it("handles write failures gracefully", async () => {
		const original = fs.createWriteStream;
		vi.spyOn(fs, "createWriteStream").mockImplementation(() => {
			throw new Error("Permission denied");
		});

		const logger = deadslog({
			consoleOutput: { enabled: false },
			fileOutput: { enabled: true, logFilePath: logFilePath14 },
		});

		expect(() => logger.info("This should not crash")).not.toThrow();

		await logger.destroy();
		fs.createWriteStream = original;
	});

	it("allows multiple destroy calls without crashing", async () => {
		const logger = deadslog({
			consoleOutput: { enabled: false },
			fileOutput: { enabled: true, logFilePath: logFilePath15 },
		});

		logger.info("Should be flushed");
		await logger.destroy();

		expect(async () => {
			await logger.destroy();
		}).not.toThrow();
	});

	it("queues messages correctly under backpressure", async () => {
		const logger = deadslog({
			consoleOutput: { enabled: false },
			fileOutput: { enabled: true, logFilePath: logFilePath16 },
		});

		const originalWrite = logger._writeToFile;
		logger._writeToFile = async (...args) => {
			await new Promise((res) => setTimeout(res, 5));
			return originalWrite.apply(log, args);
		};

		for (let i = 0; i < 100; i++) logger.info(`Delayed message ${i}`);

		await new Promise((r) => setTimeout(r, 100));
		await logger.destroy();

		const contents = fs.readFileSync(logFilePath16, "utf8");
		expect(contents).toMatch(/Delayed message/);
	});
});
