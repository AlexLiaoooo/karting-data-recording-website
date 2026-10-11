import { describe, expect, it } from "vitest";
import { cardPages, handoverCard, wrapCardText } from "./handover";
import { recordedRuns } from "./experiments";
import { makeAppData, makeEvent, makeRun, makeSession } from "./test-fixtures";
const t = (key: string) => key;

describe("mechanic handover", () => {
  it("uses Session overrides, original readings, missing values and unfinished status", () => {
    const data = makeAppData({ events: [makeEvent({ sessions: [makeSession({ condition: "Wet", trackTemperature: "15", runs: [makeRun({ completed: false, recordingPhase: "after", fastestLap: "1:02.500" })] })] })] });
    const original = JSON.stringify(data);
    const card = handoverCard(data, recordedRuns(data.events)[0], t);
    expect(card.context.at(-1)).toBe("Unfinished · After Run");
    expect(card.sections[0].rows).toContainEqual({ label: "Surface", value: "Wet" });
    expect(card.sections[0].rows).toContainEqual({ label: "Track temperature", value: "15 °C" });
    expect(card.sections.find(section => section.title === "Tyre readings")?.rows[0].value).toContain("10.0 → 12.5 PSI (+2.5)");
    expect(card.sections.find(section => section.title === "Tyre readings")?.rows[1].value).toContain("— → —");
    expect(card.sections.find(section => section.title === "Performance")?.rows).toContainEqual({ label: "Fastest lap", value: "1:02.500" });
    expect(JSON.stringify(data)).toBe(original);
  });
  it("uses the explicit experiment baseline and flags different conditions or circuits", () => {
    const first = makeRun();
    const second = makeRun({ id: "test", number: 2, experiment: { baselineRunId: first.id, change: "Two teeth shorter", expectation: "Better exit", outcome: "More stable" } });
    second.setup.rearSprocket = "84";
    const data = makeAppData({ events: [makeEvent(), makeEvent({ id: "test-event", condition: "Wet", sessions: [makeSession({ id: "test-session", runs: [second] })] })] });
    const card = handoverCard(data, recordedRuns(data.events)[1], t);
    const changes = card.sections.find(section => section.title === "Recorded changes")!.rows;
    expect(changes).toContainEqual({ label: "Rear sprocket", value: "82 → 84" });
    expect(changes).toContainEqual({ label: "What happened", value: "More stable" });
    expect(changes).toContainEqual({ label: "Comparison context", value: "Conditions or circuits differ; check the source context." });
  });
  it("uses the preceding Run number and never silently substitutes a missing chosen baseline", () => {
    const data = makeAppData({ events: [makeEvent({ sessions: [makeSession({ runs: [makeRun({ id: "later", number: 3 }), makeRun()] })] })] });
    const entry = recordedRuns(data.events)[0];
    expect(handoverCard(data, entry, t).sections.find(section => section.title === "Recorded changes")?.rows[0].value).toContain("Run 01");
    entry.run.experiment = { baselineRunId: "missing", change: "", expectation: "", outcome: "" };
    expect(handoverCard(data, entry, t).sections.find(section => section.title === "Recorded changes")?.rows[0].value).toBe("Baseline Run unavailable");
  });
  it("keeps literal markup as text and wraps long words, Chinese, emoji and newlines", () => {
    const input = "<script>text</script>\n轮胎状态很好🙂";
    const lines = wrapCardText(input, text => Array.from(text).length, 5);
    expect(lines.every(line => Array.from(line).length <= 5)).toBe(true);
    expect(lines.join("")).toBe(input.replace("\n", ""));
  });
  it("preserves long feedback across bounded pages without dropping the final text", () => {
    const card = { title: "Card", reference: "Run 01", context: [], sections: [{ title: "Feedback", rows: [{ label: "Notes", value: `${"long note ".repeat(3000)}FINAL NOTE` }] }] };
    const pages = cardPages(card, text => text.length * 20);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.every(page => page.length <= 54)).toBe(true);
    expect(pages.flat().map(line => line.text).join(" ")).toMatch(/FINAL\s+NOTE$/);
  });
});
