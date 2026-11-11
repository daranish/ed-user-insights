import type { Action, ActionLogEntry } from "@/lib/types";

/** The action's progress log, oldest first. Actions saved before logs existed get one built from what they hold. */
export function actionLog(a: Action): ActionLogEntry[] {
  if (a.log?.length) return a.log;
  const out: ActionLogEntry[] = [{ id: `${a.id}-L0`, kind: "created", at: a.createdAt, byId: a.ownerId }];
  if (a.outcomeNote) out.push({ id: `${a.id}-L1`, kind: "update", at: a.createdAt, byId: a.ownerId, status: a.status === "open" ? undefined : a.status, note: a.outcomeNote });
  else if (a.status !== "open") out.push({ id: `${a.id}-L1`, kind: "update", at: a.createdAt, byId: a.ownerId, status: a.status });
  return out;
}
