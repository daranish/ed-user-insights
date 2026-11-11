// What each role may do, with a short reason when it may not.
import type { Action, Question, Recruitment, Role, User } from "./types";

export interface Check {
  ok: boolean;
  reason?: string;
}

const yes: Check = { ok: true };
const no = (reason: string): Check => ({ ok: false, reason });

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Question owner",
  admin: "Admin / data steward",
  viewer: "Viewer",
};

/** Leadership readers (the CEO) get the executive brief as their Home. */
export function isExecutive(u: User): boolean {
  return u.role === "viewer" && !!u.executive;
}

export function canCreateQuestion(u: User): Check {
  if (u.role === "owner") return yes;
  if (u.canRaiseQuestion) return yes;
  return no(u.role === "admin" ? "Admins manage data; question owners raise questions." : "Viewers can read findings but not raise questions.");
}

export function canEditQuestion(u: User, q: Question, ownerName?: string): Check {
  if (u.role !== "owner") return no(`${ROLE_LABEL[u.role]}s have read-only access to question work.`);
  if (q.ownerId !== u.id) return no(`Only the question owner${ownerName ? ` (${ownerName})` : ""} can change this question.`);
  if (q.archivedAt) return no("This question is archived. Restore it to make changes.");
  return yes;
}

/** Questions are archived, never deleted. Only the question's owner archives or restores it. */
export function canArchiveQuestion(u: User, q: Question, ownerName?: string): Check {
  if (u.role === "owner" && q.ownerId === u.id) return yes;
  return no(`Only the question owner${ownerName ? ` (${ownerName})` : ""} can archive or restore it.`);
}

export function canRevealContact(u: User, q: Question, r: Recruitment | undefined): Check {
  if (u.role !== "owner" || q.ownerId !== u.id) return no("Only the question owner can reveal contact details.");
  if (!r || (r.status !== "invited" && r.status !== "accepted")) return no("Contacts can be revealed only for invited or accepted participants.");
  return yes;
}

/** Anyone signed in can create an action in a question and assign it to anyone. */
export function canCreateAction(): Check {
  return yes;
}

/** The creator edits the action's details and deletes it. */
export function canEditAction(u: User, a: Action, ownerName?: string): Check {
  if (a.ownerId === u.id) return yes;
  return no(`Only the person who created this action${ownerName ? ` (${ownerName})` : ""} can edit or delete it.`);
}

/** The assignee moves the status and adds comments, and nothing else. */
export function canUpdateAction(u: User, a: Action, assigneeName?: string): Check {
  if (a.assigneeId === u.id) return yes;
  return no(`Only the person it's assigned to${assigneeName ? ` (${assigneeName})` : ""} can change the status or add comments.`);
}

export function canAdmin(u: User): Check {
  return u.role === "admin" ? yes : no("Only the admin / data steward can use this.");
}
