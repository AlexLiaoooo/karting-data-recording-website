import { describe, expect, it } from "vitest";
import { sessionConditions } from "./conditions";
import { makeEvent, makeSession } from "./test-fixtures";

describe("sessionConditions", () => {
  const dryEvent = makeEvent({ condition: "Dry", ambientTemperature: "18", trackTemperature: "24" });

  /** Every Session recorded before these fields existed has none of them, and must read as before. */
  it("inherits everything from the Event when the Session records nothing of its own", () => {
    const resolved = sessionConditions(dryEvent, makeSession());

    expect(resolved).toEqual({
      condition: "Dry",
      ambientTemperature: "18",
      trackTemperature: "24",
      inherited: { condition: true, ambientTemperature: true, trackTemperature: true },
    });
  });

  /** The fault this exists for: a wet Heat 2 inside a dry Event was recorded as dry. */
  it("uses the Session's own condition when it differs from the Event's", () => {
    const resolved = sessionConditions(dryEvent, makeSession({ condition: "Wet" }));

    expect(resolved.condition).toBe("Wet");
    expect(resolved.inherited.condition).toBe(false);
  });

  it("uses the Session's own temperatures, each independently", () => {
    const resolved = sessionConditions(dryEvent, makeSession({ trackTemperature: "31" }));

    expect(resolved.trackTemperature).toBe("31");
    expect(resolved.inherited.trackTemperature).toBe(false);
    // Ambient was not recorded for the Session, so it still comes from the Event.
    expect(resolved.ambientTemperature).toBe("18");
    expect(resolved.inherited.ambientTemperature).toBe(true);
  });

  /**
   * A form field left empty stores "" rather than removing the property. That has to mean the
   * same as absent — "same as the Event" — or clearing a field would record a blank temperature.
   */
  it("treats a blank temperature as not recorded, not as an empty reading", () => {
    const resolved = sessionConditions(dryEvent, makeSession({ ambientTemperature: "", trackTemperature: "   " }));

    expect(resolved.ambientTemperature).toBe("18");
    expect(resolved.trackTemperature).toBe("24");
    expect(resolved.inherited.trackTemperature).toBe(true);
  });

  it("records a Session condition that happens to match the Event's as the Session's own", () => {
    const resolved = sessionConditions(dryEvent, makeSession({ condition: "Dry" }));

    expect(resolved.condition).toBe("Dry");
    expect(resolved.inherited.condition).toBe(false);
  });

  it("returns a blank when neither the Session nor the Event recorded a temperature", () => {
    const resolved = sessionConditions(makeEvent({ ambientTemperature: "", trackTemperature: "" }), makeSession());

    expect(resolved.ambientTemperature).toBe("");
    expect(resolved.trackTemperature).toBe("");
  });
});
