import { formatLapTime, parseLapTime } from "./lap-time";
import { lapCount } from "./tyre-sets";

export type LoggerField = "fastestLap" | "laps" | "maxRpm";
export type LoggerReadings = Record<LoggerField, string>;
export type LoggerSuggestions = { values: LoggerReadings; conflicts: LoggerField[] };
export const emptyLoggerReadings = (): LoggerReadings => ({ fastestLap: "", laps: "", maxRpm: "" });

export function validLoggerReading(field: LoggerField, value: string): boolean {
  if (field === "fastestLap") return parseLapTime(value) !== null;
  const count = lapCount(value);
  return count !== null && (field === "laps" || count > 0);
}

/** Use labelled readings only. Conflicting values stay blank for the driver's manual review. */
export function suggestLoggerReadings(text: string): LoggerSuggestions {
  const candidates: Record<LoggerField, Set<string>> = { fastestLap: new Set(), laps: new Set(), maxRpm: new Set() };
  const labels: Array<[LoggerField, RegExp]> = [
    ["fastestLap", /\b(?:BEST(?:\s+LAP(?:\s+TIME)?)?|FASTEST(?:\s+LAP(?:\s+TIME)?)?)\b/i],
    ["laps", /\b(?:LAPS(?:\s+(?:COMPLETED|COUNT))?|LAP\s+COUNT|TOTAL\s+LAPS)\b/i],
    ["maxRpm", /\b(?:MAX(?:IMUM)?\s*RPM|PEAK\s*RPM|RPM\s*MAX)\b/i],
  ];
  const lines = text.slice(0, 20_000).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  for (const [index, line] of lines.entries()) {
    if (/\b(?:AVERAGE|AVG|LAST|CURRENT|MIN(?:IMUM)?|THEORETICAL)\b/i.test(line)) continue;
    for (const [field, label] of labels) {
      const match = label.exec(line); if (!match) continue;
      let tail = line.slice(match.index + match[0].length).replace(/^\s*[:=]\s*/, "").trim();
      if (!tail && lines[index + 1] && /^[\d\s.,:]+$/.test(lines[index + 1])) tail = lines[index + 1];
      const token = field === "fastestLap" ? tail.match(/^([\d]+(?::[\d]+)?(?:[.,]\d+)?)(?:\s*(?:S|SEC|SECONDS))?(?:\s|$)/i)?.[1]
        : tail.match(/^(\d+(?:[ ,]\d{3})*)(?:\s|$)/)?.[1];
      if (!token) continue;
      const normalized = field === "fastestLap" ? token.replace(",", ".") : token.replace(/[ ,]/g, "");
      if (!validLoggerReading(field, normalized)) continue;
      candidates[field].add(field === "fastestLap" ? formatLapTime(parseLapTime(normalized)!) : String(Number(normalized)));
    }
  }
  const values = emptyLoggerReadings(); const conflicts: LoggerField[] = [];
  for (const field of Object.keys(values) as LoggerField[]) {
    if (candidates[field].size === 1) values[field] = [...candidates[field]][0];
    else if (candidates[field].size > 1) conflicts.push(field);
  }
  return { values, conflicts };
}
