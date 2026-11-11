"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, CheckCheck, Command, TriangleAlert, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const SQUIRCLE = "[corner-shape:squircle]";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const SOFT = { type: "spring", stiffness: 300, damping: 30 } as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["figure", "title", "body", "sub", "dense", "meta", "chip", "micro"] }],
      shadow: [{ shadow: ["float", "overlay"] }],
    },
  },
});

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface Change {
  id: string;
  /** The original phrase. Empty for a pure insertion. */
  from: string;
  /** The suggested phrase. Empty for a pure deletion. */
  to: string;
  /** Why, in a few words: "tighter", "fixes tense". */
  reason?: string;
  /** What you typed over this phrase since the suggestion was made. Accepting it asks first. */
  yours?: string;
}

export type Decision = "pending" | "accepted" | "rejected";

export interface InlineDiffResult {
  text: string;
  accepted: string[];
  rejected: string[];
}

export interface InlineDiffProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** The text the suggestion was made against. */
  original: string;
  /** The suggested text. Diffed against `original` by word and grouped into phrases. */
  suggested?: string;
  /** Or the changes, already worked out. Each `from` is found in `original`, in order. */
  changes?: Change[];
  /** Reasons by change id, for computed changes. */
  reasons?: Record<string, string>;
  /** The resulting text, after every decision. */
  onChange?: (text: string) => void;
  /** When nothing is left to decide. */
  onDone?: (result: InlineDiffResult) => void;
  /** Decisions already made, by change id (for a saved review). */
  defaultDecisions?: Record<string, Decision>;
  /** Show the diff without actions. */
  readOnly?: boolean;
  /** Default "Suggested edits". */
  title?: string;
}

type Seg = { kind: "text"; text: string } | ({ kind: "change" } & Change);

const tokens = (s: string) => s.match(/\s+|[^\s]+/g) ?? [];

export function diffPhrases(a: string, b: string): Seg[] {
  const A = tokens(a);
  const B = tokens(b);
  const n = A.length;
  const m = B.length;
  const L: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);

  type Op = { eq: boolean; from: string; to: string };
  const ops: Op[] = [];
  const push = (eq: boolean, from: string, to: string) => {
    const last = ops[ops.length - 1];
    if (last && last.eq === eq) {
      last.from += from;
      last.to += to;
    } else ops.push({ eq, from, to });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) push(true, A[i], B[j]), i++, j++;
    else if (L[i + 1][j] >= L[i][j + 1]) push(false, A[i++], "");
    else push(false, "", B[j++]);
  }
  while (i < n) push(false, A[i++], "");
  while (j < m) push(false, "", B[j++]);

  const small = (s: string) => {
    const words = s.trim().split(/\s+/).filter(Boolean);
    return words.length === 0 || (words.length === 1 && words[0].length <= 3);
  };
  let merged = true;
  while (merged) {
    merged = false;
    for (let k = 1; k < ops.length - 1; k++) {
      if (ops[k].eq && !ops[k - 1].eq && !ops[k + 1].eq && small(ops[k].from)) {
        ops.splice(k - 1, 3, { eq: false, from: ops[k - 1].from + ops[k].from + ops[k + 1].from, to: ops[k - 1].to + ops[k].to + ops[k + 1].to });
        merged = true;
        break;
      }
    }
  }

  const out: Seg[] = [];
  let id = 0;
  for (const op of ops) {
    if (op.eq) {
      out.push({ kind: "text", text: op.from });
      continue;
    }
    const lead = Math.min(op.from.match(/^\s*/)![0].length, op.to.match(/^\s*/)![0].length);
    const tail = Math.min(op.from.match(/\s*$/)![0].length, op.to.match(/\s*$/)![0].length);
    const pre = op.from.slice(0, lead);
    const post = tail ? op.from.slice(op.from.length - tail) : "";
    if (pre) out.push({ kind: "text", text: pre });
    out.push({ kind: "change", id: `c${++id}`, from: op.from.slice(lead, op.from.length - tail), to: op.to.slice(lead, op.to.length - tail) });
    if (post) out.push({ kind: "text", text: post });
  }
  return out;
}

function placeChanges(original: string, changes: Change[]): Seg[] {
  const out: Seg[] = [];
  let at = 0;
  for (const c of changes) {
    const i = c.from ? original.indexOf(c.from, at) : at;
    if (i < 0) continue;
    if (i > at) out.push({ kind: "text", text: original.slice(at, i) });
    out.push({ kind: "change", ...c });
    at = i + c.from.length;
  }
  if (at < original.length) out.push({ kind: "text", text: original.slice(at) });
  return out;
}

function Settled({ how, animate, children }: { how: Decision; animate: boolean; children: React.ReactNode }) {
  const [fresh, setFresh] = React.useState(animate);
  React.useEffect(() => {
    if (!fresh) return;
    const t = setTimeout(() => setFresh(false), 60);
    return () => clearTimeout(t);
  }, [fresh]);
  return (
    <span
      className={cn(
        "rounded-[3px] transition-[background-color,opacity] ease-out",
        how === "accepted" ? "duration-[900ms]" : "duration-300",
        fresh && (how === "accepted" ? "bg-success/25" : "opacity-40"),
      )}
    >
      {children}
    </span>
  );
}

function Key({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <kbd
      aria-label={label}
      className={cn(
        "inline-grid h-[18px] min-w-[18px] place-items-center rounded-[5px] bg-card px-1 font-sans text-[10.5px] font-medium text-foreground/80",
        "shadow-[inset_0_-1px_0_var(--border)] ring-1 ring-border",
        SQUIRCLE,
      )}
    >
      {children}
    </kbd>
  );
}

function useIsMac() {
  const [mac, setMac] = React.useState(true);
  React.useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)), []);
  return mac;
}

export const InlineDiff = React.forwardRef<HTMLDivElement, InlineDiffProps>(function InlineDiff(
  { original, suggested, changes, reasons, defaultDecisions, onChange, onDone, readOnly = false, title = "Suggested edits", className, ...rest },
  ref,
) {
  const reduce = useReducedMotion();
  const mac = useIsMac();
  const segs = React.useMemo(() => {
    const s = changes ? placeChanges(original, changes) : diffPhrases(original, suggested ?? original);
    return s.map((x) => (x.kind === "change" && reasons?.[x.id] && !x.reason ? { ...x, reason: reasons[x.id] } : x));
  }, [original, suggested, changes, reasons]);
  const list = segs.filter((s): s is Seg & { kind: "change" } => s.kind === "change");

  const [decided, setDecided] = React.useState<Record<string, Decision>>(defaultDecisions ?? {});
  const [history, setHistory] = React.useState<Array<Record<string, Decision>>>([]);
  const [active, setActive] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState<string | null>(null);
  const [flash, setFlash] = React.useState<Record<string, number>>({});
  const box = React.useRef<HTMLDivElement>(null);
  const els = React.useRef<Record<string, HTMLElement | null>>({});
  React.useImperativeHandle(ref, () => box.current as HTMLDivElement);

  const state = (id: string): Decision => decided[id] ?? "pending";
  const pending = list.filter((c) => state(c.id) === "pending");
  const accepted = list.filter((c) => state(c.id) === "accepted").length;
  const rejected = list.filter((c) => state(c.id) === "rejected").length;

  const textOf = (d: Record<string, Decision>) =>
    segs.map((s) => (s.kind === "text" ? s.text : (d[s.id] ?? "pending") === "accepted" ? s.to : s.yours ?? s.from)).join("");

  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const text = textOf(decided);
    onChange?.(text);
    if (list.length && list.every((c) => (decided[c.id] ?? "pending") !== "pending"))
      onDone?.({ text, accepted: list.filter((c) => decided[c.id] === "accepted").map((c) => c.id), rejected: list.filter((c) => decided[c.id] === "rejected").map((c) => c.id) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decided]);

  const commit = (next: Record<string, Decision>, ids: string[]) => {
    setHistory((h) => [...h, decided]);
    setDecided(next);
    const now = Date.now();
    setFlash((f) => ({ ...f, ...Object.fromEntries(ids.map((id) => [id, now])) }));
    setConfirm(null);
  };

  const nextPending = (after: string, d: Record<string, Decision>) => {
    const i = list.findIndex((c) => c.id === after);
    const order = [...list.slice(i + 1), ...list.slice(0, i)];
    return order.find((c) => (d[c.id] ?? "pending") === "pending")?.id ?? null;
  };

  const decide = (id: string, how: "accepted" | "rejected", force = false) => {
    if (readOnly || state(id) !== "pending") return;
    const c = list.find((x) => x.id === id);
    if (how === "accepted" && c?.yours != null && !force) {
      setConfirm(id);
      return;
    }
    const next = { ...decided, [id]: how };
    commit(next, [id]);
    const go = nextPending(id, next);
    setActive(go);
    requestAnimationFrame(() => (go ? els.current[go]?.focus({ preventScroll: false }) : box.current?.focus()));
  };

  const all = (how: "accepted" | "rejected") => {
    const ids = pending.filter((c) => how === "rejected" || c.yours == null).map((c) => c.id);
    if (!ids.length) return;
    commit({ ...decided, ...Object.fromEntries(ids.map((id) => [id, how])) }, ids);
    setActive(null);
  };

  const undo = () => {
    if (!history.length) return;
    const prev = history[history.length - 1];
    const changed = list.find((c) => (prev[c.id] ?? "pending") !== state(c.id));
    setHistory((h) => h.slice(0, -1));
    setDecided(prev);
    setConfirm(null);
    if (changed) {
      setActive(changed.id);
      requestAnimationFrame(() => els.current[changed.id]?.focus());
    }
  };

  const move = (dir: 1 | -1) => {
    const open = pending.length ? pending : list;
    if (!open.length) return;
    const i = open.findIndex((c) => c.id === active);
    const n = open[(i + dir + open.length) % open.length] ?? open[0];
    setActive(n.id);
    els.current[n.id]?.focus();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      undo();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === "j") (e.preventDefault(), move(1));
    else if (k === "k") (e.preventDefault(), move(-1));
    else if (active && k === "a" && !readOnly) (e.preventDefault(), decide(active, "accepted"));
    else if (active && k === "r" && !readOnly) (e.preventDefault(), decide(active, "rejected"));
    else if (k === "escape") (setActive(null), setConfirm(null));
  };

  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);
  React.useLayoutEffect(() => {
    if (!active || readOnly || state(active) !== "pending") return setPos(null);
    const el = els.current[active];
    const host = box.current;
    if (!el || !host) return setPos(null);
    const place = () => {
      const r = el.getClientRects()[0] ?? el.getBoundingClientRect();
      const h = host.getBoundingClientRect();
      const width = 248;
      setPos({ top: r.bottom - h.top + 6, left: Math.max(8, Math.min(r.left - h.left, h.width - width - 8)) });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, decided, readOnly]);

  const activeChange = list.find((c) => c.id === active);

  return (
    <div
      ref={box}
      tabIndex={-1}
      onKeyDown={onKey}
      className={cn("relative w-full rounded-[18px] border border-border bg-card text-card-foreground outline-none", SQUIRCLE, className)}
      {...rest}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="text-body font-semibold">{title}</div>
          <div className="text-meta text-muted-foreground" aria-live="polite">
            {list.length === 0 ? (
              "No changes suggested"
            ) : (
              <>
                {list.length} suggestion{list.length === 1 ? "" : "s"}
                {accepted > 0 && <span className="text-success"> · {accepted} accepted</span>}
                {rejected > 0 && <span> · {rejected} rejected</span>}
                {pending.length === 0 && <span> · all decided</span>}
              </>
            )}
          </div>
        </div>
        {!readOnly && list.length > 0 && (
          <div className="flex items-center gap-1.5">
            {history.length > 0 && (
              <Button size="sm" variant="ghost" onClick={undo} aria-label="Undo the last decision" className="motion-safe:animate-fade-in">
                <Undo2 />
                Undo
              </Button>
            )}
            {pending.length > 0 && (
              <>
                <Button size="sm" variant="outline" onClick={() => all("rejected")}>
                  Reject all
                </Button>
                <Button size="sm" onClick={() => all("accepted")} disabled={!pending.some((c) => c.yours == null)}>
                  <CheckCheck />
                  Accept all
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="px-4 py-3.5 text-body leading-[1.85] break-words whitespace-pre-wrap">
        {segs.map((s, i) => {
          if (s.kind === "text") return <React.Fragment key={i}>{s.text}</React.Fragment>;
          const d = state(s.id);
          if (d !== "pending") {
            const settled = d === "accepted" ? s.to : s.yours ?? s.from;
            return (
              <Settled key={`${s.id}-${d}-${flash[s.id] ?? 0}`} how={d} animate={!reduce && flash[s.id] != null}>
                {settled}
              </Settled>
            );
          }
          const on = active === s.id;
          const conflict = s.yours != null;
          return (
            <span
              key={s.id}
              ref={(el) => {
                els.current[s.id] = el;
              }}
              role={readOnly ? undefined : "button"}
              tabIndex={readOnly ? -1 : 0}
              aria-label={`Change ${s.from ? `“${s.from}”` : "(insert)"} to ${s.to ? `“${s.to}”` : "(delete)"}${s.reason ? `, ${s.reason}` : ""}${conflict ? ", overlaps your edit" : ""}`}
              aria-expanded={readOnly ? undefined : on}
              title={readOnly ? s.reason : undefined}
              onFocus={() => setActive(s.id)}
              onClick={() => setActive(s.id)}
              className={cn(
                "rounded-[4px] px-px py-0.5 transition-colors [box-decoration-break:clone]",
                !readOnly && "cursor-pointer",
                on ? "bg-muted ring-2 ring-ring" : "hover:bg-muted",
                conflict && !on && "ring-1 ring-warning/60",
                "outline-none",
              )}
            >
              {(conflict ? s.yours : s.from) && (
                <del className="bg-destructive-soft text-destructive decoration-destructive/60">{conflict ? s.yours : s.from}</del>
              )}
              {s.to && (
                <ins className="ml-[3px] bg-success-soft text-success no-underline decoration-success/70 underline-offset-[3px] [text-decoration-line:underline]">{s.to}</ins>
              )}
            </span>
          );
        })}
      </div>

      {list.length > 0 && !readOnly && (
        <div className="border-t border-border px-4 py-2 text-meta text-muted-foreground">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <Key>J</Key>
              <Key>K</Key>
              move
            </span>
            <span className="inline-flex items-center gap-1">
              <Key>A</Key>
              accept
            </span>
            <span className="inline-flex items-center gap-1">
              <Key>R</Key>
              reject
            </span>
            <span className="inline-flex items-center gap-1">
              <Key label={mac ? "Command" : "Control"}>{mac ? <Command className="size-2.5" /> : "Ctrl"}</Key>
              <Key>Z</Key>
              undo
            </span>
          </span>
        </div>
      )}

      <AnimatePresence>
        {pos && activeChange && (
          <motion.div
            key={activeChange.id}
            role="dialog"
            aria-label="Decide this change"
            initial={reduce ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={SOFT}
            style={{ top: pos.top, left: pos.left }}
            onMouseDown={(e) => e.preventDefault()}
            className={cn("absolute z-20 w-[248px] rounded-[12px] border border-border bg-card p-2 shadow-lg", SQUIRCLE)}
          >
            {confirm === activeChange.id ? (
              <div className="space-y-2 p-1">
                <div className="flex items-start gap-2 text-sub">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
                  <span>
                    You changed this to “{activeChange.yours}”. Replace your edit with “{activeChange.to || "nothing"}”?
                  </span>
                </div>
                <div className="flex justify-end gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => decide(activeChange.id, "rejected")}>
                    Keep mine
                  </Button>
                  <Button size="sm" onClick={() => decide(activeChange.id, "accepted", true)}>
                    Replace
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {(activeChange.reason || activeChange.yours != null) && (
                  <div className="px-1.5 pt-0.5 pb-1.5 text-meta text-muted-foreground">
                    {activeChange.yours != null ? <span className="text-warning">Overlaps your edit</span> : null}
                    {activeChange.yours != null && activeChange.reason ? " · " : null}
                    {activeChange.reason}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => decide(activeChange.id, "rejected")}>
                    <X />
                    Reject
                    <kbd className="ml-auto font-mono text-[11px] text-muted-foreground">R</kbd>
                  </Button>
                  <Button size="sm" onClick={() => decide(activeChange.id, "accepted")}>
                    <Check />
                    Accept
                    <kbd className="ml-auto font-mono text-[11px] opacity-70">A</kbd>
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default InlineDiff;
