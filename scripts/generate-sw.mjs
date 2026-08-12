import { readdir, writeFile } from "node:fs/promises";
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

const files = (await listFiles(outputDirectory))
  .map((file) => `/${relative(outputDirectory, file).split(sep).join("/")}`)
  .filter((file) => file !== "/sw.js" && !file.endsWith(".map"));

const precache = Array.from(new Set(["/", ...files])).sort();
const serviceWorker = `const CACHE_NAME = "kart-data-${Date.now()}";
const PRECACHE = ${JSON.stringify(precache, null, 2)};

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (event.request.destination === "document") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/"))),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request)),
  );
});
`;

await writeFile(join(outputDirectory, "sw.js"), serviceWorker, "utf8");
console.log(`Generated service worker with ${precache.length} precached files.`);

