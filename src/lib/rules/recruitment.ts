// Pipeline rules: when a meeting can be closed out, and the (simulated) WhatsApp invite text.
import type { Participant, Question, Recruitment } from "../types";

/** A booked call runs 30 minutes; Done / No-show unlock once it has ended. */
export const MEETING_MINUTES = 30;

export function meetingEndsAt(scheduledAt: string): number {
  return new Date(scheduledAt).getTime() + MEETING_MINUTES * 60_000;
}

/** `nowMs` is the simulated clock, so the Demo controls can fast-forward it. */
export function canCloseMeeting(rec: Pick<Recruitment, "status" | "scheduledAt">, nowMs: number): boolean {
  return rec.status === "accepted" && !!rec.scheduledAt && nowMs >= meetingEndsAt(rec.scheduledAt);
}

/** Sent automatically when Ops approve the invite. Always names the SKU the customer bought. */
export function inviteMessage(p: Participant, _q: Question, ownerName: string): string {
  return `Hi {first name}, this is ${ownerName} from Everyday Goods. You bought our ${p.productContext.sku} recently, and we'd love 20 minutes of your time on a call to hear how it's going. Reply here to give your consent and pick a date and time that suits you. If you'd rather not, just say so and we won't ask again.`;
}

/** Sessions the owner still has to write evidence for (the call is done, nothing captured yet). */
export function sessionsAwaitingEvidence<S extends { id: string }>(sessions: S[], evidence: { sessionId: string | null }[]): S[] {
  return sessions.filter((s) => !evidence.some((e) => e.sessionId === s.id));
}
