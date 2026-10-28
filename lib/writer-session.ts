import { writeTransaction } from "./database";
import { assertWriter, claimWriterInTransaction, releaseWriterInTransaction } from "./writer-lease";

export async function claimWriter(owner: string) {
  let claimed = false;
  await writeTransaction(["app"], async transaction => { claimed = await claimWriterInTransaction(transaction, owner); });
  return claimed;
}

export function renewWriter(owner: string) {
  return writeTransaction(["app"], transaction => assertWriter(transaction, owner));
}

export function releaseWriter(owner: string) {
  return writeTransaction(["app"], transaction => releaseWriterInTransaction(transaction, owner));
}
