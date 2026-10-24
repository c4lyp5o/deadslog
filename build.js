import { writeFile } from "node:fs/promises";
import { build } from "esbuild";

// One CommonJS bundle serves both entry points: Node can import CJS from ESM,
// so the ESM entry is a one-line re-export instead of a second copy of the code.
await build({
	entryPoints: ["src/index.js"],
	outfile: "dist/index.cjs",
	bundle: true,
	minify: true,
	platform: "node",
	target: "node18",
	format: "cjs",
	sourcemap: false,
	logLevel: "info",
	footer: { js: "module.exports=module.exports.default;" },
}).catch(() => process.exit(1));

await writeFile("dist/index.js", 'export { default } from "./index.cjs";\n');
