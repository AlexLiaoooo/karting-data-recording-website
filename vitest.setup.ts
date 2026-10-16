// The data layer runs in the browser, so tests need the browser APIs it depends on:
// IndexedDB for the database tests, and crypto.randomUUID for record creation.
import "fake-indexeddb/auto";
import { webcrypto } from "node:crypto";

// jsdom has no showModal/close implementation. Real browser checks verify native inertness.
if (typeof HTMLDialogElement !== "undefined") {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value(this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute("open"); } });
}
if (typeof HTMLElement !== "undefined" && !HTMLElement.prototype.scrollIntoView) {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value() {} });
}

if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
}
