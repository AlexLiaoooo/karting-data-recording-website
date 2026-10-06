import { emptySetup, emptyTyre } from "./types";
import { legacyMarkerTypes, markerTypes } from "./track-map/types";

type RecordValue = Record<string, unknown>;

export const isRecord = (value: unknown): value is RecordValue =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const strings = (value: RecordValue, keys: string[]) => keys.every((key) => typeof value[key] === "string");
const optionalStrings = (value: RecordValue, keys: string[]) => keys.every((key) => value[key] === undefined || typeof value[key] === "string");
const choice = (value: unknown, choices: readonly string[]) => typeof value === "string" && choices.includes(value);
const positiveInteger = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const coordinate = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
const conditions = ["Dry", "Damp", "Wet", "Mixed"];

function date(value: unknown): boolean {
  if (value === "") return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** IDs are unique across a collection, including Sessions/Runs in different Events. */
function records(value: unknown, check: (record: RecordValue) => boolean, ids = new Set<string>()): boolean {
  return Array.isArray(value) && value.every((record) => {
    if (!isRecord(record) || typeof record.id !== "string" || !record.id.trim() || ids.has(record.id)) return false;
    ids.add(record.id);
    return check(record);
  });
}

function setup(value: unknown): boolean {
  return isRecord(value) && strings(value, Object.keys(emptySetup()));
}

export function validAppRecords(value: RecordValue): boolean {
  const sessionIds = new Set<string>();
  const runIds = new Set<string>();
  const run = (record: RecordValue) => strings(record, ["label", "recordedAt", "laps", "fastestLap", "averageLap", "position", "cornerEntry", "midCorner", "cornerExit", "comments", "updatedAt"])
    && optionalStrings(record, ["maxRpm"])
    && positiveInteger(record.number) && typeof record.completed === "boolean"
    && choice(record.balance, ["", "Understeer", "Neutral", "Oversteer"])
    && choice(record.grip, ["", "Low", "Medium", "High"])
    && choice(record.braking, ["", "Poor", "Acceptable", "Good"])
    && setup(record.setup) && isRecord(record.tyres)
    && ["fl", "fr", "rl", "rr"].every((corner) => {
      const tyre = (record.tyres as RecordValue)[corner];
      return isRecord(tyre) && strings(tyre, Object.keys(emptyTyre()));
    });
  const session = (record: RecordValue) => strings(record, ["name", "startTime", "notes", "createdAt"])
    && choice(record.type, ["Practice", "Qualifying", "Heat", "Pre-final", "Final", "Other"])
    && (record.condition === undefined || choice(record.condition, conditions))
    && optionalStrings(record, ["ambientTemperature", "trackTemperature"])
    && records(record.runs, run, runIds);
  return records(value.events, (record) => strings(record, ["name", "track", "weather", "ambientTemperature", "trackTemperature", "notes", "createdAt", "updatedAt"])
    && date(record.startDate) && date(record.endDate)
    && optionalStrings(record, ["trackLayoutId"])
    && choice(record.type, ["Practice", "Test", "Race", "Other"])
    && choice(record.condition, conditions)
    && records(record.sessions, session, sessionIds))
    && (value.setupTemplates === undefined || records(value.setupTemplates, (record) =>
      strings(record, ["name", "createdAt", "updatedAt"]) && setup(record.setup)))
    && (value.lastEventId === undefined || value.lastEventId === null || typeof value.lastEventId === "string");
}

/** Structural checks preserve legacy marker types and optional fields for migration. */
export function validPortableTrackMap(value: unknown): boolean {
  return validTrackMap(value, true);
}

export function validStoredTrackMap(value: unknown): boolean {
  return validTrackMap(value, false);
}

function validTrackMap(value: unknown, portable: boolean): boolean {
  if (!isRecord(value) || value.version !== 1) return false;
  const trackIds = new Set<string>();
  const assetIds = new Set<string>();
  const markerIds = new Set<string>();
  const layoutIds = new Set<string>();
  const observationIds = new Set<string>();
  if (!records(value.tracks, (record) => strings(record, ["name", "location", "notes", "createdAt", "updatedAt"]), trackIds)
    || !records(value.assets, (record) => strings(record, ["mimeType", "updatedAt"])
      && (portable ? typeof record.dataUrl === "string" : Object.prototype.toString.call(record.blob) === "[object Blob]")
      && positiveInteger(record.width) && positiveInteger(record.height)
      && typeof record.size === "number" && Number.isSafeInteger(record.size) && record.size >= 0, assetIds)) return false;
  if (!records(value.layouts, (record) => strings(record, ["trackId", "name", "createdAt", "updatedAt"])
    && trackIds.has(record.trackId as string)
    && (record.mapAssetId === null || (typeof record.mapAssetId === "string" && assetIds.has(record.mapAssetId)))
    && choice(record.direction, ["Clockwise", "Anti-clockwise", "Unknown"])
    && optionalStrings(record, ["sourceAttribution", "sourceUrl", "builtInLayoutKey", "builtInMapVersion", "notes"])
    && (record.corners === undefined || (Array.isArray(record.corners) && record.corners.every((corner) =>
      isRecord(corner) && positiveInteger(corner.number) && strings(corner, ["label"]) && coordinate(corner.x) && coordinate(corner.y))
      && new Set(record.corners.map((corner) => corner.number)).size === record.corners.length))
    && records(record.markers, (marker) => strings(marker, ["label", "shortInstruction", "generalNote", "dryNote", "wetNote", "updatedAt"])
      && coordinate(marker.x) && coordinate(marker.y) && positiveInteger(marker.order)
      && (marker.cornerNumber === undefined || positiveInteger(marker.cornerNumber))
      && choice(marker.type, [...markerTypes, ...Object.keys(legacyMarkerTypes)])
      && Array.isArray(marker.tags) && marker.tags.every((tag) => typeof tag === "string"), markerIds), layoutIds)) return false;
  // Deleted Events/Sessions/markers may leave historical observations: the app already
  // handles those references. Their IDs remain strings; never discard those notes.
  return records(value.visits, (record) => strings(record, ["layoutId", "eventId", "sessionId", "summary", "createdAt", "updatedAt"])
    && layoutIds.has(record.layoutId as string) && date(record.date) && choice(record.condition, conditions)
    && records(record.observations, (observation) => strings(observation, ["markerId", "sessionId", "note", "createdAt", "updatedAt"])
      && observation.sessionId === record.sessionId
      && choice(observation.result, ["", "Better", "Same", "Worse"]), observationIds));
}
