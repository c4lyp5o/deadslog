# Changelog

All notable changes to this project will be documented in this file.

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

## [v1.2.2] - 2025-05-24
### Fixed
- Types file was not included in the package, causing issues for TypeScript users.

## [v1.2.1] - 2025-05-21
### Added
- Added `getMetrics()` method to retrieve log metrics (e.g., total logs, errors).
- Automatic CommonJS wrapper generation (`dist/index.cjs`) for seamless dual ESM/CJS support.
- TypeScript type definitions are now generated and included in the published package.
- JSDoc typedefs and return annotations for full IntelliSense support.

### Changed
- Changed output format so that only level is colored in console logs.
- Build process now includes a script to generate the CJS wrapper after every build.
- Improved `.npmignore` and `.gitignore` recommendations for clean publishing.
- Updated `package.json` to use `exports` for both ESM and CJS entrypoints, and to include types.

### Fixed
- No major bug fixes in this release, but improved compatibility and developer experience.

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