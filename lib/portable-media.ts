/** Byte count and base64 shape are checked before media is accepted from device storage/backups. */
export function validMediaDataUrl(value: unknown, mimeType: string, size: number, maxBytes: number): value is string {
  if (typeof value !== "string" || !Number.isSafeInteger(size) || size < 1 || size > maxBytes
    || value.length > Math.ceil(maxBytes / 3) * 4 + 48) return false;
  const prefix = `data:${mimeType};base64,`;
  if (!value.startsWith(prefix)) return false;
  const encoded = value.slice(prefix.length);
  if (!encoded || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) return false;
  const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
  return encoded.length / 4 * 3 - padding === size;
}

export function mediaDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Media read failed"));
    reader.onabort = () => reject(new Error("Media read interrupted"));
    reader.readAsDataURL(blob);
  });
}

export function validMediaTimestamp(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}
