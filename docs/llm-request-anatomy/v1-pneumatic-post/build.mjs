// Build the sorting-line figure: node build.mjs [--light]
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
process.argv.splice(2, 0, dirname(fileURLToPath(import.meta.url)));
await import("../scripts/build-figure.mjs");
