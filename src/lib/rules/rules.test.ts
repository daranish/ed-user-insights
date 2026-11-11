import { describe, expect, it } from "vitest";
import { seedDb } from "@/fixtures";
import type { Db, Evidence, Finding, FindingLink } from "@/lib/types";
import { computeCoverage, nOfN } from "./coverage";
import { completionBlockers, confidenceChecks, isConfidenceValid, maxAllowed } from "./confidence";
import { displayEvidence } from "./consent";
import { detectPii } from "./pii";
import { relatedFindings } from "./search";
import { insights } from "./metrics";
import { archivedDb, liveDb } from "./archive";
import { briefText, executiveBrief } from "./brief";
import { canCloseMeeting, inviteMessage, sessionsAwaitingEvidence } from "./recruitment";

const f1 = (db: Db) => db.findings.find((f) => f.id === "F-1")!;
const withLinks = (f: Finding, links: FindingLink[]): Finding => ({ ...f, links });
const sup = (...ids: string[]): FindingLink[] => ids.map((evidenceId) => ({ evidenceId, stance: "supports" as const }));

describe("coverage", () => {
  it("counts distinct supporting participants against everyone interviewed", () => {
    const db = seedDb();
    const cov = computeCoverage(f1(db), db);
    expect(cov.supportingParticipants).toEqual(["P-003", "P-007"]);
    expect(cov.interviewed).toBe(4);
    expect(nOfN(cov)).toBe("2 of 4 interviewed");
  });

  it("counts a participant once however many items they contribute", () => {
    const db = seedDb();
    // E-101, E-108 and E-109 are all P-003.
    const cov = computeCoverage(withLinks(f1(db), sup("E-101", "E-108", "E-109")), db);
    expect(cov.supportingParticipants).toEqual(["P-003"]);
  });

  it("breaks supporters down by segment and channel", () => {
    const db = seedDb();
    const cov = computeCoverage(withLinks(f1(db), sup("E-101", "E-102", "E-103")), db);
    expect(cov.byChannel).toEqual({ "own-site": 2, marketplace: 1 });
    expect(cov.bySegment["one-time lapsed"]).toBe(2);
    expect(cov.bySegment["first-time"]).toBe(1);
  });

  it("lists target segments with no completed session", () => {
    const db = seedDb();
    // Q-1 targets repeat buyers too, but nobody repeat has been interviewed.
    expect(computeCoverage(f1(db), db).targetSegmentsWithoutSessions).toEqual(["repeat"]);
  });

  it("reports the paraphrase share and contradicting / context links", () => {
    const db = seedDb();
    const cov = computeCoverage(
      withLinks(f1(db), [...sup("E-101", "E-104"), { evidenceId: "E-108", stance: "contradicts" }, { evidenceId: "E-105", stance: "context" }]),
      db,
    );
    expect(cov.paraphraseShare).toBe(0.5);
    expect(cov.contradicting).toBe(1);
    expect(cov.context).toBe(1);
  });

  it("ignores links to evidence that no longer exists", () => {
    const db = seedDb();
    const cov = computeCoverage(withLinks(f1(db), sup("E-101", "E-999")), db);
    expect(cov.supportingParticipants).toEqual(["P-003"]);
  });
});

describe("confidence guardrails", () => {
  it("allows only Signal with 2 participants (seeded F-1)", () => {
    const db = seedDb();
    const checks = confidenceChecks(computeCoverage(f1(db), db));
    expect(checks.signal.allowed).toBe(true);
    expect(checks.pattern.allowed).toBe(false);
    expect(checks.pattern.reason).toMatch(/3 distinct participants; 2 so far/);
  });

  it("unlocks Pattern at 3 distinct participants", () => {
    const db = seedDb();
    const cov = computeCoverage(withLinks(f1(db), sup("E-101", "E-102", "E-103")), db);
    expect(maxAllowed(cov)).toBe("pattern");
  });

  it("refuses Pattern when all supporting evidence is paraphrase", () => {
    const db = seedDb();
    // Make three paraphrase-only items from three different people.
    const para = (id: string, sessionId: string): Evidence => ({ ...db.evidence[0], id, sessionId, captureType: "paraphrase" });
    db.evidence.push(para("X-1", "S-1"), para("X-2", "S-2"), para("X-3", "S-3"));
    const checks = confidenceChecks(computeCoverage(withLinks(f1(db), sup("X-1", "X-2", "X-3")), db));
    expect(checks.signal.allowed).toBe(true);
    expect(checks.pattern.allowed).toBe(false);
    expect(checks.pattern.reason).toMatch(/paraphrase/);
  });

  it("flags a stored level the evidence no longer supports", () => {
    const db = seedDb();
    const cov = computeCoverage(f1(db), db);
    expect(isConfidenceValid("signal", cov)).toBe(true);
    expect(isConfidenceValid("pattern", cov)).toBe(false);
  });

  it("blocks completion until counter-evidence is checked", () => {
    const db = seedDb();
    const f = f1(db);
    const cov = computeCoverage(f, db);
    expect(completionBlockers(f, cov)).toEqual(["Check for counter-evidence."]);
    const checked = { ...f, counterEvidenceChecked: "none-found" as const };
    expect(completionBlockers(checked, cov)).toEqual([]);
  });
});

describe("evidence display", () => {
  const ev = { textEn: "I still have half the bottle left.", textOriginal: "आधी बोतल बची है।", captureType: "direct-quotation" as const };

  it("shows text and original, as a quote", () => {
    const v = displayEvidence(ev);
    expect(v.text).toBe(ev.textEn);
    expect(v.original).toBe(ev.textOriginal);
    expect(v.asQuote).toBe(true);
  });

});

describe("personal-data warning", () => {
  it("catches emails, phone numbers and known names", () => {
    const w = detectPii("Rohan said email me at rohan.g@example.com or call +91 98024 10714", ["Rohan Gupta"]);
    expect(w.map((x) => x.kind).sort()).toEqual(["email", "name", "phone"]);
    expect(w.find((x) => x.kind === "name")!.message).toMatch(/the customer/);
  });

  it("stays quiet on ordinary evidence", () => {
    expect(detectPii("Median reorder at day 62 for the 250 ml bottle.", ["Rohan Gupta"])).toEqual([]);
  });
});

describe("related findings", () => {
  it("surfaces earlier findings for a similar question", () => {
    const db = seedDb();
    const hits = relatedFindings("Why do shampoo buyers not come back? Is it the price?", db);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => db.findings.some((f) => f.id === h.id))).toBe(true);
  });
});

describe("recruitment pipeline", () => {
  const at = "2026-11-12T09:00:00+05:30";
  const start = new Date(at).getTime();

  it("keeps Done / No-show locked until 30 minutes after the meeting time", () => {
    const rec = { status: "accepted" as const, scheduledAt: at };
    expect(canCloseMeeting(rec, start + 29 * 60_000)).toBe(false);
    expect(canCloseMeeting(rec, start + 30 * 60_000)).toBe(true);
  });

  it("only applies to accepted people with a booked time", () => {
    expect(canCloseMeeting({ status: "invited", scheduledAt: at }, start + 3_600_000)).toBe(false);
    expect(canCloseMeeting({ status: "accepted" }, start + 3_600_000)).toBe(false);
  });

  it("names the SKU the customer bought in the invite", () => {
    const db = seedDb();
    const p = db.participants[0];
    expect(inviteMessage(p, db.questions[0], "Ananya Rao")).toContain(p.productContext.sku);
  });

  it("lists sessions that have no evidence yet", () => {
    const awaiting = sessionsAwaitingEvidence([{ id: "S-1" }, { id: "S-2" }], [{ sessionId: "S-1" }, { sessionId: null }]);
    expect(awaiting.map((x) => x.id)).toEqual(["S-2"]);
  });
});

describe("insights", () => {
  it("reads the seed loop end to end", () => {
    const m = insights(seedDb());
    expect(m.funnel).toMatchObject({ questions: 3, conversations: 4, findings: 3, findingsComplete: 2, actions: 3, actionsDone: 0 });
    expect(m.assumptions.find((a) => a.question.id === "Q-1")?.status).toBe("contradicted");
    expect(m.attention.overdue.map((a) => a.id)).toEqual(["A-2"]);
  });

  it("puts each question at the right stage", () => {
    const db = seedDb();
    const stage = (id: string) => insights(db).scorecard.find((r) => r.question.id === id)?.stage;
    expect(stage("Q-1")).toBe("acting");
    db.actions = db.actions.filter((x) => x.id !== "A-1"); // F-3 loses its only action
    expect(stage("Q-1")).toBe("deciding");
    expect(stage("Q-3")).toBe("recruiting");
  });

  it("ranks complete findings before drafts", () => {
    const m = insights(seedDb());
    const first = m.keyFindings.findIndex((k) => k.finding.status === "draft");
    expect(m.keyFindings.slice(0, first).every((k) => k.finding.status === "complete")).toBe(true);
  });
});

describe("executive brief", () => {
  it("puts the contradicted belief first, with the finding and the actions it led to", () => {
    const b = executiveBrief(seedDb());
    const q1 = b.beliefs[0];
    expect(q1.question.id).toBe("Q-1");
    expect(q1.status).toBe("contradicted");
    expect(q1.finding?.id).toBe("F-2");
    expect(q1.actions.map((a) => a.id).sort()).toEqual(["A-2", "A-3"]);
    expect(b.beliefs.filter((x) => x.status === "untested").map((x) => x.question.id)).toEqual(["Q-2", "Q-3"]);
  });

  it("flags the overdue action first, naming who to ask", () => {
    const b = executiveBrief(seedDb());
    expect(b.risks[0].id).toBe("late-A-2");
    expect(b.risks[0].detail).toContain("Ananya");
    expect(b.pulse.overdue).toBe(1);
  });

  it("reads the channel mix from completed conversations only", () => {
    const b = executiveBrief(seedDb());
    expect(b.pulse.heard).toEqual({ "own-site": 2, marketplace: 2 });
    expect(b.risks.some((r) => r.id === "channel")).toBe(true);
  });

  it("lists booked calls and late actions as coming up, in date order", () => {
    const b = executiveBrief(seedDb());
    expect(b.upcoming.map((u) => u.at)).toEqual([...b.upcoming.map((u) => u.at)].sort());
    expect(b.upcoming.find((u) => u.text.includes("A-2"))?.late).toBe(true);
  });

  it("writes a plain-text brief", () => {
    const db = seedDb();
    const t = briefText(executiveBrief(db), (id) => db.users.find((u) => u.id === id)?.name ?? id);
    expect(t).toContain("Q-1 CONTRADICTED");
    expect(t).toContain("Needs a nudge:");
  });
});

describe("archived questions", () => {
  it("leave the live view with all their records, and stay in the archived view", () => {
    const db = seedDb();
    const before = db.questions.length;
    db.questions[0].archivedAt = "2026-11-10T09:00:00.000Z";
    const id = db.questions[0].id;
    const live = liveDb(db);
    const arch = archivedDb(db);
    expect(live.questions).toHaveLength(before - 1);
    expect(live.findings.every((f) => f.questionId !== id)).toBe(true);
    expect(live.actions.every((a) => a.questionId !== id)).toBe(true);
    expect(arch.questions.map((q) => q.id)).toEqual([id]);
    expect(arch.findings.every((f) => f.questionId === id)).toBe(true);
    // nothing is deleted from the original
    expect(db.questions).toHaveLength(before);
  });

  it("are left out of the leadership figures but not out of search", () => {
    const db = seedDb();
    const all = insights(db);
    db.questions[0].archivedAt = "2026-11-10T09:00:00.000Z";
    const live = insights(liveDb(db));
    expect(live.scorecard.some((r) => r.question.id === db.questions[0].id)).toBe(false);
    expect(live.scorecard.length).toBe(all.scorecard.length - 1);
    const f = db.findings.find((x) => x.questionId === db.questions[0].id)!;
    expect(relatedFindings(f.claim, db).some((h) => h.id === f.id)).toBe(true);
  });
});

