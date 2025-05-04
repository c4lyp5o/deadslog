import { build } from "esbuild";

await build({
	entryPoints: ["src/index.js"],
	outfile: "dist/index.js",
	bundle: true,
	minify: true,
	platform: "node",
	target: "node16",
	format: "esm",
	sourcemap: false,
	define: {
		"process.env.NODE_ENV": '"production"',
		__DEV__: "false",
	},
	mangleProps: /^_/, // Optional but very effective
	logLevel: "info",
}).catch(() => process.exit(1));
