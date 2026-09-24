// Bundles React + the test harness into a classic script served from /public.
// Classic (non-module) because the sandboxed iframe has an opaque origin, and
// module scripts would need CORS headers to load from our origin.
import { build } from "esbuild";

await build({
  entryPoints: ["src/sandbox/runtime-entry.ts"],
  outfile: "public/sandbox/runtime.js",
  bundle: true,
  format: "iife",
  minify: true,
  target: "es2020",
  define: { "process.env.NODE_ENV": '"development"' }, // React's act() needs the dev build
  logLevel: "warning",
});
