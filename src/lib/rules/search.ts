// Keyword-overlap search across findings and evidence. Stands in for full-text search in the real build.
import type { CaptureType, Confidence, Db } from "@/lib/types";
import { computeCoverage, participantOfEvidence } from "./coverage";

const STOP = new Set(
  "a an the and or of to in on for with do does did not no is are was were be been it its this that these those why how what who when where which they them their our we you your i me my at by from as about into than then so if but any some all more most less our customers customer buyers buyer people".split(" "),
);

export function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z-]+/g) ?? [])
    .map((t) => t.replace(/(ing|ers|er|es|s)$/, ""))
    .filter((t) => t.length > 2 && !STOP.has(t));
}

function overlap(q: string[], doc: string[]): number {
  if (!q.length) return 0;
  const set = new Set(doc);
  return q.filter((t) => set.has(t)).length / q.length;
}

export interface SearchHit {
  kind: "finding" | "evidence";
  id: string;
  title: string;
  questionId: string;
  questionText: string;
  /** Distinct supporting participants (findings) or 1/0 (evidence). */
  n: number;
  confidence: Confidence | null;
  captureType?: CaptureType;
  /** The finding an evidence hit belongs to, if any. */
  findingId?: string;
  score: number;
}

export function search(query: string, db: Db, opts: { limit?: number; minScore?: number; kinds?: SearchHit["kind"][] } = {}): SearchHit[] {
  const q = [...new Set(tokens(query))];
  if (!q.length) return [];
  const kinds = opts.kinds ?? ["finding", "evidence"];
  const qText = (id: string) => db.questions.find((x) => x.id === id)?.text ?? "";
  const hits: SearchHit[] = [];

  if (kinds.includes("finding")) {
    for (const f of db.findings) {
      const evText = f.links.map((l) => db.evidence.find((e) => e.id === l.evidenceId)).filter(Boolean)
        .map((e) => `${e!.textEn} ${e!.tags.join(" ")}`).join(" ");
      const doc = tokens(`${f.claim} ${f.claim} ${f.limitations} ${evText} ${qText(f.questionId)}`);
      const score = overlap(q, doc);
      if (score <= (opts.minScore ?? 0)) continue;
      const cov = computeCoverage(f, db);
      hits.push({
        kind: "finding", id: f.id, title: f.claim, questionId: f.questionId, questionText: qText(f.questionId),
        n: cov.supportingParticipants.length, confidence: f.confidence,
        score,
      });
    }
  }
  if (kinds.includes("evidence")) {
    for (const e of db.evidence) {
      const doc = tokens(`${e.textEn} ${e.tags.join(" ")}`);
      const score = overlap(q, doc);
      if (score <= (opts.minScore ?? 0)) continue;
      const finding = db.findings.find((f) => f.links.some((l) => l.evidenceId === e.id));
      hits.push({
        kind: "evidence", id: e.id, title: e.textEn, questionId: e.questionId, questionText: qText(e.questionId),
        n: participantOfEvidence(db, e.sessionId) ? 1 : 0, confidence: finding?.confidence ?? null,
        captureType: e.captureType, findingId: finding?.id, score,
      });
    }
  }
  return hits.sort((a, b) => b.score - a.score || (a.kind === "finding" ? -1 : 1)).slice(0, opts.limit ?? 20);
}

/** "Did we already learn this?" Findings related to a draft question. */
export function relatedFindings(draft: string, db: Db, limit = 5): SearchHit[] {
  return search(draft, db, { kinds: ["finding"], minScore: 0.15, limit });
}
