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
  const escaped = message.replace(/"/g, '""');
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
    trace: '🔍',
    debug: '🐛',
    info: 'ℹ️',
    success: '✅',
    warn: '⚠️',
    error: '❌',
    fatal: '💀'
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

## Changelog

## [v1.3.0] - 2026-02-28
### Changed
- fileOutput.rotate is now truly optional (defaults to false); rotation thresholds are validated only when rotate: true.
- When fileOutput.enabled is false, other fileOutput.* options are ignored (no validation).
- Default formatter now uses local/system time (instead of UTC `toISOString()`).
- File rotation now uses in-memory byte tracking for more deterministic rotation behavior under buffered writes.

### Added
- File output option `maxQueueSize` (defaults to `100000`) to configure the maximum internal write queue size.
- File output options to control queue-full behavior:
  - `onQueueFull`: `"drop"` (default) or `"block"`
  - `queueFullTimeoutMs`: timeout for `"block"` mode

### Fixed
- Improved shutdown durability: `destroy()`/`flush()` now wait for in-flight log calls to finish enqueueing before closing streams.
- Prevented race conditions during concurrent stream initialization by serializing file stream opening.
- Rotation edge case: a single log entry larger than maxLogSize no longer triggers rotation churn (oversize line is written; rotation happens on a subsequent write).

---

See [CHANGELOG.md](./CHANGELOG.md) for previous versions and more details.

## License
MIT