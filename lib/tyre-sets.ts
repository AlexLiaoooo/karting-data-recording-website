import { recordedRuns, type RecordedRun } from "./experiments";
import type { AppData, TyreSet } from "./types";

export type TyreUsage = { laps: number | null; heatCycles: number | null; completedRuns: number; missingLaps: number };
export function lapCount(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const count = Number(value);
  return Number.isSafeInteger(count) ? count : null;
}
const add = (first: number | null, second: number) => first !== null && Number.isSafeInteger(first + second) ? first + second : null;
const initialUsage = (set: TyreSet): TyreUsage => ({ laps: set.initialLaps, heatCycles: set.initialHeatCycles, completedRuns: 0, missingLaps: 0 });

function countRun(usage: TyreUsage, entry: RecordedRun) {
  if (!entry.run.completed) return;
  const laps = lapCount(entry.run.laps);
  usage.completedRuns += 1;
  if (laps === null) usage.missingLaps += 1;
  else usage.laps = add(usage.laps, laps);
  if (entry.run.tyreHeatCycle) usage.heatCycles = add(usage.heatCycles, 1);
}

/** Stable recorded sequence: Event start date / creation, Session creation order, Run number. */
export function tyreRunHistory(data: AppData): RecordedRun[] {
  return [...data.events].sort((a, b) => (a.startDate || a.createdAt.slice(0, 10)).localeCompare(b.startDate || b.createdAt.slice(0, 10))
    || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)).flatMap(event =>
    event.sessions.flatMap(session => recordedRuns([{ ...event, sessions: [{ ...session, runs: [...session.runs].sort((a, b) => a.number - b.number) }] }])));
}

export function tyreSetSummary(data: AppData, set: TyreSet): TyreUsage {
  const usage = initialUsage(set);
  for (const entry of recordedRuns(data.events)) if (entry.run.tyreSetId === set.id) countRun(usage, entry);
  return usage;
}

/** Snapshot before each Run, so comparing two Runs cannot use today's tyre age for both. */
export function tyreUsageByRun(data: AppData): Map<string, TyreUsage> {
  const totals = new Map(data.tyreSets.map(set => [set.id, initialUsage(set)]));
  const result = new Map<string, TyreUsage>();
  for (const entry of tyreRunHistory(data)) {
    const usage = entry.run.tyreSetId ? totals.get(entry.run.tyreSetId) : undefined;
    if (!usage) continue;
    result.set(entry.run.id, { ...usage });
    countRun(usage, entry);
  }
  return result;
}
