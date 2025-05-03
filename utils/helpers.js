import fs from "node:fs";

export const mkdirWithRetry = (dir, retries = 5, delayMs = 100) => {
	for (let i = 0; i < retries; i++) {
		try {
			fs.mkdirSync(dir, { recursive: true });
			return;
		} catch (err) {
			if (i === retries - 1) throw err;
			// Sleep for delayMs using Atomics.wait
			Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
		}
	}
};

export const writeFileWithRetry = (
	filePath,
	content = "",
	retries = 5,
	delayMs = 100,
) => {
	for (let i = 0; i < retries; i++) {
		try {
			fs.writeFileSync(filePath, content);
			return;
		} catch (err) {
			if (i === retries - 1) throw err;
			Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
		}
	}
};
