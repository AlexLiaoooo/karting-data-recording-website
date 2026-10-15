/** Repair only the old canvas PNG fallback bug; unrelated format mismatches stay invalid. */
export function mapAssetMimeType(declared: string, actual: string): string {
  return actual === "image/png" && (declared === "image/webp" || declared === "image/jpeg") ? actual : declared;
}
