"use client";

import * as React from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "framer-motion";
import { AlertCircle, ArrowLeft, ArrowRight, CornerDownRight, Download, FileSpreadsheet, Loader2, RotateCw, Upload, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select, SelectContent, SelectItem, SelectRoot, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { State } from "@/components/ui/state";
import { Stepper } from "@/components/ui/stepper";
import { Switch } from "@/components/ui/switch";
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const SQUIRCLE = "[corner-shape:squircle]";

const TRAY =
  "rounded-[26px] p-1.5 [corner-shape:squircle] bg-[var(--tray,#f0f0f0)] dark:bg-[var(--tray,#0e0e10)]";

const TRAY_CARD =
  "rounded-[20px] [corner-shape:squircle] bg-card ring-1 ring-border shadow-[0_1px_2px_rgb(0_0_0/0.05),0_4px_12px_-6px_rgb(0_0_0/0.08)] dark:shadow-[0_1px_2px_rgb(0_0_0/0.5),0_4px_12px_-6px_rgb(0_0_0/0.5)]";

const FLAT_CARD =
  "overflow-hidden rounded-[22px] [corner-shape:squircle] bg-card ring-1 ring-border shadow-[0_1px_2px_rgb(0_0_0/0.05)] dark:shadow-[0_1px_2px_rgb(0_0_0/0.4)]";

type Look = "layered" | "flat";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const SPRING = {
  type: "spring",
  stiffness: 420,
  damping: 34,
  mass: 0.8,
} as const;

const SOFT = { type: "spring", stiffness: 300, damping: 30 } as const;

const FOLD = { duration: 0.22, ease: [0.22, 1, 0.36, 1] } as const;

const DURATION = {
  fast: 0.12,
  base: 0.18,
  slow: 0.26,
} as const;

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

export interface ImportField {
  /** The key this value has in the rows you are given. */
  key: string;
  label: string;
  /** A row without it needs fixing, and a file without a column for it cannot continue. */
  required?: boolean;
  /** What the value is checked as. Default `text`. */
  type?: "text" | "email" | "number" | "date" | "select";
  /** The allowed values of a `select`. Case is corrected to match. */
  options?: string[];
  /** Other headers that mean this field: "E-mail address", "Organisation". */
  aliases?: string[];
  /** Your own check, run after the type's. Return the problem in a few words, or nothing. */
  validate?: (value: string, row: ImportRow) => string | undefined;
}

export type ImportRow = Record<string, string>;

export interface ImportResult {
  /** How many rows went in. */
  imported: number;
  /** Rows the server refused. `row` is the index in the array `onImport` was given. */
  failed?: { row: number; reason: string }[];
}

export interface ImportFile {
  name: string;
  /** The CSV itself. */
  text: string;
}

export interface DataImportProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** What a row can hold. Their order is the order of the review table. */
  fields: ImportField[];
  /** Sends the rows. Report progress as a count of rows, honour `signal`, and resolve with what happened. */
  onImport: (rows: ImportRow[], context: { onProgress: (done: number) => void; signal: AbortSignal }) => Promise<ImportResult>;
  /** What is being imported, plural: "contacts". Pass both forms when the singular is irregular. Default "rows". */
  noun?: string | { one: string; other: string };
  /** The heading. Default "Import contacts", from `noun`. Pass `false` to hide it. */
  title?: React.ReactNode | false;
  /** Largest file accepted, in rows. A longer one is refused on upload. */
  maxRows?: number;
  /** Adds "Use a sample file" to the upload step, so the flow can be tried without one. */
  sample?: ImportFile;
  /** Start with this file loaded, on the match step. For a file dropped elsewhere in your app. */
  defaultFile?: ImportFile;
  /** Where "Download a template" points. Without it, or `onDownloadTemplate`, a template is built from `fields`. */
  templateHref?: string;
  /** Called by "Download a template" instead of following a link. */
  onDownloadTemplate?: () => void;
  /** Adds Done to the result, and is given what the import returned. */
  onDone?: (result: ImportResult) => void;
  /** Adds Cancel to the upload step. */
  onCancel?: () => void;
  /** Layered sets it in a tray, the heading above the card and the status in the strip below. Flat is one card. */
  look?: Look;
}

export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const seen: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  for (let i = 0, quoted = false; i < src.length && (quoted || (src[i] !== "\n" && src[i] !== "\r")); i++) {
    if (src[i] === '"') quoted = !quoted;
    else if (!quoted && src[i] in seen) seen[src[i]]++;
  }
  const delimiter = seen[";"] > seen[","] && seen[";"] >= seen["\t"] ? ";" : seen["\t"] > seen[","] ? "\t" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch !== '"') cell += ch;
      else if (src[i + 1] === '"') (cell += '"'), i++;
      else quoted = false;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delimiter) (row.push(cell), (cell = ""));
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      rows.push([...row, cell]);
      (row = []), (cell = "");
    } else cell += ch;
  }
  if (cell !== "" || row.length) rows.push([...row, cell]);
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

interface Sheet {
  name: string;
  headers: string[];
  rows: string[][];
  /** Per column: the field key it feeds, or null for "Do not import". */
  mapping: (string | null)[];
  /** Per column: matched by name and not touched since. */
  auto: boolean[];
}
interface Checked {
  index: number;
  values: ImportRow;
  errors: Record<string, string>;
  bad: boolean;
}
type Action = { label: string; act: () => void; icon?: React.ReactNode; disabled?: boolean; quiet?: boolean } | false | undefined;
interface Run {
  phase: "running" | "done" | "cancelled" | "error";
  total: number;
  done: number;
  /** Row indexes that were sent, in order, so a server failure can be traced back to its line. */
  sent: number[];
  skipped: { index: number; reason: string }[];
  result?: ImportResult;
  error?: string;
}

const STEPS = ["Upload", "Match columns", "Review", "Import"];
const SKIP = "__skip";
const LIMIT = 100;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const num = (n: number) => n.toLocaleString("en-US");
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const toCsv = (rows: string[][]) => rows.map((r) => r.map((c) => (/[",\n\r]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\r\n");

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob(["﻿", text], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function isDate(v: string) {
  const real = (y: number, m: number, d: number) => {
    const t = new Date(Date.UTC(y, m - 1, d));
    return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
  };
  const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ][\d:.+\-Z]*)?$/);
  if (iso) return real(+iso[1], +iso[2], +iso[3]);
  const slashed = v.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (slashed) return real(+slashed[3], +slashed[2], +slashed[1]) || real(+slashed[3], +slashed[1], +slashed[2]);
  const named = v.toLowerCase().match(/^(?:(\d{1,2})\s+([a-z]{3})[a-z]*\.?|([a-z]{3})[a-z]*\.?\s+(\d{1,2}),?)\s+(\d{4})$/);
  return named ? real(+named[5], MONTHS.indexOf(named[2] ?? named[3]) + 1, +(named[1] ?? named[4])) : false;
}

function problem(f: ImportField, v: string, row: ImportRow): string | undefined {
  if (!v) return f.required ? "Required" : undefined;
  if (f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return "Not an email address";
  if (f.type === "number" && !Number.isFinite(Number(v.replace(/[,\s]/g, "")))) return "Not a number";
  if (f.type === "date" && !isDate(v)) return "Not a date";
  if (f.type === "select" && f.options && !f.options.includes(v)) return "Not an option";
  return f.validate?.(v, row);
}

function inspect(fields: ImportField[], mapping: (string | null)[], cells: string[], index: number): Checked {
  const values: ImportRow = {};
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const col = mapping.indexOf(f.key);
    if (col < 0) continue;
    const raw = (cells[col] ?? "").trim();
    values[f.key] = f.type === "select" ? (f.options?.find((o) => o.toLowerCase() === raw.toLowerCase()) ?? raw) : raw;
  }
  for (const f of fields) {
    const found = f.key in values ? problem(f, values[f.key], values) : undefined;
    if (found) errors[f.key] = found;
  }
  return { index, values, errors, bad: Object.keys(errors).length > 0 };
}

function read(file: ImportFile, fields: ImportField[], maxRows?: number): Sheet | string {
  const [head, ...body] = parseCsv(file.text);
  if (!head) return `${file.name} is empty.`;
  if (!body.length) return `${file.name} has a header row and nothing under it.`;
  if (maxRows && body.length > maxRows) return `${file.name} has ${num(body.length)} rows. The limit is ${num(maxRows)}.`;
  const headers = head.map((h, i) => h.trim() || `Column ${i + 1}`);
  const taken = new Set<string>();
  const mapping = headers.map((h) => {
    const hit = fields.find((f) => !taken.has(f.key) && [f.key, f.label, ...(f.aliases ?? [])].some((a) => norm(a) === norm(h)));
    if (hit) taken.add(hit.key);
    return hit?.key ?? null;
  });
  return { name: file.name, headers, rows: body.map((r) => headers.map((_, i) => (r[i] ?? "").trim())), mapping, auto: mapping.map(Boolean) };
}

function Tick({ reduce, delay = 0 }: { reduce: boolean | null; delay?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="size-3">
      <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.32, delay, ease: "easeOut" }} />
    </svg>
  );
}

function CountUp({ to, reduce }: { to: number; reduce: boolean | null }) {
  const [n, setN] = React.useState(reduce ? to : 0);
  React.useEffect(() => {
    if (reduce) return setN(to);
    const run = animate(0, to, { duration: 0.7, ease: "easeOut", onUpdate: (v) => setN(Math.round(v)) });
    return () => run.stop();
  }, [to, reduce]);
  return <>{num(n)}</>;
}

function Panel({ title, description, dir, focus, focusKey, children }: { title: React.ReactNode; description?: React.ReactNode; dir: number; focus: boolean; focusKey?: string; children: React.ReactNode }) {
  const heading = React.useRef<HTMLHeadingElement>(null);
  React.useEffect(() => {
    if (focus) heading.current?.focus({ preventScroll: true });
  }, [focus, focusKey]);
  return (
    <motion.div
      custom={dir}
      variants={{ enter: (d: number) => ({ opacity: 0, x: 20 * d }), rest: { opacity: 1, x: 0 }, exit: (d: number) => ({ opacity: 0, x: -20 * d }) }}
      initial="enter"
      animate="rest"
      exit="exit"
      transition={{ duration: DURATION.base, ease: "easeOut" }}
      className="flex min-w-0 flex-1 flex-col"
    >
      <h3 ref={heading} tabIndex={-1} className="text-[15px] font-medium tracking-[-0.01em] outline-none">
        {title}
      </h3>
      {description && <p className="mt-1 text-[13px] leading-relaxed text-pretty text-muted-foreground">{description}</p>}
      <div className="mt-4 flex min-w-0 flex-1 flex-col">{children}</div>
    </motion.div>
  );
}

function CellEditor({ field, value, error, line, at, onCommit, onNext }: { field: ImportField; value: string; error: string; line: number; at: number; onCommit: (value: string) => void; onNext: () => void }) {
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => setDraft(value), [value]);
  const reason = React.useId();
  const picked = React.useRef(false);
  const label = `${field.label}, row ${line}`;
  const commit = () => void (draft.trim() !== value && onCommit(draft));

  return (
    <>
      {field.type === "select" && field.options?.length ? (
        <SelectRoot value="" onValueChange={(v) => ((picked.current = true), onCommit(v))}>
          <SelectTrigger data-editor={at} size="sm" aria-label={label} aria-invalid aria-describedby={reason} className="min-w-[108px]">
            <SelectValue placeholder={value || "Choose"} />
          </SelectTrigger>
          <SelectContent onCloseAutoFocus={(e) => picked.current && (e.preventDefault(), onNext())}>
            {field.options.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </SelectRoot>
      ) : (
        <Input
          data-editor={at}
          size="sm"
          value={draft}
          inputMode={field.type === "email" ? "email" : field.type === "number" ? "decimal" : undefined}
          autoComplete="off"
          spellCheck={false}
          aria-label={label}
          aria-invalid
          aria-describedby={reason}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.preventDefault(), commit(), onNext());
            else if (e.key === "Escape" && draft !== value) (e.stopPropagation(), setDraft(value));
          }}
          className="min-w-[132px]"
        />
      )}
      <span id={reason} className="mt-1 block text-[12px] leading-tight text-destructive">
        {error}
      </span>
    </>
  );
}

const TILE = cn("grid size-9 shrink-0 place-items-center rounded-[10px] bg-muted text-foreground/70 [&_svg]:size-[18px]", SQUIRCLE);
const LINK = "underline decoration-foreground/30 hover:decoration-foreground";

function SheetMark({ state, reading }: { state: "rest" | "hover" | "drag"; reading: boolean }) {
  const reduce = useReducedMotion();
  const fan = state === "drag" ? 1 : state === "hover" ? 0.45 : 0;
  const move = (r: number, x: number, y: number) => (reduce ? {} : { rotate: r * (1 + fan), x: x * (1 + fan * 1.6), y: y - fan * 3 });
  const sheet = (label: string) => (
    <span className={cn("grid h-11 w-9 place-items-end rounded-[7px] bg-card p-1 ring-1 ring-border", SQUIRCLE)}>
      <span className="rounded-[3px] bg-success-soft px-1 text-[8px] leading-3 font-semibold text-success">{label}</span>
    </span>
  );
  return (
    <span aria-hidden className="relative mb-4 grid h-14 w-20 place-items-center">
      <motion.span className="absolute opacity-90" initial={false} animate={move(-14, -17, 3)} transition={SPRING}>
        {sheet("CSV")}
      </motion.span>
      <motion.span className="absolute opacity-90" initial={false} animate={move(14, 17, 3)} transition={SPRING}>
        {sheet("TSV")}
      </motion.span>
      <motion.span
        initial={false}
        animate={reduce ? {} : { y: -fan * 4, scale: 1 + fan * 0.05 }}
        transition={SPRING}
        className={cn(
          "relative grid size-11 place-items-center rounded-[12px] bg-card text-foreground/80 ring-1 ring-border shadow-[0_6px_16px_-6px_rgb(0_0_0/0.18)] dark:shadow-[0_6px_16px_-6px_rgb(0_0_0/0.6)] [&_svg]:size-[18px]",
          SQUIRCLE,
        )}
      >
        {reading ? <Loader2 className="motion-safe:animate-spin" /> : <Upload strokeWidth={1.75} />}
      </motion.span>
    </span>
  );
}

export const DataImport = React.forwardRef<HTMLDivElement, DataImportProps>(function DataImport(
  { fields, onImport, noun = "rows", title, maxRows, sample, defaultFile, templateHref, onDownloadTemplate, onDone, onCancel, look = "layered", className, ...props },
  ref,
) {
  const reduce = useReducedMotion();
  const words = typeof noun === "string" ? { one: noun.replace(/ies$/, "y").replace(/s$/, ""), other: noun } : noun;
  const count = (n: number) => `${num(n)} ${n === 1 ? words.one : words.other}`;

  const [data, setData] = React.useState<Sheet | null>(() => {
    const start = defaultFile ? read(defaultFile, fields, maxRows) : null;
    return start && typeof start !== "string" ? start : null;
  });
  const [nav, setNav] = React.useState({ step: data ? 1 : 0, dir: 1, moved: false });
  const [say, setSay] = React.useState("");
  const go = (step: number) => {
    if (step === nav.step) return;
    setNav({ step, dir: step > nav.step ? 1 : -1, moved: true });
    setSay(`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`);
  };

  const [fileError, setFileError] = React.useState<string | null>(null);
  const [reading, setReading] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const depth = React.useRef(0);
  const picker = React.useRef<HTMLInputElement>(null);
  const zone = React.useRef<HTMLDivElement>(null);

  const load = (file: ImportFile) => {
    const next = read(file, fields, maxRows);
    if (typeof next === "string") return setFileError(next);
    setFileError(null);
    setData(next);
    setFixed([]);
  };
  const take = async (file?: File) => {
    if (!file) return;
    if (!/\.(csv|tsv)$/i.test(file.name) && file.type !== "text/csv") return setFileError(`${file.name} is not a CSV file. Export the sheet as .csv and try again.`);
    setReading(true);
    try {
      load({ name: file.name, text: await file.text() });
    } catch {
      setFileError(`${file.name} could not be read.`);
    } finally {
      setReading(false);
    }
  };

  const missing = data ? fields.filter((f) => f.required && !data.mapping.includes(f.key)) : [];
  const unused = data ? fields.filter((f) => !f.required && !data.mapping.includes(f.key)) : [];
  const active = data ? fields.filter((f) => data.mapping.includes(f.key)) : [];
  const names = (list: ImportField[]) => list.map((f) => f.label).join(list.length === 2 ? " and " : ", ");

  const [view, setView] = React.useState<"problems" | "all">("problems");
  const [hovering, setHovering] = React.useState(false);
  const [skip, setSkip] = React.useState(false);
  const [fixed, setFixed] = React.useState<number[]>([]);
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  const table = React.useRef<HTMLDivElement>(null);
  const primary = React.useRef<HTMLButtonElement>(null);
  const [spill, setSpill] = React.useState(false);
  const measure = () => setSpill(Boolean(table.current && table.current.scrollWidth - table.current.scrollLeft - table.current.clientWidth > 8));
  React.useEffect(measure);

  const records = React.useMemo(() => (data ? data.rows.map((cells, i) => inspect(fields, data.mapping, cells, i)) : []), [data, fields]);
  const bad = records.filter((r) => r.bad);
  const ready = records.length - bad.length;
  const listed = view === "all" ? records : records.filter((r) => r.bad || fixed.includes(r.index));

  const edit = (index: number, key: string, value: string) => {
    if (!data) return;
    const col = data.mapping.indexOf(key);
    const rows = data.rows.map((r, i) => (i === index ? r.map((c, j) => (j === col ? value.trim() : c)) : r));
    setData({ ...data, rows });
    if (!records[index].bad || inspect(fields, data.mapping, rows[index], index).bad) return;
    setFixed((f) => [...f, index]);
    setSay(`Row ${index + 2} fixed. ${bad.length > 1 ? `${bad.length - 1} left.` : "Every row is ready."}`);
    timers.current.push(setTimeout(() => setFixed((f) => f.filter((i) => i !== index)), 700));
  };
  const focusNext = (at: number) =>
    requestAnimationFrame(() => {
      const editors = Array.from(table.current?.querySelectorAll<HTMLElement>("[data-editor]") ?? []);
      (editors.find((el) => Number(el.dataset.editor) > at) ?? editors.find((el) => Number(el.dataset.editor) !== at) ?? primary.current)?.focus();
    });

  const [run, setRun] = React.useState<Run | null>(null);
  const abort = React.useRef<AbortController | null>(null);
  React.useEffect(
    () => () => {
      abort.current?.abort();
      timers.current.forEach(clearTimeout);
    },
    [],
  );

  const start = async () => {
    const sent = records.filter((r) => !r.bad);
    const skipped = bad.map((r) => {
      const key = Object.keys(r.errors)[0];
      return { index: r.index, reason: `${fields.find((f) => f.key === key)?.label ?? key}: ${r.errors[key]}` };
    });
    const control = new AbortController();
    abort.current = control;
    setRun({ phase: "running", total: sent.length, done: 0, sent: sent.map((r) => r.index), skipped });
    go(3);
    try {
      const result = await onImport(
        sent.map((r) => r.values),
        { signal: control.signal, onProgress: (n) => void (control.signal.aborted || setRun((s) => s && { ...s, done: Math.max(0, Math.min(s.total, n)) })) },
      );
      if (control.signal.aborted) return;
      setRun((s) => s && { ...s, phase: "done", done: s.total, result });
      setSay(`${count(result.imported)} imported${result.failed?.length ? `, ${result.failed.length} failed` : ""}.`);
    } catch (err) {
      if (control.signal.aborted) return;
      setRun((s) => s && { ...s, phase: "error", error: err instanceof Error && err.message ? err.message : "The server did not answer. Nothing you fixed is lost." });
    }
  };
  const cancel = () => {
    abort.current?.abort();
    setRun((s) => s && { ...s, phase: "cancelled" });
  };
  const again = () => {
    setData(null);
    setRun(null);
    setFixed([]);
    setSkip(false);
    setView("problems");
    go(0);
  };

  const misses = !data || !run ? [] : [...(run.result?.failed ?? []).map((f) => ({ index: run.sent[f.row] ?? -1, reason: f.reason, failed: true })), ...run.skipped.map((s) => ({ ...s, failed: false }))];
  const report = () => data && download(`${data.name.replace(/\.\w+$/, "")}-errors.csv`, toCsv([[...data.headers, "Reason"], ...misses.map((m) => [...(data.rows[m.index] ?? []), m.reason])]));
  const template = () => (onDownloadTemplate ? onDownloadTemplate() : download(`${words.other}-template.csv`, toCsv([fields.map((f) => f.label)])));

  const { step, dir } = nav;
  const phase = step === 3 ? run?.phase : undefined;
  const result = run?.result;
  const back: Action =
    step === 0
      ? onCancel && { label: "Cancel", act: onCancel }
      : step < 3
        ? { label: "Back", icon: <ArrowLeft />, act: () => go(step - 1) }
        : phase === "done"
          ? { label: "Import another file", icon: <RotateCw />, act: again }
          : phase !== "running" && { label: "Back to review", icon: <ArrowLeft />, act: () => go(2) };
  const next: Action =
    step === 0
      ? { label: "Continue", disabled: !data || reading, act: () => go(1) }
      : step === 1
        ? { label: "Continue", disabled: missing.length > 0 || active.length === 0, act: () => go(2) }
        : step === 2
          ? { label: `Import ${count(ready)}`, disabled: ready === 0 || (bad.length > 0 && !skip), act: start }
          : phase === "running"
            ? { label: "Cancel import", quiet: true, act: cancel }
            : phase === "done"
              ? onDone && result && { label: "Done", act: () => onDone(result) }
              : { label: "Try again", icon: <RotateCw />, act: start };
  const changed = React.useRef(0);
  React.useEffect(() => void (changed.current = performance.now()), [step, phase]);
  const once = (act: () => void) => () => void (performance.now() - changed.current > 350 && act());
  const note = step !== 2 || !bad.length ? null : skip ? `${num(bad.length)} ${bad.length === 1 ? "row" : "rows"} will be skipped` : ready ? "Fix the rows above, or skip them" : "No row is ready to import";
  const panel = { dir: reduce ? 0 : dir, focus: nav.moved };

  const tray = look === "layered";

  return (
    <div ref={ref} data-look={look}
      className={cn("@container w-full max-w-[640px] min-w-0 text-foreground antialiased", tray ? TRAY : FLAT_CARD, className)} {...props}>
      <div className={cn("border-b border-border px-4 py-4 @min-[560px]:px-5", tray && "border-b-0 px-3 pt-2 pb-3")}>
        {title !== false && (
          <div className="mb-3.5 flex items-baseline justify-between gap-3">
            <h2 className="text-[15px] font-medium tracking-[-0.01em]">{title ?? `Import ${words.other}`}</h2>
            <p className="shrink-0 text-[12px] text-muted-foreground tabular-nums @min-[600px]:hidden">
              Step {step + 1} of {STEPS.length}
            </p>
          </div>
        )}
        <Stepper
          aria-label="Import steps"
          current={phase === "done" ? STEPS.length : step}
          onStepClick={step < 3 ? go : undefined}
          steps={STEPS.map((s, i) => ({ title: <span className="sr-only @min-[600px]:not-sr-only">{s}</span>, error: i === 3 && phase === "error" }))}
        />
      </div>
      <div className={cn(tray && cn(TRAY_CARD, "overflow-hidden"))}>

      <div className="flex min-h-[460px] flex-col overflow-hidden px-4 py-5 @min-[560px]:px-5">
        <AnimatePresence mode="wait" initial={false} custom={panel.dir}>
          {step === 0 && (
            <Panel key="upload" {...panel} title="Upload a CSV file" description={`One ${words.one} per row, with the column names in the first row.${maxRows ? ` Up to ${num(maxRows)} rows.` : ""}`}>
              <AnimatePresence initial={false}>
                {data && (
                  <motion.div key="file" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={reduce ? { duration: 0 } : FOLD} className="overflow-hidden">
                    <div className={cn("mb-3 flex items-center gap-3 rounded-[14px] p-3 ring-1 ring-border ring-inset", SQUIRCLE)}>
                      <span className={TILE}>
                        <FileSpreadsheet aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{data.name}</p>
                        <p className="mt-0.5 truncate text-[12px] text-muted-foreground tabular-nums">
                          {num(data.rows.length)} {data.rows.length === 1 ? "row" : "rows"} · {data.headers.length} {data.headers.length === 1 ? "column" : "columns"}
                        </p>
                      </div>
                      <IconButton label={`Remove ${data.name}`} size="sm" onClick={() => (setData(null), zone.current?.focus())} className="text-muted-foreground hover:text-foreground">
                        <X />
                      </IconButton>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div
                ref={zone}
                role="button"
                tabIndex={0}
                aria-busy={reading || undefined}
                aria-label={data ? "Replace it: choose a CSV file or drop it here" : "Choose a CSV file or drop it here"}
                onClick={() => picker.current?.click()}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), picker.current?.click())}
                onDragEnter={(e) => (e.preventDefault(), (depth.current += 1), setDragging(true))}
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={() => void ((depth.current = Math.max(0, depth.current - 1)) === 0 && setDragging(false))}
                onDrop={(e) => (e.preventDefault(), (depth.current = 0), setDragging(false), void take(e.dataTransfer.files?.[0]))}
                onPointerEnter={() => setHovering(true)}
                onPointerLeave={() => setHovering(false)}
                className={cn(
                  "flex flex-1 cursor-pointer flex-col items-center justify-center rounded-[14px] border-[1.5px] border-dashed px-6 pt-7 pb-6 text-center transition-colors duration-200",
                  dragging ? "border-info/60 bg-info/[0.04]" : "border-foreground/[0.14] bg-foreground/[0.015] hover:border-foreground/25",
                  SQUIRCLE,
                  FOCUS,
                )}
              >
                <SheetMark state={reading ? "rest" : dragging ? "drag" : hovering ? "hover" : "rest"} reading={reading} />
                <p className="text-[15px] font-medium tracking-[-0.01em]">
                  {reading ? (
                    "Reading the file"
                  ) : dragging ? (
                    "Release to load it"
                  ) : (
                    <>
                      {data ? "Drop another CSV to replace it, or " : "Drop a CSV here or "}
                      <span className="text-info">browse</span>
                    </>
                  )}
                </p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  CSV or TSV{maxRows ? ` · up to ${num(maxRows)} rows` : ""}
                </p>
                <input ref={picker} type="file" hidden accept=".csv,.tsv,text/csv" onChange={(e) => (void take(e.target.files?.[0]), (e.target.value = ""))} />
              </div>

              {fileError && (
                <p role="alert" className="mt-2.5 flex items-start gap-1.5 text-[13px] leading-snug text-destructive">
                  <AlertCircle aria-hidden className="mt-px size-3.5 shrink-0" />
                  {fileError}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5">
                {sample && (
                  <Button variant="link" size="sm" onClick={() => load(sample)} className={LINK}>
                    Use a sample file
                  </Button>
                )}
                {templateHref ? (
                  <Button asChild variant="link" size="sm" className={LINK}>
                    <a href={templateHref} download>
                      <Download aria-hidden />
                      Download a template
                    </a>
                  </Button>
                ) : (
                  <Button variant="link" size="sm" onClick={template} className={LINK}>
                    <Download />
                    Download a template
                  </Button>
                )}
              </div>
            </Panel>
          )}

          {step === 1 && data && (
            <Panel
              key="match"
              {...panel}
              title="Match columns to fields"
              description={`${data.auto.filter(Boolean).length} of ${data.headers.length} columns matched automatically. Check them, and set the rest.`}
            >
              <div aria-hidden className="mb-1.5 hidden grid-cols-[minmax(0,1fr)_16px_minmax(0,240px)] gap-x-3 px-3 text-[12px] font-medium text-muted-foreground @min-[560px]:grid">
                <span className="truncate">Column in {data.name}</span>
                <span />
                <span>Field</span>
              </div>
              <ul className={cn("divide-y divide-border rounded-[14px] ring-1 ring-border", SQUIRCLE)}>
                {data.headers.map((header, i) => {
                  const key = data.mapping[i];
                  const samples = [...new Set(data.rows.map((r) => r[i]).filter(Boolean))].slice(0, 3);
                  return (
                    <li key={i} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-3 py-2.5 @min-[560px]:grid-cols-[minmax(0,1fr)_16px_minmax(0,240px)]">
                      <div className="col-span-2 min-w-0 @min-[560px]:col-span-1">
                        <p className="flex items-center gap-2">
                          <span className={cn("truncate text-[13px] font-medium transition-colors", !key && "text-muted-foreground")}>{header}</span>
                          {key && data.auto[i] && <Badge size="sm">Auto</Badge>}
                        </p>
                        <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{samples.length ? samples.join(" · ") : "No values"}</p>
                      </div>
                      <ArrowRight aria-hidden className="hidden size-4 text-muted-foreground @min-[560px]:block" />
                      <CornerDownRight aria-hidden className="ml-0.5 size-4 text-muted-foreground @min-[560px]:hidden" />
                      <Select
                        aria-label={`Field for the column ${header}`}
                        value={key ?? SKIP}
                        onValueChange={(v) => setData({ ...data, mapping: data.mapping.map((m, j) => (j === i ? (v === SKIP ? null : v) : m)), auto: data.auto.map((a, j) => j !== i && a) })}
                        className={key ? undefined : "text-muted-foreground"}
                      >
                        {fields.map((f) => {
                          const at = data.mapping.indexOf(f.key);
                          const taken = at >= 0 && at !== i;
                          return (
                            <SelectItem key={f.key} value={f.key} disabled={taken} hint={taken ? `Matched to ${data.headers[at]}` : f.required ? "Required" : undefined}>
                              {f.label}
                            </SelectItem>
                          );
                        })}
                        <SelectSeparator />
                        <SelectItem value={SKIP}>Do not import</SelectItem>
                      </Select>
                    </li>
                  );
                })}
              </ul>
              <AnimatePresence initial={false} mode="wait">
                {missing.length > 0 ? (
                  <motion.p
                    key="missing"
                    role="alert"
                    initial={{ opacity: 0, y: reduce ? 0 : -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: DURATION.base }}
                    className={cn("mt-3 flex items-start gap-2 rounded-[10px] bg-destructive-soft px-2.5 py-2 text-[13px] leading-snug text-destructive", SQUIRCLE)}
                  >
                    <AlertCircle aria-hidden className="mt-px size-3.5 shrink-0" />
                    <span>
                      {names(missing)} {missing.length === 1 ? "is required. Choose the column that holds it." : "are required. Choose the columns that hold them."}
                    </span>
                  </motion.p>
                ) : unused.length > 0 ? (
                  <motion.p key="unused" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: DURATION.base }} className="mt-3 px-0.5 text-[13px] leading-snug text-muted-foreground">
                    No column for {names(unused)}. {unused.length === 1 ? "It" : "They"} will be left empty.
                  </motion.p>
                ) : null}
              </AnimatePresence>
            </Panel>
          )}

          {step === 2 && data && (
            <Panel
              key="review"
              {...panel}
              title={`Review ${num(records.length)} ${records.length === 1 ? "row" : "rows"}`}
              description={
                <span className="tabular-nums">
                  <span className="font-medium text-foreground">{num(ready)} ready</span>
                  {" · "}
                  {bad.length ? (
                    <span className="font-medium text-destructive">
                      {num(bad.length)} {bad.length === 1 ? "needs" : "need"} fixing
                    </span>
                  ) : (
                    "nothing to fix"
                  )}
                </span>
              }
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
                <SegmentedControl
                  label="Rows shown"
                  value={view}
                  onChange={setView}
                  options={[
                    { value: "problems", label: "To fix", hint: num(bad.length) },
                    { value: "all", label: "All rows", hint: num(records.length) },
                  ]}
                />
                <Field inline label="Skip rows with problems">
                  <Switch checked={skip} onCheckedChange={setSkip} disabled={!bad.length} />
                </Field>
              </div>

              {listed.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: DURATION.slow }} className="grid flex-1">
                  <State framed kind="success" size="sm" title="Every row is ready" description={`Nothing left to fix. ${count(ready)} will be imported.`} className="justify-center" />
                </motion.div>
              ) : (
                <div className="relative">
                  <div ref={table} role="region" aria-label="Rows to review" tabIndex={0} onScroll={measure} className={cn("max-h-[300px] overflow-auto rounded-[14px] ring-1 ring-border", SQUIRCLE, FOCUS)}>
                    <table className="w-full border-collapse text-[13px]">
                      <thead>
                        <tr>
                          {["Row", ...active.map((f) => f.label)].map((h, i) => (
                            <th key={i} scope="col" className={cn("sticky top-0 z-[1] h-9 bg-card px-2.5 text-left text-[12px] font-medium whitespace-nowrap text-muted-foreground shadow-[inset_0_-1px_0_var(--border)]", i === 0 && "w-px")}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody key={view}>
                        <AnimatePresence initial={false}>
                          {listed.slice(0, LIMIT).map((r) => (
                            <motion.tr key={r.index} initial={false} animate="rest" exit="gone" className="border-b border-border/60 last:border-b-0">
                              {[null, ...active].map((f, c) => (
                                <td key={c} className="p-0 align-top">
                                  <motion.div variants={{ rest: { height: "auto", opacity: 1 }, gone: { height: 0, opacity: 0 } }} transition={reduce ? { duration: 0 } : SOFT} className="overflow-hidden">
                                    <div className={cn("px-2.5 whitespace-nowrap", r.bad || fixed.includes(r.index) ? "py-1.5 leading-8" : "py-2 leading-5")}>
                                      {!f ? (
                                        fixed.includes(r.index) && !r.bad ? (
                                          <span className="inline-grid size-5 place-items-center rounded-full bg-success-soft align-middle text-success">
                                            <Tick reduce={reduce} />
                                            <span className="sr-only">Row {r.index + 2}, fixed</span>
                                          </span>
                                        ) : (
                                          <span className="text-muted-foreground tabular-nums">{r.index + 2}</span>
                                        )
                                      ) : r.errors[f.key] ? (
                                        <div className="leading-normal">
                                          <CellEditor field={f} value={r.values[f.key]} error={r.errors[f.key]} line={r.index + 2} at={r.index * 1000 + c} onCommit={(v) => edit(r.index, f.key, v)} onNext={() => focusNext(r.index * 1000 + c)} />
                                        </div>
                                      ) : r.values[f.key] ? (
                                        <span className="block max-w-[220px] truncate">{r.values[f.key]}</span>
                                      ) : (
                                        <span className="text-muted-foreground">–</span>
                                      )}
                                    </div>
                                  </motion.div>
                                </td>
                              ))}
                            </motion.tr>
                          ))}
                        </AnimatePresence>
                      </tbody>
                    </table>
                  </div>
                  {spill && <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-[2] w-10 rounded-r-[14px] bg-linear-to-l from-card to-transparent" />}
                </div>
              )}
              {listed.length > LIMIT && (
                <p className="mt-2 text-[12px] text-muted-foreground tabular-nums">
                  Showing the first {LIMIT} of {num(listed.length)}.
                </p>
              )}
            </Panel>
          )}

          {step === 3 && data && run && (
            <Panel
              key="import"
              {...panel}
              focusKey={run.phase}
              title={{ running: `Importing ${count(run.total)}`, done: "Import complete", cancelled: "Import cancelled", error: "Import failed" }[run.phase]}
              description={run.phase === "running" ? "Keep this open until it finishes." : run.phase === "done" ? `From ${data.name}.` : undefined}
            >
              <AnimatePresence mode="wait" initial={false}>
                {run.phase === "running" ? (
                  <motion.div key="running" exit={{ opacity: 0 }} transition={{ duration: DURATION.fast }} className={cn("grid flex-1 place-content-center justify-items-center rounded-[14px] px-5 py-8 text-center ring-1 ring-border ring-inset", SQUIRCLE)}>
                    <span className={TILE}>
                      <FileSpreadsheet aria-hidden />
                    </span>
                    <p className="mt-3 text-[27px] leading-none font-medium tracking-[-0.02em] tabular-nums">
                      {num(run.done)} <span className="text-[13px] font-normal tracking-normal text-muted-foreground">of {num(run.total)}</span>
                    </p>
                    <div
                      role="progressbar"
                      aria-label={`Importing ${words.other}`}
                      aria-valuemin={0}
                      aria-valuemax={run.total}
                      aria-valuenow={run.done}
                      aria-valuetext={`${run.done} of ${run.total}`}
                      className="mt-4 h-1.5 w-[min(320px,60cqw)] overflow-hidden rounded-full bg-foreground/10"
                    >
                      <motion.div initial={false} animate={{ width: `${run.total ? (run.done / run.total) * 100 : 0}%` }} transition={reduce ? { duration: 0 } : { duration: 0.3, ease: "linear" }} className="h-full rounded-full bg-foreground/60" />
                    </div>
                    <p className="mt-3 max-w-full truncate text-[12px] text-muted-foreground">{data.name}</p>
                  </motion.div>
                ) : run.phase === "done" ? (
                  <motion.div key="done" initial={{ opacity: 0, y: reduce ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: DURATION.slow }} className="flex min-w-0 flex-col gap-3">
                    <dl className={cn("grid grid-cols-[repeat(3,minmax(0,1fr))] gap-px overflow-hidden rounded-[14px] bg-border ring-1 ring-border", SQUIRCLE)}>
                      {[
                        { label: "Imported", value: run.result?.imported ?? 0, note: `of ${num(records.length)} ${records.length === 1 ? "row" : "rows"}` },
                        { label: "Skipped", value: run.skipped.length, note: "Had problems" },
                        { label: "Failed", value: run.result?.failed?.length ?? 0, note: "Refused" },
                      ].map((s, i) => (
                        <div key={s.label} className="min-w-0 bg-card px-3.5 py-3">
                          <dt className="text-[12px] text-muted-foreground">{s.label}</dt>
                          <dd className="mt-1 flex items-center gap-2 text-[22px] leading-none font-medium tracking-[-0.02em] tabular-nums">
                            <CountUp to={s.value} reduce={reduce} />
                            {i === 0 && s.value > 0 && (
                              <span className="grid size-5 place-items-center rounded-full bg-success-soft text-success">
                                <Tick reduce={reduce} delay={0.5} />
                              </span>
                            )}
                          </dd>
                          <dd className="mt-1.5 truncate text-[12px] text-muted-foreground">{s.note}</dd>
                        </div>
                      ))}
                    </dl>
                    {misses.length > 0 && (
                      <div className={cn("rounded-[14px] ring-1 ring-border ring-inset", SQUIRCLE)}>
                        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border py-2 pr-2 pl-3">
                          <p className="text-[13px] font-medium tabular-nums">
                            {num(misses.length)} {misses.length === 1 ? "row was" : "rows were"} not imported
                          </p>
                          <Button variant="outline" size="sm" onClick={report}>
                            <Download />
                            Download error report
                          </Button>
                        </div>
                        <ul className="divide-y divide-border/60">
                          {misses.slice(0, 5).map((m) => (
                            <li key={`${m.index}-${m.failed}`} className="flex items-baseline gap-3 px-3 py-2 text-[13px] leading-snug">
                              <span className="w-12 shrink-0 text-muted-foreground tabular-nums">Row {m.index + 2}</span>
                              <span className="min-w-0 flex-1 break-words">
                                <span className="font-medium">{data.rows[m.index]?.find(Boolean) ?? "Empty row"}</span>
                                <span className="text-muted-foreground"> · {m.reason}</span>
                              </span>
                              <Badge size="sm" tone={m.failed ? "destructive" : "neutral"}>
                                {m.failed ? "Failed" : "Skipped"}
                              </Badge>
                            </li>
                          ))}
                        </ul>
                        {misses.length > 5 && <p className="border-t border-border/60 px-3 py-2 text-[12px] text-muted-foreground tabular-nums">And {num(misses.length - 5)} more, all in the error report.</p>}
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div key={run.phase} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: DURATION.slow }} className="grid flex-1">
                    <State
                      framed
                      size="sm"
                      kind={run.phase === "error" ? "error" : "empty"}
                      icon={run.phase === "cancelled" ? <X aria-hidden className="size-4" /> : undefined}
                      title={`Stopped at ${num(run.done)} of ${num(run.total)}`}
                      description={<span className="block text-balance">{run.phase === "error" ? run.error : "Rows already sent may have been saved. Your fixes and matches are still here."}</span>}
                      className="justify-center"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </Panel>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3 @min-[560px]:px-5">
        {note && <p className="w-full text-right text-[12px] text-muted-foreground tabular-nums @min-[560px]:order-2 @min-[560px]:ml-auto @min-[560px]:w-auto">{note}</p>}
        {back && (
          <Button variant="ghost" onClick={once(back.act)}>
            {back.icon}
            {back.label}
          </Button>
        )}
        {next && (
          <Button ref={primary} variant={next.quiet ? "outline" : "primary"} disabled={next.disabled} onClick={once(next.act)} className={cn("order-3 ml-auto", note && "@min-[560px]:ml-1")}>
            {next.icon}
            {next.label}
          </Button>
        )}
      </div>

      <span role="status" className="sr-only">
        {say}
      </span>
      </div>
    </div>
  );
});

export default DataImport;
