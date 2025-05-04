import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// Enable coverage reporting
		coverage: {
			provider: "v8", // Use 'v8' or 'c8' as the coverage provider
			reporter: ["text", "lcov", "html"], // Generate coverage reports in text, lcov, and HTML formats
			include: ["src/*.js", "src/utils/*.js"], // Include all source files in the `src` directory
			exclude: ["node_modules", "test", "dist"], // Exclude test files, dependencies, and build files
			reportsDirectory: "./coverage", // Output directory for coverage reports
		},
	},
});
