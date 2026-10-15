"use client";

import { useMemo, useState } from "react";
import { Plus, Wrench } from "lucide-react";
import { useTranslation, type Translate } from "@/lib/i18n";
import { componentUsage, type ComponentUsage } from "@/lib/component-life";
import { lapCount, tyreRunHistory } from "@/lib/tyre-sets";
import type { AppData, ComponentKind, KartComponent, RunRecord } from "@/lib/types";
import type { RecordedRun } from "@/lib/experiments";
import { ComponentServices } from "./component-services";
import { ComponentDrafts, useComponentDraft } from "./component-drafts";

const kinds: ComponentKind[] = ["Engine", "Chain", "Sprocket", "Brake"];
type Draft = Omit<KartComponent, "initialLaps" | "serviceIntervalLaps"> & { initialLaps: string; serviceIntervalLaps: string };
function stateLabel(state: ComponentUsage["state"], t: Translate) {
  switch (state) { case "due": return t("Service due"); case "soon": return t("Due soon"); case "ok": return t("Within interval"); case "incomplete": return t("Incomplete usage"); case "check": return t("Check service counter"); default: return t("No service interval"); }
}

export function RunComponents({ run, components, onUpdate }: { run: RunRecord; components: KartComponent[]; onUpdate: (updater: (run: RunRecord) => RunRecord) => void }) {
  const { t } = useTranslation();
  return <details className="summary-card run-components"><summary>{t("Installed components")} · {run.componentIds?.length ?? 0}</summary>
    {components.filter(component => !component.retired || run.componentIds?.includes(component.id)).map(component => <label className="difference-toggle component-choice" key={component.id}>
      <input type="checkbox" checked={run.componentIds?.includes(component.id) ?? false} onChange={event => {
        const checked = event.target.checked;
        onUpdate(current => ({ ...current, componentIds: checked ? [...new Set([...(current.componentIds ?? []), component.id])] : (current.componentIds ?? []).filter(id => id !== component.id) }));
      }} />{component.name} · {t(component.kind)}{component.retired ? ` · ${t("Retired")}` : ""}
    </label>)}
    <p className="help-text">{components.length ? t("Only completed Runs add laps to selected components. Correcting or deleting a Run recalculates usage.") : t("Create parts from Component-life notebook on Home, then select the installed parts here.")}</p>
  </details>;
}

type NotebookProps = { data: AppData; onSave: (component: KartComponent) => void; onOpen: (run: RecordedRun) => void };
export function ComponentLifeNotebook({ onBusyChange, ...props }: NotebookProps & { onBusyChange?: (busy: boolean) => void }) {
  return <ComponentDrafts onBusyChange={onBusyChange}><ComponentNotebook {...props} /></ComponentDrafts>;
}

function ComponentNotebook({ data, onSave, onOpen }: NotebookProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<Draft | null>(null); const [invalid, setInvalid] = useState(false);
  const busy = useComponentDraft(draft !== null);
  const history = useMemo(() => tyreRunHistory(data), [data]);
  const edit = (component: KartComponent) => { setDraft({ ...component, initialLaps: String(component.initialLaps), serviceIntervalLaps: component.serviceIntervalLaps === null ? "" : String(component.serviceIntervalLaps) }); setInvalid(false); };
  return <div className="page-content component-notebook">
    <p className="lead">{t("Track engines, chains, sprockets and brakes through recorded Runs and service history.")}</p>
    <button type="button" className="button button-primary button-block" disabled={draft !== null} onClick={() => { const now = new Date().toISOString(); edit({ id: crypto.randomUUID(), name: "", kind: "Engine", notes: "", initialLaps: 0, serviceIntervalLaps: null, retired: false, services: [], createdAt: now, updatedAt: now }); }}><Plus />{t("Add component")}</button>
    {draft && <form className="summary-card component-form" onSubmit={event => {
      event.preventDefault(); const initialLaps = lapCount(draft.initialLaps); const interval = draft.serviceIntervalLaps.trim() ? lapCount(draft.serviceIntervalLaps) : null;
      if (!draft.name.trim() || initialLaps === null || (draft.serviceIntervalLaps.trim() && (interval === null || interval === 0))) { setInvalid(true); return; }
      const current = data.components.find(component => component.id === draft.id);
      onSave({ ...draft, ...current, name: draft.name.trim(), kind: draft.kind, notes: draft.notes, initialLaps, serviceIntervalLaps: interval, updatedAt: new Date().toISOString() }); setDraft(null); setInvalid(false);
    }}>
      <h2>{data.components.some(component => component.id === draft.id) ? t("Edit component") : t("New component")}</h2>
      <div className="form-grid">
        <label className="field field-full"><span>{t("Component name")}</span><input className="input" required value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
        <label className="field field-full"><span>{t("Component type")}</span><select className="select" value={draft.kind} onChange={event => setDraft({ ...draft, kind: event.target.value as ComponentKind })}>{kinds.map(kind => <option value={kind} key={kind}>{t(kind)}</option>)}</select></label>
        <label className="field"><span>{t("Starting laps")}</span><input className="input" required inputMode="numeric" value={draft.initialLaps} onChange={event => setDraft({ ...draft, initialLaps: event.target.value })} /></label>
        <label className="field"><span>{t("Service interval (laps)")}</span><input className="input" inputMode="numeric" value={draft.serviceIntervalLaps} onChange={event => setDraft({ ...draft, serviceIntervalLaps: event.target.value })} /></label>
        <label className="field field-full"><span>{t("Component notes")}</span><textarea className="textarea" value={draft.notes} onChange={event => setDraft({ ...draft, notes: event.target.value })} /></label>
      </div>
      <p className="help-text">{t("Starting laps are use before the first recorded Run. Enter your own service interval, or leave it blank to turn reminders off.")}</p>
      {invalid && <p className="form-error" role="alert">{t("Enter a name, nonnegative whole starting laps and a positive whole interval or leave it blank.")}</p>}
      <div className="action-stack"><button type="submit" className="button button-primary button-block">{t("Save component")}</button><button type="button" className="button button-secondary button-block" onClick={() => setDraft(null)}>{t("Cancel")}</button></div>
    </form>}
    {!data.components.length && !draft && <section className="empty-state"><Wrench /><h2>{t("No components yet")}</h2><p>{t("Give each part a name, then link it to the Runs where it was used.")}</p></section>}
    {data.components.map(component => {
      const usage = componentUsage(data, component); const entries = history.filter(entry => entry.run.componentIds?.includes(component.id));
      return <article className="summary-card component-card" key={component.id}>
        <div className="card-head"><div><h2>{component.name}</h2><span className="muted">{t(component.kind)} · {component.retired ? t("Retired") : t("Active")}</span></div><span className={`badge component-state-${usage.state}`}>{stateLabel(usage.state, t)}</span></div>
        <div className="stat-grid"><div><span>{t("Lifetime recorded laps")}</span><strong>{usage.totalLaps ?? "—"}</strong></div><div><span>{t("Laps since service")}</span><strong>{usage.sinceService ?? "—"}</strong></div><div><span>{t("Laps remaining")}</span><strong>{usage.remainingLaps ?? "—"}</strong></div></div>
        <p className="help-text">{t("Starting laps: {laps} · Completed assigned Runs: {runs}", { laps: component.initialLaps, runs: usage.completedRuns })}</p>
        {usage.missingLaps > 0 && <p className="help-text">{t("{count} completed Runs have missing or invalid lap counts; the lap total is incomplete.", { count: usage.missingLaps })}</p>}
        {usage.state === "check" && <p className="form-error">{t("A service counter exceeds recorded usage, or the total is too large. Check starting usage and service records.")}</p>}
        {component.notes && <p className="component-notes">{component.notes}</p>}
        <div className="component-actions"><button type="button" className="button button-secondary" disabled={draft !== null} onClick={() => edit(component)}>{t("Edit component")}</button><button type="button" className="button button-soft" onClick={() => onSave({ ...component, retired: !component.retired, updatedAt: new Date().toISOString() })}>{component.retired ? t("Reactivate component") : t("Retire component")}</button></div>
        <ComponentServices component={component} totalLaps={usage.totalLaps} onSave={onSave} />
        <details><summary>{t("Assigned Run history")} · {entries.length}</summary><div className="item-list">{[...entries].reverse().map(entry => <button type="button" className="list-item" disabled={busy} key={entry.run.id} onClick={() => onOpen(entry)}><span className="list-copy"><strong>{entry.eventName} · {entry.sessionName} · Run {String(entry.run.number).padStart(2, "0")}</strong><span>{entry.date} · {entry.run.laps || "—"} {t("Laps")} · {entry.run.completed ? t("Completed") : t("Unfinished")}</span></span></button>)}</div></details>
      </article>;
    })}
    <p className="help-text">{t("Reminders use your interval and recorded laps only. Due soon means within 10% of the interval. Retiring a part preserves its history.")}</p>
  </div>;
}
