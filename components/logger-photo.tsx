"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Download, ImagePlus, ScanText, Trash2 } from "lucide-react";
import { captureLoggerPhoto, loggerPhotoExtension } from "@/lib/logger-photo";
import { readLoggerPhoto } from "@/lib/logger-ocr";
import { emptyLoggerReadings, suggestLoggerReadings, validLoggerReading, type LoggerField, type LoggerReadings } from "@/lib/logger-readings";
import type { LoggerPhoto, RunRecord } from "@/lib/types";
import { useTranslation } from "@/lib/i18n";
import { usePhotoSource } from "@/lib/photo-source";

const fields: Array<[LoggerField, string]> = [["fastestLap", "Fastest lap"], ["laps", "Laps"], ["maxRpm", "Max RPM"]];
const unselected = () => ({ fastestLap: false, laps: false, maxRpm: false });
function PhotoPreview({ photo, run }: { photo: LoggerPhoto; run: RunRecord }) {
  const { t } = useTranslation();
  const source = usePhotoSource(photo);
  const identity = run.id.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 8) || "record";
  return <figure className="logger-photo-preview">
    {/* eslint-disable-next-line @next/next/no-img-element -- Bounded original evidence data URL stored locally; no remote image optimization. */}
    <img src={source || undefined} width={photo.width} height={photo.height} alt={t("Data-logger photo")} />
    <figcaption>{photo.sourceName} · {photo.width} × {photo.height}</figcaption>
    <a className="button button-secondary button-block" href={source || undefined} download={`kart-logger-${photo.capturedAt.slice(0, 10)}-run-${String(run.number).padStart(2, "0")}-${identity}.${loggerPhotoExtension(photo.mimeType)}`}><Download />{t("Download original photo")}</a>
  </figure>;
}

export function LoggerPhotoPanel({ run, onSave, onRemove, onBusyChange }: { run: RunRecord; onSave: (photo: LoggerPhoto, readings: Partial<LoggerReadings>) => void; onRemove: () => void; onBusyChange: (busy: boolean) => void }) {
  const { t } = useTranslation();
  const camera = useRef<HTMLInputElement>(null); const picker = useRef<HTMLInputElement>(null);
  const operation = useRef(0); const job = useRef<ReturnType<typeof readLoggerPhoto> | null>(null);
  const [draft, setDraft] = useState<LoggerPhoto | null>(null);
  const [readings, setReadings] = useState(emptyLoggerReadings);
  const [selected, setSelected] = useState(unselected);
  const [phase, setPhase] = useState<"idle" | "loading" | "reading">("idle");
  const [progress, setProgress] = useState(0);
  const [text, setText] = useState(""); const [conflicts, setConflicts] = useState<LoggerField[]>([]);
  const [error, setError] = useState<"photo" | "ocr" | "values" | null>(null);
  const [removing, setRemoving] = useState(false);
  const active = phase !== "idle"; const busy = active || draft !== null;
  useEffect(() => () => { operation.current += 1; job.current?.cancel(); }, []);
  useEffect(() => {
    onBusyChange(busy);
    if (!busy) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", guard);
    return () => { window.removeEventListener("beforeunload", guard); onBusyChange(false); };
  }, [busy, onBusyChange]);

  function review(photo: LoggerPhoto) {
    setDraft(photo); setReadings(emptyLoggerReadings()); setSelected(unselected()); setText(""); setConflicts([]); setError(null); setRemoving(false);
  }
  async function choose(file?: File) {
    if (!file) return;
    const id = ++operation.current; job.current?.cancel(); setPhase("loading"); setError(null);
    try { const photo = await captureLoggerPhoto(file); if (id === operation.current) review(photo); }
    catch { if (id === operation.current) setError("photo"); }
    finally { if (id === operation.current) setPhase("idle"); }
  }
  async function recognize() {
    if (!draft || active) return;
    const id = ++operation.current; setPhase("reading"); setProgress(0); setError(null);
    const current = readLoggerPhoto(draft, value => { if (id === operation.current) setProgress(value); }); job.current = current;
    try {
      const raw = await current.result; if (id !== operation.current) return;
      const suggestions = suggestLoggerReadings(raw); setText(raw); setReadings(suggestions.values); setConflicts(suggestions.conflicts); setSelected(unselected());
    } catch (error) { if (id === operation.current && !(error instanceof DOMException && error.name === "AbortError")) setError("ocr"); }
    finally { if (id === operation.current) { setPhase("idle"); job.current = null; } }
  }
  function discard() { operation.current += 1; job.current?.cancel(); job.current = null; setPhase("idle"); setDraft(null); setError(null); }
  return <div className="page-content logger-photo-page">
    <section className="summary-card">
      <p className="eyebrow">{t("Run {number}", { number: String(run.number).padStart(2, "0") })}</p><h1>{t("Data-logger photo capture")}</h1>
      <p>{t("Photograph the logger, then review lap time, lap count and RPM before saving.")}</p>
      <p className="help-text">{t("Photos and recognition stay on this device. Use JPEG, PNG or WebP up to 6 MB and 24 megapixels.")}</p>
      <div className="action-stack">
        <button type="button" className="button button-primary button-block" disabled={active} onClick={() => camera.current?.click()}><Camera />{t("Take logger photo")}</button>
        <button type="button" className="button button-secondary button-block" disabled={active} onClick={() => picker.current?.click()}><ImagePlus />{t("Choose logger photo")}</button>
      </div>
      <input ref={camera} type="file" hidden accept="image/jpeg,image/png,image/webp" capture="environment" aria-label={t("Camera photo")} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; void choose(file); }} />
      <input ref={picker} type="file" hidden accept="image/jpeg,image/png,image/webp" aria-label={t("Photo file")} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; void choose(file); }} />
      {phase === "loading" && <><p role="status">{t("Preparing photo…")}</p><button type="button" className="button button-secondary button-block" onClick={() => { operation.current += 1; setPhase("idle"); }}>{t("Cancel photo loading")}</button></>}
      {error && <p role="alert" className="form-error">{error === "photo" ? t("The photo could not be opened. Check its format, file size and dimensions; your saved photo is unchanged.") : error === "ocr" ? t("The photo could not be read automatically. You can retry or enter readings from the photo manually.") : t("Check the selected readings: use a valid lap time and whole lap/RPM numbers.")}</p>}
    </section>
    {draft && <section className="summary-card logger-photo-review" aria-label={t("Review logger photo")}>
      <h2>{t("Review logger photo")}</h2><PhotoPreview photo={draft} run={run} />
      <button type="button" className="button button-soft button-block" disabled={active} onClick={() => void recognize()}><ScanText />{t("Read photo on this device")}</button>
      {phase === "reading" && <><p role="status">{t("Reading photo… {percent}%", { percent: progress })}</p><button type="button" className="button button-secondary button-block" onClick={() => { operation.current += 1; job.current?.cancel(); job.current = null; setPhase("idle"); }}>{t("Cancel recognition")}</button></>}
      <p className="help-text">{t("Check every suggested value against the photo. Select only readings you want to apply; unchecked fields keep the Run's current values.")}</p>
      {fields.map(([field, label]) => <div className="logger-reading" key={field}>
        <label className="difference-toggle"><input type="checkbox" checked={selected[field]} disabled={active} onChange={event => setSelected({ ...selected, [field]: event.target.checked })} />{t("Use {field}", { field: t(label) })}</label>
        <label className="field"><span>{t(label)}</span><input className="input" disabled={active} inputMode={field === "fastestLap" ? "decimal" : "numeric"} placeholder={t("Enter from photo")} value={readings[field]} onChange={event => setReadings({ ...readings, [field]: event.target.value })} /></label>
        <p className="help-text">{t("Current: {value}", { value: run[field] || "—" })}{conflicts.includes(field) ? ` · ${t("Conflicting readings; enter manually.")}` : ""}</p>
      </div>)}
      {text && <details className="logger-raw-text"><summary>{t("Recognized text")}</summary><pre>{text}</pre></details>}
      <p>{run.loggerPhoto ? t("Saving will replace this Run's photo. The original stays unchanged until you save.") : t("This photo is not saved to the Run yet.")}</p>
      <div className="action-stack">
        <button type="button" className="button button-primary button-block" disabled={active} onClick={() => {
          const chosen = fields.filter(([field]) => selected[field]);
          if (chosen.some(([field]) => !validLoggerReading(field, readings[field]))) { setError("values"); return; }
          onSave(draft, Object.fromEntries(chosen.map(([field]) => [field, readings[field].trim()]))); setDraft(null); setError(null);
        }}>{t("Save photo and selected readings")}</button>
        <button type="button" className="button button-secondary button-block" onClick={discard}>{t("Discard photo draft")}</button>
      </div>
    </section>}
    {!draft && run.loggerPhoto && <section className="summary-card"><h2>{t("Saved logger photo")}</h2><PhotoPreview photo={run.loggerPhoto} run={run} />
      <button type="button" className="button button-soft button-block" disabled={active} onClick={() => review(run.loggerPhoto!)}>{t("Review saved photo readings")}</button>
      {removing ? <div role="group" aria-label={t("Remove logger photo?")}><p>{t("Remove this photo? The Run's readings will be kept.")}</p><div className="action-stack"><button type="button" className="button button-danger button-block" ref={element => { element?.focus(); }} onClick={() => { onRemove(); setRemoving(false); }}>{t("Confirm removal")}</button><button type="button" className="button button-secondary button-block" onClick={() => setRemoving(false)}>{t("Cancel")}</button></div></div> : <button type="button" className="button button-secondary button-block" disabled={active} onClick={() => setRemoving(true)}><Trash2 />{t("Remove logger photo")}</button>}
    </section>}
  </div>;
}
