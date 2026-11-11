"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { State, Skeleton } from "@/components/ui/state";
import { Button } from "@/components/ui/button";
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const SQUIRCLE = "[corner-shape:squircle]";

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

export interface Series {
  /** Key in each data row. */
  key: string;
  label: string;
  /** Slot 1–5. Defaults to the series' position — keep it stable across filters. */
  slot?: 1 | 2 | 3 | 4 | 5;
}

const color = (s: Series, i: number) => `var(--chart-${s.slot ?? (i % 5) + 1})`;
const AXIS = { fill: "var(--muted-foreground)", fontSize: 11 };
const defaultFormat = (v: number) => v.toLocaleString();

export interface ChartCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Right side of the header: a range select, a menu. */
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function ChartCard({ title, subtitle, actions, className, children, ...rest }: ChartCardProps) {
  return (
    <figure className={cn("m-0 grid gap-4 rounded-[22px] bg-card p-5 text-card-foreground ring-1 ring-border", SQUIRCLE, className)} {...rest}>
      <figcaption className="flex items-start justify-between gap-3">
        <div className="grid gap-0.5">
          <span className="text-[14px] font-medium tracking-[-0.01em]">{title}</span>
          {subtitle && <span className="text-[12px] text-muted-foreground">{subtitle}</span>}
        </div>
        {actions}
      </figcaption>
      {children}
    </figure>
  );
}

function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5" aria-hidden>
      {series.map((s, i) => (
        <li key={s.key} className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <span className="h-2 w-2 rounded-[3px]" style={{ background: color(s, i) }} />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

export const TOOLTIP_GLIDE = { isAnimationActive: true, animationDuration: 180, animationEasing: "ease-out" as const };

export const HOVER_DOT =
  "[&_.recharts-active-dot_circle]:origin-center [&_.recharts-active-dot_circle]:[transform-box:fill-box] [&_.recharts-active-dot_circle]:motion-safe:animate-[layro-dot-in_.22s_cubic-bezier(.22,1,.36,1)]";

export const hoverFade = (on: boolean): React.CSSProperties => ({
  opacity: on ? 1 : 0.38,
  transition: "opacity 200ms ease-out",
});

export function useHoverIndex() {
  const [active, setActive] = React.useState<number | null>(null);
  const handlers = React.useMemo(
    () => ({
      onMouseMove: (s: { activeTooltipIndex?: number; isTooltipActive?: boolean }) =>
        setActive(s?.isTooltipActive && s.activeTooltipIndex != null ? s.activeTooltipIndex : null),
      onMouseLeave: () => setActive(null),
    }),
    [],
  );
  const lit = React.useCallback((i: number) => active == null || active === i, [active]);
  return { active, setActive, handlers, lit };
}

export function PointTip({ anchor, children }: { anchor: HTMLElement | null; children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<{ x: number; y: number } | null>(null);
  React.useLayoutEffect(() => {
    const tip = ref.current;
    const host = tip?.offsetParent as HTMLElement | null;
    if (!anchor || !tip || !host) return setPos(null);
    const a = anchor.getBoundingClientRect();
    const h = host.getBoundingClientRect();
    const half = tip.offsetWidth / 2;
    const x = a.left - h.left + a.width / 2;
    setPos({ x: Math.min(Math.max(x, half), Math.max(half, h.width - half)), y: a.top - h.top });
  }, [anchor]);
  if (!anchor) return null;
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full pb-2 transition-[left,top] duration-150 ease-out motion-reduce:transition-none"
      style={{ left: pos?.x ?? 0, top: pos?.y ?? 0, visibility: pos ? "visible" : "hidden" }}
    >
      <div className="w-max max-w-[240px] rounded-[10px] bg-popover px-3 py-2 text-[12px] text-popover-foreground shadow-float ring-1 ring-border [--pop-y:4px] motion-safe:animate-pop-in">
        {children}
      </div>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  series,
  format,
  labelFormat,
}: TooltipProps<number, string> & { series: Series[]; format: (v: number) => string; labelFormat?: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[140px] rounded-[10px] bg-popover px-3 py-2 text-[12px] text-popover-foreground shadow-float ring-1 ring-border [--pop-y:4px] motion-safe:animate-pop-in">
      {label !== undefined && <p className="mb-1.5 font-medium">{labelFormat ? labelFormat(String(label)) : label}</p>}
      <ul className="grid gap-1">
        {payload.map((p) => {
          const i = series.findIndex((s) => s.key === p.dataKey);
          const s = series[i] ?? { key: String(p.dataKey), label: String(p.name) };
          return (
            <li key={s.key} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="h-2 w-2 rounded-[3px]" style={{ background: color(s, Math.max(i, 0)) }} />
                {s.label}
              </span>
              <span className="font-medium tabular-nums">{format(Number(p.value))}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DataTableFallback<T extends Record<string, unknown>>({
  caption,
  data,
  xKey,
  series,
  format,
}: {
  caption: string;
  data: T[];
  xKey: string;
  series: Series[];
  format: (v: number) => string;
}) {
  return (
    <div className="sr-only">
    <table>
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">{xKey}</th>
          {series.map((s) => (
            <th key={s.key} scope="col">
              {s.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i}>
            <th scope="row">{String(row[xKey])}</th>
            {series.map((s) => (
              <td key={s.key}>{format(Number(row[s.key]))}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}

interface CartesianProps<T> {
  data: T[];
  xKey: keyof T & string;
  series: Series[];
  /** Value formatter for the axis, tooltip and table. */
  format?: (v: number) => string;
  /** Label formatter for the x-axis and tooltip. */
  xFormat?: (v: string) => string;
  height?: number;
  /** Accessible summary, read before the data table. */
  description: string;
  className?: string;
}

export function AreaTrend<T extends Record<string, unknown>>({
  data,
  xKey,
  series,
  format = defaultFormat,
  xFormat,
  height = 220,
  description,
  stacked = false,
  className,
}: CartesianProps<T> & { stacked?: boolean }) {
  const id = React.useId().replace(/:/g, "");
  return (
    <div className={cn("grid gap-3", className)}>
      <Legend series={series} />
      <div role="img" aria-label={description} style={{ height }}>
        <div aria-hidden className={cn("h-full w-full", HOVER_DOT)}><ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
            <defs>
              {series.map((s, i) => (
                <linearGradient key={s.key} id={`${id}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color(s, i)} stopOpacity={0.14} />
                  <stop offset="100%" stopColor={color(s, i)} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey={xKey} tickLine={false} axisLine={false} tick={AXIS} tickMargin={8} tickFormatter={xFormat} minTickGap={24} />
            <YAxis tickLine={false} axisLine={false} tick={AXIS} tickFormatter={format} width={48} />
            <RTooltip
              {...TOOLTIP_GLIDE}
              cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
              content={<ChartTooltip series={series} format={format} labelFormat={xFormat} />}
            />
            {series.map((s, i) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stackId={stacked ? "a" : undefined}
                stroke={color(s, i)}
                strokeWidth={2}
                fill={`url(#${id}-${s.key})`}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)", fill: color(s, i) }}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer></div>
      </div>
      <DataTableFallback caption={description} data={data} xKey={xKey} series={series} format={format} />
    </div>
  );
}

export function BarCompare<T extends Record<string, unknown>>({
  data,
  xKey,
  series,
  format = defaultFormat,
  xFormat,
  height = 220,
  description,
  stacked = false,
  className,
}: CartesianProps<T> & { stacked?: boolean }) {
  const hover = useHoverIndex();
  return (
    <div className={cn("grid gap-3", className)}>
      <Legend series={series} />
      <div role="img" aria-label={description} style={{ height }}>
        <div aria-hidden className="h-full w-full"><ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 0 }} barGap={2} barCategoryGap="28%" {...hover.handlers}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey={xKey} tickLine={false} axisLine={false} tick={AXIS} tickMargin={8} tickFormatter={xFormat} />
            <YAxis tickLine={false} axisLine={false} tick={AXIS} tickFormatter={format} width={48} />
            <RTooltip {...TOOLTIP_GLIDE} cursor={{ fill: "var(--accent)", opacity: 0.6 }} content={<ChartTooltip series={series} format={format} labelFormat={xFormat} />} />
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stackId={stacked ? "a" : undefined}
                fill={color(s, i)}
                maxBarSize={24}
                radius={stacked && i < series.length - 1 ? 0 : [4, 4, 0, 0]}
                stroke={stacked ? "var(--card)" : undefined}
                strokeWidth={stacked ? 2 : 0}
                isAnimationActive={false}
              >
                {data.map((_, j) => (
                  <Cell key={j} style={hoverFade(hover.lit(j))} />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer></div>
      </div>
      <DataTableFallback caption={description} data={data} xKey={xKey} series={series} format={format} />
    </div>
  );
}

export interface DonutSlice {
  label: string;
  value: number;
  slot?: 1 | 2 | 3 | 4 | 5;
}

export function DonutBreakdown({
  data,
  format = defaultFormat,
  centerLabel = "Total",
  description,
  size = 176,
  className,
}: {
  data: DonutSlice[];
  format?: (v: number) => string;
  centerLabel?: string;
  description: string;
  size?: number;
  className?: string;
}) {
  const total = data.reduce((n, d) => n + d.value, 0);
  const series: Series[] = data.map((d, i) => ({ key: d.label, label: d.label, slot: d.slot ?? (((i % 5) + 1) as 1) }));
  const [active, setActive] = React.useState<number | null>(null);
  const lit = (i: number) => active == null || active === i;
  const shown = active != null ? data[active] : null;
  return (
    <div className={cn("flex flex-wrap items-center gap-6", className)}>
      <div role="img" aria-label={description} className="relative shrink-0" style={{ width: size, height: size }}>
        <div aria-hidden className="h-full w-full"><ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="68%"
              outerRadius="100%"
              stroke="var(--card)"
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
              rootTabIndex={-1}
              isAnimationActive={false}
              onMouseEnter={(_, i) => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              {data.map((d, i) => (
                <Cell key={d.label} fill={color(series[i], i)} style={hoverFade(lit(i))} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer></div>
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          <span key={shown?.label ?? "total"} className="grid motion-safe:animate-fade-in">
            <span className="text-[11px] text-muted-foreground">{shown ? shown.label : centerLabel}</span>
            <span className="text-[17px] font-medium tabular-nums">{format(shown ? shown.value : total)}</span>
          </span>
        </div>
      </div>
      <ul className="grid max-w-[340px] min-w-[180px] flex-1 gap-2">
        {data.map((d, i) => (
          <li
            key={d.label}
            className="flex items-center justify-between gap-4 text-[13px]"
            style={hoverFade(lit(i))}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
          >
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: color(series[i], i) }} />
              {d.label}
            </span>
            <span className="tabular-nums">
              <span className="font-medium">{format(d.value)}</span>
              <span className="ml-2 text-muted-foreground">{total ? Math.round((d.value / total) * 100) : 0}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Sparkline({
  data,
  slot = 1,
  height = 36,
  className,
}: {
  data: number[];
  slot?: 1 | 2 | 3 | 4 | 5;
  height?: number;
  className?: string;
}) {
  const rows = data.map((v, i) => ({ i, v }));
  return (
    <div aria-hidden className={className} style={{ height }}>
      <div aria-hidden className="h-full w-full"><ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={`var(--chart-${slot})`}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            strokeLinecap="round"
          />
        </LineChart>
      </ResponsiveContainer></div>
    </div>
  );
}

export interface KpiCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: React.ReactNode;
  /** Change vs the previous period, as a fraction: 0.124 = +12.4%. */
  delta?: number;
  /** Whether up is good (revenue) or bad (churn). Default "up". */
  good?: "up" | "down";
  /** What the delta compares against: "vs last month". */
  period?: string;
  trend?: number[];
}

export function KpiCard({ label, value, delta, good = "up", period, trend, className, ...rest }: KpiCardProps) {
  const up = (delta ?? 0) >= 0;
  const positive = delta === undefined ? null : (up && good === "up") || (!up && good === "down");
  return (
    <div className={cn("grid gap-2 rounded-[18px] bg-card p-4 text-card-foreground ring-1 ring-border", SQUIRCLE, className)} {...rest}>
      <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
      <div className="flex items-end justify-between gap-3">
        <p className="text-[24px] leading-none font-medium tracking-[-0.02em] tabular-nums">{value}</p>
        {trend && <Sparkline data={trend} className="w-20" slot={1} height={28} />}
      </div>
      {delta !== undefined && (
        <p className="flex items-center gap-1 text-[12px]">
          <span className={cn("inline-flex items-center gap-0.5 font-medium tabular-nums", positive ? "text-success" : "text-destructive")}>
            {up ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
            <span className="sr-only">{up ? "Up" : "Down"} </span>
            {Math.abs(delta * 100).toFixed(1)}%
          </span>
          {period && <span className="text-muted-foreground">{period}</span>}
        </p>
      )}
    </div>
  );
}

export interface ChartStatusProps {
  loading?: boolean;
  /** Why the data didn't load. Shows an error state with Try again when onRetry is set. */
  error?: React.ReactNode;
  onRetry?: () => void;
  /** No data to draw. */
  empty?: boolean;
  /** What to say when empty. Default "No data for this period". */
  emptyText?: React.ReactNode;
  height: number;
  /** The loading shape: bars (default), a ring for radial charts, rows for tables. */
  skeleton?: "bars" | "ring" | "rows";
  children: React.ReactNode;
}

export function ChartStatus({ loading, error, onRetry, empty, emptyText = "No data for this period", height, skeleton = "bars", children }: ChartStatusProps) {
  const fade = "motion-safe:animate-[layro-fade-in_.24s_ease-out]";
  if (loading && skeleton === "rows")
    return (
      <div role="status" aria-label="Loading chart" className={cn("grid w-full basis-full content-start gap-1.5", fade)} style={{ height }}>
        {Array.from({ length: Math.max(3, Math.floor(height / 38)) }, (_, i) => (
          <Skeleton key={i} className="h-8" style={{ opacity: 1 - i * 0.07 }} />
        ))}
      </div>
    );
  if (loading && skeleton === "ring")
    return (
      <div role="status" aria-label="Loading chart" className={cn("flex w-full basis-full items-center gap-6", fade)} style={{ height }}>
        <div aria-hidden className="aspect-square h-full shrink-0 rounded-full border-[14px] border-foreground/[0.07] motion-safe:animate-skeleton" />
        <Skeleton lines={3} className="min-w-[140px] flex-1" />
      </div>
    );
  if (loading)
    return (
      <div role="status" aria-label="Loading chart" className={cn("flex w-full basis-full items-end gap-2 px-1", fade)} style={{ height }}>
        {[46, 70, 58, 82, 64, 90, 74, 60].map((h, i) => (
          <Skeleton key={i} className="flex-1 rounded-b-none" style={{ height: `${h}%` }} />
        ))}
      </div>
    );
  if (error)
    return (
      <div className={cn("grid w-full basis-full place-items-center", fade)} style={{ minHeight: height }}>
        <State
          kind="error"
          size="sm"
          title="Couldn't load this chart"
          description={error}
          action={onRetry ? <Button size="sm" variant="outline" onClick={onRetry}>Try again</Button> : undefined}
        />
      </div>
    );
  if (empty)
    return (
      <div className={cn("grid w-full basis-full place-items-center", fade)} style={{ minHeight: height }}>
        <State size="sm" title={emptyText} />
      </div>
    );
  return <>{children}</>;
}

export function useSteadyHeight(showingData: boolean) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [height, setHeight] = React.useState<number>();
  React.useEffect(() => {
    const el = ref.current;
    if (!showingData || !el) return;
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [showingData]);
  return { ref, style: !showingData && height ? { minHeight: height } : undefined };
}

export {
  Legend as ChartLegend,
  ChartTooltip as ChartTooltipContent,
  DataTableFallback as ChartTable,
  color as chartColor,
  AXIS as CHART_AXIS,
  defaultFormat as chartFormat,
};

export default ChartCard;
