// The demo runs on a fixed "today" so overdue items and dates stay stable for every reviewer.
export const TODAY = "2026-11-12";

export function nowIso(): string {
  // Fixed date, real clock time: keeps audit entries ordered within a demo.
  const t = new Date();
  const hh = String(t.getHours()).padStart(2, "0");
  const mm = String(t.getMinutes()).padStart(2, "0");
  const ss = String(t.getSeconds()).padStart(2, "0");
  return `${TODAY}T${hh}:${mm}:${ss}+05:30`;
}

const DATE = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const DATETIME = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function fmtDate(isoOrDay: string): string {
  return DATE.format(new Date(isoOrDay.length === 10 ? `${isoOrDay}T12:00:00` : isoOrDay));
}

export function fmtDateTime(iso: string): string {
  return DATETIME.format(new Date(iso));
}

export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b.slice(0, 10)).getTime() - new Date(a.slice(0, 10)).getTime()) / 86_400_000);
}

export function toDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** The simulated clock in ms: the fixed demo day with the real time of day, plus whatever the Demo controls fast-forwarded. */
export function simNowMs(shiftMin = 0): number {
  return new Date(nowIso()).getTime() + shiftMin * 60_000;
}

/** "2026-11-12T09:00:00+05:30" from a ms timestamp. */
export function toIstIso(ms: number): string {
  const d = new Date(ms + 330 * 60_000);
  return d.toISOString().slice(0, 16) + ":00+05:30";
}
