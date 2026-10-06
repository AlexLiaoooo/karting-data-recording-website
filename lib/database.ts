import type { AppData, EventRecord } from "./types";
import { isRecord, validAppRecords } from "./validation";

const DB_NAME = "kart-data-recorder";
const DB_VERSION = 2;
const STORE_NAME = "app";
const DATA_KEY = "primary";

export const emptyAppData = (): AppData => ({
  version: 2,
  events: [],
  lastEventId: null,
  setupTemplates: [],
});

/**
 * Fills Run fields added after a record was written.
 *
 * A Run stored before `maxRpm` existed has no such property. React treats an input whose value is
 * undefined as uncontrolled, so the field would warn on render and then fight the first keystroke.
 * Backfilling here covers stored data and restored backups alike, since both pass through
 * normalizeAppData, and lets the field stay non-optional everywhere else.
 */
function migrateRuns(events: EventRecord[]): EventRecord[] {
  return events.map((event) => ({
    ...event,
    sessions: (event.sessions ?? []).map((session) => ({
      ...session,
      runs: (session.runs ?? []).map((run) => ({ ...run, maxRpm: run.maxRpm ?? "" })),
    })),
  }));
}

export function normalizeAppData(value: unknown): AppData | null {
  if (!isRecord(value) || !validAppRecords(value)) return null;
  const candidate = value as {
    version?: unknown;
    events?: unknown;
    lastEventId?: unknown;
    setupTemplates?: unknown;
  };
  if ((candidate.version !== 1 && candidate.version !== 2) || !Array.isArray(candidate.events)) return null;

  return {
    version: 2,
    events: migrateRuns(candidate.events as EventRecord[]),
    lastEventId: typeof candidate.lastEventId === "string" ? candidate.lastEventId : null,
    setupTemplates: Array.isArray(candidate.setupTemplates) ? candidate.setupTemplates : [],
  };
}

export function openKartDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Device storage is unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
      if (!database.objectStoreNames.contains("tracks")) database.createObjectStore("tracks", { keyPath: "id" });
      if (!database.objectStoreNames.contains("trackLayouts")) database.createObjectStore("trackLayouts", { keyPath: "id" });
      if (!database.objectStoreNames.contains("trackVisits")) database.createObjectStore("trackVisits", { keyPath: "id" });
      if (!database.objectStoreNames.contains("mapAssets")) database.createObjectStore("mapAssets", { keyPath: "id" });
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  });
}

export function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Device storage failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("Device storage transaction aborted"));
  });
}

export async function loadData(): Promise<AppData> {
  const database = await openKartDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const done = transactionDone(transaction);
    const request = transaction.objectStore(STORE_NAME).get(DATA_KEY);
    const result = new Promise<unknown>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const [stored] = await Promise.all([result, done]);
    if (stored === undefined) return emptyAppData();
    const normalized = normalizeAppData(stored);
    if (!normalized) throw new Error("Saved records could not be read safely");
    return normalized;
  } finally {
    database.close();
  }
}

export async function saveData(data: AppData): Promise<void> {
  await writeTransaction([STORE_NAME], (transaction) => {
    transaction.objectStore(STORE_NAME).put(data, DATA_KEY);
  });
}

/** Abort queued writes too if preparing any later record throws synchronously. */
export async function writeTransaction(stores: string[], write: (transaction: IDBTransaction) => void): Promise<void> {
  const database = await openKartDatabase();
  try {
    const transaction = database.transaction(stores, "readwrite");
    const done = transactionDone(transaction);
    try {
      write(transaction);
    } catch (error) {
      transaction.abort();
      await done.catch(() => {});
      throw error;
    }
    await done;
  } finally {
    database.close();
  }
}

export function validateImport(value: unknown): boolean {
  return normalizeAppData(value) !== null;
}
