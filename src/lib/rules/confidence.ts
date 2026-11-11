// Confidence guardrails.
import type { Confidence, Finding } from "@/lib/types";
import type { Coverage } from "./coverage";

export interface LevelCheck {
  allowed: boolean;
  /** Why it is not allowed, or what it rests on when it is. */
  reason: string;
}

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  signal: "Signal",
  pattern: "Pattern",
};

export const CONFIDENCE_RULE: Record<Confidence, string> = {
  signal: "At least 1 participant.",
  pattern: "At least 3 distinct participants, not only paraphrase.",
};

export function confidenceChecks(c: Coverage): Record<Confidence, LevelCheck> {
  const n = c.supportingParticipants.length;

  const signal: LevelCheck =
    n >= 1
      ? { allowed: true, reason: `${n} participant${n === 1 ? "" : "s"} support this.` }
      : { allowed: false, reason: "Needs at least 1 participant with verified evidence linked as supporting." };

  let pattern: LevelCheck;
  if (n < 3) pattern = { allowed: false, reason: `Needs 3 distinct participants; ${n} so far.` };
  else if (c.nonParaphraseSupport === 0)
    pattern = { allowed: false, reason: "All supporting evidence is paraphrase. Link a direct quotation or an observation." };
  else pattern = { allowed: true, reason: `${n} participants, not only paraphrase.` };

  return { signal, pattern };
}

/** The highest level the evidence allows, or null. */
export function maxAllowed(c: Coverage): Confidence | null {
  const checks = confidenceChecks(c);
  if (checks.pattern.allowed) return "pattern";
  if (checks.signal.allowed) return "signal";
  return null;
}

export function isConfidenceValid(level: Confidence | null, c: Coverage): boolean {
  if (level === null) return true;
  return confidenceChecks(c)[level].allowed;
}

/** A finding can be marked complete only once a valid confidence is chosen and counter-evidence is checked. */
export function completionBlockers(
  finding: Pick<Finding, "counterEvidenceChecked" | "confidence">,
  c: Coverage,
): string[] {
  const out: string[] = [];
  if (finding.confidence === null) out.push("Choose a confidence level.");
  else if (!isConfidenceValid(finding.confidence, c)) out.push("The confidence level is higher than the evidence allows.");
  if (finding.counterEvidenceChecked === null) out.push("Check for counter-evidence.");
  return out;
}
