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

## 📦 Installation

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

For **file output**, deadslog escapes real newline characters (`\n` / `\r\n`) into the two-character sequence `\\n` so that **each log call produces exactly one physical line** in the log file (better for rotation, grep, CSV/JSONL parsing, and log shippers).

Console output is unchanged and will display multiline stack traces.

## 📘 API

### deadslog(config)
Returns a logger instance.

#### ⚙️ Configuration Options

| Option                            | Type       | Description |
| --------------------------------- | ---------- | ----------- |
| `consoleOutput.enabled`           | `boolean`  | Enable console logging (default: `true`) |
| `consoleOutput.coloredCoding`     | `boolean`  | Enable colored output using `yoctocolors` (default: `true`) |
| `fileOutput.enabled`              | `boolean`  | Enable file logging (default: `false`) |
| `fileOutput.logFilePath`          | `string`   | File path for log output (**required** if `fileOutput.enabled` is `true`) |
| `fileOutput.rotate`               | `boolean`  | Enable automatic log file rotation (default: `false`) |
| `fileOutput.maxLogSize`           | `number`   | Maximum log file size in bytes before rotation (**required** if `fileOutput.rotate` is `true`) |
| `fileOutput.maxLogFiles`          | `number`   | Number of rotated files to keep (**required** if `fileOutput.rotate` is `true`) |
| `fileOutput.onMaxLogFilesReached` | `string`   | Rotation strategy: `"deleteOld"` or `"archiveOld"` (**required** if `fileOutput.rotate` is `true`) |
| `fileOutput.maxQueueSize`         | `number`   | Maximum number of queued file writes before queue-full strategy applies (default: `100000`) |
| `fileOutput.onQueueFull`          | `string`   | Queue-full strategy: `"drop"` (default) or `"block"` |
| `fileOutput.queueFullTimeoutMs`   | `number`   | Max time (ms) to wait for queue space when `onQueueFull: "block"` (default: `5000`) |
| `formatter`                       | `function` | Optional custom formatter for log messages |
| `minLevel`                        | `string`   | Minimum log level: `trace`, `debug`, `info`, `success`, `warn`, `error`, `fatal` (default: `info`) |
| `filters.include`                 | `string`   | RegExp string; if provided, only matching formatted lines are logged |
| `filters.exclude`                 | `string`   | RegExp string; if provided, matching formatted lines are skipped |

#### 🧰 Logger Methods
- `trace(msg)`
- `debug(msg)`
- `info(msg)`
- `success(msg)`
- `warn(msg)`
- `error(msg)`
- `fatal(msg)`
- `flush()`
- `destroy()`

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
- **File rotation**: rotate by size and keep a configurable number of files, with either **delete old** or **gzip archive** strategies.
- **Backpressure control**: choose whether a full write queue should **drop** logs (and track it) or **block** with a timeout.
- **Simple formatting** by default, with a custom formatter hook when you want full control.

If you need high-throughput structured JSON logging and an ecosystem of transports/bindings, you’ll likely want something like Pino or Winston. If you want a dead-simple API with reliable console + file logging, deadslog is built for that.

## Changelog

## [v1.3.1] - 2026-03-08
### Changed
- Logging payloads are now built from variadic arguments in the exact order supplied (console-like behavior).
- The logger now stringifies non-string payload parts more readably, including:
  - `undefined` → `"undefined"`
  - `BigInt` values → string form with `n` suffix (e.g. `1n`)
  - circular references → `"[Circular Reference]"`
  - non-serializable objects → `"[Non-serializable]"`
- `defaultFormatter` now treats the incoming `message` as a pre-built string payload (stringification happens during payload building).
- File output now escapes newline characters (`\n`/`\r\n`) as `\\n` to ensure one log entry per line (console output remains multiline for stack traces).

---

See [CHANGELOG.md](./CHANGELOG.md) for previous versions and more details.

## License
MIT