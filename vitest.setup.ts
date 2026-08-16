// The data layer runs in the browser, so tests need the browser APIs it depends on:
// IndexedDB for the database tests, and crypto.randomUUID for record creation.
import "fake-indexeddb/auto";
import { webcrypto } from "node:crypto";

if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
}
