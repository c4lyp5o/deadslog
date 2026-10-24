import { build } from "esbuild";

const shared = {
	entryPoints: ["src/index.js"],
	bundle: true,
	minify: true,
	platform: "node",
	target: "node18",
	sourcemap: false,
	logLevel: "info",
};

await Promise.all([
	build({ ...shared, outfile: "dist/index.js", format: "esm" }),
	// Real CommonJS bundle so `require("deadslog")` works without require(esm) support.
	build({
		...shared,
		outfile: "dist/index.cjs",
		format: "cjs",
		footer: { js: "module.exports=module.exports.default;" },
	}),
]).catch(() => process.exit(1));
