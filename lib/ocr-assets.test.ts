import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
describe("offline OCR packaging", () => {
  it("pins the engine/model and prepares same-origin assets in dev and production builds", () => {
    const root = join(__dirname, ".."); const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(pkg.dependencies["tesseract.js"]).toBe("7.0.0"); expect(pkg.devDependencies["@tesseract.js-data/eng"]).toBe("1.0.0");
    expect(pkg.scripts.build).toContain("prepare-ocr.mjs"); expect(pkg.scripts.dev).toContain("prepare-ocr.mjs");
    for (const name of ["tesseract-core-lstm", "tesseract-core-simd-lstm", "tesseract-core-relaxedsimd-lstm"]) {
      expect(existsSync(join(root, "node_modules", "tesseract.js-core", `${name}.wasm.js`))).toBe(true);
    }
    const source = readFileSync(join(root, "lib", "logger-ocr.ts"), "utf8");
    expect(source).toContain("location.origin"); expect(source).not.toContain("cdn.jsdelivr");
  });
});
