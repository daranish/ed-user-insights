import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Lightbulb } from "lucide-react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { State } from "@/components/ui/state";
import { toast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import { useLoad, useMe, useMutation } from "@/lib/hooks";
import { SEGMENTS, type Segment } from "@/lib/types";
import { canCreateQuestion } from "@/lib/permissions";
import { relatedFindings } from "@/lib/rules/search";
import { Card, ConfidenceBadge, Loaded, PageHeader } from "@/components/app/common";

const PRODUCTS = ["Shampoo", "Body wash", "Moisturiser"];

function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function NewQuestion() {
  const load = useLoad("new-question");
  const me = useMe();
  const db = useStore((s) => s.db);
  const createQuestion = useStore((s) => s.createQuestion);
  const navigate = useNavigate();
  const allowed = canCreateQuestion(me);
  const isOwner = me.role === "owner";

  const [text, setText] = React.useState("");
  const [decision, setDecision] = React.useState("");
  const [assumption, setAssumption] = React.useState("");
  const [segments, setSegments] = React.useState<string[]>([]);
  const [product, setProduct] = React.useState<string>("any");
  const [ownerId, setOwnerId] = React.useState<string>("");
  const [reuse, setReuse] = React.useState<string[]>([]);
  const [submitted, setSubmitted] = React.useState(false);
  const mutation = useMutation(createQuestion);

  const draft = useDebounced(`${text} ${decision} ${assumption}`);
  const related = React.useMemo(() => relatedFindings(draft, db), [draft, db]);

  const errors = {
    text: !text.trim() ? "Write the question." : text.trim().length < 12 ? "Make the question specific enough to act on." : undefined,
    owner: !isOwner && !ownerId ? "Pick the lead who should own this question." : undefined,
  };
  const valid = !Object.values(errors).some(Boolean);
  const show = (k: keyof typeof errors) => (submitted ? errors[k] : undefined);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!valid) return;
    const { value: id } = await mutation.run({
      text: text.trim(),
      decisionItInforms: decision.trim() || undefined,
      currentAssumption: assumption.trim() || undefined,
      targetSegments: segments.length ? (segments as Segment[]) : undefined,
      productFocus: product === "any" ? undefined : product,
      reusedFindingIds: reuse,
      ownerId: isOwner ? me.id : ownerId,
    });
    if (id) {
      toast.success(isOwner ? `Question ${id} created` : `Question ${id} raised`, {
        description: isOwner ? "Next: recruit participants." : "The owner will see it as a proposed question.",
      });
      navigate(`/questions/${id}/overview`);
    }
  }

  if (!allowed.ok) {
    return (
      <>
        <PageHeader title="New question" />
        <State kind="empty" scene="locked" title="You can't raise questions" description={allowed.reason} framed />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={isOwner ? "New question" : "Raise a question"}
        description={isOwner ? "Frame the question around a decision. Related findings appear as you type: check whether the company already learned this." : "Flag a recurring theme as a candidate question. A question owner takes it from here."}
      />
      <Loaded load={load}>
        {() => (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
            <form onSubmit={submit} noValidate className="grid content-start gap-5 rounded-[14px] bg-card p-5 ring-1 ring-border">
              <Field label="Question" required error={show("text")} hint="One question, in plain words.">
                <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Why do one-time body wash buyers not return?" />
              </Field>
              <Field label="Decision it informs" optional hint="Name it if you can. A question tied to a decision is more likely to change something.">
                <Textarea value={decision} onChange={(e) => setDecision(e.target.value)} rows={2} placeholder="Whether to …" />
              </Field>
              <Field label="Current assumption" optional hint="Recorded as an assumption to test, not a fact.">
                <Textarea value={assumption} onChange={(e) => setAssumption(e.target.value)} rows={2} placeholder="We think it's because …" />
              </Field>
              <fieldset className="grid gap-2">
                <legend className="text-[13px] font-medium">
                  Target User Segment <span className="font-normal text-muted-foreground">(optional)</span>
                </legend>
                <p className="text-[12px] text-muted-foreground">Tick the kinds of buyers you want to hear from. Recruitment will show only these. Tick none to see everyone.</p>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {SEGMENTS.map((x) => (
                    <Field inline key={x} label={x}>
                      <Checkbox checked={segments.includes(x)} onCheckedChange={(v) => setSegments((cur) => (v ? [...cur, x] : cur.filter((y) => y !== x)))} />
                    </Field>
                  ))}
                </div>
              </fieldset>
              <Field label="Target Product" optional hint="Recruitment will show only buyers of this product line. Leave as Any product to see all.">
                <Select value={product} onValueChange={setProduct}>
                  <SelectItem value="any">Any product</SelectItem>
                  {PRODUCTS.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </Select>
              </Field>
              {!isOwner && (
                <Field label="Suggested owner" required error={show("owner")}>
                  <Select value={ownerId} onValueChange={setOwnerId} placeholder="Choose a lead">
                    {db.users.filter((u) => u.role === "owner").map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name} · {u.title}</SelectItem>
                    ))}
                  </Select>
                </Field>
              )}
              {mutation.error && <Alert tone="destructive" title="Not saved">{mutation.error}</Alert>}
              {submitted && !valid && <Alert tone="warning" size="sm">Fix the highlighted fields to continue.</Alert>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
                <Button type="submit" loading={mutation.busy}>{isOwner ? "Create question" : "Raise question"}</Button>
              </div>
            </form>

            <Card
              title={
                <span className="flex items-center gap-1.5">
                  <Lightbulb className="size-4 text-primary" aria-hidden /> Related existing findings
                </span>
              }
              description="Did we already learn this? Build on what exists instead of starting again."
              className="content-start self-start lg:sticky lg:top-0"
            >
              {draft.trim().length < 4 ? (
                <p className="text-[13px] text-muted-foreground">Start typing the question and matches from every team's findings appear here.</p>
              ) : related.length === 0 ? (
                <State size="sm" scene="search" title="Nothing related yet" description="No existing finding shares these words. This looks new." />
              ) : (
                <ul className="grid gap-3" aria-live="polite">
                  {related.map((h) => {
                    const f = db.findings.find((x) => x.id === h.id)!;
                    return (
                      <li key={h.id} className="grid gap-2 rounded-[10px] p-3 ring-1 ring-border">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[13px] font-medium">{f.claim}</span>
                          <ConfidenceBadge level={f.confidence} />
                        </div>
                        <div className="text-[12px] text-muted-foreground">
                          {h.questionId}: {h.questionText} · n = {h.n}
                        </div>
                        <Field inline label="Build on this finding">
                          <Checkbox checked={reuse.includes(f.id)} onCheckedChange={(v) => setReuse((cur) => (v ? [...cur, f.id] : cur.filter((x) => x !== f.id)))} />
                        </Field>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>
        )}
      </Loaded>
    </>
  );
}
