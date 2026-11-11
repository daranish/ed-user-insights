// Domain model for the ED User Insights prototype.
// Question → Recruitment → Session → Evidence → Finding → Action.

export type Role = "owner" | "admin" | "viewer";

export interface User {
  id: string;
  name: string;
  title: string; // "Growth lead"
  email: string;
  role: Role;
  /** Viewers who may still raise a question (the CX lead). */
  canRaiseQuestion?: boolean;
  /** Leadership reader: Home is the executive brief. */
  executive?: boolean;
}

/** "frequent buyer": reorders within 30 days of the previous order (a Growth-owned threshold, not yet signed off). */
export type Segment = "first-time" | "one-time lapsed" | "repeat" | "frequent buyer";
export const SEGMENTS: Segment[] = ["first-time", "one-time lapsed", "repeat", "frequent buyer"];

export type Channel = "own-site" | "marketplace";
export const CHANNELS: Channel[] = ["own-site", "marketplace"];

export type RecruitmentSource = "export" | "qr-opt-in";

export interface Participant {
  code: string; // P-014, pseudonymous
  /** Internal customer reference from the export. Used for duplicate matching, never shown as identity. */
  customerRef: string;
  segment: Segment;
  channel: Channel;
  productContext: { sku: string; firstOrderDate?: string; lastOrderDate: string };
  recruitmentSource: RecruitmentSource;
  importBatchId?: string;
}

/** Kept apart from Participant. Never rendered unless revealed through the audited dialog. */
export interface ParticipantContact {
  participantCode: string;
  name: string;
  email: string;
  phone: string;
}

export type QuestionStatus = "proposed" | "active" | "closed";

export interface Question {
  id: string;
  text: string;
  /** Optional: a question can be raised before the decision or the starting belief is known. */
  decisionItInforms?: string;
  currentAssumption?: string;
  /** Optional: when absent, every segment is in the candidate pool. */
  targetSegments?: Segment[];
  /** Narrows the candidate pool to buyers of this product line. */
  productFocus?: string;
  ownerId: string;
  status: QuestionStatus;
  createdAt: string;
  /** Who raised it, when not the owner (the CX lead can raise questions). */
  raisedById?: string;
  /** Set when the owner archives the question: read-only and out of the lists, but nothing is deleted. */
  archivedAt?: string;
  archivedById?: string;
  /** Existing findings this question chose to build on: the reuse moment. */
  reusedFindingIds: string[];
}

/**
 * considered -> invite-requested (owner asks) -> invited (Ops approve; WhatsApp sent) ->
 * accepted (customer books a time) | declined -> done | no-show (unlocked 30 min after the meeting).
 */
export type RecruitmentStatus = "considered" | "invite-requested" | "invited" | "accepted" | "declined" | "no-show" | "done";
export const RECRUITMENT_STATUSES: RecruitmentStatus[] = ["considered", "invite-requested", "invited", "accepted", "declined", "no-show", "done"];

export type CouponStatus = "n/a" | "offered" | "sent" | "redeemed";

export interface Recruitment {
  questionId: string;
  participantCode: string;
  status: RecruitmentStatus;
  declineReason?: string;
  /** Owner asked Ops for permission to contact. */
  inviteRequestedAt?: string;
  inviteRequestedById?: string;
  /** Ops decision. A rejection sends the person back to "considered" with the reason. */
  inviteDecidedAt?: string;
  inviteDecidedById?: string;
  inviteDeniedReason?: string;
  /** SIMULATED WhatsApp message sent on approval. */
  invitedAt?: string;
  inviteMessage?: string;
  /** When the customer booked the call (ISO). */
  scheduledAt?: string;
  /** SIMULATED Google Meet link for the call, created when the customer books. */
  meetLink?: string;
  /** Given by the customer in their WhatsApp reply when they book. */
  consentRecord?: boolean;
  consentQuote?: boolean;
  couponStatus: CouponStatus;
}

export interface Session {
  id: string;
  questionId: string;
  participantCode: string;
  date: string; // YYYY-MM-DD
  conductorId: string;
  recordingRef?: string; // SIMULATED Drive link
  languageSpoken: string;
}

export type CaptureType = "direct-quotation" | "paraphrase" | "observation";
export const CAPTURE_TYPES: CaptureType[] = ["direct-quotation", "paraphrase", "observation"];

export interface EvidenceRevision {
  at: string;
  byId: string;
  previousTextEn: string;
}

export interface Evidence {
  id: string;
  questionId: string;
  sessionId: string | null;
  textEn: string;
  textOriginal?: string;
  originalLanguage?: string;
  captureType: CaptureType;
  tags: string[];
  revisions: EvidenceRevision[];
  createdAt: string;
  createdById: string;
}

export type Confidence = "signal" | "pattern";
export const CONFIDENCES: Confidence[] = ["signal", "pattern"];

export type Stance = "supports" | "contradicts" | "context";

export interface FindingLink {
  evidenceId: string;
  stance: Stance;
}

export interface Finding {
  id: string;
  questionId: string;
  claim: string;
  /** Null when no level is justified yet (e.g. no evidence linked). */
  confidence: Confidence | null;
  counterEvidenceChecked: "linked" | "none-found" | null;
  version: number;
  links: FindingLink[];
  /** What this finding does NOT tell us. */
  limitations: string;
  /** How the finding bears on the question's current assumption. */
  assumptionVerdict: "supports" | "contradicts" | "not-addressed";
  status: "draft" | "complete";
  /** Set when linked evidence is edited after the finding was written. */
  evidenceChanged?: boolean;
  /** Set when linked evidence was erased after a consent withdrawal. */
  needsReReview?: boolean;
  updatedAt: string;
  updatedById: string;
}

export type ActionType = "decision" | "experiment" | "more-research" | "no-action";
export const ACTION_TYPES: ActionType[] = ["decision", "experiment", "more-research", "no-action"];
export type ActionStatus = "open" | "in-progress" | "done";

/** One line of an action's progress log. "created" is the first entry; later ones are updates by whoever owns the action. */
export interface ActionLogEntry {
  id: string;
  kind: "created" | "update" | "edited";
  at: string; // ISO
  byId: string;
  /** The status the action moved to, when this update changed it. */
  status?: ActionStatus;
  note?: string;
}

export interface Action {
  id: string;
  questionId: string;
  /** The findings that back this action. At least one. */
  findingIds: string[];
  type: ActionType;
  description: string;
  /** Required for no-action. */
  reason?: string;
  /** Who created the action. Only they can edit or delete it. */
  ownerId: string;
  /** Who has to do it. Only they can change the status and comment. May be the owner. */
  assigneeId: string;
  dueDate: string; // YYYY-MM-DD
  outcomeNote?: string;
  status: ActionStatus;
  createdAt: string;
  /** Progress log, oldest first. Older saved actions may not have one; see actionLog(). */
  log?: ActionLogEntry[];
}

export interface ImportBatch {
  id: string;
  at: string;
  byId: string;
  fileName: string;
  rowsTotal: number;
  rowsImported: number;
  rowsFailed: number;
  duplicates: number;
  rejectedColumns: string[];
  participantCodes: string[];
  status: "committed" | "rolled-back";
}

export interface AuditLogEntry {
  id: string;
  at: string;
  actorId: string;
  action: string; // "contact.revealed"
  target: string;
  level: "info" | "warn" | "error";
}

export interface Db {
  users: User[];
  questions: Question[];
  participants: Participant[];
  contacts: ParticipantContact[];
  recruitments: Recruitment[];
  sessions: Session[];
  evidence: Evidence[];
  findings: Finding[];
  actions: Action[];
  importBatches: ImportBatch[];
  audit: AuditLogEntry[];
}
