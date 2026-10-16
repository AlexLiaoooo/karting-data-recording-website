import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TrackEditor, LayoutEditor } from "../../components/track-map/editors";
import { LanguageProvider } from "../i18n";

let root: Root; let container: HTMLDivElement; let opener: HTMLButtonElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.clearAllMocks();
  opener = document.createElement("button"); document.body.appendChild(opener); opener.focus();
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); opener.remove(); vi.unstubAllGlobals(); });

describe("Track Map editor dialogs", () => {
  it.each(["track", "layout"])("names the %s editor, focuses its name and keeps Tab inside", async kind => {
    const close = vi.fn(); const save = vi.fn();
    const editor = kind === "track" ? createElement(TrackEditor, { onClose: close, onSave: save }) : createElement(LayoutEditor, { onClose: close, onSave: save });
    await act(async () => root.render(createElement(LanguageProvider, null, editor)));
    const dialog = container.querySelector("dialog")!;
    expect(document.getElementById(dialog.getAttribute("aria-labelledby")!)!.textContent).toBe(kind === "track" ? "New track" : "New layout");
    expect(document.activeElement).toBe(dialog.querySelector("input"));
    dialog.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.focus();
    const event = new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }); document.activeElement!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true); expect(document.activeElement).toBe(dialog.querySelector('button[type="submit"]'));
    await act(async () => dialog.dispatchEvent(new Event("cancel", { cancelable: true })));
    expect(close).toHaveBeenCalledOnce(); expect(save).not.toHaveBeenCalled();
    await act(async () => root.render(null)); expect(document.activeElement).toBe(opener);
  });
});
