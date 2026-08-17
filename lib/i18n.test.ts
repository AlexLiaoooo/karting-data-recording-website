import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { zhDictionary } from "./i18n";

const ROOT = join(__dirname, "..");
const SOURCES = [
  "app/page.tsx",
  ...readdirSync(join(ROOT, "components/track-map"))
    .filter((file) => file.endsWith(".tsx"))
    .map((file) => `components/track-map/${file}`),
];

/** Every literal key passed to t() in the app, with where it came from. */
function usedKeys() {
  const keys = new Map<string, string>();
  for (const file of SOURCES) {
    const source = readFileSync(join(ROOT, file), "utf8");
    for (const match of source.matchAll(/\bt\("((?:[^"\\]|\\.)+)"/g)) {
      keys.set(match[1].replace(/\\"/g, '"'), file);
    }
  }
  return keys;
}

describe("Chinese translations", () => {
  it("covers every string the app passes to t()", () => {
    const missing = [...usedKeys()]
      .filter(([key]) => !(key in zhDictionary))
      .map(([key, file]) => `${key}  (${file})`);

    expect(missing, `untranslated keys:\n${missing.join("\n")}`).toEqual([]);
  });

  it("has no blank or accidentally-English translations", () => {
    const suspect = Object.entries(zhDictionary)
      .filter(([key, value]) => !value.trim() || value === key)
      // Structural nouns of the data model, product names and headings that USER_GUIDE.zh-CN.md
      // deliberately leaves in English, so they read the same in both languages.
      .filter(([key]) => ![
        "Kart Data", "Track Library", "Track maps", "Sessions", "Runs", "Events", "Layouts",
        "Run", "Run {number}", "Chassis setup", "Driver feedback",
        "TRACK MAP NOTEBOOK", "TRACK LIBRARY", "TRACK LAYOUT", "CHASSIS SETUP",
      ].includes(key))
      .map(([key]) => key);

    expect(suspect).toEqual([]);
  });

  it("keeps every placeholder in the translation that the English has", () => {
    for (const [key, value] of Object.entries(zhDictionary)) {
      const inKey = [...key.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      const inValue = [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      expect(inValue, `placeholders differ for "${key}"`).toEqual(inKey);
    }
  });

  it("does not translate values that are stored in records", () => {
    // These are written into IndexedDB as record values, so translating them would corrupt data.
    for (const stored of ["Full Layout", "PF International"]) {
      expect(stored in zhDictionary, `${stored} must not be translated`).toBe(false);
    }
  });
});
