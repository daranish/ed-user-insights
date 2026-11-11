// The CEO's executive brief on Home: the few things a leader needs from customer learning,
// in the order they read them. What changed, what we got wrong, what is stuck, what comes next.
import type { Action, Db, Finding, Question } from "@/lib/types";
import { CHANNELS } from "@/lib/types";
import { computeCoverage } from "./coverage";
import { actionLog } from "./actionLog";
import { insights, isOverdue, STAGE_LABEL, type QuestionStage } from "./metrics";
import { TODAY, daysBetween, fmtDate } from "@/lib/time";

export const STAGES: QuestionStage[] = ["recruiting", "interviewing", "writing-evidence", "writing-findings", "deciding", "acting", "closed-loop"];

/** Illustrative channel mix of the customer base (see coverage.ts). */
export const CHANNEL_BASE = { "own-site": 0.4, marketplace: 0.6 } as const;

export type BriefEvent = { at: string; kind: "question" | "conversation" | "finding" | "action" | "outcome"; text: string; questionId: string; href: string };
export type BriefUpcoming = { at: string; kind: "call" | "due"; text: string; questionId: string; href: string; late?: boolean };
export type BriefRisk = { id: string; tone: "destructive" | "warning"; title: string; detail: string; href: string };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function nextStep(stage: QuestionStage, r: { conversations: number; findings: number; actions: number; actionsDone: number }, db: Db, q: Question): string {
  const recs = db.recruitments.filter((x) => x.questionId === q.id);
  switch (stage) {
    case "recruiting": {
      const asked = recs.filter((x) => x.status === "invite-requested").length;
      return asked ? `${plural(asked, "invite")} waiting for Ops approval` : "Choosing customers to invite";
    }
    case "interviewing": {
      const booked = recs.filter((x) => x.status === "accepted").length;
      const invited = recs.filter((x) => x.status === "invited").length;
      return [booked && `${plural(booked, "call")} booked`, invited && `${invited} awaiting a reply`].filter(Boolean).join(", ") || "Waiting on customers";
    }
    case "writing-evidence":
      return `Writing up ${plural(r.conversations, "conversation")}`;
    case "writing-findings":
      return "Turning evidence into findings";
    case "deciding": {
      const unacted = db.findings.filter((f) => f.questionId === q.id && !db.actions.some((a) => a.findingIds.includes(f.id))).length;
      return unacted ? `${plural(unacted, "finding")} without an action yet` : "Deciding what to do";
    }
    case "acting": {
      const next = db.actions.filter((a) => a.questionId === q.id && a.status !== "done").sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
      return `${r.actionsDone} of ${plural(r.actions, "action")} done${next ? `, next due ${fmtDate(next.dueDate)}` : ""}`;
    }
    case "closed-loop":
      return "Every action done";
  }
}

/** The finding that best answers the question's assumption: complete before draft, Pattern before Signal, more customers first. */
function lead(fs: Finding[], db: Db) {
  const score = (f: Finding) => (f.status === "complete" ? 4 : 0) + (f.confidence === "pattern" ? 2 : f.confidence === "signal" ? 1 : 0);
  return [...fs].sort((a, b) => score(b) - score(a) || computeCoverage(b, db).supportingParticipants.length - computeCoverage(a, db).supportingParticipants.length)[0];
}

export function executiveBrief(db: Db) {
  const m = insights(db);

  // Beliefs: for every question with a starting assumption, what customers said and what we did about it.
  const beliefs = m.assumptions
    .filter((a) => a.question.currentAssumption)
    .map((a) => {
      const finding = lead(a.status === "contradicted" ? a.contradicting : a.supporting, db);
      const actions: Action[] = finding ? db.actions.filter((x) => x.questionId === a.question.id && x.findingIds.some((id) => [...a.contradicting, ...a.supporting].some((f) => f.id === id))) : [];
      const cov = finding ? computeCoverage(finding, db) : null;
      return { question: a.question, status: a.status, finding, participants: cov?.supportingParticipants.length ?? 0, interviewed: cov?.interviewed ?? 0, actions };
    })
    .sort((a, b) => ({ contradicted: 0, supported: 1, untested: 2 })[a.status] - ({ contradicted: 0, supported: 1, untested: 2 })[b.status]);

  const portfolio = m.scorecard
    .map((r) => ({ ...r, step: STAGES.indexOf(r.stage), next: nextStep(r.stage, r, db, r.question) }))
    .sort((a, b) => b.overdue - a.overdue || a.step - b.step);

  // Who we've heard from, by channel, against the customer base.
  const heard = Object.fromEntries(CHANNELS.map((c) => [c, 0])) as Record<(typeof CHANNELS)[number], number>;
  const done = new Set(db.recruitments.filter((r) => r.status === "done").map((r) => `${r.questionId}|${r.participantCode}`));
  for (const s of db.sessions.filter((s) => done.has(`${s.questionId}|${s.participantCode}`))) {
    const p = db.participants.find((x) => x.code === s.participantCode);
    if (p) heard[p.channel] += 1;
  }
  const heardTotal = heard["own-site"] + heard.marketplace;
  const marketplaceShare = heardTotal ? heard.marketplace / heardTotal : 0;

  const decisions = db.actions.filter((a) => a.type === "decision" || a.type === "experiment");
  const onTime = db.actions.length ? (db.actions.length - m.actionStatus.overdue) / db.actions.length : 1;

  // Things a leader may want to chase, worst first. Each names who to ask.
  const owner = (id: string) => db.users.find((u) => u.id === id)?.name ?? id;
  const risks: BriefRisk[] = [
    ...m.attention.overdue.map((a) => ({
      id: `late-${a.id}`,
      tone: "destructive" as const,
      title: `${a.id} is ${plural(daysBetween(a.dueDate, TODAY), "day")} late`,
      detail: `${a.description} Assigned to ${owner(a.assigneeId)}.`,
      href: `/questions/${a.questionId}/actions?a=${a.id}`,
    })),
    ...(heardTotal && marketplaceShare < CHANNEL_BASE.marketplace - 0.05
      ? [{
          id: "channel",
          tone: "warning" as const,
          title: "Marketplace buyers are under-heard",
          detail: `${Math.round(marketplaceShare * 100)}% of conversations, against about ${Math.round(CHANNEL_BASE.marketplace * 100)}% of customers.`,
          href: "/dashboard",
        }]
      : []),
    ...m.attention.unacted.map((f) => ({
      id: `unacted-${f.id}`,
      tone: "warning" as const,
      title: `${f.id} is complete but has no action`,
      detail: `“${f.claim}” Owned by ${owner(db.questions.find((q) => q.id === f.questionId)?.ownerId ?? "")}.`,
      href: `/questions/${f.questionId}/findings?f=${f.id}`,
    })),
    ...m.scorecard
      .filter((r) => r.stage === "recruiting" && daysBetween(r.question.createdAt, TODAY) >= 7)
      .map((r) => ({
        id: `stalled-${r.question.id}`,
        tone: "warning" as const,
        title: `${r.question.id} has no customers booked after ${daysBetween(r.question.createdAt, TODAY)} days`,
        detail: `${r.question.text} Owned by ${owner(r.question.ownerId)}.`,
        href: `/questions/${r.question.id}/recruitment`,
      })),
  ];

  // Coming up: booked calls and action due dates in the next two weeks, plus anything already late.
  const upcoming: BriefUpcoming[] = [
    ...db.recruitments
      .filter((r) => r.status === "accepted" && r.scheduledAt && r.scheduledAt.slice(0, 10) >= TODAY)
      .map((r) => ({ at: r.scheduledAt!, kind: "call" as const, text: `Customer call with ${r.participantCode}`, questionId: r.questionId, href: `/questions/${r.questionId}/recruitment` })),
    ...db.actions
      .filter((a) => a.status !== "done" && daysBetween(TODAY, a.dueDate) <= 14)
      .map((a) => ({ at: a.dueDate, kind: "due" as const, text: `${a.id} due: ${a.description}`, questionId: a.questionId, href: `/questions/${a.questionId}/actions?a=${a.id}`, late: isOverdue(a) })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  // What happened, newest first, from the records themselves.
  const events: BriefEvent[] = [
    ...db.questions.map((q) => ({ at: q.createdAt, kind: "question" as const, text: `New question from ${owner(q.raisedById ?? q.ownerId)}: ${q.text}`, questionId: q.id, href: `/questions/${q.id}/overview` })),
    ...db.sessions
      .filter((s) => done.has(`${s.questionId}|${s.participantCode}`))
      .map((s) => ({ at: s.date, kind: "conversation" as const, text: `Spoke with customer ${s.participantCode}`, questionId: s.questionId, href: `/questions/${s.questionId}/sessions` })),
    ...db.findings.map((f) => ({
      at: f.updatedAt,
      kind: "finding" as const,
      text: `${f.status === "complete" ? "Finding completed" : "Finding drafted"}: ${f.claim}`,
      questionId: f.questionId,
      href: `/questions/${f.questionId}/findings?f=${f.id}`,
    })),
    ...db.actions.flatMap((a) =>
      actionLog(a).map((l) => ({
        at: l.at,
        kind: l.status === "done" ? ("outcome" as const) : ("action" as const),
        text:
          l.kind === "created"
            ? `${owner(a.ownerId)} set ${a.id}: ${a.description}`
            : l.status === "done"
              ? `${a.id} done${a.outcomeNote ? `: ${a.outcomeNote}` : ""}`
              : `${owner(l.byId)} ${l.status ? `moved ${a.id} to ${l.status.replace("-", " ")}` : `updated ${a.id}`}${l.note ? `: ${l.note}` : ""}`,
        questionId: a.questionId,
        href: `/questions/${a.questionId}/actions?a=${a.id}`,
      })),
    ),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const tested = beliefs.filter((b) => b.status !== "untested").length;
  const contradicted = beliefs.filter((b) => b.status === "contradicted").length;

  return {
    m,
    beliefs,
    portfolio,
    risks,
    upcoming,
    events,
    pulse: {
      active: db.questions.filter((q) => q.status !== "closed").length,
      conversations: heardTotal,
      heard,
      marketplaceShare,
      decisions: decisions.length,
      decisionsDone: decisions.filter((a) => a.status === "done").length,
      tested,
      contradicted,
      onTime,
      overdue: m.actionStatus.overdue,
    },
  };
}

export type Brief = ReturnType<typeof executiveBrief>;

/** A plain-text version of the brief, for pasting into an email or a leadership update. */
export function briefText(b: Brief, ownerName: (id: string) => string): string {
  const p = b.pulse;
  const lines = [
    `ED User Insights brief, ${fmtDate(TODAY)}`,
    "",
    `${plural(p.active, "question")} in flight · ${plural(p.conversations, "customer conversation")} · ${plural(p.decisions, "decision or experiment", "decisions and experiments")} taken from findings · ${p.overdue ? `${p.overdue} overdue` : "nothing overdue"}.`,
    "",
    "What we believed vs what customers said:",
    ...b.beliefs.map((x) =>
      x.finding
        ? `- ${x.question.id} ${x.status === "contradicted" ? "CONTRADICTED" : "SUPPORTED"}: we assumed “${x.question.currentAssumption}” Customers: “${x.finding.claim}” (${x.participants} of ${x.interviewed} interviewed).`
        : `- ${x.question.id} not tested yet: “${x.question.currentAssumption}”`,
    ),
    "",
    "Where each question is:",
    ...b.portfolio.map((r) => `- ${r.question.id} (${ownerName(r.question.ownerId)}): ${STAGE_LABEL[r.stage]}. ${r.next}.`),
  ];
  if (b.risks.length) lines.push("", "Needs a nudge:", ...b.risks.map((r) => `- ${r.title}. ${r.detail}`));
  return lines.join("\n");
}
