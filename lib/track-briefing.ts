import { recordedRuns, type RecordedRun } from "./experiments";
import { orderedSessionRuns } from "./session-timeline";
import type { EventRecord } from "./types";
import type { TrackMapData } from "./track-map/types";

function usableDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

/** Visit dates order Events; creation time breaks ties for two Events on the same day. */
function before(candidate: EventRecord, current: EventRecord): boolean {
  return candidate.startDate < current.startDate
    || (candidate.startDate === current.startDate && candidate.createdAt < current.createdAt);
}

/** The most recent saved setup on the previous visit, skipping fully blank placeholder Runs. */
function lastSetup(event: EventRecord): RecordedRun | undefined {
  const entries = recordedRuns([event]);
  for (const session of [...event.sessions].reverse()) {
    for (const run of orderedSessionRuns(session.runs).reverse()) {
      const hasSetup = Object.values(run.setup).some(value => value.trim());
      const hasColdPressure = Object.values(run.tyres).some(tyre => tyre.coldPressure.trim());
      if (hasSetup || hasColdPressure) return entries.find(entry => entry.sessionId === session.id && entry.run.id === run.id);
    }
  }
}

/** Read-only: names never substitute for a saved Layout ID, and current/future Events never contribute. */
export function trackBriefing(events: EventRecord[], current: EventRecord, maps: TrackMapData) {
  const layout = maps.layouts.find(item => item.id === current.trackLayoutId);
  const track = maps.tracks.find(item => item.id === layout?.trackId);
  const status = !current.trackLayoutId ? "unlinked"
    : !layout || !track ? "missing-layout"
    : !usableDate(current.startDate) ? "missing-date" : "ready";
  const earlier = status === "ready" ? events
    .filter(event => event.id !== current.id && usableDate(event.startDate) && before(event, current))
    .sort((a, b) => b.startDate.localeCompare(a.startDate) || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)) : [];
  const pastEvents = earlier.filter(event => event.trackLayoutId === layout?.id);
  const previous = pastEvents[0];
  const history = recordedRuns(pastEvents);
  const visits = previous ? maps.visits.filter(visit => visit.layoutId === layout?.id && visit.eventId === previous.id)
    .flatMap(visit => {
      const session = previous.sessions.find(item => item.id === visit.sessionId);
      return session ? [{ visit, session }] : [];
    }) : [];
  const unlinkedCount = earlier.filter(event => !event.trackLayoutId && event.track.trim()
    && event.track.trim().toLowerCase() === current.track.trim().toLowerCase()).length;
  return { status, layout, track, previous, setup: previous ? lastSetup(previous) : undefined, history, visits, unlinkedCount };
}

/** Always keep general instructions; Damp/Mixed need both sets of surface-specific reference notes. */
export function briefingNoteSurfaces(condition: EventRecord["condition"]): Array<"Dry" | "Wet"> {
  return condition === "Dry" ? ["Dry"] : condition === "Wet" ? ["Wet"] : ["Dry", "Wet"];
}
