import {
	existsSync,
	statSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
	renameSync,
	unlinkSync,
	createWriteStream,
} from "node:fs";

export const existsWithRetry = (filePath, retries = 5, delayMs = 100) => {
	for (let i = 0; i < retries; i++) {
		try {
			const stats = existsSync(filePath);
			return stats;
		} catch (err) {
			if (err.code === "ENOENT") throw err;
			if (i === retries - 1) throw err;
			Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
		}
	}
};

export const statWithRetry = (filePath, retries = 5, delayMs = 100) => {
	for (let i = 0; i < retries; i++) {
		try {
			const stats = statSync(filePath);
			return stats;
		} catch (err) {
			if (err.code === "ENOENT") throw err;
			if (i === retries - 1) throw err;
			Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
		}
	}
};

export const mkdirWithRetry = (dir, retries = 5, delayMs = 100) => {
	for (let i = 0; i < retries; i++) {
		try {
			mkdirSync(dir, { recursive: true });
			return;
		} catch (err) {
			if (i === retries - 1) throw err;
			// Sleep for delayMs using Atomics.wait
			Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
		}
	}
};

export const readFileWithRetry = (filePath, retries = 5, delayMs = 100) => {
	for (let i = 0; i < retries; i++) {
		try {
			const contents = readFileSync(filePath);
			return contents;
		} catch (err) {
			if (i === retries - 1) throw err;
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
			writeFileSync(filePath, content);
			return;
		} catch (err) {
			if (i === retries - 1) throw err;
			Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
		}
	}
};

export const writeFileWithEncodingRetry = (
	filePath,
	content = "",
	encoding = "utf8",
	retries = 5,
	delayMs = 100,
) => {
	for (let i = 0; i < retries; i++) {
		try {
			writeFileSync(filePath, content, encoding);
			return;
		} catch (err) {
			if (i === retries - 1) throw err;
			Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
		}
	}
};

export const renameWithRetry = (
	oldPath,
	newPath,
	retries = 5,
	delayMs = 100,
) => {
	for (let i = 0; i < retries; i++) {
		try {
			renameSync(oldPath, newPath);
			return;
		} catch (err) {
			if (err.code !== "ENOENT") throw err;
			if (i === retries - 1) throw err;
			Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
		}
	}
};

export const unlinkWithRetry = (filePath, retries = 5, delayMs = 100) => {
	for (let i = 0; i < retries; i++) {
		try {
			unlinkSync(filePath);
			return;
		} catch (err) {
			if (err.code !== "ENOENT") throw err;
			if (i === retries - 1) throw err;
			Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
		}
	}
};

export const createWriteStreamWithRetry = (
	filePath,
	args,
	retries = 5,
	delayMs = 100,
) => {
	for (let i = 0; i < retries; i++) {
		try {
			const stream = createWriteStream(filePath, args);
			return stream;
		} catch (err) {
			if (err.code === "ENOENT") throw err;
			if (i === retries - 1) throw err;
			Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
		}
	}
};
