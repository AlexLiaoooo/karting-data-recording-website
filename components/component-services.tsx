"use client";

import { useState } from "react";
import { localDate } from "@/lib/format";
import { lapCount } from "@/lib/tyre-sets";
import type { ComponentService, KartComponent } from "@/lib/types";
import { useTranslation } from "@/lib/i18n";

type Draft = Omit<ComponentService, "lapsAtService"> & { lapsAtService: string };
export function ComponentServices({ component, totalLaps, onSave }: { component: KartComponent; totalLaps: number | null; onSave: (component: KartComponent) => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [invalid, setInvalid] = useState(false); const [removing, setRemoving] = useState<string | null>(null);
  function edit(service: ComponentService) { setDraft({ ...service, lapsAtService: String(service.lapsAtService) }); setInvalid(false); setRemoving(null); }
  return <section className="component-services">
    <h3>{t("Service history")}</h3>
    {!draft && <button type="button" className="button button-secondary button-block" onClick={() => edit({ id: crypto.randomUUID(), date: localDate(), lapsAtService: totalLaps ?? 0, notes: "" })}>{t("Record service")}</button>}
    {draft && <form className="component-service-form" onSubmit={event => {
      event.preventDefault(); const lapsAtService = lapCount(draft.lapsAtService);
      const parsed = new Date(`${draft.date}T12:00:00Z`);
      if (lapsAtService === null || !draft.notes.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== draft.date || draft.date > localDate()) { setInvalid(true); return; }
      const record = { ...draft, lapsAtService, notes: draft.notes.trim() };
      onSave({ ...component, services: component.services.some(service => service.id === record.id) ? component.services.map(service => service.id === record.id ? record : service) : [...component.services, record], updatedAt: new Date().toISOString() });
      setDraft(null); setInvalid(false);
    }}>
      <h4>{component.services.some(service => service.id === draft.id) ? t("Edit service") : t("New service record")}</h4>
      <label className="field"><span>{t("Service date")}</span><input className="input" type="date" required max={localDate()} value={draft.date} onChange={event => setDraft({ ...draft, date: event.target.value })} /></label>
      <label className="field"><span>{t("Lifetime laps at service")}</span><input className="input" inputMode="numeric" required value={draft.lapsAtService} onChange={event => setDraft({ ...draft, lapsAtService: event.target.value })} /></label>
      <label className="field"><span>{t("Service performed")}</span><textarea className="textarea" required value={draft.notes} onChange={event => setDraft({ ...draft, notes: event.target.value })} /></label>
      <p className="help-text">{t("Confirm the lifetime counter when service was performed. This records maintenance; it does not change Run lap counts.")}</p>
      {invalid && <p className="form-error" role="alert">{t("Enter a valid past or current date, whole lifetime laps and a service description.")}</p>}
      <div className="action-stack"><button type="submit" className="button button-primary button-block">{t("Save service")}</button><button type="button" className="button button-secondary button-block" onClick={() => setDraft(null)}>{t("Cancel")}</button></div>
    </form>}
    <div className="component-service-list">{[...component.services].sort((a, b) => b.lapsAtService - a.lapsAtService || b.date.localeCompare(a.date)).map(service => <article className="component-service-entry" key={service.id}>
      <strong>{service.date} · {t("{count} lifetime laps", { count: service.lapsAtService })}</strong><p>{service.notes}</p>
      {removing === service.id ? <div role="group" aria-label={t("Remove service record?")}><p>{t("Removing this service will recalculate the reminder.")}</p><div className="action-stack"><button type="button" className="button button-danger button-block" ref={element => { element?.focus(); }} onClick={() => { onSave({ ...component, services: component.services.filter(record => record.id !== service.id), updatedAt: new Date().toISOString() }); setRemoving(null); }}>{t("Confirm removal")}</button><button type="button" className="button button-secondary button-block" onClick={() => setRemoving(null)}>{t("Cancel")}</button></div></div> : <div className="component-actions"><button type="button" className="button button-secondary" onClick={() => edit(service)}>{t("Edit service")}</button><button type="button" className="button button-soft" onClick={() => { setRemoving(service.id); setDraft(null); }}>{t("Remove service")}</button></div>}
    </article>)}</div>
    {!component.services.length && <p className="help-text">{t("No service recorded yet.")}</p>}
  </section>;
}
