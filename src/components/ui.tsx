/**
 * Interface primitives.
 *
 * Status is never carried by colour alone: every badge pairs its tone with a
 * word, and where a badge stands in for a longer phrase it carries a `title`
 * so the meaning is reachable on hover and by screen readers.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  CHANGE_TYPES,
  meta as classificationMeta,
  type ChangeType,
  type ClassificationCode,
  type Tone,
} from "@/lib/classification";
import { PRIORITIES, type PriorityLevel } from "@/lib/priority";

/* -- Surfaces -------------------------------------------------------------- */

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("vp-card", className)} {...props}>
      {children}
    </div>
  );
}

export function SectionHeading({
  title,
  action,
  count,
  icon,
  description,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  count?: number;
  icon?: React.ReactNode;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex items-center gap-2.5 min-w-0">
        {icon ? <span className="text-muted shrink-0">{icon}</span> : null}
        {typeof count === "number" ? (
          <span className="grid h-6 min-w-6 place-items-center rounded-full bg-accent-soft px-1.5 text-[12px] font-semibold text-accent vp-num">
            {count}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-semibold text-ink">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{description}</p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Small uppercase label used above headings and beside dense data. */
export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-[11px] font-semibold uppercase tracking-[0.13em] text-faint",
        className,
      )}
    >
      {children}
    </p>
  );
}

/* -- Tone system ----------------------------------------------------------- */

const TONE_CLASS: Record<Tone, string> = {
  critical: "bg-crit-soft text-crit border-crit-border",
  warning: "bg-warn-soft text-warn border-warn-border",
  positive: "bg-ok-soft text-ok border-ok-border",
  neutral: "bg-info-soft text-info border-info-border",
  muted: "bg-surface-3 text-muted border-line-2",
};

const TONE_DOT: Record<Tone, string> = {
  critical: "bg-crit",
  warning: "bg-amber",
  positive: "bg-ok",
  neutral: "bg-info",
  muted: "bg-slate",
};

const TONE_SOLID: Record<Tone, string> = {
  critical: "bg-crit text-white border-crit",
  warning: "bg-warn text-white border-warn",
  positive: "bg-ok text-white border-ok",
  neutral: "bg-info text-white border-info",
  muted: "bg-ink-2 text-white border-ink-2",
};

export function Badge({
  tone = "muted",
  children,
  className,
  dot = false,
  solid = false,
  title,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
  /** Filled rather than tinted. Reserved for a genuine alarm. */
  solid?: boolean;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium leading-none whitespace-nowrap",
        solid ? TONE_SOLID[tone] : TONE_CLASS[tone],
        className,
      )}
    >
      {dot ? (
        <span
          className={cn("h-1.5 w-1.5 rounded-full", solid ? "bg-white/80" : TONE_DOT[tone])}
        />
      ) : null}
      {children}
    </span>
  );
}

export function ClassificationBadge({
  code,
  full = false,
  className,
}: {
  code: ClassificationCode;
  full?: boolean;
  className?: string;
}) {
  const info = classificationMeta(code);
  return (
    <Badge
      tone={info.tone}
      dot
      className={className}
      title={info.code === "VUS" ? "Variant of uncertain significance" : info.label}
    >
      {full ? info.label : info.short}
    </Badge>
  );
}

export function ChangeTypeBadge({
  type,
  className,
}: {
  type: ChangeType;
  className?: string;
}) {
  const info = CHANGE_TYPES[type];
  return (
    <Badge tone={info.tone} className={className} title={info.description}>
      {info.label}
    </Badge>
  );
}

export function PriorityBadge({
  level,
  className,
}: {
  level: PriorityLevel;
  className?: string;
}) {
  const info = PRIORITIES[level];
  return (
    <Badge
      tone={info.tone}
      dot
      solid={level === "CRITICAL"}
      className={className}
      title={info.guidance}
    >
      {info.label}
    </Badge>
  );
}

/* -- Status --------------------------------------------------------------- */

const DOT_COLOUR: Record<Tone | "accent", string> = { ...TONE_DOT, accent: "bg-accent" };

export function StatusDot({
  tone = "positive",
  pulse = false,
  className,
}: {
  tone?: Tone | "accent";
  pulse?: boolean;
  className?: string;
}) {
  const colour = DOT_COLOUR[tone];
  return (
    <span className={cn("relative inline-flex h-2 w-2 shrink-0", className)}>
      {pulse ? (
        <span
          className={cn("absolute inset-0 rounded-full", colour)}
          style={{ animation: "vp-pulse-ring 2.4s ease-out infinite" }}
        />
      ) : null}
      <span className={cn("relative h-2 w-2 rounded-full", colour)} />
    </span>
  );
}

/** Review confidence as filled marks plus the word, never marks alone. */
export function ConfidenceMeter({
  stars,
  strength,
  className,
}: {
  stars: number;
  strength: string;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-2", className)}
      title={`${strength}, ${stars} of 4 review criteria met`}
    >
      <span className="inline-flex gap-0.5" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 w-3.5 rounded-full transition-colors",
              i < stars ? "bg-accent" : "bg-line-2",
            )}
          />
        ))}
      </span>
      <span className="text-[12.5px] font-medium text-ink-2">{strength}</span>
      <span className="sr-only">{`${stars} of 4 review criteria met`}</span>
    </span>
  );
}

/* -- Buttons --------------------------------------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-oxblood text-white hover:bg-garnet active:bg-oxblood shadow-sm shadow-oxblood/20",
  secondary:
    "bg-surface text-accent border border-line hover:bg-canvas active:bg-surface-3",
  ghost: "text-ink-2 hover:bg-surface-3 hover:text-ink",
  danger: "bg-crit text-white hover:bg-crit/90",
};

/** Button styling for elements that are not buttons, such as links. */
export function buttonClasses(
  variant: ButtonVariant = "secondary",
  size: "sm" | "md" | "lg" = "md",
  className?: string,
): string {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors",
    "disabled:pointer-events-none disabled:opacity-45",
    size === "sm" && "h-8 px-3 text-[12.5px]",
    size === "md" && "h-10 px-4 text-[13.5px]",
    size === "lg" && "h-12 px-6 text-[14.5px]",
    BUTTON_VARIANT[variant],
    className,
  );
}

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: "sm" | "md" | "lg";
  }
>(function Button(
  { variant = "secondary", size = "md", className, children, ...props },
  ref,
) {
  return (
    <button ref={ref} className={buttonClasses(variant, size, className)} {...props}
    >
      {children}
    </button>
  );
});

/* -- Data display ---------------------------------------------------------- */

export function Field({
  label,
  value,
  mono = false,
  className,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-faint">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1 text-[13.5px] leading-snug text-ink",
          mono && "font-mono text-[12.5px]",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/** The HGVS string, set in mono so a reviewer can scan it character by character. */
export function VariantLabel({
  gene,
  hgvs,
  protein,
  size = "md",
  className,
}: {
  gene: string;
  hgvs: string;
  protein?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5", className)}>
      <span
        className={cn(
          "font-semibold tracking-tight text-ink",
          size === "sm" && "text-[13px]",
          size === "md" && "text-[15px]",
          size === "lg" && "text-[19px]",
        )}
      >
        {gene}
      </span>
      <span
        className={cn(
          "font-mono text-muted",
          size === "sm" && "text-[11.5px]",
          size === "md" && "text-[12.5px]",
          size === "lg" && "text-[14px]",
        )}
      >
        {hgvs}
        {protein ? ` (${protein})` : ""}
      </span>
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-14 text-center",
        className,
      )}
    >
      {icon ? (
        <span className="grid h-11 w-11 place-items-center rounded-full bg-surface-3 text-faint">
          {icon}
        </span>
      ) : null}
      <div>
        <p className="text-[14px] font-medium text-ink">{title}</p>
        {description ? (
          <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("relative overflow-hidden rounded-lg bg-surface-3", className)}
      aria-hidden
    >
      <div
        className="absolute inset-x-0 h-full bg-gradient-to-b from-transparent via-surface/70 to-transparent"
        style={{ animation: "vp-sweep 1.4s ease-in-out infinite" }}
      />
    </div>
  );
}

/** The standing reminder that this system does not decide anything. */
export function DecisionNotice({ className }: { className?: string }) {
  return (
    <p className={cn("text-[12px] leading-relaxed text-muted", className)}>
      Decision support only. Final interpretation remains with the qualified clinical team.
    </p>
  );
}
