# Changelog

All notable changes to this project will be documented in this file.

## [v1.2.0] - 2025-05-04
### Added
- Introduced a new `compose` utility to allow functional composition for color transformations in `colorMap`.
- Added support for handling `undefined` and non-serializable objects in the default formatter.
- Included JSDoc comments for enhanced maintainability and developer experience, explaining key functions, constants, and configurations.
- Added detailed error messages and logging for internal operations like file rotation, queue processing, and write operations.
- Added more robust retry mechanisms for file system operations using helper functions (`existsWithRetry`, `statWithRetry`, etc.).

### Changed
- Replaced the `chalk` library with `yoctocolors` for color mapping to reduce bundle size.
- Refactored file handling to use `node:fs/promises` for modern asynchronous file operations.
- Increased the default `MAX_QUEUE_SIZE` from `1000` to `100000`, allowing for higher scalability in log queueing.
- Improved the `defaultFormatter` to handle additional edge cases and provide more informative log messages.
- Refactored `colorMap` to utilize the new `compose` utility for applying multiple transformations.

### Fixed
- Resolved issues where unhandled exceptions during file rotation could cause the logger to silently fail.
- Improved error handling for file stream initialization and cleanup, ensuring no dangling file streams.

### Removed
- Deprecated the use of `zlib`'s synchronous API in favor of more modern and efficient methods for file compression.

### Notes
- Reduced filesize from 12.3kb to 7.5kb (60.97% reduction)
- Backward compatibility is maintained, but developers are encouraged to transition to the updated API and utilize new features for better performance and reliability.


## [v1.1.1] - 2025-05-03
### Fixed
- Wrong export parameters for helpers

## [v1.1.0] - 2025-05-03
### Added
- Introduced file compression during log rotation when `onMaxLogFilesReached` is set to `archiveOld`.
  - Utilized `zlib.gzipSync` for compressing old log files into `.gz` format.
  
### Improved
- Improved log rotation logic to handle compressed files correctly.
- Enhanced error handling for logging stream errors during and after rotation.

## [v1.0.0] - Initial Release
### Added
- Core logging functionality with console and file output support.
- Configurable logging levels with color-coded console output.
- Log rotation feature with support for strategies:
  - `deleteOld`: Deletes the oldest log files when maximum file count is reached.
  - `archiveOld`: Archives old log files when maximum file count is reached.
- Cleanup functionality to ensure resources are released during application shutdown.
- Queue-based file writing to handle high-volume logging efficiently.