import { describe, expect, it, vi } from "vitest";
import { SaveQueue } from "./save-queue";

describe("SaveQueue", () => {
  it("waits for debounced writes as well as active writes before reporting Saved", async () => {
    const status = vi.fn();
    const queue = new SaveQueue(status);
    queue.stage("app");
    queue.stage("trackMap");
    await queue.save("app", async () => {});
    expect(status).toHaveBeenLastCalledWith("Saving…");
    await queue.save("trackMap", async () => {});
    expect(status).toHaveBeenLastCalledWith("Saved");
  });

  it("keeps a failed app save visible when an unrelated map save succeeds", async () => {
    const status = vi.fn();
    const queue = new SaveQueue(status);
    await queue.save("app", async () => { throw new Error("Quota exceeded"); });
    await queue.save("trackMap", async () => {});
    expect(status).toHaveBeenLastCalledWith("Error");
    await queue.save("app", async () => {});
    expect(status).toHaveBeenLastCalledWith("Saved");
  });

  it("serializes old and new snapshots and lets restore wait for both", async () => {
    const queue = new SaveQueue(() => {});
    const writes: string[] = [];
    let finish!: () => void;
    queue.save("app", () => new Promise<void>((resolve) => {
      finish = () => { writes.push("old"); resolve(); };
    }));
    queue.save("app", async () => { writes.push("new"); });
    await Promise.resolve();
    expect(writes).toEqual([]);
    finish();
    await queue.idle();
    writes.push("restore");
    expect(writes).toEqual(["old", "new", "restore"]);
  });

  it("reports a synchronous storage exception without breaking future retries", async () => {
    const status = vi.fn();
    const queue = new SaveQueue(status);
    await queue.save("app", () => { throw new Error("Unavailable"); });
    expect(status).toHaveBeenLastCalledWith("Error");
    await queue.save("app", async () => {});
    expect(status).toHaveBeenLastCalledWith("Saved");
  });
});
