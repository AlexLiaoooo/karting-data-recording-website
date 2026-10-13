import type { AppData, KartComponent } from "./types";
import { recordedRuns } from "./experiments";
import { lapCount } from "./tyre-sets";

export type ComponentUsage = {
  totalLaps: number | null;
  completedRuns: number;
  missingLaps: number;
  serviceLaps: number;
  sinceService: number | null;
  remainingLaps: number | null;
  state: "none" | "due" | "soon" | "ok" | "incomplete" | "check";
};

/** Services retain their recorded lifetime counters; Run corrections can expose a mismatch. */
export function componentUsage(data: AppData, component: KartComponent): ComponentUsage {
  let totalLaps: number | null = component.initialLaps;
  let completedRuns = 0; let missingLaps = 0;
  for (const { run } of recordedRuns(data.events)) {
    if (!run.completed || !run.componentIds?.includes(component.id)) continue;
    completedRuns += 1;
    const count = lapCount(run.laps);
    if (count === null) missingLaps += 1;
    else if (totalLaps !== null) totalLaps = Number.isSafeInteger(totalLaps + count) ? totalLaps + count : null;
  }
  const serviceLaps = component.services.reduce((highest, service) => Math.max(highest, service.lapsAtService), 0);
  const sinceService = totalLaps !== null && totalLaps >= serviceLaps ? totalLaps - serviceLaps : null;
  const interval = component.serviceIntervalLaps;
  const remainingLaps = sinceService !== null && interval !== null ? Math.max(0, interval - sinceService) : null;
  const state = sinceService === null ? "check" : interval === null ? "none" : sinceService >= interval ? "due"
    : missingLaps > 0 ? "incomplete" : remainingLaps! <= Math.max(1, Math.ceil(interval * 0.1)) ? "soon" : "ok";
  return { totalLaps, completedRuns, missingLaps, serviceLaps, sinceService, remainingLaps, state };
}
