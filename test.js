import deadslog from "./logger.js";
import fs from "node:fs";

const logFilePath = "test-log.txt";
const logger = deadslog({ logFilePath });

logger.info("This is a test info message");
logger.warn("This is a test warning message");
logger.error("This is a test error message");

// Verify file logging
if (fs.existsSync(logFilePath)) {
	const logContent = fs.readFileSync(logFilePath, "utf8");
	console.log("\nLog file content:");
	console.log(logContent);
} else {
	console.error("Log file was not created.");
}

// Clean up
logger.destroy();

// Remove the test log file after testing
if (fs.existsSync(logFilePath)) {
	fs.unlinkSync(logFilePath);
	console.log("Test log file removed.");
}

// Test cases for deadslog
// 1. Test info logging
// 2. Test warning logging
// 3. Test error logging
// 4. Test file logging
// 5. Test console logging
// 6. Test log file creation
// 7. Test log file content
// 8. Test log file cleanup
