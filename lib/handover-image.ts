import { cardPages, wrapCardText, type HandoverCard } from "./handover";

/** Browser canvas only: local fonts/text, no external images, services or HTML injection. */
export async function handoverImages(card: HandoverCard, pageLabel: (page: number, count: number) => string): Promise<Blob[]> {
  await document.fonts?.ready;
  const canvas = document.createElement("canvas");
  canvas.width = 1000;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image rendering unavailable");
  context.font = "26px system-ui, sans-serif";
  const pages = cardPages(card, text => context.measureText(text).width);
  const blobs: Blob[] = [];
  for (const [index, lines] of pages.entries()) {
    canvas.height = 250 + lines.length * 36;
    context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#1555a3"; context.font = "bold 28px system-ui, sans-serif";
    for (const [lineIndex, title] of wrapCardText(card.title, text => context.measureText(text).width, 900).slice(0, 2).entries()) context.fillText(title, 50, 58 + lineIndex * 36);
    context.font = "22px system-ui, sans-serif"; context.fillStyle = "#526579";
    const reference = wrapCardText(card.reference, text => context.measureText(text).width, 900);
    for (const [lineIndex, line] of reference.slice(0, 2).entries()) context.fillText(line + (lineIndex === 1 && reference.length > 2 ? "…" : ""), 50, 102 + lineIndex * 28);
    context.font = "20px system-ui, sans-serif";
    context.fillText(`Kart Data · ${pageLabel(index + 1, pages.length)}`, 50, 164);
    for (const [lineIndex, line] of lines.entries()) {
      const y = 210 + lineIndex * 36;
      context.font = `${line.heading ? "bold " : ""}26px system-ui, sans-serif`;
      context.fillStyle = line.heading ? "#1555a3" : "#192d43";
      context.fillText(line.text, 50, y);
    }
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Image encoding failed")), "image/png"));
    blobs.push(blob);
  }
  return blobs;
}

export function supportsFileSharing(files: File[]): boolean {
  try { return typeof navigator !== "undefined" && typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files }); }
  catch { return false; }
}
