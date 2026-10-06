export type SaveKind = "app" | "trackMap";
export type SaveStatus = "Saved" | "Saving…" | "Error";

/** Serialize writes so an older debounce cannot finish after a newer snapshot. */
export class SaveQueue {
  private tail: Promise<void> = Promise.resolve();
  private pending = 0;
  private dirty = new Set<SaveKind>();
  private failed = new Set<SaveKind>();

  constructor(private report: (status: SaveStatus) => void) {}

  stage(kind: SaveKind) {
    this.dirty.add(kind);
    this.notify();
  }

  save(kind: SaveKind, write: () => Promise<void>): Promise<void> {
    this.dirty.delete(kind);
    this.pending += 1;
    this.notify();
    this.tail = this.tail.then(write).then(
      () => { this.failed.delete(kind); },
      () => { this.failed.add(kind); },
    ).finally(() => {
      this.pending -= 1;
      this.notify();
    });
    return this.tail;
  }

  idle(): Promise<void> {
    return this.tail;
  }

  markFailed(kind: SaveKind) {
    this.dirty.delete(kind);
    this.failed.add(kind);
    this.notify();
  }

  reset() {
    this.dirty.clear();
    this.failed.clear();
    this.notify();
  }

  private notify() {
    this.report(this.failed.size ? "Error" : this.pending || this.dirty.size ? "Saving…" : "Saved");
  }
}
