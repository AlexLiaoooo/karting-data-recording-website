"use client";

import { useMemo, useState } from "react";
import { CircleGauge, Plus } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { lapCount, tyreRunHistory, tyreSetSummary, type TyreUsage } from "@/lib/tyre-sets";
import type { RecordedRun } from "@/lib/experiments";
import type { AppData, RunRecord, TyreSet } from "@/lib/types";

type Draft = Omit<TyreSet, "initialLaps" | "initialHeatCycles"> & { initialLaps: string; initialHeatCycles: string };

export function TyreAge({ usage }: { usage?: TyreUsage }) {
  const { t } = useTranslation();
  return usage ? <div className="tyre-age">
    <p>{t("Recorded age before this Run: {laps} laps · {cycles} heat cycles", { laps: usage.laps ?? "—", cycles: usage.heatCycles ?? "—" })}</p>
    {usage.missingLaps > 0 && <p className="help-text">{t("{count} earlier completed Runs have missing or invalid lap counts; the lap total is incomplete.", { count: usage.missingLaps })}</p>}
  </div> : null;
}

export function RunTyreSet({ run, sets, usage, onUpdate }: {
  run: RunRecord; sets: TyreSet[]; usage?: TyreUsage; onUpdate: (updater: (run: RunRecord) => RunRecord) => void;
}) {
  const { t } = useTranslation();
  return <section className="summary-card run-tyre-set">
    <label className="field"><span>{t("Tyre set")}</span><select className="select" value={run.tyreSetId ?? ""} onChange={event => {
      const id = event.target.value || null;
      onUpdate(current => ({ ...current, tyreSetId: id, tyreHeatCycle: id === current.tyreSetId ? current.tyreHeatCycle : false }));
    }}><option value="">{t("No tyre set assigned")}</option>
      {sets.filter(set => !set.retired || set.id === run.tyreSetId).map(set => <option key={set.id} value={set.id}>{set.name}{set.compound ? ` · ${set.compound}` : ""}{set.retired ? ` · ${t("Retired")}` : ""}</option>)}
    </select></label>
    <TyreAge usage={usage} />
    <label className="difference-toggle tyre-cycle"><input type="checkbox" checked={run.tyreHeatCycle ?? false} disabled={!run.tyreSetId} onChange={event => onUpdate(current => ({ ...current, tyreHeatCycle: event.target.checked }))} />{t("Heat cycle recorded for this Run")}</label>
    <p className="help-text">{t("Usage counts completed assigned Runs only. Mark a heat cycle when recorded; it is not inferred from hot readings.")}</p>
    {!sets.length && <p className="help-text">{t("Create tyre sets from Tyre-set history on Home, then assign one here.")}</p>}
  </section>;
}

export function TyreSetLibrary({ data, onSave, onOpen }: { data: AppData; onSave: (set: TyreSet) => void; onOpen: (entry: RecordedRun) => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState(false);
  const history = useMemo(() => tyreRunHistory(data), [data]);
  const edit = (set: TyreSet) => { setDraft({ ...set, initialLaps: String(set.initialLaps), initialHeatCycles: String(set.initialHeatCycles) }); setError(false); };
  return <div className="page-content tyre-set-library">
    <p className="lead">{t("Follow each tyre set across Events, including usage before you started recording.")}</p>
    <button className="button button-primary button-block" type="button" onClick={() => {
      const now = new Date().toISOString();
      edit({ id: crypto.randomUUID(), name: "", compound: "", notes: "", initialLaps: 0, initialHeatCycles: 0, retired: false, createdAt: now, updatedAt: now });
    }}><Plus />{t("Add tyre set")}</button>
    {draft && <form className="summary-card tyre-set-form" onSubmit={event => {
      event.preventDefault();
      const initialLaps = lapCount(draft.initialLaps);
      const initialHeatCycles = lapCount(draft.initialHeatCycles);
      if (!draft.name.trim() || initialLaps === null || initialHeatCycles === null) { setError(true); return; }
      onSave({ ...draft, name: draft.name.trim(), initialLaps, initialHeatCycles, updatedAt: new Date().toISOString() });
      setDraft(null); setError(false);
    }}>
      <h2>{data.tyreSets.some(set => set.id === draft.id) ? t("Edit tyre set") : t("New tyre set")}</h2>
      <div className="form-grid">
        <label className="field field-full"><span>{t("Tyre set name")}</span><input className="input" required value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
        <label className="field field-full"><span>{t("Compound / model")}</span><input className="input" value={draft.compound} onChange={event => setDraft({ ...draft, compound: event.target.value })} /></label>
        <label className="field"><span>{t("Starting laps")}</span><input className="input" required inputMode="numeric" value={draft.initialLaps} onChange={event => setDraft({ ...draft, initialLaps: event.target.value })} /></label>
        <label className="field"><span>{t("Starting heat cycles")}</span><input className="input" required inputMode="numeric" value={draft.initialHeatCycles} onChange={event => setDraft({ ...draft, initialHeatCycles: event.target.value })} /></label>
        <label className="field field-full"><span>{t("Tyre set notes")}</span><textarea className="textarea" value={draft.notes} onChange={event => setDraft({ ...draft, notes: event.target.value })} /></label>
      </div>
      <p className="help-text">{t("Starting usage is usage before the first Run recorded here. Do not include Runs already in this app.")}</p>
      {error && <p className="form-error" role="alert">{t("Enter a name and nonnegative whole numbers for starting usage.")}</p>}
      <div className="action-stack"><button className="button button-primary button-block" type="submit">{t("Save tyre set")}</button><button className="button button-secondary button-block" type="button" onClick={() => { setDraft(null); setError(false); }}>{t("Cancel")}</button></div>
    </form>}
    {!data.tyreSets.length && !draft && <section className="empty-state"><span className="empty-icon"><CircleGauge /></span><h2>{t("No tyre sets yet")}</h2><p>{t("Give each set a name so tyre age can be read beside setup changes.")}</p></section>}
    {data.tyreSets.map(set => {
      const usage = tyreSetSummary(data, set);
      const entries = history.filter(entry => entry.run.tyreSetId === set.id);
      return <article className="summary-card tyre-set-card" key={set.id}>
        <div className="card-head"><h2>{set.name}</h2><span className="badge">{set.retired ? t("Retired") : t("Active")}</span></div>
        {set.compound && <p className="muted">{set.compound}</p>}
        <div className="stat-grid"><div><span>{t("Recorded laps")}</span><strong>{usage.laps ?? "—"}</strong></div><div><span>{t("Recorded heat cycles")}</span><strong>{usage.heatCycles ?? "—"}</strong></div><div><span>{t("Completed Runs")}</span><strong>{usage.completedRuns}</strong></div></div>
        <p className="help-text">{t("Includes starting usage: {laps} laps · {cycles} heat cycles", { laps: set.initialLaps, cycles: set.initialHeatCycles })}</p>
        {usage.missingLaps > 0 && <p className="help-text">{t("{count} completed Runs have missing or invalid lap counts; the lap total is incomplete.", { count: usage.missingLaps })}</p>}
        {set.notes && <p className="tyre-set-notes">{set.notes}</p>}
        <details><summary>{t("Assigned Run history")} · {entries.length}</summary><div className="item-list">{[...entries].reverse().map(entry => <button className="list-item" type="button" key={entry.run.id} onClick={() => onOpen(entry)}>
          <span className="list-copy"><strong>{entry.eventName} · {entry.sessionName} · {t("Run {number}", { number: String(entry.run.number).padStart(2, "0") })}</strong><span>{entry.date} · {t(entry.conditions.condition)} · {entry.run.laps.trim() || "—"} {t("Laps")} · {entry.run.completed ? t("Completed") : t("Unfinished")}{entry.run.tyreHeatCycle ? ` · ${t("Heat cycle recorded")}` : ""}</span></span>
        </button>)}</div></details>
        <div className="tyre-set-actions"><button className="button button-secondary" type="button" onClick={() => edit(set)}>{t("Edit tyre set")}</button><button className="button button-soft" type="button" onClick={() => onSave({ ...set, retired: !set.retired, updatedAt: new Date().toISOString() })}>{set.retired ? t("Reactivate tyre set") : t("Retire tyre set")}</button></div>
      </article>;
    })}
    <p className="help-text">{t("Retiring preserves history. Editing or deleting Runs recalculates usage. Unrecorded use is not included.")}</p>
  </div>;
}
