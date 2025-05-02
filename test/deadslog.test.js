import { describe, it, expect, afterEach, afterAll, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import deadslog from "../index.js";

const tempDir = path.join(process.cwd(), "test", "logtest");
const logFilePath = path.join(tempDir, "test-output.log");

afterEach(async () => {
	vi.restoreAllMocks();
});

afterAll(async () => {
	try {
		if (fs.existsSync(tempDir)) {
			await fs.promises.rm(tempDir, { recursive: true });
		}
	} catch (err) {
		console.error("Error during test cleanup:", err);
	}
});

describe("deadslog extended tests", () => {
	it("logs to console", () => {
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

	it("writes to file", async () => {
		const log = deadslog({
			consoleOutput: { enabled: false },
			fileOutput: { enabled: true, logFilePath },
		});

		log.info("File test message");

		await new Promise((resolve) => setTimeout(resolve, 10));
		log.destroy();

		const contents = fs.readFileSync(logFilePath, "utf8");
		expect(contents).toMatch(/File test message/);
	});

	it("does not log below minLevel", async () => {
		const log = deadslog({
			minLevel: "warn",
			consoleOutput: { enabled: false },
			fileOutput: { enabled: true, logFilePath },
		});

		log.info("Should not be logged");
		log.warn("Warning message");

		await new Promise((resolve) => setTimeout(resolve, 10));
		log.destroy();

		const contents = fs.readFileSync(logFilePath, "utf8");
		expect(contents).not.toMatch(/Should not be logged/);
		expect(contents).toMatch(/Warning message/);
	});

	it("handles file rotation properly", async () => {
		const log = deadslog({
			consoleOutput: { enabled: false },
			fileOutput: {
				enabled: true,
				logFilePath,
				rotate: true,
				maxLogSize: 50,
				maxLogFiles: 2,
				onMaxLogFilesReached: "deleteOld",
			},
		});

		log.info("Message 1");
		log.info("Message 2");
		log.info("Message 3");

		await new Promise((resolve) => setTimeout(resolve, 100));
		log.destroy();

		expect(fs.existsSync(path.join(tempDir, "test-output.1.log"))).toBe(true);
	});

	it("archives old logs correctly", async () => {
		const log = deadslog({
			consoleOutput: { enabled: false },
			fileOutput: {
				enabled: true,
				logFilePath,
				rotate: true,
				maxLogSize: 50,
				maxLogFiles: 2,
				onMaxLogFilesReached: "archiveOld",
			},
		});

		log.info("Log for compression");

		await new Promise((resolve) => setTimeout(resolve, 100));
		log.destroy();

		expect(fs.existsSync(path.join(tempDir, "test-output.1.log.gz"))).toBe(
			true,
		);
	});
});
