# deadslog

A dead simple logger module for Node.js.

## Installation

```bash
npm install deadslog
```

## Usage

```javascript
import deadslog from "deadslog";

const logger = deadslog({ logFilePath: 'path/to/logfile.log' });

logger.info("This is an info message"); // Log an info message
logger.warn("This is a warning message"); // Log a warning message
logger.error("This is an error message"); // Log an error message
logger.destroy(); // Clean up resources when done
```

## License

ISC