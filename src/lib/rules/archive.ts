// Archived questions stay in the data (findings are still searchable and reusable) but are set aside
// from the lists and the leadership views. These helpers cut the db down to one side of that line.
import type { Db } from "@/lib/types";

export const isArchived = (q: { archivedAt?: string }): boolean => !!q.archivedAt;

function scope(db: Db, keep: (archived: boolean) => boolean): Db {
  const ids = new Set(db.questions.filter((q) => keep(isArchived(q))).map((q) => q.id));
  const inScope = <T extends { questionId: string }>(xs: T[]) => xs.filter((x) => ids.has(x.questionId));
  return {
    ...db,
    questions: db.questions.filter((q) => ids.has(q.id)),
    recruitments: inScope(db.recruitments),
    sessions: inScope(db.sessions),
    evidence: inScope(db.evidence),
    findings: inScope(db.findings),
    actions: inScope(db.actions),
  };
}

/** Only questions that are not archived, with their records. Feeds the question list and the leadership views. */
export const liveDb = (db: Db): Db => scope(db, (archived) => !archived);

/** Only archived questions, with their records. */
export const archivedDb = (db: Db): Db => scope(db, (archived) => archived);
