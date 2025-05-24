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

### 🔹 Basic
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

### 📦 CommonJS Usage
```js
const deadslog = require("deadslog");
const logger = deadslog();
logger.info("Hello from CJS!");
```

## 📘 API

### deadslog(config)
Returns a logger instance.

#### ⚙️ Configuration Options

| Option                            | Type       | Description                                                                      |
| --------------------------------- | ---------- | -------------------------------------------------------------------------------- |
| `consoleOutput.enabled`           | `boolean`  | Enable console logging (default: `true`)                                         |
| `consoleOutput.coloredCoding`     | `boolean`  | Enable colored output using `chalk` (default: `true`)                            |
| `fileOutput.enabled`              | `boolean`  | Enable file logging (default: `false`)                                           |
| `fileOutput.logFilePath`          | `string`   | File path for log output (required if file logging is enabled)                   |
| `fileOutput.rotate`               | `boolean`  | Enable automatic log file rotation                                               |
| `fileOutput.maxLogSize`           | `number`   | Maximum log file size in bytes before rotation                                   |
| `fileOutput.maxLogFiles`          | `number`   | Number of rotated files to keep                                                  |
| `fileOutput.onMaxLogFilesReached` | `string`   | Rotation strategy: `"deleteOld"` or `"archiveOld"`                               |
| `formatter`                       | `function` | Optional custom formatter for log messages                                       |
| `minLevel`                        | `string`   | Minimum log level: `trace`, `debug`, `info`, `success`, `warn`, `error`, `fatal` |
| `filters.include`                  | `string`   | Word filter to include from log |
| `filters.exclude`                  | `string`   | Word filter to exclude from log |


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

## [v1.2.2] - 2025-05-24
### Fixed
- Types file was not included in the package, causing issues for TypeScript users.

---

See [CHANGELOG.md](./CHANGELOG.md) for previous versions and more details.

## License
MIT
