// Warns when evidence text looks like it contains personal details.
export interface PiiWarning {
  kind: "email" | "phone" | "name";
  match: string;
  message: string;
}

const EMAIL = /[^\s@,;()]+@[^\s@,;()]+\.[a-z]{2,}/gi;
// 10+ digits, allowing spaces, dashes and a leading +.
const PHONE = /\+?\d[\d\s-]{8,}\d/g;

export function detectPii(text: string, knownNames: string[] = []): PiiWarning[] {
  const out: PiiWarning[] = [];
  for (const m of text.match(EMAIL) ?? []) {
    out.push({ kind: "email", match: m, message: `Looks like an email address (${m}). Remove it.` });
  }
  for (const m of text.match(PHONE) ?? []) {
    if (m.replace(/\D/g, "").length >= 10) {
      out.push({ kind: "phone", match: m.trim(), message: `Looks like a phone number (${m.trim()}). Remove it.` });
    }
  }
  const seen = new Set<string>();
  for (const full of knownNames) {
    for (const part of full.split(/\s+/)) {
      if (part.length < 3 || seen.has(part.toLowerCase())) continue;
      if (new RegExp(`\\b${part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text)) {
        seen.add(part.toLowerCase());
        out.push({ kind: "name", match: part, message: `Looks like a name ("${part}"). Write "the customer" instead.` });
      }
    }
  }
  return out;
}
