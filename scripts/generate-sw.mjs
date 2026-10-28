import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const outputDirectory = join(process.cwd(), "out");

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? listFiles(path) : [path];
    }),
  );
  return nested.flat();
}

let outputFiles;

try {
  outputFiles = await listFiles(outputDirectory);
} catch (error) {
  if (error?.code === "ENOENT") {
    console.log(
      "Skipping service worker precache generation because the static export directory is managed by the deployment platform.",
    );
    process.exit(0);
  }

  throw error;
}

const files = outputFiles
  .map((file) => `/${relative(outputDirectory, file).split(sep).join("/")}`)
  .filter((file) => file !== "/sw.js" && !file.endsWith(".map"));

const precache = Array.from(new Set(["/", ...files])).sort();
// Keep fallback and generated worker lifecycle/fetch behavior identical.
const template = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
const serviceWorker = template
  .replace(/^const CACHE_NAME = .*;$/m, `const CACHE_NAME = "kart-data-${Date.now()}";`)
  .replace(/^const PRECACHE = .*;$/m, `const PRECACHE = ${JSON.stringify(precache, null, 2)};`);

await writeFile(join(outputDirectory, "sw.js"), serviceWorker, "utf8");
console.log(`Generated service worker with ${precache.length} precached files.`);
