# deadslog

[![CI & Publish](https://github.com/c4lyp5o/deadslog/actions/workflows/ci-publish.yml/badge.svg)](https://github.com/c4lyp5o/deadslog/actions/workflows/ci-publish.yml)
[![codecov](https://codecov.io/gh/c4lyp5o/deadslog/graph/badge.svg?token=CBXCJDUJS9)](https://codecov.io/gh/c4lyp5o/deadslog)

**deadslog** is a dead simple, yet powerful logging library for Node.js.  
It supports console and file output, log rotation, custom formatting, and graceful shutdown with async-safe queuing.

---

## 🚀 Features

- ✅ Console and file logging
- 🔁 Log rotation (delete or archive old logs)
- 🎨 Colorized or plain output using `chalk`
- ✨ Custom message formatting
- 🧵 Async-safe log queue with backpressure support
- 🔒 Graceful shutdown with automatic log flushing

---

## 📦 Installation

```bash
npm install deadslog
```

Requires Node.js 16+ (uses native ES modules and async stream pipeline)


## 🛠️ Usage

```javascript
import deadslog from 'deadslog';

const logger = deadslog({
  consoleOutput: {
    enabled: true,
    coloredCoding: true,
  },
  fileOutput: {
    enabled: true,
    logFilePath: './logs/app.log',
    rotate: true,
    maxLogSize: 500000, // bytes
    maxLogFiles: 5,
    onMaxLogFilesReached: 'archiveOld', // Options: 'archiveOld' or 'deleteOld'
  },
  minLevel: 'debug', // Minimum log level to record
});

logger.trace("This is a trace message"); // Trace-level message
logger.debug("Debugging info"); // Debug-level message
logger.info("General information"); // Info-level message
logger.success("Operation succeeded!"); // Success-level message
logger.warn("Something might be wrong"); // Warning-level message
logger.error("An error occurred"); // Error-level message
logger.fatal("Fatal error encountered"); // Fatal-level message

// Optional: Clean up resources and shut down the logger gracefully
await logger.destroy();
```

### Pro Tip 💡
For scenarios where only console logging is required, you can use `deadslog` with its default configuration. This eliminates the need for additional setup.

```javascript
import deadslog from 'deadslog';

const logger = deadslog();

logger.info("This will log to the console with default settings");
logger.error("Errors will also be displayed in the console");
```


## ⚙️ Configuration Options

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


## 🧩 Custom Formatter Example

```javascript
const jsonFormatter = (level, message) => {
  return JSON.stringify({
    level,
    timestamp: new Date().toISOString(),
    message
  });
};
```

To use a formatter:

```javascript
const logger = deadslog({
  formatter: jsonFormatter
});
```


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


## 🪪 License

MIT
