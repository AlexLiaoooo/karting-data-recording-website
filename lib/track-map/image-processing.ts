import type { MapAsset } from "./types";

const MAX_MAP_SIDE = 1600;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The selected image could not be opened."));
    };
    image.src = url;
  });
}
function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function optimiseMapImage(file: File): Promise<MapAsset> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  const image = await loadImage(file);
  const scale = Math.min(1, MAX_MAP_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image processing is unavailable in this browser.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  let blob = await canvasToBlob(canvas, "image/webp", 0.86);
  let mimeType = "image/webp";
  if (!blob) {
    blob = await canvasToBlob(canvas, "image/jpeg", 0.88);
    mimeType = "image/jpeg";
  }
  if (!blob) throw new Error("The map image could not be saved.");

  return {
    id: crypto.randomUUID(),
    blob,
    width,
    height,
    mimeType,
    size: blob.size,
    updatedAt: new Date().toISOString(),
  };
}
