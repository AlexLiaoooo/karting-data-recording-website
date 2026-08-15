import type { AppData } from "./types";

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

export function normalizeAppData(value: unknown): AppData | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as {
    version?: unknown;
    events?: unknown;
    lastEventId?: unknown;
    setupTemplates?: unknown;
  };
  if ((candidate.version !== 1 && candidate.version !== 2) || !Array.isArray(candidate.events)) return null;

  return {
    version: 2,
    events: candidate.events,
    lastEventId: typeof candidate.lastEventId === "string" ? candidate.lastEventId : null,
    setupTemplates: Array.isArray(candidate.setupTemplates) ? candidate.setupTemplates : [],
  };
}

export function openKartDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
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
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadData(): Promise<AppData> {
  if (typeof indexedDB === "undefined") return emptyAppData();
  const database = await openKartDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(DATA_KEY);
    request.onsuccess = () => resolve(normalizeAppData(request.result) ?? emptyAppData());
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

export async function saveData(data: AppData): Promise<void> {
  const database = await openKartDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(data, DATA_KEY);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export function validateImport(value: unknown): boolean {
  return normalizeAppData(value) !== null;
}
