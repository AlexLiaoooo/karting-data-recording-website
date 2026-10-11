"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Share2 } from "lucide-react";
import { handoverCard, type HandoverCard } from "@/lib/handover";
import { handoverImages, supportsFileSharing } from "@/lib/handover-image";
import type { AppData } from "@/lib/types";
import type { RecordedRun } from "@/lib/experiments";
import { useTranslation } from "@/lib/i18n";

type Prepared = { card: HandoverCard; files: File[]; urls: string[] };

export function MechanicHandover({ data, entry }: { data: AppData; entry: RecordedRun }) {
  const { t } = useTranslation();
  const card = useMemo(() => handoverCard(data, entry, t), [data, entry, t]);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [failedCard, setFailedCard] = useState<HandoverCard | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [shareFailed, setShareFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let urls: string[] = [];
    handoverImages(card, (page, count) => t("Page {page} of {count}", { page, count })).then(blobs => {
      if (cancelled) return;
      const identity = entry.run.id.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 8) || "record";
      const files = blobs.map((blob, index) => new File([blob], `kart-handover-${entry.date || "undated"}-run-${String(entry.run.number).padStart(2, "0")}-${identity}-${index + 1}.png`, { type: "image/png" }));
      urls = files.map(file => URL.createObjectURL(file));
      setPrepared({ card, files, urls }); setFailedCard(null);
    }).catch(() => { if (!cancelled) setFailedCard(card); });
    return () => { cancelled = true; urls.forEach(url => URL.revokeObjectURL(url)); };
  }, [card, entry.date, entry.run.number, entry.run.id, t, attempt]);
  const ready = prepared?.card === card && failedCard !== card ? prepared : null;
  const canShare = ready && supportsFileSharing(ready.files);

  function download() {
    if (!ready) return;
    ready.files.forEach((file, index) => {
      const anchor = document.createElement("a");
      anchor.href = ready.urls[index]; anchor.download = file.name;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
    });
  }
  async function share() {
    if (!ready || sharing) return;
    setSharing(true); setShareFailed(false);
    try { await navigator.share({ files: ready.files, title: card.title }); }
    catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) setShareFailed(true); }
    finally { setSharing(false); }
  }

  return <div className="page-content handover-page">
    <p className="lead">{t("A snapshot of this Run for your mechanic. Review the card before downloading or sharing.")}</p>
    <div className="action-stack">
      <button type="button" className="button button-primary button-block" disabled={!ready || sharing} onClick={download}><Download />{t("Download handover images")}</button>
      {canShare && <button type="button" className="button button-secondary button-block" disabled={sharing} onClick={share}><Share2 />{sharing ? t("Opening share sheet…") : t("Share handover card")}</button>}
    </div>
    <p className="help-text">{t("PNG images are created on this device. Long cards continue on additional pages. You can send downloaded images manually.")}</p>
    {shareFailed && <p role="alert" className="form-error">{t("Sharing could not open. Download the images and send them manually.")}</p>}
    {failedCard === card ? <section className="summary-card" role="alert"><p>{t("The card images could not be created. Your Run is unchanged.")}</p><button type="button" className="button button-secondary" onClick={() => { setFailedCard(null); setAttempt(current => current + 1); }}>{t("Retry image creation")}</button></section> : !ready ? <p role="status">{t("Preparing handover images…")}</p> : <div className="handover-images">{ready.urls.map((url, index) => <figure key={url}>
      {/* eslint-disable-next-line @next/next/no-img-element -- local canvas Blob URL with cleanup tied to this snapshot */}
      <img src={url} alt={`${card.title} · ${t("Page {page} of {count}", { page: index + 1, count: ready.urls.length })}`} />
      <figcaption>{t("Page {page} of {count}", { page: index + 1, count: ready.urls.length })} · <a href={url} download={ready.files[index].name}>{t("Download this page")}</a></figcaption>
    </figure>)}</div>}
    <details className="handover-text" open><summary>{t("Card text")}</summary><article className="summary-card">
      <h1>{card.title}</h1>{card.context.map((value, index) => <p key={index}>{value}</p>)}
      {card.sections.map(section => <section key={section.title}><h2>{section.title}</h2><dl>{section.rows.map((row, index) => <div key={index}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl></section>)}
    </article></details>
  </div>;
}
