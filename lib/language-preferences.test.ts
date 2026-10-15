import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("language without preference storage", () => {
  it("renders and switches both ways when reads and writes throw", async () => {
    vi.resetModules(); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    const { LanguageProvider, LanguageToggle } = await import("./i18n");
    const container = document.createElement("div"); document.body.appendChild(container);
    const root = createRoot(container);
    try {
      await act(async () => root.render(createElement(LanguageProvider, null, createElement(LanguageToggle))));
      expect(document.documentElement.lang).toBe("en");
      await act(async () => container.querySelector("button")!.click());
      expect(document.documentElement.lang).toBe("zh-CN");
      expect(container.querySelector("button")!.getAttribute("aria-label")).toBe("切换到英文");
      await act(async () => container.querySelector("button")!.click());
      expect(document.documentElement.lang).toBe("en");
    } finally { await act(async () => root.unmount()); container.remove(); }
  });
});
