import type { DriverDebrief } from "./types";

export const MAX_DEBRIEF_DURATION_MS = 60_000;
export const MAX_DEBRIEF_BYTES = 2 * 1024 * 1024;
const audioTypes = ["audio/webm", "audio/mp4", "audio/ogg"] as const;
export const debriefMimeType = (value: string) => audioTypes.find(type => type === value.split(";")[0].trim().toLowerCase()) ?? null;

/** Validate bounded, complete audio data before it can enter storage or a replacement backup. */
export function validDriverDebrief(value: unknown): value is DriverDebrief {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (typeof item.recordedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(item.recordedAt)
    || !Number.isFinite(Date.parse(item.recordedAt)) || new Date(item.recordedAt).toISOString() !== item.recordedAt
    || typeof item.durationMs !== "number" || !Number.isSafeInteger(item.durationMs) || item.durationMs < 1 || item.durationMs > MAX_DEBRIEF_DURATION_MS
    || typeof item.size !== "number" || !Number.isSafeInteger(item.size) || item.size < 1 || item.size > MAX_DEBRIEF_BYTES
    || typeof item.mimeType !== "string" || !audioTypes.some(type => type === item.mimeType)
    || typeof item.dataUrl !== "string" || item.dataUrl.length > Math.ceil(MAX_DEBRIEF_BYTES / 3) * 4 + 40) return false;
  const prefix = `data:${item.mimeType};base64,`;
  if (!item.dataUrl.startsWith(prefix)) return false;
  const encoded = item.dataUrl.slice(prefix.length);
  if (!encoded || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) return false;
  const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
  return encoded.length / 4 * 3 - padding === item.size;
}

export async function createDriverDebrief(blob: Blob, durationMs: number, recordedAt: string): Promise<DriverDebrief> {
  const mimeType = debriefMimeType(blob.type);
  if (!mimeType || !blob.size || blob.size > MAX_DEBRIEF_BYTES) throw new Error("Invalid recording");
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Recording could not be read"));
    reader.onabort = () => reject(new Error("Recording read interrupted"));
    reader.readAsDataURL(new Blob([blob], { type: mimeType }));
  });
  const result = { recordedAt, mimeType, size: blob.size, durationMs, dataUrl };
  if (!validDriverDebrief(result)) throw new Error("Invalid recording");
  return result;
}

export function debriefBlob(note: DriverDebrief): Blob {
  if (!validDriverDebrief(note)) throw new Error("Invalid recording");
  const binary = atob(note.dataUrl.slice(note.dataUrl.indexOf(",") + 1));
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  return new Blob([bytes], { type: note.mimeType });
}

export const debriefExtension = (type: DriverDebrief["mimeType"]) => type === "audio/mp4" ? "m4a" : type === "audio/ogg" ? "ogg" : "webm";
export function debriefClock(durationMs: number): string {
  const seconds = Math.ceil(durationMs / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
