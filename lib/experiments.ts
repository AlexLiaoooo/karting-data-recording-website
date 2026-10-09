import { sessionConditions, type ResolvedConditions } from "./conditions";
import { parseLapTime } from "./lap-time";
import type { EventRecord, RunRecord } from "./types";

export type RecordedRun = {
  run: RunRecord;
  eventId: string;
  sessionId: string;
  eventName: string;
  sessionName: string;
  track: string;
  trackLayoutId?: string;
  date: string;
  conditions: ResolvedConditions;
};

export function recordedRuns(events: EventRecord[]): RecordedRun[] {
  return events.flatMap(event => event.sessions.flatMap(session => {
    const conditions = sessionConditions(event, session);
    return session.runs.map(run => ({
      run, eventId: event.id, sessionId: session.id, eventName: event.name,
      sessionName: session.name, track: event.track, trackLayoutId: event.trackLayoutId,
      date: event.startDate, conditions,
    }));
  }));
}

export function hasExperiment(run: RunRecord): boolean {
  const entry = run.experiment;
  return Boolean(entry && (entry.baselineRunId || entry.change.trim() || entry.expectation.trim() || entry.outcome.trim()));
}

/** Live recorded results, not a claim that a setup change caused a lap-time change. */
export function experimentComparison(test: RecordedRun, baseline: RecordedRun) {
  const first = parseLapTime(baseline.run.fastestLap);
  const second = parseLapTime(test.run.fastestLap);
  const trackA = baseline.track.trim().toLowerCase();
  const trackB = test.track.trim().toLowerCase();
  return {
    lapDelta: first === null || second === null ? null : second - first,
    differentConditions: baseline.conditions.condition !== test.conditions.condition,
    differentTrack: baseline.trackLayoutId && test.trackLayoutId
      ? baseline.trackLayoutId !== test.trackLayoutId
      : Boolean(trackA && trackB && trackA !== trackB),
    unknownTrack: !trackA || !trackB,
  };
}
