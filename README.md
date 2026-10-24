# deadslog

[![CI & Publish](https://github.com/c4lyp5o/deadslog/actions/workflows/ci-publish.yml/badge.svg)](https://github.com/c4lyp5o/deadslog/actions/workflows/ci-publish.yml)
![GitHub issues](https://img.shields.io/github/issues/c4lyp5o/deadslog) 
![GitHub pull requests](https://img.shields.io/github/issues-pr/c4lyp5o/deadslog)
[![codecov](https://codecov.io/gh/c4lyp5o/deadslog/graph/badge.svg?token=CBXCJDUJS9)](https://codecov.io/gh/c4lyp5o/deadslog)
![npm](https://img.shields.io/npm/v/deadslog) 
![npm](https://img.shields.io/npm/dt/deadslog) 
![GitHub](https://img.shields.io/github/license/c4lyp5o/deadslog)

A dead simple logger module for Node.js. Provides console and file-based logging with support for log rotation, custom formatting, colored output, and robust error handling.

## ✨ Features

- 🖥 Console and file logging  
- 🔄 Log rotation with delete/archive strategies  
- 🧩 Customizable log formatting  
- 🌈 Colored log levels in console  
- 🧱 Handles undefined/non-serializable messages  
- 🧠 TypeScript type definitions included  
- 🔁 ESM + CommonJS support  
- 🪶 Zero runtime dependencies  

## 📦 Installation

Requires Node.js 18 or later.

```sh
npm install deadslog
# or
bun add deadslog
```

## 🚀 Usage

### 🔹 CommonJS
```js
const deadslog = require("deadslog");
const logger = deadslog();
logger.info("Hello, world!");
```

### 🔹 ESM
```js
import deadslog from "deadslog";
const logger = deadslog();
logger.info("Hello, world!");
```

### 🎨 With Custom Formatter
```js
const logger = deadslog({
  formatter: (level, message) => {
    const timestamp = new Date().toLocaleString();
    return `---\nTime: ${timestamp}\nLevel: ${level}\nMessage: ${message}\n---`;
  },
});
logger.info("Custom formatted log!");
```

### 📁 File Logging & Rotation
```js
const logger = deadslog({
  fileOutput: {
    enabled: true,
    logFilePath: "./logs/app.log",
    rotate: true,
    maxLogSize: 1024 * 1024, // 1MB
    maxLogFiles: 3,
    onMaxLogFilesReached: "archiveOld", // or "deleteOld"
  },
});
logger.info("This will be written to a file!");
```

For **file output**, deadslog replaces real line breaks (LF / CRLF) with a literal backslash followed by `n`, so that **each log call produces exactly one physical line** in the log file (better for rotation, grep, CSV/JSONL parsing, and log shippers).

Console output is unchanged and will display multiline stack traces.

## 📘 API

### deadslog(config)
Returns a logger instance.

#### ⚙️ Configuration Options

| Option                            | Type       | Description |
| --------------------------------- | ---------- | ----------- |
| `consoleOutput.enabled`           | `boolean`  | Enable console logging (default: `true`) |
| `consoleOutput.coloredCoding`     | `boolean`  | Enable ANSI-colored level tags, respecting `NO_COLOR`/`FORCE_COLOR` (default: `false`; `true` when `consoleOutput` is omitted) |
| `fileOutput.enabled`              | `boolean`  | Enable file logging (default: `false`) |
| `fileOutput.logFilePath`          | `string`   | File path for log output (**required** if `fileOutput.enabled` is `true`) |
| `fileOutput.rotate`               | `boolean`  | Enable automatic log file rotation (default: `false`) |
| `fileOutput.maxLogSize`           | `number`   | Maximum log file size in bytes before rotation (**required** if `fileOutput.rotate` is `true`) |
| `fileOutput.maxLogFiles`          | `number`   | Number of rotated files to keep (**required** if `fileOutput.rotate` is `true`) |
| `fileOutput.onMaxLogFilesReached` | `string`   | How rotated files are kept: `"deleteOld"` (plain `app.1.log`, ...) or `"archiveOld"` (gzipped `app.1.log.gz`, ...). Either way the oldest is deleted past `maxLogFiles` (**required** if `fileOutput.rotate` is `true`) |
| `fileOutput.maxQueueSize`         | `number`   | Maximum number of queued file writes before queue-full strategy applies (default: `100000`) |
| `fileOutput.onQueueFull`          | `string`   | Queue-full strategy: `"drop"` (default) or `"block"` |
| `fileOutput.queueFullTimeoutMs`   | `number`   | Max time (ms) to wait for queue space when `onQueueFull: "block"`; `0` waits indefinitely (default: `5000`) |
| `formatter`                       | `function` | Optional `(level, message) => string`; `message` is the arguments already serialized and joined. Colors apply only if the output contains the `[LEVEL]` tag |
| `minLevel`                        | `string`   | Minimum log level: `trace`, `debug`, `info`, `success`, `warn`, `error`, `fatal` (default: `info`) |
| `filters.include`                 | `string`   | RegExp string; if provided, only matching formatted lines are logged |
| `filters.exclude`                 | `string`   | RegExp string; if provided, matching formatted lines are skipped |

#### 🧰 Logger Methods
- `trace(...args)`, `debug(...args)`, `info(...args)`, `success(...args)`, `warn(...args)`, `error(...args)`, `fatal(...args)`: variadic like `console.log`, e.g. `logger.error("request failed", err, { requestId })`. They never throw; each returns a promise (never rejects) that settles once the line is written, if you want to await it.
- `flush()`: wait until all pending writes and rotations finish.
- `destroy()`: flush, then close the file. Later log calls are ignored.
- `getMetrics()`: file-writer stats (`messagesLogged`, `bytesWritten`, `writeFailures`, `droppedMessages`, `rotations`, `averageWriteTime`, `lastFileError`, ...), or a message string if file output is disabled.

If 5 messages in a row fail to reach the file (e.g. disk full or permissions), file writes pause for 30 seconds, then the next write is retried. Rejected messages are counted in `writeFailures`.

## 🧠 TypeScript
Type definitions are included and will be picked up automatically.

## 📚 Formatter Examples For Use
### 🧾 1. Simple Timestamp Formatter

```javascript
const simpleFormatter = (level, message) => {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] ${message}`;
};
```

```yaml
[2025-05-03T13:45:21.123Z] [INFO] Application started
```

### 📜 2. Multiline Developer-Friendly Formatter

```javascript
const multilineFormatter = (level, message) => {
  const timestamp = new Date().toLocaleString();
  return `---\nTime: ${timestamp}\nLevel: ${level}\nMessage: ${message}\n---`;
};
```

```yaml
---
Time: 5/3/2025, 1:46:11 PM
Level: DEBUG
Message: Connected to database
---
```

### 📁 3. File-Friendly CSV Formatter

```javascript
const csvFormatter = (level, message) => {
  const timestamp = new Date().toISOString();
  const escaped = message.replace(/\r?\n/g, "\\n").replace(/"/g, '""');
  return `"${timestamp}","${level}","${escaped}"`;
};
```

```yaml
"2025-05-03T13:47:02.789Z","ERROR","Failed to load module: ""auth.js"""
```

### 🌈 4. Emoji-Coded Formatter

```javascript
const emojiFormatter = (level, message) => {
  const emojis = {
    TRACE: '🔍',
    DEBUG: '🐛',
    INFO: 'ℹ️',
    SUCCESS: '✅',
    WARN: '⚠️',
    ERROR: '❌',
    FATAL: '💀'
  };
  const timestamp = new Date().toISOString();
  return `${emojis[level] || ''} [${timestamp}] ${level}: ${message}`;
};
```

```yaml
✅ [2025-05-03T13:48:15.456Z] SUCCESS: Task completed
```

### 🪵 5. JSONL (JSON Lines) Formatter for Parsing

```javascript
const jsonlFormatter = (level, message) => {
  return JSON.stringify({
    ts: Date.now(),
    level,
    message
  });
};
```

```yaml
{"ts":1714740493123,"level":"INFO","message":"Something happened"}
```

## Why deadslog?

deadslog is a small, console-friendly logger for Node.js that focuses on *robust file logging* without the complexity of a full logging framework.

It keeps the ergonomics of `console.log(...args)` (variadic arguments, readable output, optional colored levels), but adds production-minded behavior that many lightweight loggers skip:

- **Durable shutdown**: `flush()` / `destroy()` wait for in-flight logs, queued writes, and rotations to finish.
- **File rotation**: rotate by size and keep a configurable number of files, stored plain or **gzip-archived**.
- **Backpressure control**: choose whether a full write queue should **drop** logs (and track it) or **block** with a timeout.
- **Simple formatting** by default, with a custom formatter hook when you want full control.

If you need high-throughput structured JSON logging and an ecosystem of transports/bindings, you’ll likely want something like Pino or Winston. If you want a dead-simple API with reliable console + file logging, deadslog is built for that.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).

## License
MIT