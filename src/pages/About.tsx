import { CircleSlash, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, PageHeader, SimBadge } from "@/components/app/common";

const SIMULATED = [
  ["Google sign-in (company domain)", "A role picker. The header switcher stands in for SSO."],
  ["Backend persistence", "One in-memory store, mirrored to localStorage. Every request waits 300–800 ms and can be forced to fail from Demo controls."],
  ["CRM / order export", "The candidate pool and the demo CSV are synthetic."],
  ["Google Meet and Drive links", "Links are generated and shown; nothing is opened. “Recording unavailable” can be forced."],
  ["WhatsApp and email sending", "Invites are copied to the clipboard from a template. You send them yourself, outside the app."],
  ["Other editors", "The “someone else saved this finding” conflict is triggered from Demo controls."],
];

const EXCLUDED = [
  "CRM integration (live sync with the store or marketplaces)",
  "WhatsApp / email APIs (automated sending, reminders)",
  "RFM / cohort analytics",
  "AI synthesis (auto-tagging, auto-written findings)",
];

export function About() {
  return (
    <>
      <PageHeader
        title="About this prototype"
        description="A clickable prototype for Everyday Goods to walk through the workflow and give feedback before the real build. All data is synthetic: no real customers, systems or interviews."
      />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card title={<span className="flex items-center gap-1.5"><Sparkles className="size-4 text-[color:var(--simulated)]" aria-hidden /> Simulated</span>} description={<>Marked with <SimBadge /> wherever it appears.</>}>
          <ul className="grid gap-3 text-[13px]">
            {SIMULATED.map(([t, d]) => (
              <li key={t}>
                <span className="font-medium">{t}</span>
                <span className="block text-muted-foreground">{d}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title={<span className="flex items-center gap-1.5"><CircleSlash className="size-4 text-muted-foreground" aria-hidden /> Excluded from the MVP</span>}>
          <ul className="grid gap-1.5 text-[13px]">
            {EXCLUDED.map((e) => (
              <li key={e} className="flex items-start gap-2">
                <Badge size="sm" tone="outline">Out</Badge> {e}
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Try this">
          <ol className="grid list-decimal gap-1.5 pl-4 text-[13px]">
            <li>As Ananya, open Q-1 → Findings. Link E-103 (Kannada) to “haven't run out yet”: Pattern unlocks.</li>
            <li>Switch to Sana (CEO): findings are read-only.</li>
            <li>As Kabir, start a question about shampoo and see related findings from Q-1 appear.</li>
            <li>Open Q-3 → Recruitment and filter to Marketplace for the empty state.</li>
            <li>As Ravi, import the demo CSV, then try rolling back B-001.</li>
            <li>Use Demo controls to force errors and an edit conflict.</li>
          </ol>
        </Card>
      </div>
    </>
  );
}
