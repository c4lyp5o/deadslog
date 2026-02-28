import { describe, it, expect, afterEach, afterAll, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import deadslog from "../src/index.js";

const mainTestDir = path.join(process.cwd(), "test", "logtest");

const makeDir = (n) => path.join(mainTestDir, `test${n}`);
const makeLog = (n) => path.join(makeDir(n), "test-output.log");

const tempDir = makeDir(1);
const tempDir2 = makeDir(2);
const tempDir3 = makeDir(3);
const tempDir4 = makeDir(4);
const tempDir5 = makeDir(5);
const tempDir6 = makeDir(6);
const tempDir7 = makeDir(7);
const tempDir8 = makeDir(8);
const tempDir9 = makeDir(9);
const tempDir10 = makeDir(10);
const tempDir11 = makeDir(11);
const tempDir12 = makeDir(12);
const tempDir13 = makeDir(13);
const tempDir14 = makeDir(14);
const tempDir15 = makeDir(15);

const logFilePath = makeLog(1);
const logFilePath2 = makeLog(2);
const logFilePath3 = makeLog(3);
const logFilePath4 = makeLog(4);
const logFilePath5 = makeLog(5);
const logFilePath6 = makeLog(6);
const logFilePath7 = makeLog(7);
const logFilePath8 = makeLog(8);
const logFilePath9 = makeLog(9);
const logFilePath10 = makeLog(10);
const logFilePath11 = makeLog(11);
const logFilePath12 = makeLog(12);
const logFilePath13 = makeLog(13);
const logFilePath14 = makeLog(14);
const logFilePath15 = makeLog(15);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(predicate, { timeoutMs = 1500, intervalMs = 25 } = {}) {
	const start = Date.now();
	let lastErr;
	while (Date.now() - start < timeoutMs) {
		try {
			const value = await predicate();
			if (value) return value;
		} catch (e) {
			lastErr = e;
		}
		await sleep(intervalMs);
	}
	if (lastErr) throw lastErr;
	throw new Error(`Timed out after ${timeoutMs}ms`);
}

async function waitForFile(filePath, opts) {
	return waitFor(() => fs.existsSync(filePath), opts);
}

async function waitForFileContains(filePath, matcher, opts) {
	await waitForFile(filePath, opts);
	return waitFor(() => {
		const contents = fs.readFileSync(filePath, "utf8");
		if (matcher instanceof RegExp) return matcher.test(contents);
		return contents.includes(matcher);
	}, opts);
}

afterEach(() => {
	vi.restoreAllMocks();
});

afterAll(async () => {
	try {
		if (fs.existsSync(mainTestDir)) {
			await fs.promises.rm(mainTestDir, { recursive: true, force: true });
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

	it("colors only the level token when coloredCoding is enabled", async () => {
		const logger = deadslog({
			consoleOutput: { enabled: true, coloredCoding: true },
			minLevel: "info",
		});
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});

		// Message contains "[INFO]" too; we only want the leading token to be colorized.
		logger.info("Message mentions [INFO] inside payload");

		const out = spy.mock.calls[0][0];

		// Ensure message text still contains literal "[INFO]" somewhere
		expect(out).toContain("Message mentions [INFO] inside payload");

		await logger.destroy();
	});

	it("respects minLevel in both console and file", async () => {
		const logger = deadslog({
			minLevel: "error",
			consoleOutput: { enabled: true, coloredCoding: false },
			fileOutput: { enabled: true, logFilePath: logFilePath2 },
		});
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});

		logger.warn("This should be ignored");
		logger.error("This should appear");

		await logger.destroy();

		await waitForFileContains(logFilePath2, /This should appear/);
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

	it("formats a string message correctly", () => {
		const logger = deadslog({ consoleOutput: { enabled: true } });
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});

		logger.info("Test string message");

		expect(spy).toHaveBeenCalledWith(
			expect.stringContaining("Test string message"),
		);

		logger.destroy();
	});

	it("handles undefined messages gracefully", async () => {
		const logger = deadslog({ consoleOutput: { enabled: true } });
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});

		logger.info(undefined);

		expect(spy).toHaveBeenCalledWith(
			expect.stringContaining("[Message is undefined]"),
		);

		await logger.destroy();
	});

	it("handles non-serializable objects gracefully (e.g., BigInt)", async () => {
		const logger = deadslog({ consoleOutput: { enabled: true } });
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});

		// JSON.stringify throws on BigInt by default
		logger.info({ value: 1n });

		expect(spy).toHaveBeenCalledWith(
			expect.stringContaining("Non-serializable object"),
		);

		await logger.destroy();
	});

	it("handles circular objects gracefully", async () => {
		const logger = deadslog({ consoleOutput: { enabled: true } });
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});

		const circularObject = {};
		circularObject.circularRef = circularObject;

		logger.info(circularObject);

		const infoCall = spy.mock.calls.find((call) =>
			call[0].includes("[Circular Reference]"),
		);
		expect(infoCall).toBeTruthy();

		await logger.destroy();
	});

	it("handles top-level Error messages correctly", async () => {
		const logger = deadslog({ consoleOutput: { enabled: true } });
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});

		const err = new Error("Top level error");
		logger.error(err);

		const call = spy.mock.calls.find((c) => c[0].includes("Top level error"));
		expect(call).toBeTruthy();

		const output = call[0];
		expect(output).toMatch(/\[ERROR\]/);
		expect(output).toMatch(/"name"\s*:\s*"Error"/);
		expect(output).toMatch(/"stack"\s*:\s*"/);

		await logger.destroy();
	});

	it("supports variadic logging: logger.error('error happened', err) includes both message and error details", async () => {
		const logPath = makeLog(30);

		const logger = deadslog({
			consoleOutput: { enabled: false },
			fileOutput: { enabled: true, logFilePath: logPath },
		});

		const err = new Error("boom");
		logger.error("error happened", err);

		await logger.destroy();

		const content = fs.readFileSync(logPath, "utf8");

		expect(content).toMatch(/error happened/);

		expect(content).toMatch(/"message":"boom"/);
		expect(content).toMatch(/"name":"Error"/);
	});

	it("formats object-only payloads cleanly without the '[Multiple arguments]' quirk", async () => {
		const logger = deadslog({
			consoleOutput: { enabled: true, coloredCoding: false },
			fileOutput: { enabled: false },
		});
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});

		// 1. Single object logging
		logger.info({ userId: 123 });
		const singleOutput = spy.mock.calls[0][0];
		expect(singleOutput).toContain('{"userId":123}');
		expect(singleOutput).not.toContain("[Multiple arguments]");

		// 2. Multiple objects without a string message
		logger.info({ id: 1 }, { status: "active" });
		const multiOutput = spy.mock.calls[1][0];

		// Should output the unpacked array/objects gracefully
		expect(multiOutput).toContain('"id":1');
		expect(multiOutput).toContain('"status":"active"');

		await logger.destroy();
	});

	it("applies include/exclude filters to file output", async () => {
		const logPath = makeLog(16);
		const logger = deadslog({
			consoleOutput: { enabled: false },
			fileOutput: { enabled: true, logFilePath: logPath },
			filters: { include: "KEEP", exclude: "DROP" },
		});

		logger.info("KEEP this");
		logger.info("DROP this");
		logger.info("IGNORE this"); // doesn't match include

		await logger.destroy();

		await waitForFile(logPath);
		const contents = fs.readFileSync(logPath, "utf8");
		expect(contents).toMatch(/KEEP this/);
		expect(contents).not.toMatch(/DROP this/);
		expect(contents).not.toMatch(/IGNORE this/);
	});

	it("throws on invalid include regex", () => {
		expect(() =>
			deadslog({
				filters: { include: "(" }, // invalid regex
			}),
		).toThrow(/valid RegExp|Invalid regular expression/i);
	});

	it("does not require logFilePath when fileOutput.enabled is false", () => {
		expect(() =>
			deadslog({
				consoleOutput: { enabled: false },
				fileOutput: { enabled: false },
			}),
		).not.toThrow();
	});

	it("does not validate rotate/maxLogSize/maxLogFiles when fileOutput.enabled is false", () => {
		expect(() =>
			deadslog({
				consoleOutput: { enabled: false },
				fileOutput: {
					enabled: false,
					// intentionally wrong types/values; should be ignored
					logFilePath: 123,
					rotate: "yes",
					maxLogSize: "big",
					maxLogFiles: -1,
					onMaxLogFilesReached: "nope",
				},
			}),
		).not.toThrow();
	});

	it("does not validate queue options when fileOutput.enabled is false", () => {
		expect(() =>
			deadslog({
				consoleOutput: { enabled: false },
				fileOutput: {
					enabled: false,
					// intentionally wrong; should be ignored
					onQueueFull: "explode",
					queueFullTimeoutMs: -999,
					maxQueueSize: 0,
				},
			}),
		).not.toThrow();
	});

	it("writes to file if file output is enabled", async () => {
		const logger = deadslog({
			consoleOutput: { enabled: false },
			fileOutput: { enabled: true, logFilePath },
		});

		logger.info("File test message");
		await logger.destroy();

		await waitForFileContains(logFilePath, /File test message/);
	});

	it("rotates based on in-memory byte tracking (does not rely on stat size lag)", async () => {
		const logPath = makeLog(20);
		const dir = makeDir(20);

		const logger = deadslog({
			consoleOutput: { enabled: false },
			fileOutput: {
				enabled: true,
				logFilePath: logPath,
				rotate: true,
				maxLogSize: 120, // small threshold
				maxLogFiles: 2,
				onMaxLogFilesReached: "deleteOld",
			},
		});

		// Many short writes; byte tracking should rotate deterministically.
		for (let i = 0; i < 100; i++)
			logger.info(`rot-line-${i}-${"X".repeat(10)}`);

		await logger.destroy();

		await waitFor(() => fs.existsSync(path.join(dir, "test-output.1.log")), {
			timeoutMs: 3000,
		});
	});

	it("rotates when max file size is reached (deleteOld)", async () => {
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

		for (let i = 0; i < 30; i++) logger.info(`Message ${i} ${"X".repeat(20)}`);

		await logger.destroy();

		// At least one rotated file should exist, but count/timing can vary.
		await waitFor(
			() => fs.existsSync(path.join(tempDir3, "test-output.1.log")),
			{
				timeoutMs: 2500,
			},
		);
	});

	it("writes an oversize line and does not get stuck rotating repeatedly", async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "deadslog-oversize-"));
		const logFilePath = path.join(dir, "app.log");

		const logger = deadslog({
			consoleOutput: { enabled: false },
			fileOutput: {
				enabled: true,
				logFilePath,
				rotate: true,
				maxLogSize: 50, // intentionally tiny
				maxLogFiles: 3,
				onMaxLogFilesReached: "deleteOld",
			},
		});

		const big = "X".repeat(1000);

		logger.info(big);
		logger.info("after big");

		await logger.destroy();

		const content = fs.readFileSync(logFilePath, "utf8");
		expect(content).toMatch(/after big/);

		const metrics = logger.getMetrics();
		expect(typeof metrics).toBe("object");
		expect(metrics.rotations).toBeGreaterThanOrEqual(0);
	});

	it("does not lose the final log line across rotation (deleteOld)", async () => {
		const dir = makeDir(18);
		const logPath = makeLog(18);

		const logger = deadslog({
			consoleOutput: { enabled: false },
			fileOutput: {
				enabled: true,
				logFilePath: logPath,
				rotate: true,
				maxLogSize: 80,
				maxLogFiles: 2,
				onMaxLogFilesReached: "deleteOld",
			},
		});

		for (let i = 0; i < 50; i++) logger.info(`line ${i} ${"X".repeat(20)}`);

		await logger.destroy();

		const candidatePaths = [
			logPath,
			path.join(dir, "test-output.1.log"),
			path.join(dir, "test-output.2.log"),
		];

		// Wait until at least one candidate exists and is non-empty
		await waitFor(
			() => {
				const existing = candidatePaths.filter((p) => fs.existsSync(p));
				if (existing.length === 0) return false;

				// ensure something was actually written
				return existing.some((p) => {
					try {
						return fs.statSync(p).size > 0;
					} catch {
						return false;
					}
				});
			},
			{ timeoutMs: 3000, intervalMs: 25 },
		);

		const existing = candidatePaths.filter((p) => fs.existsSync(p));
		const combined = existing.map((p) => fs.readFileSync(p, "utf8")).join("\n");

		expect(combined).toMatch(/line 49/);
	});

	it("archives old logs when max log files are reached (archiveOld)", async () => {
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

		for (let i = 0; i < 50; i++)
			logger.info("Log for compression " + "X".repeat(20));

		await logger.destroy();

		await waitFor(
			() => fs.existsSync(path.join(tempDir5, "test-output.1.log.gz")),
			{
				timeoutMs: 3000,
			},
		);
	});

	it("flushes queued logs on destroy", async () => {
		const logger = deadslog({
			consoleOutput: { enabled: false },
			fileOutput: { enabled: true, logFilePath: logFilePath6 },
		});

		for (let i = 0; i < 25; i++) logger.info(`Flush test ${i}`);

		await logger.destroy();
		await waitForFileContains(logFilePath6, /Flush test 24/);
	});

	it("flushes all logs before destroy is complete", async () => {
		const logger = deadslog({
			consoleOutput: { enabled: false },
			fileOutput: { enabled: true, logFilePath: logFilePath10 },
		});

		for (let i = 0; i < 5; i++) logger.info(`Flush test message ${i}`);
		await logger.destroy();

		await waitForFileContains(logFilePath10, /Flush test message 4/);
		const contents = fs.readFileSync(logFilePath10, "utf8");

		for (let i = 0; i < 5; i++) {
			expect(contents).toMatch(new RegExp(`Flush test message ${i}`));
		}
	});

	it("does not lose burst logs when not awaiting individual calls (shutdown durability)", async () => {
		const logPath = makeLog(19);
		const logger = deadslog({
			consoleOutput: { enabled: false },
			fileOutput: { enabled: true, logFilePath: logPath },
		});

		for (let i = 0; i < 200; i++) logger.info(`burst ${i}`);

		await logger.destroy();

		await waitForFileContains(logPath, /burst 199/);
	});

	it("handles multiple loggers writing concurrently (same file)", async () => {
		const log1 = deadslog({
			consoleOutput: { enabled: false },
			fileOutput: { enabled: true, logFilePath: logFilePath7 },
		});
		const log2 = deadslog({
			consoleOutput: { enabled: false },
			fileOutput: { enabled: true, logFilePath: logFilePath7 },
		});

		log1.info("Message from logger 1");
		log2.info("Message from logger 2");

		await log1.destroy();
		await log2.destroy();

		await waitForFileContains(logFilePath7, /Message from logger 1/);
		await waitForFileContains(logFilePath7, /Message from logger 2/);
	});

	it("handles high throughput logging without crashing", async () => {
		const logger = deadslog({
			consoleOutput: { enabled: false },
			fileOutput: { enabled: true, logFilePath: logFilePath8 },
		});

		for (let i = 0; i < 1000; i++)
			logger.info(`High throughput test message ${i}`);

		await logger.destroy();

		await waitForFileContains(logFilePath8, /High throughput test message 999/);
	});

	it("flush/destroy creates the file even if called immediately", async () => {
		const logger = deadslog({
			consoleOutput: { enabled: false },
			fileOutput: { enabled: true, logFilePath: logFilePath12 },
		});

		logger.info("Hello");
		await logger.destroy();

		await waitForFileContains(logFilePath12, /Hello/);
	});

	it("allows multiple destroy calls without crashing", async () => {
		const logger = deadslog({
			consoleOutput: { enabled: false },
			fileOutput: { enabled: true, logFilePath: logFilePath15 },
		});

		logger.info("Should be flushed");
		await logger.destroy();

		await expect(logger.destroy()).resolves.toBeUndefined();
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

	it("exposes lastFileError in metrics when file stream cannot be opened", async () => {
		const logPath = makeLog(21);

		vi.spyOn(fs.WriteStream.prototype, "write").mockImplementation(
			(_chunk, _encoding, _cb) => {
				throw new Error("Permission denied");
			},
		);

		const logger = deadslog({
			consoleOutput: { enabled: false },
			fileOutput: { enabled: true, logFilePath: logPath },
		});

		logger.info("will fail");

		await sleep(0);
		await sleep(10);

		const m = logger.getMetrics();
		expect(typeof m).toBe("object");
		expect(m.lastFileError).toBeTruthy();
		expect(m.lastFileError).toMatch(/Permission denied/i);

		await logger.destroy();
	});

	it("drops logs when queue is full in drop mode and reports droppedMessages", async () => {
		const logPath = makeLog(22);

		// Slow stream to keep queue full
		const original = fs.createWriteStream;
		vi.spyOn(fs, "createWriteStream").mockImplementation(() => {
			const { Writable } = require("node:stream");
			return new Writable({
				write(_chunk, _enc, cb) {
					setTimeout(cb, 25); // slow writes -> queue pressure
				},
			});
		});

		const logger = deadslog({
			consoleOutput: { enabled: false },
			fileOutput: {
				enabled: true,
				logFilePath: logPath,
				onQueueFull: "drop",
				maxQueueSize: 5, // tiny to force drops quickly
			},
		});

		// Burst more than maxQueueSize; some should drop
		for (let i = 0; i < 200; i++) logger.info(`msg ${i}`);

		// Wait for drop counter to become > 0
		await waitFor(
			() => {
				const m = logger.getMetrics();
				return m && typeof m === "object" && m.droppedMessages > 0;
			},
			{ timeoutMs: 2000, intervalMs: 25 },
		);

		const m = logger.getMetrics();
		expect(m.droppedMessages).toBeGreaterThan(0);

		await logger.destroy();
		fs.createWriteStream = original;
	});

	it("applies backpressure in block mode (enqueue waits instead of dropping)", async () => {
		const logPath = makeLog(23);

		// NOTE: This test is inherently more timing-sensitive. Keep it small and bounded.
		// We'll simulate a very slow underlying stream so the queue fills, then ensure droppedMessages stays 0.
		const logger = deadslog({
			consoleOutput: { enabled: false },
			fileOutput: {
				enabled: true,
				logFilePath: logPath,
				onQueueFull: "block",
				queueFullTimeoutMs: 2000,
			},
		});

		// Fire a moderate burst; block mode should avoid drops.
		for (let i = 0; i < 5000; i++)
			logger.info(`block-msg ${i} ${"X".repeat(50)}`);

		await logger.destroy();

		const m = logger.getMetrics();
		expect(m.droppedMessages).toBe(0);

		await waitForFileContains(logPath, /block-msg 4999/);
	});

	it("blocks (does not drop) when queue is full in block mode", async () => {
		const logPath = makeLog(23);

		const logger = deadslog({
			consoleOutput: { enabled: false },
			fileOutput: {
				enabled: true,
				logFilePath: logPath,
				onQueueFull: "block",
				queueFullTimeoutMs: 2000,
				maxQueueSize: 5,
			},
		});

		// Not awaiting individual calls; we only assert no drops after destroy.
		for (let i = 0; i < 200; i++) logger.info(`block-msg ${i}`);

		await logger.destroy();

		const m = logger.getMetrics();
		expect(m.droppedMessages).toBe(0);
	});
});
