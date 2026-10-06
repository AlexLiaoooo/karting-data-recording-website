import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BACKUP_HISTORY_KEY, BACKUP_INTERVAL, backupIsDue, ONE_DAY, readBackupHistory, writeBackupHistory } from "./backup-reminder";

const now = Date.UTC(2026, 9, 6, 12);
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("backup reminders", () => {
  it("stays quiet on an empty device and reminds after the first records exist", () => {
    const history = readBackupHistory();
    expect(backupIsDue(false, history, now)).toBe(false);
    expect(backupIsDue(true, history, now)).toBe(true);
  });

  it("waits seven days after a full export and handles a corrected clock", () => {
    const history = { lastExportAt: now, dismissedUntil: 0 };
    expect(backupIsDue(true, history, now + BACKUP_INTERVAL - 1)).toBe(false);
    expect(backupIsDue(true, history, now + BACKUP_INTERVAL)).toBe(true);
    expect(backupIsDue(true, history, now - ONE_DAY)).toBe(true);
  });

  it("keeps a dismissal across reloads and resumes after 24 hours", () => {
    writeBackupHistory({ lastExportAt: null, dismissedUntil: now + ONE_DAY });
    expect(backupIsDue(true, readBackupHistory(), now + ONE_DAY - 1)).toBe(false);
    expect(backupIsDue(true, readBackupHistory(), now + ONE_DAY)).toBe(true);
  });

  it.each(["invalid-json", "null", '{"lastExportAt":"wrong","dismissedUntil":{}}', '{"lastExportAt":1e30,"dismissedUntil":-1}'])("ignores corrupt reminder preferences: %s", (stored) => {
    localStorage.setItem(BACKUP_HISTORY_KEY, stored);
    expect(readBackupHistory()).toEqual({ lastExportAt: null, dismissedUntil: 0 });
  });

  it("does not turn a preference storage failure into a failed backup", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Denied"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Quota exceeded"); });
    expect(readBackupHistory()).toEqual({ lastExportAt: null, dismissedUntil: 0 });
    expect(() => writeBackupHistory({ lastExportAt: now, dismissedUntil: 0 })).not.toThrow();
  });
});
