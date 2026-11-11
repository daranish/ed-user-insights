"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Bot, CircleDashed, FileText, Quote, ShieldCheck, ShieldX, StickyNote, TriangleAlert, UserCheck } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { State } from "@/components/ui/state";
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const SQUIRCLE = "[corner-shape:squircle]";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const SOFT = { type: "spring", stiffness: 300, damping: 30 } as const;

const FOLD = { duration: 0.22, ease: [0.22, 1, 0.36, 1] } as const;

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

export type EvidenceRelation = "supports" | "contradicts" | "contextualizes";
export type EvidenceStatus = "unreviewed" | "supported" | "conflicting" | "unsupported";

export interface EvidenceNode {
  id: string;
  kind: "claim" | "source" | "note";
  title: string;
  description?: string;
  /** For claims: where review stands. */
  status?: EvidenceStatus;
  sourceUrl?: string;
  /** For sources: "Contract", "Ticket", "Web page". */
  sourceType?: string;
}

export interface EvidenceEdge {
  id: string;
  /** The claim. */
  source: string;
  /** The source or note. */
  target: string;
  relation: EvidenceRelation;
  /** Why they are linked: the passage, or a reviewer's note. */
  note?: string;
}

export interface EvidenceMapProps extends React.HTMLAttributes<HTMLDivElement> {
  nodes: EvidenceNode[];
  edges: EvidenceEdge[];
  selectedNodeId?: string | null;
  defaultSelectedNodeId?: string | null;
  onNodeSelect?: (node: EvidenceNode | null) => void;
  /** Open a source yourself. Without it, an http(s) `sourceUrl` opens in a new tab. */
  onOpenSource?: (node: EvidenceNode) => void;
  /** Adds review buttons to claims. May return a promise. */
  onStatusChange?: (claimId: string, status: EvidenceStatus) => void | Promise<void>;
  /** `map` or `list`. The map turns into the list below 640px wide. */
  layout?: "map" | "list";
  /** Who drew the links. Default "model": the details then say they are unchecked. */
  linkedBy?: "model" | "human";
}

const REL: Record<EvidenceRelation, { word: string; past: string; stroke: string; dash?: string; text: string }> = {
  supports: { word: "Supports", past: "supported by", stroke: "stroke-foreground/45", text: "text-foreground" },
  contradicts: { word: "Contradicts", past: "contradicted by", stroke: "stroke-destructive/70", dash: "6 4", text: "text-destructive" },
  contextualizes: { word: "Context", past: "given context by", stroke: "stroke-foreground/30", dash: "2 4", text: "text-muted-foreground" },
};
const STATUS: Record<EvidenceStatus, { word: string; tone: BadgeTone; icon: React.ElementType }> = {
  supported: { word: "Supported", tone: "success", icon: ShieldCheck },
  conflicting: { word: "Conflicting", tone: "destructive", icon: TriangleAlert },
  unsupported: { word: "Unsupported", tone: "destructive", icon: ShieldX },
  unreviewed: { word: "To review", tone: "outline", icon: CircleDashed },
};
const safeUrl = (u?: string) => (u && /^https?:\/\//i.test(u) ? u : undefined);

function NodeBox({
  n,
  selected,
  dim,
  counts,
  onPick,
  setRef,
}: {
  n: EvidenceNode;
  selected: boolean;
  dim: boolean;
  counts: { sup: number; con: number; ctx: number };
  onPick: () => void;
  setRef: (el: HTMLButtonElement | null) => void;
}) {
  const claim = n.kind === "claim";
  const S = claim && n.status ? STATUS[n.status] : null;
  return (
    <motion.button
      ref={setRef}
      type="button"
      aria-pressed={selected}
      onClick={onPick}
      animate={{ opacity: dim ? 0.4 : 1 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "w-full cursor-pointer rounded-[12px] bg-card px-3 py-2 text-left ring-1 ring-inset transition-shadow",
        selected ? "ring-2 ring-foreground" : claim && n.status === "conflicting" ? "ring-destructive/40" : "ring-border hover:ring-foreground/30",
        FOCUS,
        SQUIRCLE,
      )}
    >
      <span className="flex items-start gap-2">
        {claim ? null : n.kind === "note" ? <StickyNote aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" /> : <FileText aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />}
        <span className="min-w-0 flex-1">
          <span className={cn("line-clamp-2 text-[12.5px] leading-snug", claim && "font-medium")}>{n.title}</span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted-foreground">
            {S && (
              <span className="inline-flex items-center gap-1">
                <S.icon aria-hidden className="size-3" />
                {S.word}
              </span>
            )}
            {!claim && n.sourceType && <span>{n.sourceType}</span>}
            {claim && (
              <span className="tabular-nums">
                {counts.sup} for{counts.con > 0 && <span className="text-destructive"> · {counts.con} against</span>}
                {counts.sup + counts.con === 0 && <span className="text-warning"> · no evidence</span>}
              </span>
            )}
            {!claim && counts.sup + counts.con + counts.ctx === 0 && <span>· not cited</span>}
          </span>
        </span>
      </span>
    </motion.button>
  );
}

export const EvidenceMap = React.forwardRef<HTMLDivElement, EvidenceMapProps>(function EvidenceMap(
  { nodes, edges: rawEdges, selectedNodeId, defaultSelectedNodeId = null, onNodeSelect, onOpenSource, onStatusChange, layout = "map", linkedBy = "model", className, ...props },
  ref,
) {
  const reduce = useReducedMotion();
  const [inner, setInner] = React.useState<string | null>(defaultSelectedNodeId);
  const selected = selectedNodeId !== undefined ? selectedNodeId : inner;
  const [view, setView] = React.useState<"map" | "list">(layout);
  const [rels, setRels] = React.useState<Set<EvidenceRelation>>(new Set(["supports", "contradicts", "contextualizes"]));
  const [busy, setBusy] = React.useState<EvidenceStatus | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const byId = React.useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const edges = rawEdges.filter((e) => byId.has(e.source) && byId.has(e.target));
  const dropped = rawEdges.length - edges.length;
  const claims = nodes.filter((n) => n.kind === "claim");
  const others = nodes.filter((n) => n.kind !== "claim");
  const node = selected ? (byId.get(selected) ?? null) : null;
  const links = node ? edges.filter((e) => e.source === node.id || e.target === node.id) : [];
  const lit = new Set(links.flatMap((e) => [e.source, e.target]));

  const board = React.useRef<HTMLDivElement>(null);
  const refs = React.useRef(new Map<string, HTMLElement>());
  const [geo, setGeo] = React.useState<{ w: number; h: number; y: Map<string, number>; left: number; right: number } | null>(null);
  const measure = React.useCallback(() => {
    const b = board.current;
    if (!b) return;
    const bb = b.getBoundingClientRect();
    const k = b.offsetWidth ? bb.width / b.offsetWidth : 1;
    const y = new Map<string, number>();
    let left = 0;
    let right = b.offsetWidth;
    refs.current.forEach((el, id) => {
      const r = el.getBoundingClientRect();
      y.set(id, (r.top - bb.top + r.height / 2) / k);
      if (byId.get(id)?.kind === "claim") left = Math.max(left, (r.right - bb.left) / k);
      else right = Math.min(right, (r.left - bb.left) / k);
    });
    setGeo({ w: b.offsetWidth, h: b.offsetHeight, y, left, right });
  }, [byId]);
  const [narrow, setNarrow] = React.useState(false);
  const shell = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = shell.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setNarrow(el.clientWidth < 640));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const mode = narrow ? "list" : view;

  React.useLayoutEffect(() => {
    if (mode !== "map") return;
    measure();
    const ro = new ResizeObserver(measure);
    if (board.current) ro.observe(board.current);
    return () => ro.disconnect();
  }, [measure, mode, nodes, edges.length]);

  const pick = (id: string) => {
    const next = id === selected ? null : id;
    setInner(next);
    setError(null);
    onNodeSelect?.(next ? (byId.get(next) ?? null) : null);
  };
  const review = async (s: EvidenceStatus) => {
    if (!node || !onStatusChange) return;
    setError(null);
    setBusy(s);
    try {
      await onStatusChange(node.id, s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The review did not save.");
    } finally {
      setBusy(null);
    }
  };
  const open = (n: EvidenceNode) => {
    if (onOpenSource) onOpenSource(n);
    else if (safeUrl(n.sourceUrl)) window.open(safeUrl(n.sourceUrl), "_blank", "noopener,noreferrer");
  };
  const count = (r: EvidenceRelation, id: string) => edges.filter((e) => e.relation === r && (e.source === id || e.target === id)).length;

  if (!nodes.length) {
    return (
      <div ref={ref} className={cn("w-full", className)} {...props}>
        <State size="sm" framed title="No evidence yet" description="Claims and sources appear here once the report is generated." />
      </div>
    );
  }

  const boxFor = (n: EvidenceNode) => (
    <NodeBox
      key={n.id}
      n={n}
      selected={n.id === selected}
      dim={Boolean(node && !lit.has(n.id))}
      counts={{ sup: count("supports", n.id), con: count("contradicts", n.id), ctx: count("contextualizes", n.id) }}
      onPick={() => pick(n.id)}
      setRef={(el) => {
        if (el) refs.current.set(n.id, el);
        else refs.current.delete(n.id);
      }}
    />
  );

  const facts = (node: EvidenceNode) => (
    <>
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-muted-foreground">{node.kind === "claim" ? "Claim" : node.kind === "note" ? "Note" : (node.sourceType ?? "Source")}</p>
          <p className="text-[14px] leading-snug font-medium">{node.title}</p>
          {node.description && <p className="mt-1 text-[12.5px] text-muted-foreground">{node.description}</p>}
        </div>
        {node.kind !== "claim" && (onOpenSource || safeUrl(node.sourceUrl)) && (
          <Button size="sm" variant="outline" onClick={() => open(node)}>
            Open source
            <ArrowUpRight />
          </Button>
        )}
      </div>
      {links.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {links.map((e) => {
            const other = byId.get(e.source === node.id ? e.target : e.source)!;
            return (
              <li key={e.id} className="text-[12.5px]">
                <button type="button" onClick={() => pick(other.id)} className={cn("rounded-[6px] text-left hover:underline", FOCUS)}>
                  <span className={cn("font-medium", REL[e.relation].text)}>{node.kind === "claim" ? REL[e.relation].word : REL[e.relation].word === "Context" ? "Gives context to" : REL[e.relation].word}</span> · {other.title}
                </button>
                {e.note && (
                  <span className="mt-0.5 flex gap-1.5 text-muted-foreground">
                    <Quote aria-hidden className="mt-0.5 size-3 shrink-0" />
                    {e.note}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[12.5px] text-warning">Nothing is linked to this {node.kind === "claim" ? "claim" : "source"}.</p>
      )}
      {node.kind === "claim" && (
        <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          {linkedBy === "model" ? <Bot aria-hidden className="size-3.5" /> : <UserCheck aria-hidden className="size-3.5" />}
          {linkedBy === "model" ? "Links drawn by a model, not checked by a person." : "Links drawn by a person."}
        </p>
      )}
      {node.kind === "claim" && onStatusChange && (
        <div role="group" aria-label="Your verdict" className="flex flex-wrap gap-1.5 border-t border-border pt-2.5">
          {(["supported", "conflicting", "unsupported"] as EvidenceStatus[]).map((s) => {
            const S = STATUS[s];
            return (
              <Button key={s} size="sm" variant={node.status === s ? "secondary" : "outline"} aria-pressed={node.status === s} loading={busy === s} disabled={busy !== null} onClick={() => review(s)}>
                <S.icon />
                {S.word}
              </Button>
            );
          })}
        </div>
      )}
      {error && (
        <p role="alert" className="text-[12.5px] text-destructive">
          {error}
        </p>
      )}
    </>
  );
  const inline = mode === "list" && node?.kind === "claim";

  return (
    <div ref={(el) => {
      shell.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) ref.current = el;
    }} className={cn("w-full min-w-0 text-foreground", className)} {...props}>
      <div className={cn("flex flex-col gap-3 rounded-[20px] bg-card p-4 ring-1 ring-border ring-inset", SQUIRCLE)}>
        <div className="flex flex-wrap items-center gap-2">
          {!narrow && (
            <SegmentedControl
              size="sm"
              label="View"
              value={view}
              onChange={setView}
              options={[
                { value: "map", label: "Map" },
                { value: "list", label: "List" },
              ]}
            />
          )}
          <div role="group" aria-label="Show links" className="flex flex-wrap items-center gap-1">
            {(Object.keys(REL) as EvidenceRelation[]).map((r) => {
              const on = rels.has(r);
              const n = edges.filter((e) => e.relation === r).length;
              return (
                <button
                  key={r}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setRels((s) => {
                      const x = new Set(s);
                      if (x.has(r)) x.delete(r);
                      else x.add(r);
                      return x;
                    })
                  }
                  className={cn("inline-flex h-7 items-center gap-1.5 rounded-full px-2 text-[12px] ring-1 ring-inset ring-border transition-colors", on ? "bg-card hover:bg-accent" : "text-muted-foreground line-through decoration-foreground/30", FOCUS)}
                >
                  <svg aria-hidden width="18" height="6" className="shrink-0">
                    <line x1="0" y1="3" x2="18" y2="3" strokeWidth="2" strokeDasharray={REL[r].dash} className={REL[r].stroke} />
                  </svg>
                  {REL[r].word} <span className="text-muted-foreground tabular-nums">{n}</span>
                </button>
              );
            })}
          </div>
          <span className="ml-auto text-[12px] text-muted-foreground tabular-nums">
            {claims.length} claims · {others.length} sources
            {dropped > 0 && <span className="text-warning"> · {dropped} broken {dropped === 1 ? "link" : "links"} skipped</span>}
          </span>
        </div>

        <div className="grid gap-3">
          {mode === "map" ? (
            <div ref={board} className="relative grid grid-cols-[minmax(0,1fr)_minmax(64px,0.55fr)_minmax(0,1fr)] gap-0">
              <div className="flex flex-col gap-2">
                <p className="text-[12px] font-medium text-muted-foreground">Claims</p>
                {claims.map(boxFor)}
              </div>
              <div />
              <div className="flex flex-col gap-2">
                <p className="text-[12px] font-medium text-muted-foreground">Sources</p>
                {others.map(boxFor)}
              </div>
              {geo && (
                <svg aria-hidden className="pointer-events-none absolute inset-0 overflow-visible" width={geo.w} height={geo.h}>
                  {edges.map((e, i) => {
                    if (!rels.has(e.relation)) return null;
                    const a = geo.y.get(e.source);
                    const b = geo.y.get(e.target);
                    if (a === undefined || b === undefined) return null;
                    const x1 = geo.left + 2;
                    const x2 = geo.right - 2;
                    const mid = (x1 + x2) / 2;
                    const on = node ? e.source === node.id || e.target === node.id : true;
                    return (
                      <motion.path
                        key={e.id}
                        d={`M${x1},${a} C${mid},${a} ${mid},${b} ${x2},${b}`}
                        fill="none"
                        strokeWidth={node && on ? 2.25 : 1.5}
                        strokeDasharray={REL[e.relation].dash}
                        className={REL[e.relation].stroke}
                        initial={reduce ? false : { pathLength: 0 }}
                        animate={{ pathLength: 1, opacity: on ? 1 : 0.15 }}
                        transition={{ duration: reduce ? 0 : 0.6, delay: reduce ? 0 : i * 0.03 }}
                      />
                    );
                  })}
                </svg>
              )}
            </div>
          ) : (
            <ul aria-label="Claims and their sources" className="flex flex-col gap-2">
              {claims.map((c) => {
                const S = c.status ? STATUS[c.status] : STATUS.unreviewed;
                const mine = edges.filter((e) => e.source === c.id && rels.has(e.relation));
                return (
                  <li
                    key={c.id}
                    onClick={() => pick(c.id)}
                    className={cn("cursor-pointer rounded-[12px] p-3 ring-1 ring-inset transition-colors hover:bg-accent/40", c.id === selected ? "ring-2 ring-foreground" : "ring-border", SQUIRCLE)}
                  >
                    <button type="button" aria-pressed={c.id === selected} className={cn("w-full cursor-pointer rounded-[6px] text-left", FOCUS)}>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="min-w-0 flex-1 text-[13px] font-medium">{c.title}</span>
                        <Badge tone={S.tone} size="sm">
                          {S.word}
                        </Badge>
                      </span>
                    </button>
                    <AnimatePresence initial={false}>
                      {inline && c.id === selected && node && (
                        <motion.div
                          key="facts"
                          initial={reduce ? false : { height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                          transition={reduce ? { duration: 0 } : FOLD}
                          className="cursor-auto overflow-hidden"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="mt-2.5 flex flex-col gap-2.5 border-t border-border pt-2.5">{facts(node)}</div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {inline && c.id === selected ? null : mine.length ? (
                      <ul className="mt-2 flex flex-col gap-1 border-l border-border pl-3">
                        {mine.map((e) => (
                          <li key={e.id} className="text-[12.5px]">
                            <span className={cn("font-medium", REL[e.relation].text)}>{REL[e.relation].word}:</span> {byId.get(e.target)?.title}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1.5 text-[12.5px] text-warning">No source is linked to this claim.</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <AnimatePresence mode="wait" initial={false}>
            {node && !inline && (
              <motion.div
                key={node.id}
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
                transition={SOFT}
                className={cn("flex flex-col gap-2.5 rounded-[14px] bg-muted/40 p-3 ring-1 ring-border ring-inset", SQUIRCLE)}
              >
                {facts(node)}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
});

export default EvidenceMap;
