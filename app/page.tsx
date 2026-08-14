"use client";

import {
  ArrowLeft,
  Check,
  ChevronRight,
  CircleGauge,
  Copy,
  Database,
  Download,
  Flag,
  Gauge,
  History,
  LocateFixed,
  LoaderCircle,
  MessageSquareText,
  Pencil,
  Plus,
  Route,
  Save,
  Settings,
  Share2,
  Timer,
  Trash2,
  Trophy,
  Upload,
  Wrench,
  X,
} from "lucide-react";
import { ChangeEvent, FocusEvent as ReactFocusEvent, FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { emptyAppData, loadData, normalizeAppData, saveData, validateImport } from "@/lib/database";
import { buildCsv } from "@/lib/csv";
import { AppData, createRun, EventRecord, RunRecord, SessionRecord, SetupTemplate, TyreCorner } from "@/lib/types";

type Screen = "home" | "events" | "event" | "session" | "run" | "compare" | "settings";
type DeleteTarget = { kind: "event" | "session" | "run" | "template"; id: string; name: string };
type EventFormData = Omit<EventRecord, "id" | "sessions" | "createdAt" | "updatedAt">;
type SessionFormData = Pick<SessionRecord, "name" | "type" | "startTime" | "notes">;
type HistoricalRun = { run: RunRecord; eventName: string; sessionName: string };
type WeatherState = "idle" | "loading" | "success" | "error";

const sessionTypes: SessionRecord["type"][] = ["Practice", "Qualifying", "Heat", "Pre-final", "Final", "Other"];
const eventTypes: EventRecord["type"][] = ["Practice", "Test", "Race", "Other"];
const conditions: EventRecord["condition"][] = ["Dry", "Damp", "Wet", "Mixed"];
const tyreCorners: Array<{ key: TyreCorner; label: string; code: string }> = [
  { key: "fl", label: "Front left", code: "FL" },
  { key: "fr", label: "Front right", code: "FR" },
  { key: "rl", label: "Rear left", code: "RL" },
  { key: "rr", label: "Rear right", code: "RR" },
];

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(`${value}T12:00:00`),
  );
}

function bestLap(session: SessionRecord) {
  const laps = session.runs.map((run) => Number(run.fastestLap)).filter((lap) => Number.isFinite(lap) && lap > 0);
  return laps.length ? Math.min(...laps).toFixed(3) : "—";
}

function totalLaps(session: SessionRecord) {
  return session.runs.reduce((total, run) => total + (Number(run.laps) || 0), 0);
}

function getCurrentPosition() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      maximumAge: 5 * 60 * 1000,
      timeout: 12 * 1000,
    });
  });
}

function locationErrorMessage(error: unknown) {
  if (error instanceof GeolocationPositionError) {
    if (error.code === error.PERMISSION_DENIED) return "Location access was denied. Allow location access in your browser settings, or enter the temperature manually.";
    if (error.code === error.POSITION_UNAVAILABLE) return "Your current location is unavailable. Check your location settings or enter the temperature manually.";
    if (error.code === error.TIMEOUT) return "Location lookup timed out. Try again, or enter the temperature manually.";
  }
  return "Current temperature could not be loaded. Check your connection and try again.";
}

function IconButton({ label, children, onClick }: { label: string; children: ReactNode; onClick: () => void }) {
  return (
    <button className="icon-button" type="button" aria-label={label} onClick={onClick}>
      {children}
    </button>
  );
}

function TopBar({
  title,
  subtitle,
  onBack,
  action,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  action?: ReactNode;
}) {
  return (
    <header className="topbar">
      {onBack ? (
        <IconButton label="Back" onClick={onBack}>
          <ArrowLeft />
        </IconButton>
      ) : (
        <span className="brand-mark" aria-hidden="true">
          <Gauge />
        </span>
      )}
      <div className="topbar-copy">
        <strong>{title}</strong>
        {subtitle && <span>{subtitle}</span>}
      </div>
      {action && <div className="topbar-action">{action}</div>}
    </header>
  );
}

function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <section className="empty-state">
      <span className="empty-icon">{icon}</span>
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </section>
  );
}

export default function HomePage() {
  const [data, setData] = useState<AppData>(emptyAppData());
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState<"Saved" | "Saving…" | "Error">("Saved");
  const [screen, setScreen] = useState<Screen>("home");
  const [eventId, setEventId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [showRunHistoryForm, setShowRunHistoryForm] = useState(false);
  const [showSaveTemplateForm, setShowSaveTemplateForm] = useState(false);
  const [showApplyTemplateForm, setShowApplyTemplateForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [pendingImport, setPendingImport] = useState<AppData | null>(null);
  const [toast, setToast] = useState("");
  const [compareIds, setCompareIds] = useState<[string, string]>(["", ""]);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    loadData()
      .then((stored) => setData(stored))
      .catch(() => setSaveState("Error"))
      .finally(() => {
        hydrated.current = true;
        setReady(true);
      });
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    setSaveState("Saving…");
    const timer = window.setTimeout(() => {
      saveData(data)
        .then(() => setSaveState("Saved"))
        .catch(() => setSaveState("Error"));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [data]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsStandalone(window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
      setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!showEventForm && !showSessionForm && !showRunHistoryForm && !showSaveTemplateForm && !showApplyTemplateForm && !pendingImport) return;

    const root = document.documentElement;
    const viewport = window.visualViewport;
    const listenerOptions = { passive: true } as const;
    const updateViewport = () => {
      root.style.setProperty("--visual-viewport-height", `${viewport?.height ?? window.innerHeight}px`);
      root.style.setProperty("--visual-viewport-offset-top", `${viewport?.offsetTop ?? 0}px`);
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);
    viewport?.addEventListener("resize", updateViewport);
    viewport?.addEventListener("scroll", updateViewport, listenerOptions);

    return () => {
      window.removeEventListener("resize", updateViewport);
      viewport?.removeEventListener("resize", updateViewport);
      viewport?.removeEventListener("scroll", updateViewport);
      root.style.removeProperty("--visual-viewport-height");
      root.style.removeProperty("--visual-viewport-offset-top");
    };
  }, [pendingImport, showApplyTemplateForm, showEventForm, showRunHistoryForm, showSaveTemplateForm, showSessionForm]);

  const selectedEvent = useMemo(() => data.events.find((event) => event.id === eventId), [data.events, eventId]);
  const selectedSession = useMemo(
    () => selectedEvent?.sessions.find((session) => session.id === sessionId),
    [selectedEvent, sessionId],
  );
  const selectedRun = useMemo(
    () => selectedSession?.runs.find((run) => run.id === runId),
    [selectedSession, runId],
  );
  const activeEvent = data.events.find((event) => event.id === data.lastEventId) ?? data.events[0];
  const historicalRuns = useMemo<HistoricalRun[]>(() => data.events.flatMap((event) =>
    event.sessions.flatMap((session) => session.runs.map((run) => ({ run, eventName: event.name, sessionName: session.name }))),
  ), [data.events]);

  function flash(message: string) {
    setToast(message);
  }

  function openEvent(id: string) {
    setEventId(id);
    setSessionId(null);
    setRunId(null);
    setData((current) => ({ ...current, lastEventId: id }));
    setScreen("event");
  }

  function openSession(id: string) {
    setSessionId(id);
    setRunId(null);
    setScreen("session");
  }

  function openRun(id: string) {
    setRunId(id);
    setScreen("run");
  }

  function updateEvent(id: string, updater: (event: EventRecord) => EventRecord) {
    setData((current) => ({
      ...current,
      events: current.events.map((event) => (event.id === id ? updater(event) : event)),
    }));
  }

  function updateSession(id: string, updater: (session: SessionRecord) => SessionRecord) {
    if (!selectedEvent) return;
    updateEvent(selectedEvent.id, (event) => ({
      ...event,
      updatedAt: new Date().toISOString(),
      sessions: event.sessions.map((session) => (session.id === id ? updater(session) : session)),
    }));
  }

  function updateRun(id: string, updater: (run: RunRecord) => RunRecord) {
    if (!selectedSession) return;
    updateSession(selectedSession.id, (session) => ({
      ...session,
      runs: session.runs.map((run) =>
        run.id === id ? { ...updater(run), updatedAt: new Date().toISOString() } : run,
      ),
    }));
  }

  function createEvent(input: Omit<EventRecord, "id" | "sessions" | "createdAt" | "updatedAt">) {
    const now = new Date().toISOString();
    const event: EventRecord = {
      ...input,
      id: crypto.randomUUID(),
      sessions: [],
      createdAt: now,
      updatedAt: now,
    };
    setData((current) => ({ ...current, events: [event, ...current.events], lastEventId: event.id }));
    setShowEventForm(false);
    openEvent(event.id);
  }

  function openNewEventForm() {
    setEditingEventId(null);
    setShowEventForm(true);
  }

  function openEditEventForm(id: string) {
    setEditingEventId(id);
    setShowEventForm(true);
  }

  function closeEventForm() {
    setShowEventForm(false);
    setEditingEventId(null);
  }

  function saveEvent(input: EventFormData) {
    if (!editingEventId) {
      createEvent(input);
      return;
    }

    updateEvent(editingEventId, (event) => ({
      ...event,
      ...input,
      updatedAt: new Date().toISOString(),
    }));
    closeEventForm();
    flash("Event updated");
  }

  function createSession(input: SessionFormData) {
    if (!selectedEvent) return;
    const session: SessionRecord = {
      ...input,
      id: crypto.randomUUID(),
      runs: [],
      createdAt: new Date().toISOString(),
    };
    updateEvent(selectedEvent.id, (event) => ({
      ...event,
      updatedAt: new Date().toISOString(),
      sessions: [...event.sessions, session],
    }));
    setShowSessionForm(false);
    setSessionId(session.id);
    setScreen("session");
  }

  function openNewSessionForm() {
    setEditingSessionId(null);
    setShowSessionForm(true);
  }

  function openEditSessionForm(id: string) {
    setEditingSessionId(id);
    setShowSessionForm(true);
  }

  function closeSessionForm() {
    setShowSessionForm(false);
    setEditingSessionId(null);
  }

  function saveSession(input: SessionFormData) {
    if (!editingSessionId) {
      createSession(input);
      return;
    }

    updateSession(editingSessionId, (session) => ({ ...session, ...input }));
    closeSessionForm();
    flash("Session updated");
  }

  function addRun(source?: RunRecord) {
    if (!selectedSession) return;
    const run = createRun(selectedSession.runs.length + 1, source);
    updateSession(selectedSession.id, (session) => ({ ...session, runs: [...session.runs, run] }));
    setRunId(run.id);
    setScreen("run");
    setShowRunHistoryForm(false);
    if (source) flash(`Tyres and setup copied from Run ${String(source.number).padStart(2, "0")}`);
  }

  function saveSetupTemplate(name: string) {
    if (!selectedRun) return;
    const now = new Date().toISOString();
    const template: SetupTemplate = {
      id: crypto.randomUUID(),
      name,
      setup: structuredClone(selectedRun.setup),
      createdAt: now,
      updatedAt: now,
    };
    setData((current) => ({ ...current, setupTemplates: [...current.setupTemplates, template] }));
    setShowSaveTemplateForm(false);
    flash(`${name} saved as a setup template`);
  }

  function applySetupTemplate(id: string) {
    if (!selectedRun) return;
    const template = data.setupTemplates.find((candidate) => candidate.id === id);
    if (!template) return;
    updateRun(selectedRun.id, (run) => ({ ...run, setup: structuredClone(template.setup) }));
    setShowApplyTemplateForm(false);
    flash(`${template.name} applied`);
  }

  function requestDelete(target: DeleteTarget) {
    setDeleteTarget(target);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.kind === "event") {
      setData((current) => {
        const events = current.events.filter((event) => event.id !== deleteTarget.id);
        return {
          ...current,
          events,
          lastEventId: current.lastEventId === deleteTarget.id ? events[0]?.id ?? null : current.lastEventId,
        };
      });
      setScreen("events");
      setEventId(null);
    } else if (deleteTarget.kind === "session" && selectedEvent) {
      updateEvent(selectedEvent.id, (event) => ({
        ...event,
        sessions: event.sessions.filter((session) => session.id !== deleteTarget.id),
        updatedAt: new Date().toISOString(),
      }));
      setScreen("event");
      setSessionId(null);
    } else if (deleteTarget.kind === "run" && selectedSession) {
      updateSession(selectedSession.id, (session) => ({
        ...session,
        runs: session.runs.filter((run) => run.id !== deleteTarget.id),
      }));
      setScreen("session");
      setRunId(null);
    } else if (deleteTarget.kind === "template") {
      setData((current) => ({
        ...current,
        setupTemplates: current.setupTemplates.filter((template) => template.id !== deleteTarget.id),
      }));
    }
    flash(`${deleteTarget.name} deleted`);
    setDeleteTarget(null);
  }

  function startCompare() {
    if (!selectedSession || selectedSession.runs.length < 2) return;
    const lastTwo = selectedSession.runs.slice(-2);
    setCompareIds([lastTwo[0].id, lastTwo[1].id]);
    setScreen("compare");
  }

  function exportJson() {
    downloadFile(
      `kart-data-backup-${todayDate()}.json`,
      JSON.stringify(data, null, 2),
      "application/json",
    );
    flash("Backup exported");
  }

  function exportCsv() {
    downloadFile(`kart-data-${todayDate()}.csv`, buildCsv(data), "text/csv;charset=utf-8");
    flash("Excel-ready CSV exported");
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!validateImport(parsed)) throw new Error("Invalid backup");
      const normalized = normalizeAppData(parsed);
      if (!normalized) throw new Error("Invalid backup");
      setPendingImport(normalized);
    } catch {
      flash("That file is not a valid Kart Data backup");
    }
  }

  function confirmImport() {
    if (!pendingImport) return;
    setData(pendingImport);
    setPendingImport(null);
    setEventId(null);
    setSessionId(null);
    setRunId(null);
    setScreen("home");
    flash("Backup restored");
  }

  if (!ready) {
    return (
      <main className="loading-screen">
        <span className="brand-mark"><Gauge /></span>
        <p>Loading Kart Data…</p>
      </main>
    );
  }

  let content: ReactNode;

  if (screen === "home") {
    content = (
      <>
        <TopBar
          title="Kart Data"
          subtitle="Trackside recorder"
          action={
            <IconButton label="Data and settings" onClick={() => setScreen("settings")}>
              <Settings />
            </IconButton>
          }
        />
        <div className="page-content">
          <p className="eyebrow">{new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</p>
          <h1>{activeEvent ? "Ready for the next run?" : "Start your first event"}</h1>
          <p className="lead">{activeEvent ? "Resume the active event or start a new one." : "Create an event, add a session, then record each run."}</p>

          {activeEvent ? (
            <article className="summary-card">
              <div className="card-head"><span className="badge">Active event</span><span className="muted">{formatDate(activeEvent.startDate)}</span></div>
              <h2>{activeEvent.name}</h2>
              <p className="muted">{activeEvent.track || "Track not set"} · {activeEvent.condition}</p>
              <div className="stat-grid">
                <Stat label="Sessions" value={String(activeEvent.sessions.length)} />
                <Stat label="Runs" value={String(activeEvent.sessions.reduce((count, session) => count + session.runs.length, 0))} />
                <Stat label="Track" value={activeEvent.trackTemperature ? `${activeEvent.trackTemperature} °C` : "—"} />
              </div>
              <button className="button button-primary button-block" type="button" onClick={() => openEvent(activeEvent.id)}>
                Resume recording <ChevronRight />
              </button>
            </article>
          ) : (
            <EmptyState
              icon={<Flag />}
              title="No events yet"
              text="Your records stay on this device and work without an account."
              action={<button className="button button-primary" onClick={openNewEventForm}><Plus /> New event</button>}
            />
          )}

          {activeEvent && <button className="button button-secondary button-block standalone-action" onClick={openNewEventForm}><Plus /> New event</button>}

          {data.events.length > 0 && (
            <section className="list-section">
              <div className="section-heading"><h2>Recent events</h2><button className="text-button" onClick={() => setScreen("events")}>View all</button></div>
              <div className="item-list">
                {data.events.slice(0, 3).map((event) => (
                  <button className="list-item" key={event.id} onClick={() => openEvent(event.id)}>
                    <span className="list-icon"><Flag /></span>
                    <span className="list-copy"><strong>{event.name}</strong><span>{formatDate(event.startDate)} · {event.sessions.length} sessions</span></span>
                    <ChevronRight />
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </>
    );
  } else if (screen === "events") {
    content = (
      <>
        <TopBar title="All events" subtitle={`${data.events.length} ${data.events.length === 1 ? "event" : "events"}`} onBack={() => setScreen("home")} />
        <div className="page-content">
          <div className="section-heading"><h1>Events</h1><button className="button button-primary button-small" onClick={openNewEventForm}><Plus /> New</button></div>
          {data.events.length ? (
            <div className="item-list">
              {data.events.map((event) => (
                <button className="list-item" key={event.id} onClick={() => openEvent(event.id)}>
                  <span className="list-icon"><Flag /></span>
                  <span className="list-copy"><strong>{event.name}</strong><span>{event.track || "Track not set"} · {formatDate(event.startDate)}</span></span>
                  <ChevronRight />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState icon={<History />} title="No events" text="Create an event to begin recording." />
          )}
        </div>
      </>
    );
  } else if (screen === "event" && selectedEvent) {
    content = (
      <>
        <TopBar
          title={selectedEvent.name}
          subtitle={formatDate(selectedEvent.startDate)}
          onBack={() => setScreen("home")}
          action={
            <>
              <IconButton label="Edit event" onClick={() => openEditEventForm(selectedEvent.id)}><Pencil /></IconButton>
              <IconButton label="Delete event" onClick={() => requestDelete({ kind: "event", id: selectedEvent.id, name: selectedEvent.name })}><Trash2 /></IconButton>
            </>
          }
        />
        <div className="page-content">
          <article className="summary-card">
            <div className="card-head"><div><p className="eyebrow">EVENT CONDITIONS</p><h1>{selectedEvent.weather || selectedEvent.condition}</h1></div><span className="badge">{selectedEvent.type}</span></div>
            <p className="muted">{selectedEvent.track || "Track not set"}</p>
            <div className="stat-grid">
              <Stat label="Ambient" value={selectedEvent.ambientTemperature ? `${selectedEvent.ambientTemperature} °C` : "—"} />
              <Stat label="Track" value={selectedEvent.trackTemperature ? `${selectedEvent.trackTemperature} °C` : "—"} />
              <Stat label="Surface" value={selectedEvent.condition} />
            </div>
          </article>
          <section className="list-section">
            <div className="section-heading"><h2>Sessions</h2><span className="muted">{selectedEvent.sessions.length}</span></div>
            {selectedEvent.sessions.length ? (
              <div className="item-list">
                {selectedEvent.sessions.map((session) => (
                  <button className="list-item" key={session.id} onClick={() => openSession(session.id)}>
                    <span className="list-icon">{session.type === "Final" ? <Trophy /> : <Timer />}</span>
                    <span className="list-copy"><strong>{session.name}</strong><span>{session.runs.length} runs · Best {bestLap(session)}</span></span>
                    <ChevronRight />
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState icon={<Timer />} title="No sessions yet" text="Add the first practice, qualifying, heat or final session." />
            )}
            <button className="button button-primary button-block standalone-action" onClick={openNewSessionForm}><Plus /> Add session</button>
          </section>
        </div>
      </>
    );
  } else if (screen === "session" && selectedEvent && selectedSession) {
    content = (
      <>
        <TopBar
          title={selectedSession.name}
          subtitle={selectedEvent.name}
          onBack={() => setScreen("event")}
          action={
            <>
              <IconButton label="Edit session" onClick={() => openEditSessionForm(selectedSession.id)}><Pencil /></IconButton>
              <IconButton label="Delete session" onClick={() => requestDelete({ kind: "session", id: selectedSession.id, name: selectedSession.name })}><Trash2 /></IconButton>
            </>
          }
        />
        <div className="page-content">
          <article className="summary-card">
            <div className="card-head"><div><p className="eyebrow">SESSION SUMMARY</p><h1>{selectedSession.runs.length} recorded runs</h1></div><span className="badge">{selectedSession.type}</span></div>
            <div className="stat-grid">
              <Stat label="Best" value={bestLap(selectedSession)} />
              <Stat label="Laps" value={String(totalLaps(selectedSession))} />
              <Stat label="Start" value={selectedSession.startTime || "—"} />
            </div>
          </article>
          <div className="action-stack">
            <button className="button button-primary button-block" onClick={() => addRun()}><Plus /> Add blank Run {String(selectedSession.runs.length + 1).padStart(2, "0")}</button>
            {selectedSession.runs.length > 0 && <button className="button button-soft button-block" onClick={() => addRun(selectedSession.runs.at(-1))}><Copy /> Duplicate last run</button>}
            {historicalRuns.length > 0 && <button className="button button-secondary button-block" onClick={() => setShowRunHistoryForm(true)}><History /> Copy a historical run</button>}
            {selectedSession.runs.length > 1 && <button className="button button-secondary button-block" onClick={startCompare}><CircleGauge /> Compare runs</button>}
          </div>
          <section className="list-section">
            <div className="section-heading"><h2>Runs</h2><span className="muted">Newest first</span></div>
            {selectedSession.runs.length ? (
              <div className="item-list">
                {[...selectedSession.runs].reverse().map((run) => (
                  <button className="list-item" key={run.id} onClick={() => openRun(run.id)}>
                    <span className="list-icon"><Route /></span>
                    <span className="list-copy"><strong>Run {String(run.number).padStart(2, "0")}{run.label ? ` · ${run.label}` : ""}</strong><span>{run.laps || 0} laps · {run.balance || "No feedback"}</span></span>
                    <span className="run-result"><strong>{run.fastestLap || "—"}</strong><span>best lap</span></span>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState icon={<Route />} title="No runs yet" text="Add a run before going on track, then enter hot readings afterwards." />
            )}
          </section>
        </div>
      </>
    );
  } else if (screen === "run" && selectedSession && selectedRun) {
    content = (
      <RunEditor
        run={selectedRun}
        session={selectedSession}
        saveState={saveState}
        onBack={() => setScreen("session")}
        onUpdate={(updater) => updateRun(selectedRun.id, updater)}
        onDelete={() => requestDelete({ kind: "run", id: selectedRun.id, name: `Run ${String(selectedRun.number).padStart(2, "0")}` })}
        onComplete={() => {
          updateRun(selectedRun.id, (run) => ({ ...run, completed: true }));
          setScreen("session");
          flash(`Run ${String(selectedRun.number).padStart(2, "0")} completed`);
        }}
        templates={data.setupTemplates}
        onSaveTemplate={() => setShowSaveTemplateForm(true)}
        onApplyTemplate={() => setShowApplyTemplateForm(true)}
      />
    );
  } else if (screen === "compare" && selectedSession) {
    content = <CompareRuns session={selectedSession} ids={compareIds} setIds={setCompareIds} onBack={() => setScreen("session")} />;
  } else if (screen === "settings") {
    content = (
      <>
        <TopBar title="Data & settings" subtitle="Stored on this device" onBack={() => setScreen("home")} />
        <div className="page-content">
          <section className="settings-section">
            <div className="settings-heading"><span className="list-icon"><Database /></span><div><h1>Backup your data</h1><p>Without an account, this device is the only copy until you export a backup.</p></div></div>
            <div className="action-stack">
              <button className="button button-primary button-block" onClick={exportJson}><Download /> Export full backup</button>
              <button className="button button-secondary button-block" onClick={exportCsv}><Download /> Export Excel-ready CSV</button>
              <button className="button button-secondary button-block" onClick={() => importRef.current?.click()}><Upload /> Restore JSON backup</button>
              <input className="visually-hidden" ref={importRef} type="file" accept="application/json,.json" onChange={importBackup} />
            </div>
          </section>
          <section className="settings-section">
            <div className="settings-heading"><span className="list-icon"><Wrench /></span><div><h1>Setup templates</h1><p>Save a chassis setup from any Run, then apply it to a future Run in one tap.</p></div></div>
            {data.setupTemplates.length ? (
              <div className="template-list">
                {data.setupTemplates.map((template) => (
                  <div className="template-item" key={template.id}>
                    <span className="list-copy"><strong>{template.name}</strong><span>{template.setup.axleType || "Axle not set"} · {template.setup.rearSprocket ? `${template.setup.rearSprocket}T rear` : "Sprocket not set"}</span></span>
                    <IconButton label={`Delete ${template.name}`} onClick={() => requestDelete({ kind: "template", id: template.id, name: template.name })}><Trash2 /></IconButton>
                  </div>
                ))}
              </div>
            ) : <p className="help-text">No templates yet. Open a Run, expand Chassis setup, then choose Save as template.</p>}
          </section>
          <section className="settings-section">
            <div className="settings-heading"><span className="list-icon"><Share2 /></span><div><h1>Install on iPhone</h1><p>{isStandalone ? "Kart Data is running from your Home Screen." : "Install it for a full-screen, app-like trackside experience."}</p></div></div>
            {isStandalone ? (
              <div className="install-status"><Check /> Installed</div>
            ) : (
              <ol className="install-steps">
                <li>Open this website in Chrome or Safari.</li>
                <li>Tap the Share button.</li>
                <li>Choose <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.</li>
              </ol>
            )}
            {!isIOS && !isStandalone && <p className="help-text">On another device, use the browser&apos;s Install or Add to Home Screen option.</p>}
          </section>
          <section className="settings-section">
            <h2>Current storage</h2>
            <div className="stat-grid">
              <Stat label="Events" value={String(data.events.length)} />
              <Stat label="Sessions" value={String(data.events.reduce((sum, event) => sum + event.sessions.length, 0))} />
              <Stat label="Runs" value={String(data.events.reduce((sum, event) => sum + event.sessions.reduce((count, session) => count + session.runs.length, 0), 0))} />
            </div>
            <p className="help-text">Clearing this browser&apos;s site data will remove these records. Export a backup regularly.</p>
          </section>
        </div>
      </>
    );
  } else {
    content = (
      <>
        <TopBar title="Kart Data" subtitle="Trackside recorder" onBack={() => setScreen("home")} />
        <div className="page-content"><EmptyState icon={<Flag />} title="Record not found" text="It may have been deleted. Return home to continue." /></div>
      </>
    );
  }

  return (
    <main className="app-shell">
      <div className="phone-shell">{content}</div>
      {showEventForm && (
        <EventModal
          event={editingEventId ? data.events.find((event) => event.id === editingEventId) : undefined}
          onClose={closeEventForm}
          onSave={saveEvent}
        />
      )}
      {showSessionForm && selectedEvent && (
        <SessionModal
          event={selectedEvent}
          session={editingSessionId ? selectedEvent.sessions.find((session) => session.id === editingSessionId) : undefined}
          onClose={closeSessionForm}
          onSave={saveSession}
        />
      )}
      {showRunHistoryForm && <RunHistoryModal runs={historicalRuns} onClose={() => setShowRunHistoryForm(false)} onCopy={addRun} />}
      {showSaveTemplateForm && selectedRun && <SaveTemplateModal run={selectedRun} onClose={() => setShowSaveTemplateForm(false)} onSave={saveSetupTemplate} />}
      {showApplyTemplateForm && <ApplyTemplateModal templates={data.setupTemplates} onClose={() => setShowApplyTemplateForm(false)} onApply={applySetupTemplate} />}
      {pendingImport && <ImportConfirmModal data={pendingImport} onCancel={() => setPendingImport(null)} onConfirm={confirmImport} />}
      {deleteTarget && <DeleteModal target={deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />}
      {toast && <div className="toast" role="status"><Check /> {toast}</div>}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="stat"><span>{label}</span><strong>{value}</strong></div>;
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`field ${className}`}><span>{label}</span>{children}</label>;
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />;
}

function NumberInput({ unit, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { unit?: string }) {
  return <span className="input-with-unit"><input className="input" inputMode="decimal" {...props} />{unit && <span>{unit}</span>}</span>;
}

function keepFocusedFieldVisible(event: ReactFocusEvent<HTMLFormElement>) {
  const field = event.target;
  if (!(field instanceof HTMLElement)) return;

  window.setTimeout(() => {
    field.scrollIntoView({ block: "center", inline: "nearest" });
  }, 350);
}

function EventModal({ event, onClose, onSave }: { event?: EventRecord; onClose: () => void; onSave: (event: EventFormData) => void }) {
  const isEditing = Boolean(event);
  const [weatherState, setWeatherState] = useState<WeatherState>("idle");
  const [weatherMessage, setWeatherMessage] = useState("Uses your device location. You can still enter a value manually.");
  const [form, setForm] = useState<EventFormData>(() => event ? {
    name: event.name,
    track: event.track,
    startDate: event.startDate,
    endDate: event.endDate,
    type: event.type,
    weather: event.weather,
    ambientTemperature: event.ambientTemperature,
    trackTemperature: event.trackTemperature,
    condition: event.condition,
    notes: event.notes,
  } : {
    name: "",
    track: "",
    startDate: todayDate(),
    endDate: "",
    type: "Practice",
    weather: "",
    ambientTemperature: "",
    trackTemperature: "",
    condition: "Dry",
    notes: "",
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) return;
    onSave({ ...form, name: form.name.trim(), track: form.track.trim() });
  }

  async function loadAmbientTemperature() {
    if (!("geolocation" in navigator)) {
      setWeatherState("error");
      setWeatherMessage("This browser does not support location access. Enter the temperature manually.");
      return;
    }

    setWeatherState("loading");
    setWeatherMessage("Finding your current location…");

    try {
      const position = await getCurrentPosition();
      setWeatherMessage("Reading the current local temperature…");

      const query = new URLSearchParams({
        latitude: position.coords.latitude.toString(),
        longitude: position.coords.longitude.toString(),
        current: "temperature_2m",
        temperature_unit: "celsius",
      });
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query.toString()}`);
      if (!response.ok) throw new Error(`Weather request failed with ${response.status}`);

      const result: unknown = await response.json();
      const temperature = typeof result === "object" && result !== null && "current" in result
        && typeof result.current === "object" && result.current !== null && "temperature_2m" in result.current
        ? result.current.temperature_2m
        : undefined;
      if (typeof temperature !== "number" || !Number.isFinite(temperature)) throw new Error("Weather response did not include a temperature");

      setForm((current) => ({ ...current, ambientTemperature: temperature.toFixed(1) }));
      setWeatherState("success");
      setWeatherMessage(`Updated from your current location at ${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date())}.`);
    } catch (error) {
      setWeatherState("error");
      setWeatherMessage(locationErrorMessage(error));
    }
  }

  return (
    <div className="modal-backdrop">
      <form className="modal-sheet" onFocusCapture={keepFocusedFieldVisible} onSubmit={submit}>
        <div className="modal-head"><div><p className="eyebrow">{isEditing ? "EDIT EVENT" : "NEW EVENT"}</p><h2>{isEditing ? "Edit event" : "Create event"}</h2></div><IconButton label="Close" onClick={onClose}><X /></IconButton></div>
        <div className="form-grid">
          <Field label="Event name" className="field-full"><TextInput required autoFocus placeholder="e.g. Whilton Mill Practice" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
          <Field label="Track" className="field-full"><TextInput placeholder="Circuit name" value={form.track} onChange={(event) => setForm({ ...form, track: event.target.value })} /></Field>
          <Field label="Start date"><TextInput type="date" required value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></Field>
          <Field label="End date"><TextInput type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></Field>
          <Field label="Event type"><select className="select" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as EventRecord["type"] })}>{eventTypes.map((type) => <option key={type}>{type}</option>)}</select></Field>
          <Field label="Track condition"><select className="select" value={form.condition} onChange={(event) => setForm({ ...form, condition: event.target.value as EventRecord["condition"] })}>{conditions.map((condition) => <option key={condition}>{condition}</option>)}</select></Field>
          <Field label="Weather" className="field-full"><TextInput placeholder="e.g. Clear, light wind" value={form.weather} onChange={(event) => setForm({ ...form, weather: event.target.value })} /></Field>
          <Field label="Ambient temperature"><NumberInput unit="°C" value={form.ambientTemperature} onChange={(event) => setForm({ ...form, ambientTemperature: event.target.value })} /></Field>
          <Field label="Track temperature"><NumberInput unit="°C" value={form.trackTemperature} onChange={(event) => setForm({ ...form, trackTemperature: event.target.value })} /></Field>
          <div className="weather-fetch field-full">
            <button className="button button-soft button-small" type="button" disabled={weatherState === "loading"} onClick={loadAmbientTemperature}>
              {weatherState === "loading" ? <span className="spinner"><LoaderCircle /></span> : <LocateFixed />}
              {weatherState === "loading" ? "Getting temperature…" : "Get current temperature"}
            </button>
            <p className={`weather-message ${weatherState === "error" ? "weather-error" : ""}`} aria-live="polite">
              {weatherMessage} Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>.
            </p>
          </div>
          <Field label="Notes" className="field-full"><textarea className="textarea" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
        </div>
        <button className="button button-primary button-block" type="submit">{isEditing ? <Check /> : <Plus />} {isEditing ? "Save changes" : "Create event"}</button>
      </form>
    </div>
  );
}

function SessionModal({ event, session, onClose, onSave }: { event: EventRecord; session?: SessionRecord; onClose: () => void; onSave: (session: SessionFormData) => void }) {
  const isEditing = Boolean(session);
  const nextPractice = event.sessions.filter((session) => session.type === "Practice").length + 1;
  const [form, setForm] = useState<SessionFormData>(() => session ? {
    name: session.name,
    type: session.type,
    startTime: session.startTime,
    notes: session.notes,
  } : { name: `Practice ${nextPractice}`, type: "Practice", startTime: "", notes: "" });
  function submit(submitEvent: FormEvent) {
    submitEvent.preventDefault();
    if (!form.name.trim()) return;
    onSave({ ...form, name: form.name.trim() });
  }
  return (
    <div className="modal-backdrop">
      <form className="modal-sheet modal-compact" onFocusCapture={keepFocusedFieldVisible} onSubmit={submit}>
        <div className="modal-head"><div><p className="eyebrow">{event.name}</p><h2>{isEditing ? "Edit session" : "Add session"}</h2></div><IconButton label="Close" onClick={onClose}><X /></IconButton></div>
        <div className="form-grid">
          <Field label="Session name" className="field-full"><TextInput required autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
          <Field label="Type"><select className="select" value={form.type} onChange={(event) => { const type = event.target.value as SessionRecord["type"]; setForm({ ...form, type, name: isEditing ? form.name : type === "Practice" ? `Practice ${nextPractice}` : type }); }}>{sessionTypes.map((type) => <option key={type}>{type}</option>)}</select></Field>
          <Field label="Start time"><TextInput type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} /></Field>
          <Field label="Notes" className="field-full"><textarea className="textarea" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
        </div>
        <button className="button button-primary button-block" type="submit">{isEditing ? <Check /> : <Plus />} {isEditing ? "Save changes" : "Add session"}</button>
      </form>
    </div>
  );
}

function RunHistoryModal({ runs, onClose, onCopy }: { runs: HistoricalRun[]; onClose: () => void; onCopy: (run: RunRecord) => void }) {
  const [runId, setRunId] = useState(runs.at(-1)?.run.id ?? "");
  const selected = runs.find((item) => item.run.id === runId);
  return (
    <div className="modal-backdrop">
      <section className="modal-sheet modal-compact" role="dialog" aria-modal="true" aria-labelledby="copy-run-title">
        <div className="modal-head"><div><p className="eyebrow">NEW RUN</p><h2 id="copy-run-title">Copy a historical run</h2></div><IconButton label="Close" onClick={onClose}><X /></IconButton></div>
        <p className="help-text">Tyre readings and chassis setup will be copied. Lap times and driver feedback start blank.</p>
        <Field label="Source run" className="field-full">
          <select className="select" value={runId} onChange={(event) => setRunId(event.target.value)}>
            {runs.map(({ run, eventName, sessionName }) => <option key={run.id} value={run.id}>{eventName} · {sessionName} · Run {String(run.number).padStart(2, "0")}{run.label ? ` · ${run.label}` : ""}</option>)}
          </select>
        </Field>
        <button className="button button-primary button-block" disabled={!selected} onClick={() => selected && onCopy(selected.run)}><Copy /> Copy into new run</button>
      </section>
    </div>
  );
}

function SaveTemplateModal({ run, onClose, onSave }: { run: RunRecord; onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState(run.label ? `${run.label} setup` : `Run ${String(run.number).padStart(2, "0")} setup`);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim()) onSave(name.trim());
  }
  return (
    <div className="modal-backdrop">
      <form className="modal-sheet modal-compact" onSubmit={submit}>
        <div className="modal-head"><div><p className="eyebrow">CHASSIS SETUP</p><h2>Save setup template</h2></div><IconButton label="Close" onClick={onClose}><X /></IconButton></div>
        <Field label="Template name"><TextInput required autoFocus value={name} onChange={(event) => setName(event.target.value)} /></Field>
        <button className="button button-primary button-block" type="submit"><Save /> Save template</button>
      </form>
    </div>
  );
}

function ApplyTemplateModal({ templates, onClose, onApply }: { templates: SetupTemplate[]; onClose: () => void; onApply: (id: string) => void }) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  return (
    <div className="modal-backdrop">
      <section className="modal-sheet modal-compact" role="dialog" aria-modal="true" aria-labelledby="apply-template-title">
        <div className="modal-head"><div><p className="eyebrow">CHASSIS SETUP</p><h2 id="apply-template-title">Apply setup template</h2></div><IconButton label="Close" onClick={onClose}><X /></IconButton></div>
        <p className="help-text">This replaces every chassis setup field in the current Run. Tyres, performance and feedback are unchanged.</p>
        <Field label="Template"><select className="select" value={templateId} onChange={(event) => setTemplateId(event.target.value)}>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></Field>
        <button className="button button-primary button-block" disabled={!templateId} onClick={() => onApply(templateId)}><Wrench /> Apply template</button>
      </section>
    </div>
  );
}

function ImportConfirmModal({ data, onCancel, onConfirm }: { data: AppData; onCancel: () => void; onConfirm: () => void }) {
  const sessionCount = data.events.reduce((sum, event) => sum + event.sessions.length, 0);
  const runCount = data.events.reduce((sum, event) => sum + event.sessions.reduce((count, session) => count + session.runs.length, 0), 0);
  return (
    <div className="modal-backdrop modal-centered">
      <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="restore-title">
        <span className="danger-icon"><Upload /></span>
        <h2 id="restore-title">Replace current data?</h2>
        <p>This backup contains {data.events.length} events, {sessionCount} sessions and {runCount} runs. Restoring it replaces all data currently stored on this device.</p>
        <div className="action-stack">
          <button className="button button-primary button-block" onClick={onConfirm}>Restore backup</button>
          <button className="button button-secondary button-block" onClick={onCancel}>Cancel</button>
        </div>
      </section>
    </div>
  );
}

function DeleteModal({ target, onCancel, onConfirm }: { target: DeleteTarget; onCancel: () => void; onConfirm: () => void }) {
  const nested = target.kind === "event" ? "This also deletes every session and run inside it." : target.kind === "session" ? "This also deletes every run inside it." : "";
  return (
    <div className="modal-backdrop modal-centered">
      <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title">
        <span className="danger-icon"><Trash2 /></span>
        <h2 id="delete-title">Delete {target.name}?</h2>
        <p>{nested} This action cannot be undone.</p>
        <div className="action-stack">
          <button className="button button-danger button-block" onClick={onConfirm}>Delete permanently</button>
          <button className="button button-secondary button-block" onClick={onCancel}>Cancel</button>
        </div>
      </section>
    </div>
  );
}

function RunEditor({ run, session, saveState, templates, onBack, onUpdate, onDelete, onComplete, onSaveTemplate, onApplyTemplate }: { run: RunRecord; session: SessionRecord; saveState: string; templates: SetupTemplate[]; onBack: () => void; onUpdate: (updater: (run: RunRecord) => RunRecord) => void; onDelete: () => void; onComplete: () => void; onSaveTemplate: () => void; onApplyTemplate: () => void }) {
  function setTyre(corner: TyreCorner, field: keyof RunRecord["tyres"][TyreCorner], value: string) {
    onUpdate((current) => ({ ...current, tyres: { ...current.tyres, [corner]: { ...current.tyres[corner], [field]: value } } }));
  }
  function setSetup(field: keyof RunRecord["setup"], value: string) {
    onUpdate((current) => ({ ...current, setup: { ...current.setup, [field]: value } }));
  }
  function setField<K extends keyof RunRecord>(field: K, value: RunRecord[K]) {
    onUpdate((current) => ({ ...current, [field]: value }));
  }
  return (
    <>
      <TopBar
        title={`Run ${String(run.number).padStart(2, "0")}`}
        subtitle={session.name}
        onBack={onBack}
        action={<span className={`save-status ${saveState === "Error" ? "save-error" : ""}`}><span />{saveState}</span>}
      />
      <div className="page-content run-page">
        <div className="run-heading"><div><p className="eyebrow">{run.completed ? "COMPLETED RUN" : "CURRENT RUN"}</p><h1>{run.label || "Trackside entry"}</h1></div><IconButton label="Delete run" onClick={onDelete}><Trash2 /></IconButton></div>
        <div className="editor-stack">
          <details className="editor-section" open>
            <summary><span><CircleGauge /> Tyres <small>Cold / hot</small></span><ChevronRight /></summary>
            <div className="editor-body tyre-grid">
              {tyreCorners.map(({ key, label, code }, index) => (
                <div className={`tyre-card ${index === 2 ? "rear-start" : ""}`} key={key}>
                  <div className="tyre-head"><strong>{label}</strong><span>{code}</span></div>
                  <div className="mini-grid">
                    <Field label="Cold pressure"><NumberInput unit="PSI" aria-label={`${label} cold pressure`} value={run.tyres[key].coldPressure} onChange={(event) => setTyre(key, "coldPressure", event.target.value)} /></Field>
                    <Field label="Hot pressure"><NumberInput unit="PSI" aria-label={`${label} hot pressure`} value={run.tyres[key].hotPressure} onChange={(event) => setTyre(key, "hotPressure", event.target.value)} /></Field>
                    <Field label="Cold temp"><NumberInput unit="°C" aria-label={`${label} cold temperature`} value={run.tyres[key].coldTemperature} onChange={(event) => setTyre(key, "coldTemperature", event.target.value)} /></Field>
                    <Field label="Hot temp"><NumberInput unit="°C" aria-label={`${label} hot temperature`} value={run.tyres[key].hotTemperature} onChange={(event) => setTyre(key, "hotTemperature", event.target.value)} /></Field>
                  </div>
                </div>
              ))}
            </div>
          </details>

          <details className="editor-section">
            <summary><span><Wrench /> Chassis setup</span><ChevronRight /></summary>
            <div className="editor-body form-grid">
              <div className="template-actions field-full">
                <button className="button button-soft button-small" type="button" onClick={onSaveTemplate}><Save /> Save as template</button>
                <button className="button button-secondary button-small" type="button" disabled={!templates.length} onClick={onApplyTemplate}><Wrench /> Apply template</button>
              </div>
              <Field label="Front track / spacers"><TextInput value={run.setup.frontTrack} onChange={(event) => setSetup("frontTrack", event.target.value)} /></Field>
              <Field label="Rear track width"><NumberInput unit="mm" value={run.setup.rearTrack} onChange={(event) => setSetup("rearTrack", event.target.value)} /></Field>
              <Field label="Front ride height"><TextInput value={run.setup.frontRideHeight} onChange={(event) => setSetup("frontRideHeight", event.target.value)} /></Field>
              <Field label="Rear ride height"><TextInput value={run.setup.rearRideHeight} onChange={(event) => setSetup("rearRideHeight", event.target.value)} /></Field>
              <Field label="Front toe"><TextInput value={run.setup.frontToe} onChange={(event) => setSetup("frontToe", event.target.value)} /></Field>
              <Field label="Front camber"><TextInput value={run.setup.frontCamber} onChange={(event) => setSetup("frontCamber", event.target.value)} /></Field>
              <Field label="Caster"><TextInput value={run.setup.caster} onChange={(event) => setSetup("caster", event.target.value)} /></Field>
              <Field label="Axle type"><TextInput value={run.setup.axleType} onChange={(event) => setSetup("axleType", event.target.value)} /></Field>
              <Field label="Rear hub"><TextInput value={run.setup.rearHub} onChange={(event) => setSetup("rearHub", event.target.value)} /></Field>
              <Field label="Front torsion bar"><TextInput value={run.setup.frontTorsionBar} onChange={(event) => setSetup("frontTorsionBar", event.target.value)} /></Field>
              <Field label="Seat stays"><TextInput value={run.setup.seatStays} onChange={(event) => setSetup("seatStays", event.target.value)} /></Field>
              <Field label="Wheel / rim type"><TextInput value={run.setup.wheelType} onChange={(event) => setSetup("wheelType", event.target.value)} /></Field>
              <Field label="Front sprocket"><TextInput inputMode="numeric" value={run.setup.frontSprocket} onChange={(event) => setSetup("frontSprocket", event.target.value)} /></Field>
              <Field label="Rear sprocket"><TextInput inputMode="numeric" value={run.setup.rearSprocket} onChange={(event) => setSetup("rearSprocket", event.target.value)} /></Field>
              <Field label="Setup notes" className="field-full"><textarea className="textarea" value={run.setup.notes} onChange={(event) => setSetup("notes", event.target.value)} /></Field>
            </div>
          </details>

          <details className="editor-section">
            <summary><span><Timer /> Performance</span><ChevronRight /></summary>
            <div className="editor-body form-grid">
              <Field label="Run label"><TextInput placeholder="Optional" value={run.label} onChange={(event) => setField("label", event.target.value)} /></Field>
              <Field label="Number of laps"><TextInput inputMode="numeric" value={run.laps} onChange={(event) => setField("laps", event.target.value)} /></Field>
              <Field label="Fastest lap"><NumberInput unit="s" value={run.fastestLap} onChange={(event) => setField("fastestLap", event.target.value)} /></Field>
              <Field label="Average lap"><NumberInput unit="s" value={run.averageLap} onChange={(event) => setField("averageLap", event.target.value)} /></Field>
              <Field label="Position"><TextInput inputMode="numeric" value={run.position} onChange={(event) => setField("position", event.target.value)} /></Field>
            </div>
          </details>

          <details className="editor-section">
            <summary><span><MessageSquareText /> Driver feedback</span><ChevronRight /></summary>
            <div className="editor-body form-grid">
              <Field label="Balance"><select className="select" value={run.balance} onChange={(event) => setField("balance", event.target.value as RunRecord["balance"])}><option value="">Not recorded</option><option>Understeer</option><option>Neutral</option><option>Oversteer</option></select></Field>
              <Field label="Grip"><select className="select" value={run.grip} onChange={(event) => setField("grip", event.target.value as RunRecord["grip"])}><option value="">Not recorded</option><option>Low</option><option>Medium</option><option>High</option></select></Field>
              <Field label="Braking"><select className="select" value={run.braking} onChange={(event) => setField("braking", event.target.value as RunRecord["braking"])}><option value="">Not recorded</option><option>Poor</option><option>Acceptable</option><option>Good</option></select></Field>
              <Field label="Corner entry" className="field-full"><textarea className="textarea" value={run.cornerEntry} onChange={(event) => setField("cornerEntry", event.target.value)} /></Field>
              <Field label="Mid-corner" className="field-full"><textarea className="textarea" value={run.midCorner} onChange={(event) => setField("midCorner", event.target.value)} /></Field>
              <Field label="Corner exit / traction" className="field-full"><textarea className="textarea" value={run.cornerExit} onChange={(event) => setField("cornerExit", event.target.value)} /></Field>
              <Field label="General comments" className="field-full"><textarea className="textarea" value={run.comments} onChange={(event) => setField("comments", event.target.value)} /></Field>
            </div>
          </details>
        </div>
        <button className="button button-primary button-block complete-button" onClick={onComplete}><Check /> {run.completed ? "Done" : `Complete Run ${String(run.number).padStart(2, "0")}`}</button>
      </div>
    </>
  );
}

function CompareRuns({ session, ids, setIds, onBack }: { session: SessionRecord; ids: [string, string]; setIds: (ids: [string, string]) => void; onBack: () => void }) {
  const [differencesOnly, setDifferencesOnly] = useState(false);
  const runA = session.runs.find((run) => run.id === ids[0]);
  const runB = session.runs.find((run) => run.id === ids[1]);
  const sections = runA && runB ? comparisonSections(runA, runB) : [];
  const fastestDelta = numericComparisonDelta(runA?.fastestLap, runB?.fastestLap, "s");
  return (
    <>
      <TopBar title="Compare runs" subtitle={session.name} onBack={onBack} />
      <div className="page-content">
        <div className="compare-selectors">
          <Field label="First run"><select className="select" value={ids[0]} onChange={(event) => setIds([event.target.value, ids[1]])}>{session.runs.map((run) => <option disabled={run.id === ids[1]} key={run.id} value={run.id}>Run {String(run.number).padStart(2, "0")}{run.label ? ` · ${run.label}` : ""}</option>)}</select></Field>
          <Field label="Second run"><select className="select" value={ids[1]} onChange={(event) => setIds([ids[0], event.target.value])}>{session.runs.map((run) => <option disabled={run.id === ids[0]} key={run.id} value={run.id}>Run {String(run.number).padStart(2, "0")}{run.label ? ` · ${run.label}` : ""}</option>)}</select></Field>
        </div>
        <div className="compare-summary">
          <div><span>Fastest-lap change</span><strong>{fastestDelta}</strong><small>Run {runB?.number} compared with Run {runA?.number}</small></div>
          <label className="difference-toggle"><input type="checkbox" checked={differencesOnly} onChange={(event) => setDifferencesOnly(event.target.checked)} /> Differences only</label>
        </div>
        <div className="compare-table" role="table" aria-label="Run comparison">
          <div className="compare-row compare-head" role="row"><span>Measurement</span><strong>Run {runA?.number}</strong><strong>Run {runB?.number}</strong></div>
          {sections.map((section) => {
            const values = differencesOnly ? section.values.filter((value) => value.a !== value.b) : section.values;
            if (!values.length) return null;
            return (
              <div className="compare-section" role="rowgroup" key={section.title}>
                <div className="compare-group-title">{section.title}</div>
                {values.map((value) => <div className={`compare-row ${value.a !== value.b ? "changed" : ""}`} role="row" key={value.label}><span>{value.label}</span><strong>{value.a}</strong><strong>{value.b}</strong></div>)}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

type CompareValue = { label: string; a: string; b: string };

function comparisonSections(runA: RunRecord, runB: RunRecord): Array<{ title: string; values: CompareValue[] }> {
  const value = (label: string, a: string | number | boolean, b: string | number | boolean): CompareValue => ({
    label,
    a: a === "" ? "—" : String(a),
    b: b === "" ? "—" : String(b),
  });
  const tyreSections = tyreCorners.map(({ key, label }) => ({
    title: `${label} tyre`,
    values: [
      value("Cold pressure", unit(runA.tyres[key].coldPressure, "PSI"), unit(runB.tyres[key].coldPressure, "PSI")),
      value("Hot pressure", unit(runA.tyres[key].hotPressure, "PSI"), unit(runB.tyres[key].hotPressure, "PSI")),
      value("Pressure gain", measurementGain(runA.tyres[key].coldPressure, runA.tyres[key].hotPressure, "PSI"), measurementGain(runB.tyres[key].coldPressure, runB.tyres[key].hotPressure, "PSI")),
      value("Cold temperature", unit(runA.tyres[key].coldTemperature, "°C"), unit(runB.tyres[key].coldTemperature, "°C")),
      value("Hot temperature", unit(runA.tyres[key].hotTemperature, "°C"), unit(runB.tyres[key].hotTemperature, "°C")),
      value("Temperature gain", measurementGain(runA.tyres[key].coldTemperature, runA.tyres[key].hotTemperature, "°C"), measurementGain(runB.tyres[key].coldTemperature, runB.tyres[key].hotTemperature, "°C")),
    ],
  }));

  return [
    {
      title: "Performance",
      values: [
        value("Run label", runA.label, runB.label),
        value("Completed", runA.completed ? "Yes" : "No", runB.completed ? "Yes" : "No"),
        value("Laps", runA.laps, runB.laps),
        value("Fastest lap", unit(runA.fastestLap, "s"), unit(runB.fastestLap, "s")),
        value("Average lap", unit(runA.averageLap, "s"), unit(runB.averageLap, "s")),
        value("Position", runA.position, runB.position),
      ],
    },
    ...tyreSections,
    {
      title: "Chassis setup",
      values: [
        value("Front track / spacers", runA.setup.frontTrack, runB.setup.frontTrack),
        value("Rear track width", unit(runA.setup.rearTrack, "mm"), unit(runB.setup.rearTrack, "mm")),
        value("Front ride height", runA.setup.frontRideHeight, runB.setup.frontRideHeight),
        value("Rear ride height", runA.setup.rearRideHeight, runB.setup.rearRideHeight),
        value("Front toe", runA.setup.frontToe, runB.setup.frontToe),
        value("Front camber", runA.setup.frontCamber, runB.setup.frontCamber),
        value("Caster", runA.setup.caster, runB.setup.caster),
        value("Axle type", runA.setup.axleType, runB.setup.axleType),
        value("Rear hub", runA.setup.rearHub, runB.setup.rearHub),
        value("Front torsion bar", runA.setup.frontTorsionBar, runB.setup.frontTorsionBar),
        value("Seat stays", runA.setup.seatStays, runB.setup.seatStays),
        value("Wheel / rim type", runA.setup.wheelType, runB.setup.wheelType),
        value("Front sprocket", runA.setup.frontSprocket, runB.setup.frontSprocket),
        value("Rear sprocket", runA.setup.rearSprocket, runB.setup.rearSprocket),
        value("Setup notes", runA.setup.notes, runB.setup.notes),
      ],
    },
    {
      title: "Driver feedback",
      values: [
        value("Balance", runA.balance, runB.balance),
        value("Grip", runA.grip, runB.grip),
        value("Braking", runA.braking, runB.braking),
        value("Corner entry", runA.cornerEntry, runB.cornerEntry),
        value("Mid-corner", runA.midCorner, runB.midCorner),
        value("Corner exit / traction", runA.cornerExit, runB.cornerExit),
        value("General comments", runA.comments, runB.comments),
      ],
    },
  ];
}

function measurementGain(cold: string, hot: string, suffix: string) {
  if (!cold || !hot) return "—";
  const delta = Number(hot) - Number(cold);
  return Number.isFinite(delta) ? `${delta >= 0 ? "+" : ""}${delta.toFixed(2)} ${suffix}` : "—";
}

function numericComparisonDelta(first?: string, second?: string, suffix = "") {
  if (!first || !second) return "Not enough data";
  const delta = Number(second) - Number(first);
  if (!Number.isFinite(delta)) return "Not enough data";
  return `${delta >= 0 ? "+" : ""}${delta.toFixed(3)} ${suffix}`;
}

function unit(value: string, suffix: string) {
  return value ? `${value} ${suffix}` : "—";
}

function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
