import { act, createElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Modal } from "../components/modal";

let container: HTMLDivElement; let root: Root; let trigger: HTMLButtonElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  // jsdom has no native dialog implementation. Browser checks cover real inertness and Tab.
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: vi.fn(function (this: HTMLDialogElement) { this.setAttribute("open", ""); }) });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: vi.fn(function (this: HTMLDialogElement) { this.removeAttribute("open"); }) });
  trigger = document.createElement("button"); trigger.textContent = "Open"; document.body.appendChild(trigger); trigger.focus();
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); trigger.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function render(busy = false, strict = false) {
  const content = createElement(Modal, { labelledBy: "title", onDismiss: dismiss, busy }, [
    createElement("h2", { key: "title", id: "title", tabIndex: -1, "data-dialog-busy-focus": true }, "Confirm"),
    createElement("button", { key: "confirm", disabled: busy }, "Confirm"),
    createElement("button", { key: "cancel", disabled: busy, "data-dialog-initial-focus": true }, "Cancel"),
  ]);
  await act(async () => root.render(strict ? createElement(StrictMode, null, content) : content));
}
const dismiss = vi.fn();
function key(shiftKey = false) { const event = new KeyboardEvent("keydown", { key: "Tab", shiftKey, bubbles: true, cancelable: true }); document.activeElement!.dispatchEvent(event); return event; }

describe("shared modal behavior", () => {
  it("uses the toolbar fallback when no opening control was focused", async () => {
    trigger.blur(); expect(document.activeElement).toBe(document.body);
    const toolbar = () => createElement("header", { className: "topbar" }, createElement("button", null, "Back"));
    await act(async () => root.render(createElement("main", { className: "app-shell" }, toolbar(), createElement(Modal, { labelledBy: "body-title", onDismiss: dismiss }, createElement("h2", { id: "body-title" }, "Record")))));
    await act(async () => root.render(createElement("main", { className: "app-shell" }, toolbar())));
    expect(document.activeElement!.textContent).toBe("Back");
  });
  it("focuses the new screen's toolbar when its original opener no longer exists", async () => {
    await act(async () => root.render(createElement("main", { className: "app-shell" }, createElement("header", { className: "topbar" }, createElement("button", null, "Back")), createElement(Modal, { labelledBy: "fallback-title", onDismiss: dismiss }, createElement("h2", { id: "fallback-title" }, "Record")))));
    trigger.remove();
    await act(async () => root.render(createElement("main", { className: "app-shell" }, createElement("header", { className: "topbar" }, createElement("button", null, "Back")))));
    expect(document.activeElement!.textContent).toBe("Back");
  });
  it("opens with a named modal and the explicitly safe initial action", async () => {
    await render();
    expect(container.querySelector("dialog")!.open).toBe(true);
    expect(container.querySelector("dialog")!.getAttribute("aria-labelledby")).toBe("title");
    expect(document.activeElement!.textContent).toBe("Cancel");
  });
  it("cycles both Tab boundaries and excludes hidden, disabled and negative-tabindex controls", async () => {
    await render(); const dialog = container.querySelector("dialog")!;
    const hidden = document.createElement("button"); hidden.style.display = "none"; dialog.appendChild(hidden);
    expect(key().defaultPrevented).toBe(true); expect(document.activeElement!.textContent).toBe("Confirm");
    expect(key(true).defaultPrevented).toBe(true); expect(document.activeElement!.textContent).toBe("Cancel");
  });
  it("dismisses on native Escape cancellation only when not busy", async () => {
    dismiss.mockClear(); await render();
    await act(async () => container.querySelector("dialog")!.dispatchEvent(new Event("cancel", { bubbles: false, cancelable: true })));
    expect(dismiss).toHaveBeenCalledTimes(1);
    await render(true);
    const event = new Event("cancel", { cancelable: true }); container.querySelector("dialog")!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true); expect(dismiss).toHaveBeenCalledTimes(1);
    expect(document.activeElement!.id).toBe("title");
    expect(key().defaultPrevented).toBe(true);
  });
  it("returns focus to the opener after closing", async () => {
    await render(); await act(async () => root.render(null));
    expect(document.activeElement).toBe(trigger);
  });
  it("does not let Strict Mode replay steal focus from the reopened dialog", async () => {
    await render(false, true); expect(document.activeElement!.textContent).toBe("Cancel");
    await act(async () => root.render(null)); expect(document.activeElement).toBe(trigger);
  });
});
