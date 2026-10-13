import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePhotoSource } from "./photo-source";
import type { LoggerPhoto } from "./types";
let root: Root; let container: HTMLDivElement;
const photo: LoggerPhoto = { capturedAt: "2026-10-13T09:00:00.000Z", sourceName: "logger.png", mimeType: "image/png", size: 4, width: 1200, height: 800, blob: new Blob(["1234"], { type: "image/png" }) };
function Preview({ photo }: { photo: LoggerPhoto }) { return createElement("a", { href: usePhotoSource(photo) }, "Photo"); }
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.stubGlobal("URL", { createObjectURL: vi.fn().mockReturnValue("blob:photo-test"), revokeObjectURL: vi.fn() }); container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
describe("local photo URL lifecycle", () => {
  it("allocates a native preview URL on mount, reuses it during renders and revokes it on close", async () => {
    await act(async () => root.render(createElement(Preview, { photo })));
    expect(container.querySelector("a")!.href).toBe("blob:photo-test"); expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    await act(async () => root.render(createElement(Preview, { photo }))); expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    await act(async () => root.render(null)); expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:photo-test");
  });
  it("supports legacy portable previews without allocating a Blob URL", async () => {
    await act(async () => root.render(createElement(Preview, { photo: { ...photo, blob: undefined, dataUrl: "data:image/png;base64,AQIDBA==" } })));
    expect(container.querySelector("a")!.href).toBe("data:image/png;base64,AQIDBA=="); expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
