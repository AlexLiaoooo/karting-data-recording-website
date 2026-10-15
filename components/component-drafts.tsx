"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "@/lib/i18n";

const DraftContext = createContext<{ busy: boolean; report: (id: string, open: boolean) => void } | null>(null);

/** Count all open forms, so saving one cannot release another form's navigation guard. */
export function ComponentDrafts({ children, onBusyChange }: { children: ReactNode; onBusyChange?: (busy: boolean) => void }) {
  const { t } = useTranslation();
  const [forms, setForms] = useState<Set<string>>(() => new Set());
  const report = useCallback((id: string, open: boolean) => setForms(previous => {
    if (previous.has(id) === open) return previous;
    const next = new Set(previous); if (open) next.add(id); else next.delete(id); return next;
  }), []);
  const busy = forms.size > 0;
  const value = useMemo(() => ({ busy, report }), [busy, report]);
  useEffect(() => {
    onBusyChange?.(busy);
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    if (busy) window.addEventListener("beforeunload", guard);
    return () => { window.removeEventListener("beforeunload", guard); onBusyChange?.(false); };
  }, [busy, onBusyChange]);
  return <DraftContext.Provider value={value}>
    {busy && <p className="help-text page-content" role="status">{t("Save or cancel open component and service forms before leaving or opening another record.")}</p>}
    {children}
  </DraftContext.Provider>;
}

export function useComponentDraft(open: boolean) {
  const context = useContext(DraftContext); const id = useId(); const report = context?.report;
  useEffect(() => {
    report?.(id, open);
    return () => report?.(id, false);
  }, [id, open, report]);
  return context?.busy ?? false;
}
