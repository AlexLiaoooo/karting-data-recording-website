"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { claimWriter, releaseWriter, renewWriter } from "@/lib/writer-session";
import { WRITER_HEARTBEAT_MS } from "@/lib/writer-lease";
import { useTranslation } from "@/lib/i18n";

type EditingContext = { owner: string; lost: boolean; canWrite: () => boolean; stopEditing: () => void };
const Context = createContext<EditingContext | null>(null);

/** Acquire before reading records; serialize cleanup/acquisition across Strict Mode replay. */
export function EditingSession({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [attempt, setAttempt] = useState(0);
  const [owner, setOwner] = useState<string | null>(null);
  const [state, setState] = useState<"opening" | "busy" | "error" | "active" | "lost">("opening");
  const operations = useRef(Promise.resolve());
  const active = useRef(false);
  const stopEditing = useCallback(() => { active.current = false; setState("lost"); }, []);
  const canWrite = useCallback(() => active.current, []);

  useEffect(() => {
    const token = crypto.randomUUID();
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let renewing = false;
    const renew = async () => {
      if (cancelled || !active.current || renewing) return;
      renewing = true;
      try { await renewWriter(token); }
      catch { if (!cancelled) stopEditing(); }
      finally { renewing = false; }
    };
    operations.current = operations.current.then(async () => {
      if (cancelled) return;
      try {
        const acquired = await claimWriter(token);
        if (cancelled) return;
        if (!acquired) { setState("busy"); return; }
        active.current = true;
        setOwner(token);
        setState("active");
        timer = setInterval(() => { void renew(); }, WRITER_HEARTBEAT_MS);
      } catch { if (!cancelled) setState("error"); }
    });
    const onVisible = () => { if (document.visibilityState === "visible") void renew(); };
    window.addEventListener("focus", renew);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      active.current = false;
      clearInterval(timer);
      window.removeEventListener("focus", renew);
      document.removeEventListener("visibilitychange", onVisible);
      operations.current = operations.current.then(() => releaseWriter(token)).catch(() => undefined);
    };
  }, [attempt, stopEditing]);

  const value = useMemo(() => ({ owner: owner ?? "", lost: state === "lost", canWrite, stopEditing }), [owner, state, canWrite, stopEditing]);
  if (owner) return <Context.Provider value={value}>{children}</Context.Provider>;
  return <main className="loading-screen"><section className="storage-recovery" role={state === "opening" ? "status" : "alert"}>
    <h1>{t(state === "busy" ? "Kart Data is open in another tab" : state === "error" ? "Editing could not be secured" : "Loading Kart Data…")}</h1>
    {state !== "opening" && <>
      <p>{t(state === "busy" ? "Close the other Kart Data tab, then retry. After closing it, editing may take up to 20 seconds to become available." : "Editing is paused because device storage could not be checked. Allow device storage and retry without clearing browser data.")}</p>
      <button className="button button-primary" onClick={() => { setState("opening"); setAttempt(previous => previous + 1); }}>{t("Retry opening")}</button>
    </>}
  </section></main>;
}

export function useEditingSession() {
  const session = useContext(Context);
  if (!session) throw new Error("EditingSession is required");
  return session;
}
