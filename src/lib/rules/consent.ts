// How evidence text is shown. Consent to record and quote is collected when a customer is invited to the call,
// so it is not part of this prototype's data model: evidence is always shown in full.
import type { CaptureType, Evidence } from "@/lib/types";

export interface EvidenceDisplay {
  /** English text to show. */
  text: string;
  /** Original-language text, when it was captured. */
  original: string | null;
  /** Render as a quotation (a direct quotation). */
  asQuote: boolean;
}

export const CAPTURE_LABEL: Record<CaptureType, string> = {
  "direct-quotation": "Direct quotation",
  paraphrase: "Paraphrase",
  observation: "Observation",
};

export function displayEvidence(
  ev: Pick<Evidence, "textEn" | "textOriginal" | "captureType">,
): EvidenceDisplay {
  return {
    text: ev.textEn,
    original: ev.textOriginal ?? null,
    asQuote: ev.captureType === "direct-quotation",
  };
}
