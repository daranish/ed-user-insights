"use client";

import * as React from "react";
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

const SKIN = ["#f4d9c0", "#e8b894", "#cf9367", "#a2673f", "#79482a"];
const HAIR = ["#2b2622", "#6b4423", "#a8552c", "#d9a441", "#5c5c5c", "#171717"];
const SHIRT = ["#6478e4", "#df6072", "#3fa66a", "#e1a35b", "#8a63d2", "#3f9fb3"];
const BACKDROP = ["#eef1f4", "#f2eee9", "#eaf1ee", "#f1edf5", "#f3f0e8"];

function hash(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function Hair({ variant, fill }: { variant: number; fill: string }) {
  switch (variant % 6) {
    case 0:
      return <path d="M27 44c0-14 10-22 23-22s23 8 23 22c0-6-8-9-23-9s-23 3-23 9Z" fill={fill} />;
    case 1:
      return (
        <g fill={fill}>
          <circle cx="34" cy="28" r="9" />
          <circle cx="50" cy="23" r="10" />
          <circle cx="66" cy="28" r="9" />
          <circle cx="28" cy="40" r="7" />
          <circle cx="72" cy="40" r="7" />
        </g>
      );
    case 2:
      return (
        <path
          d="M26 46c0-16 11-24 24-24s24 8 24 24v30c0 4-4 6-7 4 2-14 1-24-1-30-4 4-11 6-16 6s-12-2-16-6c-2 6-3 16-1 30-3 2-7 0-7-4V46Z"
          fill={fill}
        />
      );
    case 3:
      return (
        <g fill={fill}>
          <circle cx="50" cy="15" r="8" />
          <path d="M27 44c0-14 10-22 23-22s23 8 23 22c0-7-9-11-23-11s-23 4-23 11Z" />
        </g>
      );
    case 4:
      return (
        <path
          d="M26 47c0-15 11-25 24-25s24 10 24 25c-2-9-9-14-18-14-6 0-10 2-16 6-5 3-10 5-14 8Z"
          fill={fill}
        />
      );
    default:
      return (
        <path
          d="M26 47c0-16 11-25 24-25s24 9 24 25v12c0 3-4 4-6 2 1-8 1-14 0-18-5 4-11 6-18 6s-13-2-18-6c-1 4-1 10 0 18-2 2-6 1-6-2V47Z"
          fill={fill}
        />
      );
  }
}

export interface AvatarProps {
  /** Stable identity — an email is ideal. Same seed, same face, forever. */
  seed: string;
  /** A real photo. Wins over the drawing; falls back to it if it fails. */
  src?: string;
  /** For the alt text and the title attribute. */
  name?: string;
  /** Pixel size. 20–44 are the sizes the set actually uses. */
  size?: number;
  /**
   * Circular by default, matching Share Dialog and Notification Panel — the
   * set has always drawn people as circles and objects as squircles, and a
   * squircle face reads as a file tile. Squircle stays available for the rare
   * case where an avatar sits in a grid of tiles.
   */
  shape?: "circle" | "squircle";
  /** A hairline, for a pale face against a pale surface. */
  ring?: boolean;
  /**
   * What to draw when there is no photo: a generated face (default), or the
   * person's initials from `name` (or the seed) on the muted surface, which
   * suits a minimal or one-accent brand.
   */
  fallback?: "face" | "initials";
  className?: string;
}

export function Avatar({
  seed,
  src,
  name,
  size = 28,
  shape = "circle",
  ring = true,
  fallback = "face",
  className,
}: AvatarProps) {
  const [broken, setBroken] = React.useState(false);
  const h = hash(seed);
  const skin = SKIN[h % SKIN.length];
  const hair = HAIR[(h >> 3) % HAIR.length];
  const shirt = SHIRT[(h >> 6) % SHIRT.length];
  const backdrop = BACKDROP[(h >> 9) % BACKDROP.length];
  const shade = `color-mix(in srgb, ${skin} 86%, #000)`;

  const STEPS = [6, 7, 8, 9, 10, 12, 14, 18];
  const wanted = size * 0.3;
  const radius =
    shape === "circle"
      ? "9999px"
      : `${STEPS.reduce((a, b) => (Math.abs(b - wanted) < Math.abs(a - wanted) ? b : a))}px`;

  const frame = cn(
    "relative inline-grid shrink-0 overflow-hidden bg-muted",
    ring && "ring-1 ring-inset ring-border/65",
    shape === "squircle" && SQUIRCLE,
    className,
  );

  if (src && !broken) {
    return (
      <img
        src={src}
        alt={name ?? ""}
        title={name}
        onError={() => setBroken(true)}
        style={{ width: size, height: size, borderRadius: radius }}
        className={cn(frame, "object-cover")}
      />
    );
  }

  if (fallback === "initials") {
    const words = (name ?? seed.split("@")[0]).split(/[\s._-]+/).filter(Boolean);
    const letters = (words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] ?? "?").slice(0, 2)).toUpperCase();
    return (
      <span
        role="img"
        aria-label={name ?? seed}
        title={name}
        style={{ width: size, height: size, borderRadius: radius, fontSize: Math.round(size * 0.38) }}
        className={cn(frame, "place-items-center font-medium text-foreground/80 select-none")}
      >
        {letters}
      </span>
    );
  }

  return (
    <span style={{ width: size, height: size, borderRadius: radius }} className={frame} title={name}>
      <svg viewBox="0 0 100 106" aria-hidden className="h-full w-full">
        <rect width="100" height="106" fill={backdrop} />
        <path d="M12 106c0-23 17-34 38-34s38 11 38 34Z" fill={shirt} />
        <path d="M42 73h16l-8 10Z" fill={backdrop} opacity="0.5" />
        <path d="M42 60h16v14a8 8 0 0 1-16 0Z" fill={shade} />
        <circle cx="27" cy="47" r="4.5" fill={skin} />
        <circle cx="73" cy="47" r="4.5" fill={skin} />
        <ellipse cx="50" cy="45" rx="22" ry="24.5" fill={skin} />
        <Hair variant={h >> 12} fill={hair} />
        <ellipse cx="42" cy="46" rx="1.9" ry="2.4" fill="#2b2622" />
        <ellipse cx="58" cy="46" rx="1.9" ry="2.4" fill="#2b2622" />
        <path
          d="M44 54c2 2.4 10 2.4 12 0"
          stroke="#2b2622"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
          opacity="0.8"
        />
      </svg>
      {name && <span className="sr-only">{name}</span>}
    </span>
  );
}

export function AvatarStack({
  people,
  size = 24,
  max = 3,
  className,
}: {
  people: Array<{ seed: string; src?: string; name?: string }>;
  size?: number;
  max?: number;
  className?: string;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <span className={cn("flex items-center", className)}>
      {shown.map((p, i) => (
        <span key={p.seed + i} style={{ marginLeft: i === 0 ? 0 : -size * 0.32 }}>
          <Avatar {...p} size={size} className="ring-2 ring-card" />
        </span>
      ))}
      {rest > 0 && (
        <span
          style={{ width: size, height: size, marginLeft: -size * 0.32 }}
          className={cn(
            "grid shrink-0 place-items-center rounded-full bg-muted-foreground/20 text-[10px] font-semibold text-foreground/75",
            "ring-2 ring-card",
          )}
        >
          +{rest}
        </span>
      )}
    </span>
  );
}

export default Avatar;
