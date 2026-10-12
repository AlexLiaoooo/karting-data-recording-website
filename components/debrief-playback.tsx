"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { debriefClock, debriefExtension } from "@/lib/driver-debrief";
import type { DriverDebrief } from "@/lib/types";
import { useTranslation } from "@/lib/i18n";

export function DebriefPlayback({ note, runId, runNumber }: { note: DriverDebrief; runId: string; runNumber: number }) {
  const { t, language } = useTranslation();
  const [failedNote, setFailedNote] = useState<DriverDebrief | null>(null);
  const identity = runId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 8) || "record";
  const filename = `kart-debrief-${note.recordedAt.slice(0, 10)}-run-${String(runNumber).padStart(2, "0")}-${identity}.${debriefExtension(note.mimeType)}`;
  const date = new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(note.recordedAt));
  return <div className="debrief-playback">
    <p className="help-text">{t("Recorded {date} · {duration}", { date, duration: debriefClock(note.durationMs) })}</p>
    <audio key={note.dataUrl} controls preload="none" src={note.dataUrl} aria-label={t("Driver debrief audio")} onError={() => setFailedNote(note)} />
    {failedNote === note && <p role="alert" className="form-error">{t("This browser could not play the recording. Download it and try an audio player on your device.")}</p>}
    <a className="button button-secondary button-block" href={note.dataUrl} download={filename}><Download />{t("Download audio note")}</a>
  </div>;
}
