"use client";

import { useState } from "react";
import { BookOpen, ChevronRight } from "lucide-react";
import { emptyExperiment, type RunRecordingPhase, type SetupExperiment } from "@/lib/types";
import { experimentComparison, hasExperiment, type RecordedRun } from "@/lib/experiments";
import { formatLapTime, parseLapTime } from "@/lib/lap-time";
import { useTranslation } from "@/lib/i18n";

const runName = (entry: RecordedRun) => `Run ${String(entry.run.number).padStart(2, "0")}${entry.run.label ? ` · ${entry.run.label}` : ""}`;

function RunContext({ entry, title }: { entry: RecordedRun; title: string }) {
  const { t } = useTranslation();
  const lap = parseLapTime(entry.run.fastestLap);
  return (
    <section className="experiment-context" aria-label={title}>
      <h3>{title} · {runName(entry)}</h3>
      <p>{entry.eventName} · {entry.sessionName}</p>
      <p>{entry.track || t("Track not set")} · {entry.date || t("No date")}</p>
      <dl>
        <div><dt>{t("Track condition")}</dt><dd>{t(entry.conditions.condition)}</dd></div>
        <div><dt>{t("Track temperature")}</dt><dd>{entry.conditions.trackTemperature ? `${entry.conditions.trackTemperature} °C` : "—"}</dd></div>
        <div><dt>{t("Ambient temperature")}</dt><dd>{entry.conditions.ambientTemperature ? `${entry.conditions.ambientTemperature} °C` : "—"}</dd></div>
        <div><dt>{t("Fastest lap")}</dt><dd>{lap === null ? entry.run.fastestLap || "—" : formatLapTime(lap)}</dd></div>
      </dl>
    </section>
  );
}

function ExperimentResult({ test, baseline, onCompare }: { test: RecordedRun; baseline?: RecordedRun; onCompare: (baselineId: string, testId: string) => void }) {
  const { t } = useTranslation();
  const result = baseline ? experimentComparison(test, baseline) : null;
  const delta = result?.lapDelta;
  return (
    <div className="experiment-result">
      {baseline ? <RunContext entry={baseline} title={t("Baseline Run")} /> : (
        <p className="help-text">{test.run.experiment?.baselineRunId
          ? t("Baseline Run is unavailable. Your experiment notes are kept; select another baseline to compare.")
          : t("Choose a baseline Run to compare its conditions and results with this test.")}</p>
      )}
      <RunContext entry={test} title={t("Test Run")} />
      {result && <div className="experiment-lap-result">
        <strong>{delta === null ? t("Record both fastest laps to see the change.")
          : Math.abs(delta!) < 0.0005 ? t("Same recorded fastest lap")
          : delta! < 0 ? t("{value} s faster than baseline", { value: Math.abs(delta!).toFixed(3) })
          : t("{value} s slower than baseline", { value: delta!.toFixed(3) })}</strong>
        {result.differentConditions && <p className="compare-warning">{t("Not like for like: {first} against {second}", { first: t(baseline!.conditions.condition), second: t(test.conditions.condition) })}</p>}
        {result.differentTrack && <p className="compare-warning">{t("Different circuits or layouts: these lap times are not like for like.")}</p>}
        {result.unknownTrack && <p className="compare-warning">{t("Circuit not recorded for both Runs; check the context before comparing.")}</p>}
        <p className="help-text">{t("Recorded comparison; conditions and driving can also affect lap times.")}</p>
        <button className="button button-secondary button-block" type="button" onClick={() => onCompare(baseline!.run.id, test.run.id)}>{t("Compare linked Runs")}<ChevronRight /></button>
      </div>}
    </div>
  );
}

export function RunExperiment({ entry, runs, phase, onChange, onCompare }: {
  entry: RecordedRun; runs: RecordedRun[]; phase: RunRecordingPhase;
  onChange: (updater: (current: SetupExperiment) => SetupExperiment) => void;
  onCompare: (baselineId: string, testId: string) => void;
}) {
  const { t } = useTranslation();
  const experiment = entry.run.experiment ?? emptyExperiment();
  const baseline = runs.find(item => item.run.id === experiment.baselineRunId && item.run.id !== entry.run.id);
  const groups = new Map<string, { label: string; runs: RecordedRun[] }>();
  for (const item of [...runs].reverse()) {
    if (item.run.id === entry.run.id) continue;
    const key = `${item.eventId}:${item.sessionId}`;
    const group = groups.get(key) ?? { label: `${item.eventName} · ${item.sessionName} · ${item.date}`, runs: [] };
    group.runs.push(item);
    groups.set(key, group);
  }
  const update = (field: keyof SetupExperiment, value: string | null) => onChange(current => ({ ...current, [field]: value }));
  return (
    <details className="editor-section" open={hasExperiment(entry.run)}>
      <summary><span><BookOpen />{t("Setup experiment")}</span><ChevronRight /></summary>
      <div className="editor-body experiment-editor">
        <p className="help-text">{t("Link a baseline, note your change and expectation, then record what happened after the Run.")}</p>
        <label className="field"><span>{t("Baseline Run")}</span>
          <select className="select" value={experiment.baselineRunId ?? ""} onChange={event => update("baselineRunId", event.target.value || null)}>
            <option value="">{t("No baseline selected")}</option>
            {experiment.baselineRunId && !baseline && <option value={experiment.baselineRunId} disabled>{t("Baseline Run unavailable")}</option>}
            {[...groups].map(([key, group]) => <optgroup key={key} label={group.label}>
              {group.runs.map(item => <option key={item.run.id} value={item.run.id}>{runName(item)} · {t(item.conditions.condition)} · {item.track || t("Track not set")}</option>)}
            </optgroup>)}
          </select>
        </label>
        <label className="field"><span>{t("What I changed")}</span><textarea className="textarea" value={experiment.change} onChange={event => update("change", event.target.value)} /></label>
        <label className="field"><span>{t("What I expected")}</span><textarea className="textarea" value={experiment.expectation} onChange={event => update("expectation", event.target.value)} /></label>
        {phase === "after" && <label className="field"><span>{t("What happened")}</span><textarea className="textarea" value={experiment.outcome} onChange={event => update("outcome", event.target.value)} /></label>}
        <ExperimentResult test={entry} baseline={baseline} onCompare={onCompare} />
      </div>
    </details>
  );
}

export function ExperimentJournal({ runs, onOpen, onCompare }: {
  runs: RecordedRun[]; onOpen: (entry: RecordedRun) => void; onCompare: (baselineId: string, testId: string) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const byId = new Map(runs.map(entry => [entry.run.id, entry]));
  const entries = runs.filter(item => hasExperiment(item.run)).sort((a, b) => b.run.recordedAt.localeCompare(a.run.recordedAt));
  const needle = query.trim().toLowerCase();
  const visible = entries.filter(item => {
    const baseline = byId.get(item.run.experiment?.baselineRunId ?? "");
    return [item.eventName, item.sessionName, item.track, runName(item), item.run.experiment?.change,
      item.run.experiment?.expectation, item.run.experiment?.outcome, baseline?.eventName, baseline?.sessionName,
      baseline?.track, baseline ? runName(baseline) : ""].join(" ").toLowerCase().includes(needle);
  });
  return (
    <div className="page-content experiment-journal">
      <h1>{t("Setup experiment journal")}</h1>
      <p className="lead">{t("Revisit what changed, what you expected and what happened, with baseline and test conditions together.")}</p>
      {entries.length ? <>
        <label className="field"><span>{t("Search experiments")}</span><input className="input" type="search" value={query} onChange={event => setQuery(event.target.value)} /></label>
        {!visible.length && <p className="help-text">{t("No experiments match your search.")}</p>}
        {visible.map(entry => {
          const experiment = entry.run.experiment!;
          const linked = byId.get(experiment.baselineRunId ?? "");
          const baseline = linked?.run.id !== entry.run.id ? linked : undefined;
          return <article className="experiment-card" key={entry.run.id}>
            <div className="card-head"><h2>{runName(entry)}</h2><span className="badge">{experiment.outcome.trim() ? t("Outcome recorded") : t("Awaiting outcome")}</span></div>
            <div className="experiment-notes">
              <h3>{t("What I changed")}</h3><p>{experiment.change || t("Not recorded")}</p>
              <h3>{t("What I expected")}</h3><p>{experiment.expectation || t("Not recorded")}</p>
              <h3>{t("What happened")}</h3><p>{experiment.outcome || t("Not recorded")}</p>
            </div>
            <ExperimentResult test={entry} baseline={baseline} onCompare={onCompare} />
            <div className="action-stack">
              <button className="button button-primary button-block" type="button" onClick={() => onOpen(entry)}>{t("Open test Run")}<ChevronRight /></button>
              {baseline && <button className="button button-secondary button-block" type="button" onClick={() => onOpen(baseline)}>{t("Open baseline Run")}<ChevronRight /></button>}
            </div>
          </article>;
        })}
      </> : <section className="empty-state"><span className="empty-icon"><BookOpen /></span><h2>{t("No setup experiments yet")}</h2><p>{t("Open a Run and expand Setup experiment to link a baseline and start your notes.")}</p></section>}
    </div>
  );
}
