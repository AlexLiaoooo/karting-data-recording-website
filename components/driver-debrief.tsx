"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic, Square, Trash2 } from "lucide-react";
import { DriverRecorder, canRecordDebrief, type RecorderError, type RecorderState } from "@/lib/driver-recorder";
import { debriefClock } from "@/lib/driver-debrief";
import type { DriverDebrief, RunRecord } from "@/lib/types";
import { useTranslation, type Translate } from "@/lib/i18n";
import { DebriefPlayback } from "./debrief-playback";

const subscribe = () => () => {};
const serverSupported = () => false;
function errorText(error: RecorderError, t: Translate) {
  switch (error) {
    case "unsupported": return t("Audio recording is unavailable here. Open this app in a supported browser over HTTPS, or use written driver feedback.");
    case "permission": return t("Microphone access was denied. Allow it in your browser settings and try again, or use written driver feedback.");
    case "unavailable": return t("The microphone is unavailable or in use. Check your device and try again.");
    case "too-large": return t("The recording exceeded 2 MB. Try a shorter note. Your saved recording is unchanged.");
    default: return t("The recording could not be prepared. Try again. Your saved recording is unchanged.");
  }
}

export function DriverDebriefPanel({ run, onChange, onBusyChange }: { run: RunRecord; onChange: (note?: DriverDebrief) => void; onBusyChange: (busy: boolean) => void }) {
  const { t } = useTranslation();
  const supported = useSyncExternalStore(subscribe, canRecordDebrief, serverSupported);
  const [status, setStatus] = useState<RecorderState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [draft, setDraft] = useState<DriverDebrief | null>(null);
  const [error, setError] = useState<RecorderError | null>(null);
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const recorder = useRef<DriverRecorder | null>(null);
  const busy = status !== "idle" || draft !== null;
  useEffect(() => {
    const controller = new DriverRecorder({ state: setStatus, elapsed: setElapsed, complete: setDraft, error: setError });
    recorder.current = controller;
    return () => { recorder.current = null; controller.dispose(); };
  }, []);
  useEffect(() => {
    onBusyChange(busy);
    if (!busy) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", guard);
    return () => { window.removeEventListener("beforeunload", guard); onBusyChange(false); };
  }, [busy, onBusyChange]);

  return <div className="page-content debrief-page">
    <section className="summary-card">
      <p className="eyebrow">{t("Run {number}", { number: String(run.number).padStart(2, "0") })}{run.label ? ` · ${run.label}` : ""}</p>
      <h1>{t("Fast driver debrief")}</h1>
      <p>{t("Say what you felt: corner entry, mid-corner, exit, and what to change next.")}</p>
      <p className="help-text">{t("Record up to one minute. Audio stays on this device and is included in full JSON backups. No transcription is generated.")}</p>
      {!supported && <p className="help-text">{errorText("unsupported", t)}</p>}
      {error && <p className="form-error" role="alert">{errorText(error, t)}</p>}
      {status === "requesting" && <p role="status">{t("Waiting for microphone permission…")}</p>}
      {status === "recording" && <p className="debrief-clock" role="status"><span className="recording-dot" aria-hidden="true" />{t("Recording {elapsed} / 1:00", { elapsed: debriefClock(Math.floor(elapsed / 1000) * 1000) })}</p>}
      {status === "processing" && <p role="status">{t("Preparing audio note…")}</p>}
      {status !== "idle" && <div className="action-stack">
        {status === "recording" && <button type="button" className="button button-primary button-block" onClick={() => recorder.current?.stop()}><Square />{t("Stop recording")}</button>}
        <button type="button" className="button button-secondary button-block" onClick={() => { recorder.current?.cancel(); setError(null); }}>{status === "requesting" ? t("Cancel microphone request") : t("Discard recording")}</button>
      </div>}
      {draft && <section className="debrief-draft" aria-label={t("Review new recording")}>
        <h2>{t("Review new recording")}</h2>
        <DebriefPlayback note={draft} runId={run.id} runNumber={run.number} />
        <p>{run.driverDebrief ? t("Saving will replace this Run's previous audio note. It remains unchanged until you save.") : t("This recording is not saved to the Run yet.")}</p>
        <div className="action-stack">
          <button type="button" className="button button-primary button-block" onClick={() => { onChange(draft); setDraft(null); }}>{t("Save audio note")}</button>
          <button type="button" className="button button-secondary button-block" onClick={() => setDraft(null)}>{t("Discard recording")}</button>
        </div>
      </section>}
      {!busy && !confirmRemoval && <button type="button" className="button button-primary button-block" disabled={!supported} onClick={() => { setError(null); void recorder.current?.start(); }}><Mic />{run.driverDebrief ? t("Record replacement note") : t("Record audio note")}</button>}
      <p className="help-text">{t("Recording stops after one minute or when this app goes into the background. Review and save the note before leaving this screen.")}</p>
    </section>
    {!busy && run.driverDebrief && <section className="summary-card">
      <h2>{t("Saved audio note")}</h2>
      <DebriefPlayback note={run.driverDebrief} runId={run.id} runNumber={run.number} />
      {confirmRemoval ? <div className="debrief-removal" role="group" aria-label={t("Remove this audio note?")}>
        <p>{t("Remove this audio note? The Run's written feedback will be kept.")}</p>
        <div className="action-stack">
          <button type="button" className="button button-danger button-block" ref={element => { element?.focus(); }} onClick={() => { onChange(undefined); setConfirmRemoval(false); }}>{t("Confirm removal")}</button>
          <button type="button" className="button button-secondary button-block" onClick={() => setConfirmRemoval(false)}>{t("Cancel")}</button>
        </div>
      </div> : <button type="button" className="button button-secondary button-block" onClick={() => setConfirmRemoval(true)}><Trash2 />{t("Remove audio note")}</button>}
    </section>}
  </div>;
}
