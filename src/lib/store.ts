// The whole "backend" for the prototype. SIMULATED: state lives in memory, mirrored to localStorage.
// Every write goes through `server()`, which adds 300–800 ms latency and can be forced to fail
// from the Demo controls, so loading and error states are real.
import { create } from "zustand";
import { seedDb } from "@/fixtures";
import { actionLog } from "@/lib/rules/actionLog";
import type {
  Action, ActionStatus, AuditLogEntry, CaptureType, Confidence, CouponStatus, Db, Evidence, Finding,
  ImportBatch, Participant, ParticipantContact, Question, Role, Segment,
} from "./types";
import { nowIso, simNowMs, TODAY } from "./time";
import { canCloseMeeting, inviteMessage } from "./rules/recruitment";

const DB_KEY = "ed-user-insights-demo-v1";
const USER_KEY = "ed-user-insights-demo-v1:user";

export interface Sim {
  /** The next screen load fails with a simulated API error. */
  failNextLoad: boolean;
  /** The next save fails with a simulated API error. */
  failNextSave: boolean;
  /** The next finding save hits "someone else saved this finding". */
  conflictNext: boolean;
  /** Recordings return "unavailable". */
  recordingUnavailable: boolean;
  /** The next import staging run fails validation on the server. */
  importFailNext: boolean;
  /** Minutes the simulated clock has been fast-forwarded (to unlock Done / No-show). */
  clockShiftMin: number;
}

const SIM_OFF: Sim = { failNextLoad: false, failNextSave: false, conflictNext: false, recordingUnavailable: false, importFailNext: false, clockShiftMin: 0 };

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 503) {
    super(message);
    this.status = status;
  }
}

export class ConflictError extends Error {
  server: Finding;
  byName: string;
  constructor(server: Finding, byName: string) {
    super(`${byName} saved this finding (v${server.version}) while you were editing.`);
    this.server = server;
    this.byName = byName;
  }
}

/** Brings an older saved demo up to date: capture types, and behavioural data (no longer used) is dropped. */
function migrate(db: Db): Db {
  const gone = new Set(
    db.evidence.filter((e) => (e as { sourceType?: string }).sourceType === "behavioural-data" || e.id === "E-B01").map((e) => e.id),
  );
  if (gone.size) {
    db.evidence = db.evidence.filter((e) => !gone.has(e.id));
    for (const f of db.findings) f.links = f.links.filter((l) => !gone.has(l.evidenceId));
  }
  const legacyF = new Set(db.findings.filter((f) => (f as { legacy?: boolean }).legacy || f.id === "F-L1").map((f) => f.id));
  const legacyE = new Set(
    db.evidence.filter((e) => (e as { provenance?: string }).provenance === "unattributed" || e.id === "E-L1" || e.id === "E-L2").map((e) => e.id),
  );
  if (legacyF.size || legacyE.size) {
    db.findings = db.findings.filter((f) => !legacyF.has(f.id));
    db.evidence = db.evidence.filter((e) => !legacyE.has(e.id));
    for (const f of db.findings) f.links = f.links.filter((l) => !legacyE.has(l.evidenceId));
    for (const q of db.questions) q.reusedFindingIds = q.reusedFindingIds.filter((id) => !legacyF.has(id));
  }
  for (const a of db.actions) {
    const old = a as Action & { findingId?: string };
    if (old.findingId !== undefined) {
      const f = db.findings.find((x) => x.id === old.findingId);
      const q = db.questions.find((x) => x.id === f?.questionId);
      a.findingIds = [old.findingId];
      a.questionId = f?.questionId ?? "";
      a.assigneeId = a.ownerId;
      a.ownerId = q?.ownerId ?? a.ownerId;
      delete old.findingId;
    }
  }
  for (const a of db.actions) a.findingIds = a.findingIds.filter((id) => !legacyF.has(id));
  db.actions = db.actions.filter((a) => a.findingIds.length > 0);
  for (const f of db.findings) delete (f as { legacy?: boolean }).legacy;
  for (const e of db.evidence) {
    delete (e as { sourceType?: string }).sourceType;
    delete (e as { provenance?: string }).provenance;
    delete (e as { sourceLabel?: string }).sourceLabel;
    const t = e.captureType as string;
    if (t === "verbatim" || t === "translated") {
      e.captureType = "direct-quotation";
      e.textOriginal ||= e.textEn;
      e.originalLanguage ||= "English";
    }
  }
  for (const f of db.findings) if ((f.confidence as string | null) === "corroborated") f.confidence = "pattern";
  // The CEO can raise questions too, and reads the executive brief.
  for (const u of db.users) if (u.id === "u_ceo") Object.assign(u, { canRaiseQuestion: true, executive: true });
  return db;
}

function loadDb(): Db {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return migrate(JSON.parse(raw) as Db);
  } catch {
    /* storage unavailable or corrupt: fall back to the seed */
  }
  return seedDb();
}

function loadUser(): string | null {
  try {
    return localStorage.getItem(USER_KEY);
  } catch {
    return null;
  }
}

export const latency = () => 300 + Math.round(Math.random() * 500);
const ARCHIVED = "This question is archived. Restore it to make changes.";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function nextId(prefix: string, ids: string[]): string {
  const max = ids.reduce((m, id) => {
    const n = Number(id.replace(/^\D+-?/, ""));
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return `${prefix}${max + 1}`;
}

function audit(db: Db, actorId: string, action: string, target: string, level: AuditLogEntry["level"] = "info") {
  db.audit.unshift({ id: nextId("L-", db.audit.map((a) => a.id)), at: nowIso(), actorId, action, target, level });
}

export interface StagedImport {
  fileName: string;
  rejectedColumns: string[];
  rowsTotal: number;
  /** Rows that will become new participants. */
  fresh: StagedRow[];
  /** Rows whose customer_ref matches an existing participant. Skipped on commit. */
  duplicates: { row: StagedRow; existingCode: string }[];
  /** Rows refused by staging, with reasons. */
  refused: { row: StagedRow; reason: string }[];
  /** Rows skipped in the browser before staging. */
  skippedInBrowser: number;
}

export type StagedRow = Record<string, string>;

interface State {
  db: Db;
  userId: string | null;
  sim: Sim;
  /** Bumped by "Break this screen" so the current screen reloads (and fails). */
  screenNonce: number;

  signIn: (userId: string) => void;
  signOut: () => void;
  resetDemo: () => void;
  setSim: (patch: Partial<Sim>) => void;
  breakScreen: () => void;
  /** Simulated GET for a screen. Throws when failNextLoad is set. */
  load: () => Promise<void>;

  createQuestion: (input: Omit<Question, "id" | "createdAt" | "status" | "ownerId"> & { ownerId?: string }) => Promise<string>;
  addToRecruitment: (questionId: string, codes: string[]) => Promise<void>;
  /** Owner asks Ops for permission to contact everyone in `codes` (all must be "considered"). */
  requestInvites: (questionId: string, codes: string[]) => Promise<void>;
  /** Ops only. Approving sends the (simulated) WhatsApp; rejecting returns the person to "considered". */
  decideInvite: (questionId: string, code: string, decision: { approve: true } | { approve: false; reason: string }) => Promise<void>;
  /** Stands in for the customer's reply on WhatsApp, which the prototype has no side for. */
  simulateCustomerReply: (questionId: string, code: string, reply: { kind: "schedule"; scheduledAt: string; consentRecord: boolean; consentQuote: boolean } | { kind: "decline"; reason: string }) => Promise<void>;
  /** Owner closes out a meeting once it has ended. "done" creates the session the owner then writes evidence for. */
  closeMeeting: (questionId: string, code: string, outcome: "done" | "no-show") => Promise<void>;
  removeFromRecruitment: (questionId: string, code: string) => Promise<void>;
  setCoupon: (questionId: string, code: string, coupon: CouponStatus) => Promise<void>;
  revealContact: (questionId: string, code: string) => Promise<ParticipantContact | undefined>;
  addEvidence: (input: Omit<Evidence, "id" | "revisions" | "createdAt" | "createdById">) => Promise<string>;
  editEvidence: (id: string, patch: { textEn: string; textOriginal?: string; originalLanguage?: string; captureType: CaptureType; tags: string[] }) => Promise<number>;
  setRecordingLink: (sessionId: string, url: string) => Promise<void>;
  createFinding: (questionId: string, claim: string) => Promise<string>;
  deleteFinding: (id: string) => Promise<void>;
  saveFinding: (draft: Finding) => Promise<Finding>;
  completeFinding: (id: string) => Promise<void>;
  clearFindingFlags: (id: string) => Promise<void>;
  createAction: (input: Pick<Action, "questionId" | "findingIds" | "type" | "description" | "reason" | "assigneeId" | "dueDate">) => Promise<string>;
  editAction: (id: string, patch: Pick<Action, "findingIds" | "type" | "description" | "reason" | "assigneeId" | "dueDate">) => Promise<void>;
  deleteAction: (id: string) => Promise<void>;
  /** Question owner only. Makes the question read-only and hides it from the lists; nothing is deleted. */
  archiveQuestion: (id: string) => Promise<void>;
  restoreQuestion: (id: string) => Promise<void>;
  updateAction: (id: string, patch: { status?: ActionStatus; note?: string }) => Promise<void>;
  stageImport: (fileName: string, rejectedColumns: string[], rows: StagedRow[], skippedInBrowser: number) => Promise<StagedImport>;
  commitImport: (staged: StagedImport) => Promise<ImportBatch>;
  rollbackBatch: (batchId: string) => Promise<void>;
  setUserRole: (userId: string, role: Role) => Promise<void>;
  /** Admin only. Adds a team member so they can be given work. Returns the new user's id. */
  addUser: (input: { name: string; title: string; email: string; role: Role; canRaiseQuestion?: boolean }) => Promise<string>;
}

export const useStore = create<State>((set, get) => {
  /** Runs a write against a copy of the db after simulated latency. */
  async function server<T>(fn: (db: Db, me: string) => T): Promise<T> {
    await wait(latency());
    const { sim, userId } = get();
    if (sim.failNextSave) {
      set({ sim: { ...sim, failNextSave: false } });
      throw new ApiError("The server didn't respond (503, simulated). Nothing was saved.");
    }
    const draft = structuredClone(get().db);
    const out = fn(draft, userId ?? "unknown");
    set({ db: draft });
    return out;
  }

  return {
    db: loadDb(),
    userId: loadUser(),
    sim: { ...SIM_OFF },
    screenNonce: 0,

    signIn: (userId) => set({ userId }),
    signOut: () => set({ userId: null }),
    resetDemo: () => set({ db: seedDb(), sim: { ...SIM_OFF }, screenNonce: get().screenNonce + 1 }),
    setSim: (patch) => set({ sim: { ...get().sim, ...patch } }),
    breakScreen: () => set({ sim: { ...get().sim, failNextLoad: true }, screenNonce: get().screenNonce + 1 }),
    load: async () => {
      await wait(latency());
      const { sim } = get();
      if (sim.failNextLoad) {
        set({ sim: { ...sim, failNextLoad: false } });
        throw new ApiError("Couldn't load this screen (503, simulated).");
      }
    },

    createQuestion: (input) =>
      server((db, me) => {
        const id = nextId("Q-", db.questions.map((q) => q.id));
        const raiser = db.users.find((u) => u.id === me);
        const isOwner = raiser?.role === "owner";
        db.questions.push({
          ...input,
          id,
          ownerId: isOwner ? me : input.ownerId ?? me,
          raisedById: isOwner ? undefined : me,
          status: isOwner ? "active" : "proposed",
          createdAt: nowIso(),
        });
        audit(db, me, "question.created", `${id}: ${input.text}`);
        return id;
      }),


    addToRecruitment: (questionId, codes) =>
      server((db, me) => {
        for (const code of codes) {
          if (db.recruitments.some((r) => r.questionId === questionId && r.participantCode === code)) continue;
          db.recruitments.push({ questionId, participantCode: code, status: "considered", couponStatus: "n/a" });
        }
        const q = db.questions.find((x) => x.id === questionId);
        if (q?.status === "proposed") q.status = "active";
        audit(db, me, "recruitment.considered", `${codes.join(", ")} for ${questionId}`);
      }),

    removeFromRecruitment: (questionId, code) =>
      server((db, me) => {
        const r = db.recruitments.find((x) => x.questionId === questionId && x.participantCode === code);
        if (!r) return;
        if (r.status !== "considered") throw new ApiError("Only people still at “Considered” can be removed from the pipeline.", 409);
        db.recruitments = db.recruitments.filter((x) => x !== r);
        audit(db, me, "recruitment.unconsidered", `${code} removed from ${questionId}`);
      }),

    requestInvites: (questionId, codes) =>
      server((db, me) => {
        const q = db.questions.find((x) => x.id === questionId);
        if (!q || q.ownerId !== me) throw new ApiError("Only the question owner can request invites.", 403);
        if (q.archivedAt) throw new ApiError(ARCHIVED, 409);
        const recs = codes.map((c) => db.recruitments.find((r) => r.questionId === questionId && r.participantCode === c));
        if (recs.length === 0 || recs.some((r) => !r || r.status !== "considered")) throw new ApiError("Only people at “Considered” can be sent for approval.", 409);
        for (const r of recs) {
          r!.status = "invite-requested";
          r!.inviteRequestedAt = nowIso();
          r!.inviteRequestedById = me;
          r!.inviteDeniedReason = undefined;
        }
        audit(db, me, "invite.requested", `${codes.join(", ")} for ${questionId}`);
      }),

    decideInvite: (questionId, code, decision) =>
      server((db, me) => {
        const user = db.users.find((u) => u.id === me);
        if (user?.role !== "admin") throw new ApiError("Only Ops can approve contact.", 403);
        const r = db.recruitments.find((x) => x.questionId === questionId && x.participantCode === code);
        const q = db.questions.find((x) => x.id === questionId);
        const p = db.participants.find((x) => x.code === code);
        if (!r || !q || !p) throw new ApiError("That invite request no longer exists.", 404);
        if (r.status !== "invite-requested") throw new ApiError("This request was already decided.", 409);
        if (decision.approve) {
          const owner = db.users.find((u) => u.id === q.ownerId)?.name ?? "the team";
          r.status = "invited";
          r.invitedAt = nowIso();
          r.inviteMessage = inviteMessage(p, q, owner);
          audit(db, me, "invite.approved", `${code} for ${questionId}; WhatsApp sent (simulated)`);
        } else {
          r.status = "considered";
          r.inviteDeniedReason = decision.reason;
          audit(db, me, "invite.rejected", `${code} for ${questionId}: ${decision.reason}`, "warn");
        }
        r.inviteDecidedAt = nowIso();
        r.inviteDecidedById = me;
      }),

    simulateCustomerReply: (questionId, code, reply) =>
      server((db, me) => {
        const q = db.questions.find((x) => x.id === questionId);
        if (!q || q.ownerId !== me) throw new ApiError("Only the question owner can use the demo customer.", 403);
        if (q.archivedAt) throw new ApiError(ARCHIVED, 409);
        const r = db.recruitments.find((x) => x.questionId === questionId && x.participantCode === code);
        if (!r || r.status !== "invited") throw new ApiError("Only people with an invite sent can reply.", 409);
        if (reply.kind === "schedule") {
          r.status = "accepted";
          r.scheduledAt = reply.scheduledAt;
          r.consentRecord = reply.consentRecord;
          r.consentQuote = reply.consentQuote;
          r.meetLink = `https://meet.google.com/eds-${questionId.toLowerCase().replace("-", "")}-${code.slice(2)}`;
          r.declineReason = undefined;
          audit(db, me, "customer.scheduled", `${code} booked ${reply.scheduledAt} (${questionId}, simulated customer)`);
        } else {
          r.status = "declined";
          r.declineReason = reply.reason;
          audit(db, me, "customer.declined", `${code}: ${reply.reason} (${questionId}, simulated customer)`);
        }
      }),

    closeMeeting: (questionId, code, outcome) =>
      server((db, me) => {
        const q = db.questions.find((x) => x.id === questionId);
        if (!q || q.ownerId !== me) throw new ApiError("Only the question owner can close a meeting.", 403);
        if (q.archivedAt) throw new ApiError(ARCHIVED, 409);
        const r = db.recruitments.find((x) => x.questionId === questionId && x.participantCode === code);
        if (!r || !canCloseMeeting(r, simNowMs(get().sim.clockShiftMin))) throw new ApiError("Done and No-show unlock 30 minutes after the meeting time.", 409);
        r.status = outcome;
        audit(db, me, "recruitment.status_changed", `${code} → ${outcome} (${questionId})`);
        if (outcome === "done") {
          const id = nextId("S-", db.sessions.map((x) => x.id));
          db.sessions.push({ id, questionId, participantCode: code, date: r.scheduledAt!.slice(0, 10), conductorId: me, languageSpoken: "English" });
          audit(db, me, "session.created", `${id}: ${code} (${questionId}), waiting for evidence`);
        }
      }),

    setCoupon: (questionId, code, coupon) =>
      server((db, me) => {
        const r = db.recruitments.find((x) => x.questionId === questionId && x.participantCode === code);
        if (r) r.couponStatus = coupon;
        audit(db, me, "recruitment.coupon_changed", `${code} → ${coupon} (${questionId})`);
      }),

    revealContact: (questionId, code) =>
      server((db, me) => {
        const r = db.recruitments.find((x) => x.questionId === questionId && x.participantCode === code);
        const q = db.questions.find((x) => x.id === questionId);
        // Enforced on the "server" too, not only by disabling the button.
        if (!q || q.ownerId !== me) throw new ApiError("Only the question owner can reveal contact details.", 403);
        if (q.archivedAt) throw new ApiError(ARCHIVED, 409);
        if (!r || (r.status !== "invited" && r.status !== "accepted")) throw new ApiError("Contacts can be revealed only for invited or accepted participants.", 403);
        audit(db, me, "contact.revealed", `${code} for ${questionId}`, "warn");
        return db.contacts.find((c) => c.participantCode === code);
      }),

    addEvidence: (input) =>
      server((db, me) => {
        const id = nextId("E-", db.evidence.filter((e) => /^E-\d+$/.test(e.id)).map((e) => e.id));
        db.evidence.push({ ...input, id, revisions: [], createdAt: nowIso(), createdById: me });
        return id;
      }),

    editEvidence: (id, patch) =>
      server((db, me) => {
        const e = db.evidence.find((x) => x.id === id);
        if (!e) throw new ApiError("That evidence no longer exists.", 404);
        if (e.textEn !== patch.textEn || e.captureType !== patch.captureType) {
          e.revisions.push({ at: nowIso(), byId: me, previousTextEn: e.textEn });
        }
        Object.assign(e, patch);
        let flagged = 0;
        for (const f of db.findings) {
          if (f.links.some((l) => l.evidenceId === id)) {
            f.evidenceChanged = true;
            flagged += 1;
          }
        }
        audit(db, me, "evidence.edited", `${id} (revision ${e.revisions.length})`);
        return flagged;
      }),

    setRecordingLink: (sessionId, url) =>
      server((db, me) => {
        const s = db.sessions.find((x) => x.id === sessionId);
        if (!s) throw new ApiError("That session no longer exists.", 404);
        const had = !!s.recordingRef;
        s.recordingRef = url;
        audit(db, me, "session.recording_link", `${s.id} (${s.participantCode}): link ${had ? "changed" : "added"}`);
      }),

    createFinding: (questionId, claim) =>
      server((db, me) => {
        const id = nextId("F-", db.findings.filter((f) => /^F-\d+$/.test(f.id)).map((f) => f.id));
        db.findings.push({
          id, questionId, claim, confidence: null, counterEvidenceChecked: null, version: 1, links: [],
          limitations: "", assumptionVerdict: "not-addressed", status: "draft", updatedAt: nowIso(), updatedById: me,
        });
        audit(db, me, "finding.created", `${id} v1`);
        return id;
      }),

    deleteFinding: (id) =>
      server((db, me) => {
        const f = db.findings.find((x) => x.id === id);
        if (!f) throw new ApiError("That finding no longer exists.", 404);
        const q = db.questions.find((x) => x.id === f.questionId);
        if (q && q.ownerId !== me) throw new ApiError("Only the question owner can delete a finding.", 403);
        for (const a of db.actions) a.findingIds = a.findingIds.filter((x) => x !== id);
        const gone = db.actions.filter((a) => a.findingIds.length === 0).length;
        db.findings = db.findings.filter((x) => x.id !== id);
        db.actions = db.actions.filter((a) => a.findingIds.length > 0);
        audit(db, me, "finding.deleted", `${id}${gone ? ` and ${gone} action${gone === 1 ? "" : "s"}` : ""}`);
      }),

    saveFinding: async (draft) => {
      const { sim } = get();
      if (sim.conflictNext) {
        // Simulate another owner saving first: the server copy moves on a version.
        set({ sim: { ...sim, conflictNext: false } });
        await wait(latency());
        const db = structuredClone(get().db);
        const f = db.findings.find((x) => x.id === draft.id)!;
        const other = db.users.find((u) => u.id === "u_brand")!;
        f.claim = `${f.claim} (mainly 250 ml buyers)`;
        f.limitations = `${f.limitations} Kabir: we haven't spoken to anyone who bought the 650 ml.`.trim();
        f.version += 1;
        f.updatedAt = nowIso();
        f.updatedById = other.id;
        audit(db, other.id, "finding.saved", `${f.id} v${f.version}`);
        set({ db });
        throw new ConflictError(structuredClone(f), other.name);
      }
      return server((db, me) => {
        const f = db.findings.find((x) => x.id === draft.id);
        if (!f) throw new ApiError("That finding no longer exists.", 404);
        if (f.version !== draft.version) {
          const by = db.users.find((u) => u.id === f.updatedById)?.name ?? "Someone";
          throw new ConflictError(structuredClone(f), by);
        }
        Object.assign(f, {
          claim: draft.claim, confidence: draft.confidence, counterEvidenceChecked: draft.counterEvidenceChecked,
          links: draft.links, limitations: draft.limitations, assumptionVerdict: draft.assumptionVerdict,
          version: f.version + 1, updatedAt: nowIso(), updatedById: me,
        });
        audit(db, me, "finding.saved", `${f.id} v${f.version}`);
        return structuredClone(f);
      });
    },

    completeFinding: (id) =>
      server((db, me) => {
        const f = db.findings.find((x) => x.id === id);
        if (!f) return;
        if (!f.counterEvidenceChecked) {
          throw new ApiError("Check counter-evidence before completing.", 422);
        }
        f.status = "complete";
        audit(db, me, "finding.completed", id);
      }),

    clearFindingFlags: (id) =>
      server((db, me) => {
        const f = db.findings.find((x) => x.id === id);
        if (!f) return;
        f.evidenceChanged = false;
        f.needsReReview = false;
        audit(db, me, "finding.rereviewed", id);
      }),

    createAction: (input) =>
      server((db, me) => {
        const q = db.questions.find((x) => x.id === input.questionId);
        if (!q) throw new ApiError("That question no longer exists.", 404);
        if (q.archivedAt) throw new ApiError(ARCHIVED, 409);
        const ids = [...new Set(input.findingIds)];
        if (ids.length === 0 || !ids.every((f) => db.findings.some((x) => x.id === f && x.questionId === q.id))) {
          throw new ApiError("Pick at least one finding from this question.", 422);
        }
        if (!db.users.some((u) => u.id === input.assigneeId)) throw new ApiError("That person doesn't exist.", 422);
        const id = nextId("A-", db.actions.map((a) => a.id));
        const at = nowIso();
        db.actions.push({
          id, questionId: q.id, findingIds: ids, type: input.type, description: input.description, reason: input.reason,
          ownerId: me, assigneeId: input.assigneeId, dueDate: input.dueDate,
          status: input.type === "no-action" ? "done" : "open", createdAt: at,
          log: [{ id: `${id}-L0`, kind: "created", at, byId: me }],
        });
        audit(db, me, "action.created", `${id} (${input.type}) on ${ids.join(", ")}, assigned to ${input.assigneeId}`);
        return id;
      }),

    editAction: (id, patch) =>
      server((db, me) => {
        const a = db.actions.find((x) => x.id === id);
        if (!a) throw new ApiError("That action no longer exists.", 404);
        if (a.ownerId !== me) throw new ApiError("Only the person who created this action can edit it.", 403);
        const ids = [...new Set(patch.findingIds)];
        if (ids.length === 0 || !ids.every((f) => db.findings.some((x) => x.id === f && x.questionId === a.questionId))) {
          throw new ApiError("Pick at least one finding from this question.", 422);
        }
        const nameOf = (uid: string) => db.users.find((u) => u.id === uid)?.name ?? uid;
        const changes: string[] = [];
        if (patch.assigneeId !== a.assigneeId) changes.push(`Reassigned to ${nameOf(patch.assigneeId)}.`);
        if (patch.dueDate !== a.dueDate) changes.push(`Due date changed to ${patch.dueDate}.`);
        if (patch.description !== a.description) changes.push("Description edited.");
        if (patch.type !== a.type) changes.push("Type changed.");
        if (ids.join() !== a.findingIds.join()) changes.push("Supporting findings changed.");
        Object.assign(a, { findingIds: ids, type: patch.type, description: patch.description, reason: patch.reason, assigneeId: patch.assigneeId, dueDate: patch.dueDate });
        if (changes.length) {
          const log = actionLog(a).slice();
          log.push({ id: `${id}-L${log.length}`, kind: "edited", at: nowIso(), byId: me, note: changes.join(" ") });
          a.log = log;
        }
        audit(db, me, "action.edited", id);
      }),

    archiveQuestion: (id) =>
      server((db, me) => {
        const q = db.questions.find((x) => x.id === id);
        if (!q) throw new ApiError("That question no longer exists.", 404);
        if (db.users.find((u) => u.id === me)?.role !== "owner" || q.ownerId !== me) throw new ApiError("Only the question owner can archive it.", 403);
        if (q.archivedAt) throw new ApiError("This question is already archived.", 409);
        q.archivedAt = nowIso();
        q.archivedById = me;
        audit(db, me, "question.archived", `${id}: ${q.text}`);
      }),

    restoreQuestion: (id) =>
      server((db, me) => {
        const q = db.questions.find((x) => x.id === id);
        if (!q) throw new ApiError("That question no longer exists.", 404);
        if (db.users.find((u) => u.id === me)?.role !== "owner" || q.ownerId !== me) throw new ApiError("Only the question owner can restore it.", 403);
        if (!q.archivedAt) throw new ApiError("This question isn't archived.", 409);
        q.archivedAt = undefined;
        q.archivedById = undefined;
        audit(db, me, "question.restored", `${id}: ${q.text}`);
      }),

    deleteAction: (id) =>
      server((db, me) => {
        const a = db.actions.find((x) => x.id === id);
        if (!a) throw new ApiError("That action no longer exists.", 404);
        if (a.ownerId !== me) throw new ApiError("Only the person who created this action can delete it.", 403);
        db.actions = db.actions.filter((x) => x.id !== id);
        audit(db, me, "action.deleted", id);
      }),

    updateAction: (id, patch) =>
      server((db, me) => {
        const a = db.actions.find((x) => x.id === id);
        if (!a) throw new ApiError("That action no longer exists.", 404);
        if (a.assigneeId !== me) throw new ApiError("Only the person it's assigned to can change the status or add comments.", 403);
        const note = patch.note?.trim() || undefined;
        const changed = patch.status && patch.status !== a.status ? patch.status : undefined;
        if (!changed && !note) return;
        const log = actionLog(a).slice();
        log.push({ id: `${id}-L${log.length}`, kind: "update", at: nowIso(), byId: me, status: changed, note });
        a.log = log;
        if (changed) a.status = changed;
        if (note) a.outcomeNote = note;
        audit(db, me, "action.updated", `${id}${changed ? ` → ${changed}` : ""}${note ? " (note added)" : ""}`);
      }),

    stageImport: async (fileName, rejectedColumns, rows, skippedInBrowser) => {
      await wait(latency() + 300);
      const { sim, db } = get();
      if (sim.importFailNext) {
        set({ sim: { ...sim, importFailNext: false } });
        throw new ApiError("Staging validation failed: the validation worker timed out (simulated). No rows were staged.", 500);
      }
      const staged: StagedImport = { fileName, rejectedColumns, rowsTotal: rows.length + skippedInBrowser, fresh: [], duplicates: [], refused: [], skippedInBrowser };
      const seenRefs = new Set<string>();
      for (const row of rows) {
        const ref = row.customer_ref?.trim();
        const existing = db.participants.find((p) => p.customerRef === ref);
        if (existing) staged.duplicates.push({ row, existingCode: existing.code });
        else if (seenRefs.has(ref)) staged.refused.push({ row, reason: "Repeated customer_ref within this file." });
        else if (row.first_order_date > row.last_order_date) staged.refused.push({ row, reason: `First order ${row.first_order_date} is after the last order ${row.last_order_date}.` });
        else if (row.last_order_date > TODAY) staged.refused.push({ row, reason: `Order date ${row.last_order_date} is after the export date.` });
        else staged.fresh.push(row);
        seenRefs.add(ref);
      }
      return staged;
    },

    commitImport: (staged) =>
      server((db, me) => {
        const batchId = nextId("B-", db.importBatches.map((b) => b.id)).replace(/^B-(\d)$/, "B-00$1").replace(/^B-(\d\d)$/, "B-0$1");
        const codes: string[] = [];
        for (const row of staged.fresh) {
          const code = `P-${nextId("", db.participants.map((x) => x.code)).padStart(3, "0")}`;
          const p: Participant = {
            code,
            customerRef: row.customer_ref,
            segment: row.segment as Segment,
            channel: row.channel as Participant["channel"],
            productContext: { sku: row.sku, firstOrderDate: row.first_order_date, lastOrderDate: row.last_order_date },
            recruitmentSource: row.source as Participant["recruitmentSource"],
            importBatchId: batchId,
          };
          db.participants.push(p);
          // Contact details go to their own store, never onto the participant.
          db.contacts.push({ participantCode: code, name: row.name ?? "", email: row.email ?? "", phone: row.phone ?? "" });
          codes.push(code);
        }
        const batch: ImportBatch = {
          id: batchId, at: nowIso(), byId: me, fileName: staged.fileName, rowsTotal: staged.rowsTotal,
          rowsImported: codes.length, rowsFailed: staged.refused.length + staged.skippedInBrowser,
          duplicates: staged.duplicates.length, rejectedColumns: staged.rejectedColumns, participantCodes: codes, status: "committed",
        };
        db.importBatches.unshift(batch);
        audit(db, me, "import.committed", `Batch ${batchId} (${codes.length} participants)`);
        if (staged.rejectedColumns.length) audit(db, me, "import.column_rejected", `${staged.rejectedColumns.join(", ")} in ${staged.fileName}`, "warn");
        return batch;
      }),

    rollbackBatch: (batchId) =>
      server((db, me) => {
        const b = db.importBatches.find((x) => x.id === batchId);
        if (!b || b.status !== "committed") throw new ApiError("That batch can't be rolled back.", 409);
        const inUse = b.participantCodes.filter((c) => db.recruitments.some((r) => r.participantCode === c));
        if (inUse.length) {
          throw new ApiError(`Can't roll back: ${inUse.length} participant${inUse.length === 1 ? " is" : "s are"} already in a question (${inUse.slice(0, 4).join(", ")}${inUse.length > 4 ? "…" : ""}). Withdraw them individually instead.`, 409);
        }
        const codes = new Set(b.participantCodes);
        db.participants = db.participants.filter((p) => !codes.has(p.code));
        db.contacts = db.contacts.filter((c) => !codes.has(c.participantCode));
        b.status = "rolled-back";
        audit(db, me, "import.rolled_back", `Batch ${batchId} (${codes.size} participants removed)`, "warn");
      }),

    setUserRole: (userId, role) =>
      server((db, me) => {
        if (userId === me) throw new ApiError("You can't change your own role.", 403);
        const u = db.users.find((x) => x.id === userId);
        if (!u) return;
        const from = u.role;
        u.role = role;
        audit(db, me, "user.role_changed", `${u.name}: ${from} → ${role}`, "warn");
      }),

    addUser: (input) =>
      server((db, me) => {
        if (db.users.find((u) => u.id === me)?.role !== "admin") throw new ApiError("Only Ops can add people.", 403);
        const name = input.name.trim();
        const title = input.title.trim();
        const email = input.email.trim().toLowerCase();
        if (!name || !title) throw new ApiError("Name and title are required.", 422);
        if (!/^\S+@\S+\.\S+$/.test(email)) throw new ApiError("That doesn't look like an email address.", 422);
        if (db.users.some((u) => u.email.toLowerCase() === email)) throw new ApiError("Someone with that email is already on the team.", 409);
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "user";
        let id = `u_${slug}`;
        for (let n = 2; db.users.some((u) => u.id === id); n += 1) id = `u_${slug}_${n}`;
        db.users.push({ id, name, title, email, role: input.role, ...(input.role === "viewer" && input.canRaiseQuestion ? { canRaiseQuestion: true } : {}) });
        audit(db, me, "user.added", `${name} (${title}) as ${input.role}${input.canRaiseQuestion && input.role === "viewer" ? ", can raise questions" : ""}`, "warn");
        return id;
      }),
  };
});

// Mirror to localStorage. Failures (private mode, quota) are ignored: the demo keeps working in memory.
useStore.subscribe((s, prev) => {
  try {
    if (s.db !== prev.db) localStorage.setItem(DB_KEY, JSON.stringify(s.db));
    if (s.userId !== prev.userId) {
      if (s.userId) localStorage.setItem(USER_KEY, s.userId);
      else localStorage.removeItem(USER_KEY);
    }
  } catch {
    /* ignore */
  }
});

export const CONFIDENCE_ORDER: (Confidence | null)[] = [null, "signal", "pattern"];
