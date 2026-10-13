import type { LoggerPhoto } from "./types";
import { mediaDataUrl, validMediaDataUrl, validMediaTimestamp } from "./portable-media";

export const MAX_LOGGER_PHOTO_BYTES = 6 * 1024 * 1024;
export const MAX_LOGGER_PHOTO_PIXELS = 24_000_000;
const mimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;

export function validLoggerPhoto(value: unknown): value is LoggerPhoto {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return validMediaTimestamp(item.capturedAt) && typeof item.sourceName === "string" && item.sourceName.length <= 2000
    && typeof item.mimeType === "string" && mimeTypes.some(type => type === item.mimeType)
    && typeof item.width === "number" && Number.isSafeInteger(item.width) && item.width > 0 && item.width <= 12000
    && typeof item.height === "number" && Number.isSafeInteger(item.height) && item.height > 0 && item.height <= 12000
    && item.width * item.height <= MAX_LOGGER_PHOTO_PIXELS
    && typeof item.size === "number" && Number.isSafeInteger(item.size) && item.size > 0 && item.size <= MAX_LOGGER_PHOTO_BYTES
    && (item.dataUrl !== undefined ? item.blob === undefined && validMediaDataUrl(item.dataUrl, item.mimeType, item.size, MAX_LOGGER_PHOTO_BYTES)
      : Object.prototype.toString.call(item.blob) === "[object Blob]" && (item.blob as Blob).size === item.size && (item.blob as Blob).type === item.mimeType);
}

export function loggerPhotoBlob(photo: LoggerPhoto): Blob {
  if (!validLoggerPhoto(photo)) throw new Error("Invalid photo");
  if (photo.blob) return photo.blob;
  const encoded = photo.dataUrl!.slice(photo.dataUrl!.indexOf(",") + 1);
  const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
  return new Blob([bytes], { type: photo.mimeType });
}

export function storedLoggerPhoto(photo: LoggerPhoto): LoggerPhoto {
  if (photo.blob) return photo;
  const metadata = { ...photo }; delete metadata.dataUrl;
  return { ...metadata, blob: loggerPhotoBlob(photo) };
}

/** Keep the accepted source bytes; OCR and suggested readings never replace this evidence. */
export async function captureLoggerPhoto(file: File): Promise<LoggerPhoto> {
  if (!mimeTypes.some(type => type === file.type) || !file.size || file.size > MAX_LOGGER_PHOTO_BYTES) throw new Error("Invalid photo");
  const dataUrl = await mediaDataUrl(file);
  const { width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("Photo could not be decoded"));
    image.src = dataUrl;
  });
  const photo = { capturedAt: new Date().toISOString(), sourceName: file.name, mimeType: file.type as LoggerPhoto["mimeType"], size: file.size, blob: new Blob([file], { type: file.type }), width, height };
  if (!validLoggerPhoto(photo)) throw new Error("Invalid photo dimensions");
  return photo;
}

export const loggerPhotoExtension = (type: LoggerPhoto["mimeType"]) => type === "image/jpeg" ? "jpg" : type === "image/webp" ? "webp" : "png";
