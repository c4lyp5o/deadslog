# Changelog

All notable changes to this project will be documented in this file.

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