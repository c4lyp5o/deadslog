# deadslog

[![CI & Publish](https://github.com/c4lyp5o/deadslog/actions/workflows/ci-publish.yml/badge.svg)](https://github.com/c4lyp5o/deadslog/actions/workflows/ci-publish.yml)

A dead simple logger module for Node.js.


## 🚀 Features

- ✅ Console & file logging
- 📦 File rotation (archive or delete strategy)
- 🎨 Colored or plain console output
- 🧩 Custom formatting function
- 🧵 Async-safe log queue (with max size)
- 🔒 Graceful shutdown: auto-flush on exit


## 📦 Install

```bash
npm install deadslog
```

Requires Node.js 16+ (uses native ES modules and async stream pipeline)


## Usage

```javascript
import deadslog from 'deadslog';

const logger = deadslog({
  consoleOutput: {
    enabled: true,
    coloredCoding: true
  },
  fileOutput: {
    enabled: true,
    logFilePath: './logs/app.log',
    rotate: true,
    maxLogSize: 500000, // bytes
    maxLogFiles: 5,
    onMaxLogFilesReached: 'archiveOld' // or 'deleteOld'
  },
  minLevel: 'debug'
});

logger.debug("Debug message");
logger.info("Info message");
logger.success("Everything is green!");
logger.warn("This might be an issue...");
logger.error("Something went wrong");

// Optional cleanup
await logger.destroy();
```


## Configuration

| Option                            | Type       | Description                                                |
| --------------------------------- | ---------- | ---------------------------------------------------------- |
| `consoleOutput.enabled`           | `boolean`  | Enable console logging (default: `true`)                   |
| `consoleOutput.coloredCoding`     | `boolean`  | Use colored output with `chalk` (default: `true`)          |
| `fileOutput.enabled`              | `boolean`  | Enable file logging (default: `false`)                     |
| `fileOutput.logFilePath`          | `string`   | Log file location (required if file logging)               |
| `fileOutput.rotate`               | `boolean`  | Enable log rotation                                        |
| `fileOutput.maxLogSize`           | `number`   | Max log size in bytes (required if rotating)               |
| `fileOutput.maxLogFiles`          | `number`   | Max rotated files to keep                                  |
| `fileOutput.onMaxLogFilesReached` | `string`   | `"deleteOld"` or `"archiveOld"` strategy                   |
| `formatter`                       | `function` | Custom message formatter                                   |
| `minLevel`                        | `string`   | Minimum level: `debug`, `info`, `success`, `warn`, `error` |


## 🔧 Formatter Example

```javascript
const jsonFormatter = (level, message) => {
  return JSON.stringify({
    level,
    timestamp: new Date().toISOString(),
    message
  });
};
```


## License

MIT
