"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import {
  AreaTrend,
  BarCompare,
  DonutBreakdown,
  Sparkline,
  type DonutSlice,
  type KpiCardProps,
  type Series,
} from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton, State } from "@/components/ui/state";
import { Button } from "@/components/ui/button";
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const SQUIRCLE = "[corner-shape:squircle]";

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

export interface DashboardKpi extends KpiCardProps {
  icon?: React.ReactNode;
}

export interface DashboardRange {
  value: string;
  label: string;
}

type Row = Record<string, unknown>;

interface CartesianPanel {
  title: string;
  subtitle?: string;
  /** Rows with an x value and one number per series. */
  data: Row[];
  /** The key holding the x value: "day", "week". */
  xKey: string;
  series: Series[];
  format?: (v: number) => string;
  xFormat?: (v: string) => string;
  /** One sentence a screen reader hears before the data table. */
  description: string;
  stacked?: boolean;
}

export interface DashboardRankItem {
  id: string;
  label: React.ReactNode;
  value: number;
  /** Shown instead of the raw number: "$12,400". */
  display?: string;
}

export interface DashboardProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "title"
> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  ranges?: DashboardRange[];
  range?: string;
  onRangeChange?: (value: string) => void;
  /** Up to four read best; more wrap. Each may carry an `icon`. */
  kpis?: DashboardKpi[];
  /** The wide chart. */
  trend?: CartesianPanel;
  /** Parts of a whole, beside the trend. */
  breakdown?: {
    title: string;
    subtitle?: string;
    data: DonutSlice[];
    format?: (v: number) => string;
    centerLabel?: string;
    description: string;
  };
  /** Bars comparing periods or groups. */
  compare?: CartesianPanel;
  /** A ranked list with a bar each: top customers, pages, plans. */
  ranking?: { title: string; subtitle?: string; items: DashboardRankItem[] };
  /** Something extra in the header, beside the range switch. */
  actions?: React.ReactNode;
  loading?: boolean;
  /** Replaces the panels with the reason. */
  error?: React.ReactNode;
  onRetry?: () => void;
  /** No data in this range. */
  empty?: boolean;
}

function Panel({
  title,
  subtitle,
  aside,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className={cn(
        "flex h-full min-w-0 flex-col gap-4 rounded-[20px] bg-card p-5 ring-1 ring-border",
        SQUIRCLE,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="m-0 text-[13.5px] font-semibold tracking-[-0.005em]">
            {title}
          </h3>
          {subtitle && (
            <p className="m-0 mt-0.5 text-[12px] text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
        {aside}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  );
}

function Delta({
  delta,
  good = "up",
}: {
  delta: number;
  good?: "up" | "down";
}) {
  const up = delta >= 0;
  const positive = (up && good === "up") || (!up && good === "down");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-[6px] px-1.5 py-px text-[11.5px] font-medium tabular-nums",
        positive
          ? "bg-success-soft text-success"
          : "bg-destructive-soft text-destructive",
      )}
    >
      {up ? (
        <ArrowUpRight aria-hidden className="size-3" />
      ) : (
        <ArrowDownRight aria-hidden className="size-3" />
      )}
      <span className="sr-only">{up ? "Up" : "Down"} </span>
      {Math.abs(delta * 100).toFixed(1)}%
    </span>
  );
}

export function Dashboard({
  title,
  description,
  ranges,
  range,
  onRangeChange,
  kpis = [],
  trend,
  breakdown,
  compare,
  ranking,
  actions,
  loading = false,
  error,
  onRetry,
  empty = false,
  className,
  style,
  ...props
}: DashboardProps) {
  const reduce = useReducedMotion();
  const enter = (i: number) => ({
    initial: reduce ? false : { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: reduce ? { duration: 0 } : { ...SOFT, delay: i * 0.05 },
  });

  return (
    <div
      className={cn(
        "@container flex w-full flex-col gap-5 text-foreground",
        className,
      )}
      style={style}
      {...props}
    >
      {(title || description || ranges || actions) && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h2 className="m-0 text-[20px] font-medium tracking-[-0.02em]">
                {title}
              </h2>
            )}
            {description && (
              <p className="m-0 mt-1 text-[13px] text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {actions}
            {ranges && range && onRangeChange && (
              <SegmentedControl
                size="sm"
                label="Date range"
                value={range}
                onChange={onRangeChange}
                options={ranges}
              />
            )}
          </div>
        </div>
      )}

      {error ? (
        <State
          framed
          kind="error"
          title="The dashboard did not load"
          description={error}
          action={
            onRetry ? (
              <Button size="sm" onClick={onRetry}>
                Try again
              </Button>
            ) : undefined
          }
        />
      ) : empty && !loading ? (
        <State
          framed
          kind="empty"
          title="Nothing in this range yet"
          description="Pick a longer range, or check back once there is activity."
        />
      ) : (
        <div aria-busy={loading || undefined} className="flex flex-col gap-4">
          {kpis.length > 0 && (
            <motion.div
              {...enter(0)}
              className={cn(
                "grid grid-cols-1 gap-px overflow-hidden rounded-[20px] bg-border ring-1 ring-border @min-[480px]:grid-cols-2 @min-[860px]:grid-cols-4 [&>*]:bg-card",
                SQUIRCLE,
              )}
            >
              {kpis.map((k, i) =>
                loading ? (
                  <div key={i} className="grid gap-3 p-5">
                    {k.icon ? (
                      <div className="flex items-center gap-2">
                        <Skeleton className="size-6 rounded-[7px]" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    ) : (
                      <Skeleton className="h-3 w-20" />
                    )}
                    <Skeleton className="h-7 w-28" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                ) : (
                  <div
                    key={k.label}
                    className="flex min-w-0 flex-col gap-2 p-5"
                  >
                    <p className="m-0 flex min-w-0 items-center gap-2 text-[12.5px] text-muted-foreground">
                      {k.icon && (
                        <span
                          aria-hidden
                          className={cn(
                            "grid size-6 shrink-0 place-items-center rounded-[7px] bg-background text-foreground/75 ring-1 ring-border/80 [&_svg]:size-3.5",
                            SQUIRCLE,
                          )}
                        >
                          {k.icon}
                        </span>
                      )}
                      <span className="truncate">{k.label}</span>
                    </p>
                    <div className="flex min-h-[30px] items-end justify-between gap-3">
                      <p className="m-0 text-[26px] leading-none font-medium tracking-[-0.025em] tabular-nums">
                        {k.value}
                      </p>
                      {k.trend && (
                        <Sparkline
                          data={k.trend}
                          className="w-20"
                          slot={2}
                          height={30}
                        />
                      )}
                    </div>
                    {k.delta !== undefined && (
                      <p className="m-0 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                        <Delta delta={k.delta} good={k.good} />
                        {k.period}
                      </p>
                    )}
                  </div>
                ),
              )}
            </motion.div>
          )}

          {(trend || breakdown) && (
            <motion.div
              {...enter(1)}
              className={cn(
                "grid gap-4",
                trend &&
                  breakdown &&
                  "@min-[860px]:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]",
              )}
            >
              {trend && (
                <Panel title={trend.title} subtitle={trend.subtitle}>
                  {loading ? (
                    <Skeleton className="h-[240px] w-full" />
                  ) : (
                    <AreaTrend
                      data={trend.data}
                      xKey={trend.xKey}
                      series={trend.series}
                      format={trend.format}
                      xFormat={trend.xFormat}
                      description={trend.description}
                      stacked={trend.stacked}
                      height={240}
                    />
                  )}
                </Panel>
              )}
              {breakdown && (
                <Panel title={breakdown.title} subtitle={breakdown.subtitle}>
                  {loading ? (
                    <Skeleton className="mx-auto size-[160px] rounded-full" />
                  ) : (
                    <DonutBreakdown
                      data={breakdown.data}
                      format={breakdown.format}
                      centerLabel={breakdown.centerLabel}
                      description={breakdown.description}
                      size={160}
                      className="justify-center"
                    />
                  )}
                </Panel>
              )}
            </motion.div>
          )}

          {(compare || ranking) && (
            <motion.div
              {...enter(2)}
              className={cn(
                "grid gap-4",
                compare && ranking && "@min-[860px]:grid-cols-2",
              )}
            >
              {compare && (
                <Panel title={compare.title} subtitle={compare.subtitle}>
                  {loading ? (
                    <Skeleton className="h-[220px] w-full" />
                  ) : (
                    <BarCompare
                      data={compare.data}
                      xKey={compare.xKey}
                      series={compare.series}
                      format={compare.format}
                      xFormat={compare.xFormat}
                      description={compare.description}
                      stacked={compare.stacked}
                    />
                  )}
                </Panel>
              )}
              {ranking && (
                <Panel title={ranking.title} subtitle={ranking.subtitle}>
                  {loading ? (
                    <Skeleton lines={5} />
                  ) : (
                    <ol className="m-0 flex list-none flex-col gap-4 p-0">
                      {(() => {
                        const top = Math.max(
                          1,
                          ...ranking.items.map((r) => r.value),
                        );
                        return ranking.items.map((r, i) => (
                          <li key={r.id} className="flex items-start gap-3">
                            <span
                              aria-hidden
                              className="w-4 pt-px text-right text-[12px] text-muted-foreground tabular-nums"
                            >
                              {i + 1}
                            </span>
                            <Progress
                              size="sm"
                              tone="chart"
                              className="flex-1"
                              label={r.label}
                              value={r.value}
                              max={top}
                              showValue
                              formatValue={(v) =>
                                r.display ?? v.toLocaleString()
                              }
                            />
                          </li>
                        ));
                      })()}
                    </ol>
                  )}
                </Panel>
              )}
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}

export default Dashboard;
