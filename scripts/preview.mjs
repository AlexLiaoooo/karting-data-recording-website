import { stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const outputDirectory = resolve("out");

try {
  for (const name of ["index.html", "sw.js"]) {
    const file = await stat(join(outputDirectory, name));
    if (!file.isFile() || file.size === 0) throw new Error(`Missing ${name}`);
  }
} catch {
  console.error("No complete production export found in out/. Run npm run build, then npm start.");
  process.exit(1);
}

// Previewing an existing build works without a package-registry update check.
process.env.NO_UPDATE_CHECK = "1";
const require = createRequire(import.meta.url);
const serverDirectory = dirname(require.resolve("serve/package.json"));
const server = join(serverDirectory, "build/main.js");
process.argv = [process.execPath, server, outputDirectory, "--no-clipboard", ...process.argv.slice(2)];
await import(pathToFileURL(server).href);
