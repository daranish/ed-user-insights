// Metrics for the CEO's Insights & Impacts screen. Measures whether learning changes decisions,
// not how many conversations people had.
import type { Action, Channel, Db, Finding, Segment } from "@/lib/types";
import { ACTION_TYPES, CHANNELS, SEGMENTS } from "@/lib/types";
import { computeCoverage } from "./coverage";
import { actionLog } from "./actionLog";
import { TODAY } from "@/lib/time";

export function isOverdue(a: Pick<Action, "status" | "dueDate">): boolean {
  return a.status !== "done" && a.dueDate < TODAY;
}

export function assumptionStatus(db: Pick<Db, "findings">, questionId: string): "contradicted" | "supported" | "untested" {
  const fs = db.findings.filter((f) => f.questionId === questionId);
  if (fs.some((f) => f.assumptionVerdict === "contradicts")) return "contradicted";
  if (fs.some((f) => f.assumptionVerdict === "supports")) return "supported";
  return "untested";
}

export function usefulness(db: Db) {
  const findings = db.findings;
  const withAction = findings.filter((f) => db.actions.some((a) => a.findingIds.includes(f.id)));
  const overdue = db.actions.filter(isOverdue);
  const contradicted = db.questions.filter((q) => assumptionStatus(db, q.id) === "contradicted");

  // A finding is reused when a question created after the finding's own question builds on it.
  const reused = findings.filter((f) => {
    const home = db.questions.find((q) => q.id === f.questionId);
    return db.questions.some((q) => q.id !== f.questionId && q.reusedFindingIds.includes(f.id) && (!home || q.createdAt > home.createdAt));
  });

  const done = new Set(db.recruitments.filter((r) => r.status === "done").map((r) => `${r.questionId}|${r.participantCode}`));
  const completed = db.sessions.filter((s) => done.has(`${s.questionId}|${s.participantCode}`));
  const grid = SEGMENTS.map((segment) => {
    const row = { segment } as { segment: Segment } & Record<Channel, number>;
    for (const c of CHANNELS) row[c] = 0;
    for (const s of completed) {
      const p = db.participants.find((x) => x.code === s.participantCode);
      if (p && p.segment === segment) row[p.channel] += 1;
    }
    return row;
  });
  const gaps = grid.flatMap((r) => CHANNELS.filter((c) => r[c] === 0).map((c) => ({ segment: r.segment, channel: c })));

  return {
    findingsTotal: findings.length,
    findingsWithAction: withAction.length,
    actionShare: findings.length ? withAction.length / findings.length : 0,
    overdue,
    contradicted,
    reused,
    grid,
    gaps,
    conversations: completed.length,
  };
}

export type QuestionStage = "recruiting" | "interviewing" | "writing-evidence" | "writing-findings" | "deciding" | "acting" | "closed-loop";

export const STAGE_LABEL: Record<QuestionStage, string> = {
  recruiting: "Recruiting",
  interviewing: "Interviewing",
  "writing-evidence": "Evidence needed",
  "writing-findings": "Findings needed",
  deciding: "Needs an action",
  acting: "Acting on it",
  "closed-loop": "Loop closed",
};

const CONTACTED = new Set(["invited", "accepted", "declined", "no-show", "done"]);

/**
 * Everything the Insights & Impacts screen shows, derived from the db. Reads the learning loop end to end:
 * how far each question has got, what the findings say, and what they changed.
 */
export function insights(db: Db) {
  const base = usefulness(db);
  const done = new Set(db.recruitments.filter((r) => r.status === "done").map((r) => `${r.questionId}|${r.participantCode}`));
  const completed = db.sessions.filter((s) => done.has(`${s.questionId}|${s.participantCode}`));
  const awaitingEvidence = completed.filter((s) => !db.evidence.some((e) => e.sessionId === s.id));

  const funnel = {
    questions: db.questions.length,
    contacted: db.recruitments.filter((r) => CONTACTED.has(r.status)).length,
    conversations: completed.length,
    evidence: db.evidence.length,
    findings: db.findings.length,
    findingsComplete: db.findings.filter((f) => f.status === "complete").length,
    actions: db.actions.length,
    actionsDone: db.actions.filter((a) => a.status === "done").length,
  };

  const assumptions = db.questions.map((q) => {
    const fs = db.findings.filter((f) => f.questionId === q.id);
    return {
      question: q,
      status: q.currentAssumption ? assumptionStatus(db, q.id) : ("untested" as const),
      contradicting: fs.filter((f) => f.assumptionVerdict === "contradicts"),
      supporting: fs.filter((f) => f.assumptionVerdict === "supports"),
    };
  });

  const strength = {
    pattern: db.findings.filter((f) => f.confidence === "pattern").length,
    signal: db.findings.filter((f) => f.confidence === "signal").length,
    unrated: db.findings.filter((f) => !f.confidence).length,
    avgParticipants: db.findings.length
      ? db.findings.reduce((n, f) => n + computeCoverage(f, db).supportingParticipants.length, 0) / db.findings.length
      : 0,
  };

  const actionStatus = {
    open: db.actions.filter((a) => a.status === "open" && !isOverdue(a)).length,
    inProgress: db.actions.filter((a) => a.status === "in-progress" && !isOverdue(a)).length,
    overdue: base.overdue.length,
    done: funnel.actionsDone,
  };
  const actionTypes = ACTION_TYPES.map((type) => ({ type, count: db.actions.filter((a) => a.type === type).length }));

  const scorecard = db.questions.map((q) => {
    const sessions = completed.filter((s) => s.questionId === q.id);
    const evidence = db.evidence.filter((e) => e.questionId === q.id);
    const findings = db.findings.filter((f) => f.questionId === q.id);
    const actions = db.actions.filter((a) => a.questionId === q.id);
    const booked = db.recruitments.some((r) => r.questionId === q.id && (r.status === "accepted" || r.status === "invited"));
    const unacted = findings.filter((f) => !actions.some((a) => a.findingIds.includes(f.id)));
    let stage: QuestionStage;
    if (sessions.length === 0) stage = booked ? "interviewing" : "recruiting";
    else if (sessions.some((s) => !evidence.some((e) => e.sessionId === s.id)) && findings.length === 0) stage = "writing-evidence";
    else if (findings.length === 0) stage = "writing-findings";
    else if (actions.length === 0 || unacted.length > 0) stage = "deciding";
    else if (actions.some((a) => a.status !== "done")) stage = "acting";
    else stage = "closed-loop";
    return {
      question: q,
      stage,
      conversations: sessions.length,
      evidence: evidence.length,
      findings: findings.length,
      findingsComplete: findings.filter((f) => f.status === "complete").length,
      actions: actions.length,
      actionsDone: actions.filter((a) => a.status === "done").length,
      overdue: actions.filter(isOverdue).length,
      assumption: assumptions.find((x) => x.question.id === q.id)!.status,
    };
  });

  // Findings ranked for a reader: finished before draft, stronger before weaker, more customers before fewer.
  const rank = (f: Finding) => (f.status === "complete" ? 4 : 0) + (f.confidence === "pattern" ? 2 : f.confidence === "signal" ? 1 : 0);
  const keyFindings = db.findings
    .map((f) => ({
      finding: f,
      participants: computeCoverage(f, db).supportingParticipants.length,
      actions: db.actions.filter((a) => a.findingIds.includes(f.id)),
    }))
    .sort((a, b) => rank(b.finding) - rank(a.finding) || b.participants - a.participants || b.finding.updatedAt.localeCompare(a.finding.updatedAt));

  const outcomes = db.actions
    .filter((a) => a.status === "done" && a.outcomeNote?.trim())
    .sort((a, b) => (actionLog(b).at(-1)?.at ?? "").localeCompare(actionLog(a).at(-1)?.at ?? ""));

  const attention = {
    overdue: base.overdue,
    awaitingEvidence,
    drafts: db.findings.filter((f) => f.status === "draft"),
    unacted: db.findings.filter((f) => f.status === "complete" && !db.actions.some((a) => a.findingIds.includes(f.id))),
  };

  return { ...base, actions: db.actions, funnel, assumptions, strength, actionStatus, actionTypes, scorecard, keyFindings, outcomes, attention };
}
