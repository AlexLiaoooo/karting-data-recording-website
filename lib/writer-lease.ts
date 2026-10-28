export const WRITER_KEY = "writer-lease";
export const WRITER_LEASE_MS = 20_000;
export const WRITER_HEARTBEAT_MS = 5_000;

type Lease = { owner: string; expiresAt: number };

export class WriterConflictError extends Error {
  constructor() { super("Another tab controls editing"); this.name = "WriterConflictError"; }
}

function readLease(transaction: IDBTransaction): Promise<Lease | undefined> {
  return new Promise((resolve, reject) => {
    const request = transaction.objectStore("app").get(WRITER_KEY);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** The lease check and record changes share one transaction, so takeover cannot race a save. */
export async function assertWriter(transaction: IDBTransaction, owner: string) {
  const lease = await readLease(transaction);
  if (!owner || lease?.owner !== owner) throw new WriterConflictError();
  transaction.objectStore("app").put({ owner, expiresAt: Date.now() + WRITER_LEASE_MS }, WRITER_KEY);
}

export async function claimWriterInTransaction(transaction: IDBTransaction, owner: string, now = Date.now()) {
  if (!owner) throw new WriterConflictError();
  const lease = await readLease(transaction);
  if (lease && lease.owner !== owner && lease.expiresAt > now) return false;
  transaction.objectStore("app").put({ owner, expiresAt: now + WRITER_LEASE_MS }, WRITER_KEY);
  return true;
}

export async function releaseWriterInTransaction(transaction: IDBTransaction, owner: string) {
  if ((await readLease(transaction))?.owner === owner) transaction.objectStore("app").delete(WRITER_KEY);
}
