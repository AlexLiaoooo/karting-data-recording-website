import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TrackEditor, LayoutEditor } from "../../components/track-map/editors";
import { LanguageProvider } from "../i18n";
import { ConfirmDeleteDialog } from "../../components/track-map/shared";
import { BuiltInTrackPicker } from "../../components/track-map/TrackLibrary";
import { BUILT_IN_TRACKS } from "./built-in-maps";
import { makeTrack } from "../test-fixtures";

let root: Root; let container: HTMLDivElement; let opener: HTMLButtonElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.clearAllMocks();
  opener = document.createElement("button"); document.body.appendChild(opener); opener.focus();
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); opener.remove(); vi.unstubAllGlobals(); });

describe("Track Map editor dialogs", () => {
  it("keeps the built-in picker on enabled rows and cancels without importing", async () => {
    const close = vi.fn(); const pick = vi.fn();
    await act(async () => root.render(createElement(LanguageProvider, null, createElement(BuiltInTrackPicker, { tracks: BUILT_IN_TRACKS, existing: [makeTrack({ name: BUILT_IN_TRACKS[0].name })], onClose: close, onPick: pick }))));
    const dialog = container.querySelector("dialog")!;
    const closeButton = dialog.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!;
    expect(document.activeElement).toBe(closeButton);
    closeButton.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe([...dialog.querySelectorAll(".list-item:not(:disabled)")].at(-1));
    await act(async () => dialog.dispatchEvent(new Event("cancel", { cancelable: true })));
    expect(close).toHaveBeenCalledOnce(); expect(pick).not.toHaveBeenCalled();
  });
  it("starts map deletion on Cancel and never confirms on Escape", async () => {
    const cancel = vi.fn(); const confirm = vi.fn();
    await act(async () => root.render(createElement(LanguageProvider, null, createElement(ConfirmDeleteDialog, { title: "Delete map?", detail: "Marker notes will be removed.", onCancel: cancel, onConfirm: confirm }))));
    const dialog = container.querySelector('dialog[role="alertdialog"]')!;
    expect(document.activeElement!.textContent).toBe("Cancel");
    expect(document.getElementById(dialog.getAttribute("aria-describedby")!)!.textContent).toContain("Marker notes");
    await act(async () => dialog.dispatchEvent(new Event("cancel", { cancelable: true })));
    expect(cancel).toHaveBeenCalledOnce(); expect(confirm).not.toHaveBeenCalled();
  });
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
