// Coverage is calculated from a finding's linked evidence, never typed in.
import type { Channel, Db, Finding, Segment } from "@/lib/types";
import { CHANNELS, SEGMENTS } from "@/lib/types";

/** Illustrative customer split by channel (brief: 40% own site, 60% marketplaces). */
export const POPULATION_SPLIT: Record<Channel, number> = { "own-site": 0.4, marketplace: 0.6 };

export type CoverageDb = Pick<Db, "evidence" | "sessions" | "participants" | "recruitments" | "questions">;

export interface Coverage {
  /** Distinct participants behind verified, supporting interview evidence. */
  supportingParticipants: string[];
  /** Distinct participants with a completed session in this question. */
  interviewed: number;
  bySegment: Record<Segment, number>;
  byChannel: Record<Channel, number>;
  /** Target segments of the question with no completed session at all. */
  targetSegmentsWithoutSessions: Segment[];
  /** Share (0–1) of linked supporting evidence that is paraphrase only. */
  paraphraseShare: number;
  /** Countable supporting interview items that are not paraphrase. */
  nonParaphraseSupport: number;
  contradicting: number;
  context: number;
}

export function participantOfEvidence(db: Pick<Db, "sessions">, sessionId: string | null): string | undefined {
  if (!sessionId) return undefined;
  return db.sessions.find((s) => s.id === sessionId)?.participantCode;
}

/** Participants with a session that took place (recruitment "done") in this question. */
export function interviewedParticipants(db: Pick<Db, "sessions" | "recruitments">, questionId: string): string[] {
  const done = new Set(
    db.recruitments.filter((r) => r.questionId === questionId && r.status === "done").map((r) => r.participantCode),
  );
  return [...new Set(db.sessions.filter((s) => s.questionId === questionId && done.has(s.participantCode)).map((s) => s.participantCode))];
}

export function computeCoverage(finding: Pick<Finding, "questionId" | "links">, db: CoverageDb): Coverage {
  const question = db.questions.find((q) => q.id === finding.questionId);
  const linked = finding.links
    .map((l) => ({ link: l, ev: db.evidence.find((e) => e.id === l.evidenceId) }))
    .filter((x): x is { link: typeof x.link; ev: NonNullable<typeof x.ev> } => !!x.ev);

  const supporting = linked.filter((x) => x.link.stance === "supports");
  const countable = supporting;

  const codes = new Set<string>();
  for (const x of countable) {
    const code = participantOfEvidence(db, x.ev.sessionId);
    if (code) codes.add(code);
  }
  const supportingParticipants = [...codes].sort();

  const bySegment = Object.fromEntries(SEGMENTS.map((s) => [s, 0])) as Record<Segment, number>;
  const byChannel = Object.fromEntries(CHANNELS.map((c) => [c, 0])) as Record<Channel, number>;
  for (const code of supportingParticipants) {
    const p = db.participants.find((x) => x.code === code);
    if (!p) continue;
    bySegment[p.segment] += 1;
    byChannel[p.channel] += 1;
  }

  const interviewed = interviewedParticipants(db, finding.questionId);
  const interviewedSegments = new Set(
    interviewed.map((c) => db.participants.find((p) => p.code === c)?.segment).filter(Boolean) as Segment[],
  );
  const targetSegmentsWithoutSessions = (question?.targetSegments ?? []).filter((s) => !interviewedSegments.has(s));

  const paraphrase = supporting.filter((x) => x.ev.captureType === "paraphrase").length;

  return {
    supportingParticipants,
    interviewed: interviewed.length,
    bySegment,
    byChannel,
    targetSegmentsWithoutSessions,
    paraphraseShare: supporting.length ? paraphrase / supporting.length : 0,
    nonParaphraseSupport: countable.filter((x) => x.ev.captureType !== "paraphrase").length,
    contradicting: linked.filter((x) => x.link.stance === "contradicts").length,
    context: linked.filter((x) => x.link.stance === "context").length,
  };
}

/** "3 of 4 interviewed". */
export function nOfN(c: Coverage): string {
  return `${c.supportingParticipants.length} of ${c.interviewed} interviewed`;
}
