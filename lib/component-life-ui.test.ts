import { act, createElement, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ComponentLifeNotebook, RunComponents } from "../components/component-life";
import { LanguageProvider } from "./i18n";
import type { AppData, KartComponent } from "./types";
import { makeAppData, makeRun } from "./test-fixtures";
const part: KartComponent = { id: "engine-a", name: "Engine A", kind: "Engine", notes: "", initialLaps: 100, serviceIntervalLaps: 120, retired: false, services: [], createdAt: "stamp", updatedAt: "stamp" };
let root: Root; let container: HTMLDivElement; let current: AppData; const open = vi.fn();
function Harness({ initial }: { initial: AppData }) {
  const [data, setData] = useState(initial); useEffect(() => { current = data; }, [data]);
  return createElement(ComponentLifeNotebook, { data, onOpen: open, onSave: component => setData(previous => ({ ...previous, components: previous.components.some(item => item.id === component.id) ? previous.components.map(item => item.id === component.id ? component : item) : [...previous.components, component] })) });
}
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
async function render(initial = makeAppData({ components: [part] })) { initial.events[0].sessions[0].runs[0].componentIds = [part.id]; await act(async () => root.render(createElement(LanguageProvider, null, createElement(Harness, { initial })))); }
async function click(name: string) { const button = [...container.querySelectorAll("button")].find(button => button.textContent?.trim() === name); if (!button) throw Error(`Missing ${name}`); await act(async () => button.click()); }
async function fill(name: string, value: string) { const label = [...container.querySelectorAll("label")].find(label => label.querySelector("span")?.textContent === name)!; const input = label.querySelector<HTMLInputElement | HTMLTextAreaElement>("input,textarea")!; await act(async () => { Object.getOwnPropertyDescriptor(input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); }); }
async function submit(selector: string) { await act(async () => container.querySelector(selector)!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); }

describe("component notebook controls", () => {
  it("keeps the guard active until all component and service drafts have closed", async () => {
    await render(); await click("Edit component"); await click("Record service");
    await fill("Service performed", "Unfinished top-end inspection");
    await fill("Component notes", "New notes"); await submit(".component-form");
    expect(container.querySelector<HTMLTextAreaElement>(".component-service-form textarea")!.value).toBe("Unfinished top-end inspection");
    expect(container.querySelector<HTMLButtonElement>(".component-card .list-item")!.disabled).toBe(true);
    const blocked = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(blocked);
    expect(blocked.defaultPrevented).toBe(true);
    await submit(".component-service-form");
    expect(current.components[0].services[0].notes).toBe("Unfinished top-end inspection");
    expect(container.querySelector<HTMLButtonElement>(".component-card .list-item")!.disabled).toBe(false);
    const allowed = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(allowed);
    expect(allowed.defaultPrevented).toBe(false);
  });
  it("does not replace or remove a service while its edit draft is open", async () => {
    await render(makeAppData({ components: [{ ...part, services: [{ id: "s", date: "2026-10-10", lapsAtService: 100, notes: "Original service" }] }] }));
    await click("Edit service"); await fill("Service performed", "Unfinished correction");
    await click("Edit service"); await click("Remove service");
    expect(container.querySelector<HTMLTextAreaElement>(".component-service-form textarea")!.value).toBe("Unfinished correction");
    expect(current.components[0].services[0].notes).toBe("Original service");
    await click("Cancel");
    expect(current.components[0].services[0].notes).toBe("Original service");
    expect(container.querySelector(".component-service-form")).toBeNull();
  });
  it("keeps an open component draft when another record is requested and guards unload until cancellation", async () => {
    await render(); await click("Edit component"); await fill("Component notes", "Unsaved engine adjustment");
    await click("Add component"); await click("Edit component");
    const input = container.querySelector<HTMLTextAreaElement>(".component-form textarea")!;
    expect(input.value).toBe("Unsaved engine adjustment");
    expect(container.querySelector<HTMLButtonElement>(".component-card .list-item")!.disabled).toBe(true);
    const blocked = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(blocked);
    expect(blocked.defaultPrevented).toBe(true);
    await click("Cancel");
    expect(container.querySelector<HTMLButtonElement>(".component-card .list-item")!.disabled).toBe(false);
    const allowed = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(allowed);
    expect(allowed.defaultPrevented).toBe(false);
    expect(current.components[0].notes).toBe("");
  });
  it("creates components only with whole starting usage and a valid optional interval", async () => {
    await render(makeAppData({ components: [] })); await click("Add component"); await fill("Component name", "Chain A"); await fill("Service interval (laps)", "0"); await submit(".component-form");
    expect(current.components).toEqual([]); expect(container.textContent).toContain("positive whole interval");
    await fill("Service interval (laps)", "200"); await submit(".component-form");
    expect(current.components[0]).toMatchObject({ name: "Chain A", initialLaps: 0, serviceIntervalLaps: 200, services: [] });
  });
  it("records service, edits the same entry and recalculates after confirmed removal", async () => {
    await render(); expect(container.textContent).toContain("Due soon"); await click("Record service"); await fill("Service performed", "Top-end service"); await submit(".component-service-form");
    expect(current.components[0].services[0]).toMatchObject({ lapsAtService: 112, notes: "Top-end service" }); expect(container.textContent).toContain("Within interval");
    await click("Edit service"); await fill("Lifetime laps at service", "110"); await submit(".component-service-form"); expect(current.components[0].services).toHaveLength(1); expect(current.components[0].services[0].lapsAtService).toBe(110);
    await click("Remove service"); expect(current.components[0].services).toHaveLength(1); await click("Confirm removal"); expect(current.components[0].services).toEqual([]); expect(container.textContent).toContain("Due soon");
  });
  it("retirement preserves service/history and metadata edits do not overwrite a newly recorded service", async () => {
    await render(); await click("Edit component"); await click("Record service"); await fill("Service performed", "New chain and check"); await submit(".component-service-form");
    await click("Retire component"); await fill("Component notes", "Spare"); await submit(".component-form");
    expect(current.components[0]).toMatchObject({ retired: true, notes: "Spare" }); expect(current.components[0].services).toHaveLength(1);
    expect(current.events[0].sessions[0].runs[0].componentIds).toEqual([part.id]); await click("Reactivate component"); expect(current.components[0].retired).toBe(false);
  });
  it("flags inconsistent service counters and opens the source Run", async () => {
    await render(makeAppData({ components: [{ ...part, services: [{ id: "s", date: "2026-10-10", lapsAtService: 200, notes: "Check counter" }] }] }));
    expect(container.textContent).toContain("Check service counter");
    await act(async () => container.querySelector<HTMLButtonElement>(".component-card .list-item")!.click()); expect(open).toHaveBeenCalledWith(expect.objectContaining({ run: expect.objectContaining({ id: "run-1" }) }));
  });
  it("keeps invalid service counters and future dates out of history", async () => {
    await render(); await click("Record service"); await fill("Service performed", "Service"); await fill("Lifetime laps at service", "-1"); await submit(".component-service-form"); expect(current.components[0].services).toEqual([]);
    await fill("Lifetime laps at service", "112"); await fill("Service date", "2099-01-01"); await submit(".component-service-form"); expect(current.components[0].services).toEqual([]);
  });
  it("shows selected retired parts but excludes them from new assignments", async () => {
    const update = vi.fn(); const run = makeRun({ componentIds: [part.id] });
    await act(async () => root.render(createElement(LanguageProvider, null, createElement(RunComponents, { run, components: [{ ...part, retired: true }, { ...part, id: "retired-other", name: "Retired other", retired: true }], onUpdate: update }))));
    expect(container.textContent).toContain("Engine A"); expect(container.textContent).not.toContain("Retired other");
    await act(async () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    expect(update.mock.lastCall![0](run).componentIds).toEqual([]);
  });
});
