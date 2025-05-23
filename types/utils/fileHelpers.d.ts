export function existsWithRetry(filePath: any, retries?: number, delayMs?: number): any;
export function statWithRetry(filePath: any, retries?: number, delayMs?: number): any;
export function mkdirWithRetry(dir: any, retries?: number, delayMs?: number): void;
export function readFileWithRetry(filePath: any, retries?: number, delayMs?: number): any;
export function writeFileWithRetry(filePath: any, content?: string, retries?: number, delayMs?: number): void;
export function createWriteStreamWithRetry(filePath: any, args: any, retries?: number, delayMs?: number): any;
