export type BackupHistory = { lastExportAt: number | null; dismissedUntil: number };
export const BACKUP_HISTORY_KEY = "kart-data-backup-history";
export const ONE_DAY = 24 * 60 * 60 * 1000;
export const BACKUP_INTERVAL = 7 * ONE_DAY;

const emptyHistory = (): BackupHistory => ({ lastExportAt: null, dismissedUntil: 0 });
const timestamp = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 8.64e15;

/** Reminder preferences are optional: denied storage must never block recording or export. */
export function readBackupHistory(): BackupHistory {
  try {
    const value = JSON.parse(localStorage.getItem(BACKUP_HISTORY_KEY) ?? "null");
    if (!value || typeof value !== "object") return emptyHistory();
    return {
      lastExportAt: timestamp(value.lastExportAt) ? value.lastExportAt : null,
      dismissedUntil: timestamp(value.dismissedUntil) ? value.dismissedUntil : 0,
    };
  } catch {
    return emptyHistory();
  }
}

export function writeBackupHistory(history: BackupHistory) {
  try {
    localStorage.setItem(BACKUP_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // The download still succeeded; only the reminder preference could not be kept.
  }
}

export function backupIsDue(hasRecords: boolean, history: BackupHistory, now: number): boolean {
  if (!hasRecords || now < history.dismissedUntil) return false;
  // A clock correction must not suppress reminders indefinitely.
  return history.lastExportAt === null || history.lastExportAt > now || now - history.lastExportAt >= BACKUP_INTERVAL;
}
