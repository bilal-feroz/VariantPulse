import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { cn } from "@/lib/utils";
import { Eyebrow } from "@/components/ui";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  back,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  className?: string;
}) {
  return (
    <header className={cn("pb-6 pt-2", className)}>
      {back ? (
        <Link
          href={back.href}
          className="mb-4 inline-flex items-center gap-1 text-[12.5px] font-medium text-muted transition-colors hover:text-accent"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {back.label}
        </Link>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow ? <Eyebrow className="mb-2">{eyebrow}</Eyebrow> : null}
          <h1 className="text-[27px] font-semibold leading-tight tracking-[-0.025em] text-ink">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-muted">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

/** Standard page shell so every route shares the same gutters and rhythm. */
export function PageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[1360px] px-5 pb-12 sm:px-6 lg:px-8", className)}>
      {children}
      <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <p className="text-[11.5px] text-faint">VariantPulse · Built by Team Kanban</p>
        <p className="text-[11.5px] text-faint">
          Synthetic patient records · Real public genomic evidence
        </p>
      </footer>
    </div>
  );
}
