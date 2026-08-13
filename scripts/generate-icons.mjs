import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const root = process.cwd();
const source = await readFile(join(root, "public", "icon.svg"));

await Promise.all([
  sharp(source).resize(192, 192).png().toFile(join(root, "public", "icon-192.png")),
  sharp(source).resize(512, 512).png().toFile(join(root, "public", "icon-512.png")),
  sharp(source).resize(384, 384).extend({ top: 64, bottom: 64, left: 64, right: 64, background: "#1769e0" }).png().toFile(join(root, "public", "icon-maskable-512.png")),
  sharp(source).resize(180, 180).png().toFile(join(root, "app", "apple-icon.png")),
]);

console.log("Generated PWA and Apple touch icons.");
