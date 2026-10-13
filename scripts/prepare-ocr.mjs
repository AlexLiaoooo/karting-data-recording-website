import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const destination = join(process.cwd(), "public", "ocr");
const modules = join(process.cwd(), "node_modules");
await mkdir(destination, { recursive: true });
await copyFile(join(modules, "tesseract.js", "dist", "worker.min.js"), join(destination, "worker.min.js"));
// OEM.LSTM_ONLY uses these three device variants in the installed v7 getCore implementation.
// Copy both wrappers and WASM files so no engine asset can fall back to a remote CDN.
const variants = ["tesseract-core-lstm", "tesseract-core-simd-lstm", "tesseract-core-relaxedsimd-lstm"];
for (const variant of variants) {
  for (const suffix of [".wasm.js", ".wasm"]) await copyFile(join(modules, "tesseract.js-core", variant + suffix), join(destination, variant + suffix));
}
await copyFile(join(modules, "@tesseract.js-data", "eng", "4.0.0_best_int", "eng.traineddata.gz"), join(destination, "eng.traineddata.gz"));
const notices = [];
for (const name of ["tesseract.js", "tesseract.js-core", "@tesseract.js-data/eng"]) {
  const directory = join(modules, name);
  const metadata = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
  notices.push(`${name} ${metadata.version} · ${metadata.license ?? "Apache-2.0"} · https://github.com/naptha/tesseract.js`);
  for (const filename of (await readdir(directory)).filter(name => /^licen[sc]e/i.test(name))) notices.push(await readFile(join(directory, filename), "utf8"));
}
await writeFile(join(destination, "LICENSES.txt"), notices.join("\n\n"));
console.log("Prepared same-origin English OCR worker, models and licenses.");
