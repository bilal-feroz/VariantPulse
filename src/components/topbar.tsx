"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Menu, Search, ShieldCheck, X } from "lucide-react";

import { CommandPalette } from "@/components/command-palette";
import { Sidebar } from "@/components/sidebar";
import { Badge, PriorityBadge, StatusDot } from "@/components/ui";
import { CURRENT_USER } from "@/data/workspace";
import { useWorkspace } from "@/state/workspace";
import { cn } from "@/lib/utils";
import { evidenceModeMeta } from "@/components/story/mode";
import { RelativeTime } from "@/components/relative-time";

/** Closes a popover on outside click and on Escape. */
function useDismiss(open: boolean, close: () => void) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  return ref;
}

export function Topbar() {
  const pathname = usePathname();
  const { analysis, sync, cases } = useWorkspace();
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [shortcut, setShortcut] = React.useState("Ctrl K");

  React.useEffect(() => {
    setShortcut(/mac|iphone|ipad/i.test(navigator.platform ?? "") ? "⌘ K" : "Ctrl K");
  }, []);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => setMenuOpen(false), [pathname]);

  const notifRef = useDismiss(notifOpen, () => setNotifOpen(false));

  const open = analysis.assessments
    .filter((a) => a.caseId)
    .filter((a) => (cases[a.caseId as string]?.status ?? "Needs review") !== "Resolved");

  const lastChecked = sync.phase === "done" ? sync.at : analysis.checkedAt;
  const mode = evidenceModeMeta(analysis.mode);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-[68px] shrink-0 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open navigation"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line bg-surface text-ink-2 lg:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>

        <Link href="/" className="flex items-center gap-2 lg:hidden">
          <Image src="/logo.png" alt="" width={26} height={26} className="h-[26px] w-[26px]" />
          <span className="text-[15px] font-semibold tracking-tight text-ink">VariantPulse</span>
        </Link>

        <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
          <span
            className="hidden items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 xl:inline-flex"
            title={analysis.reason ? `${mode.detail} ${analysis.reason}` : mode.detail}
          >
            <StatusDot tone={mode.tone} pulse={analysis.mode === "live"} />
            <span className="text-[12px] font-medium text-ink-2">{mode.label}</span>
            <RelativeTime value={lastChecked} className="text-[11.5px] text-faint vp-num" />
          </span>

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="group flex h-10 items-center gap-2.5 rounded-xl border border-line bg-surface px-3 text-left transition-colors hover:border-line-2 sm:w-[268px]"
          >
            <Search className="h-4 w-4 shrink-0 text-faint" />
            <span className="hidden flex-1 truncate text-[13px] text-faint sm:block">
              Search patients, variants...
            </span>
            <kbd className="hidden shrink-0 rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-medium text-faint sm:block">
              {shortcut}
            </kbd>
          </button>

          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setNotifOpen((v) => !v)}
              aria-label={`Review queue, ${open.length} open case${open.length === 1 ? "" : "s"}`}
              aria-expanded={notifOpen}
              className="relative grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface text-ink-2 transition-colors hover:bg-surface-2"
            >
              <Bell className="h-[17px] w-[17px]" />
              {open.length > 0 ? (
                <span className="absolute right-2 top-2 grid h-[15px] min-w-[15px] place-items-center rounded-full bg-crit px-1 text-[9.5px] font-bold text-white vp-num">
                  {open.length}
                </span>
              ) : null}
            </button>

            {notifOpen ? (
              <div className="vp-rise absolute right-0 top-12 w-[330px] overflow-hidden rounded-2xl border border-line-2 bg-surface shadow-[0_22px_60px_-24px_rgba(var(--vp-shadow-rgb),0.36)]">
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                  <p className="text-[13px] font-semibold text-ink">Open review cases</p>
                  <Badge tone={open.length ? "critical" : "positive"}>{open.length}</Badge>
                </div>
                <div className="vp-scroll max-h-[300px] overflow-y-auto">
                  {open.length === 0 ? (
                    <p className="px-4 py-8 text-center text-[12.5px] text-muted">
                      No cases are waiting for review.
                    </p>
                  ) : (
                    open.map((a) => (
                      <Link
                        key={a.caseId}
                        href={`/review/${a.caseId}`}
                        onClick={() => setNotifOpen(false)}
                        className="flex items-start gap-3 border-b border-line px-4 py-3 last:border-0 hover:bg-surface-2"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12.5px] font-medium text-ink">
                            {a.variant.gene} {a.variant.hgvsCoding}
                          </span>
                          <span className="mt-0.5 block text-[11.5px] text-muted">
                            {a.caseId} · {a.impactedRecordCount} record
                            {a.impactedRecordCount === 1 ? "" : "s"}
                          </span>
                        </span>
                        <PriorityBadge level={a.priority.level} />
                      </Link>
                    ))
                  )}
                </div>
                <Link
                  href="/review"
                  onClick={() => setNotifOpen(false)}
                  className="block border-t border-line px-4 py-2.5 text-center text-[12.5px] font-medium text-accent hover:bg-surface-2"
                >
                  Open the review queue
                </Link>
              </div>
            ) : null}
          </div>

          <Link
            href="/settings"
            title={`${CURRENT_USER.name} · ${CURRENT_USER.role}`}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-oxblood text-[14px] font-semibold text-white transition-colors hover:bg-garnet"
          >
            {CURRENT_USER.initials}
            <span className="sr-only">{CURRENT_USER.name}, open settings</span>
          </Link>
        </div>
      </header>

      {menuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]"
          />
          <div className="vp-rise absolute inset-y-0 left-0 w-[268px] bg-surface shadow-2xl">
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close navigation"
              className="absolute right-3 top-4 z-10 grid h-8 w-8 place-items-center rounded-lg text-faint hover:bg-surface-3"
            >
              <X className="h-4 w-4" />
            </button>
            <Sidebar />
          </div>
        </div>
      ) : null}

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </>
  );
}

/** The standing workspace-security marker used in page footers. */
export function ProtectedWorkspaceMark({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-[11.5px] text-faint", className)}
      title="Role-based access, full audit trail, and no patient identifiers sent to external services."
    >
      <ShieldCheck className="h-3.5 w-3.5" />
      Protected clinical workspace
    </span>
  );
}
