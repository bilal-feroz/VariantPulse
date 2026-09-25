"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowRight,
  ClipboardList,
  Dna,
  FileText,
  Globe,
  Home,
  Server,
  Settings,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

const PRIMARY: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/patients", label: "Patients", icon: Users },
  { href: "/variants", label: "Variants", icon: Dna },
  { href: "/evidence", label: "Evidence", icon: FileText },
  { href: "/review", label: "Clinical Review", icon: ClipboardList },
  { href: "/regional", label: "Regional Insights", icon: Globe },
  { href: "/activity", label: "Activity", icon: Activity },
];

const SECONDARY: NavItem[] = [
  { href: "/sources", label: "Data Sources", icon: Server },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-colors",
        active
          ? "bg-accent-soft text-ink"
          : "text-ink-2 hover:bg-surface-3 hover:text-ink",
      )}
    >
      <span
        className={cn(
          "grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors",
          active
            ? "bg-white text-accent shadow-[0_1px_2px_rgba(18,19,26,0.06)]"
            : "text-faint group-hover:text-ink-2",
        )}
      >
        <Icon className="h-[15px] w-[15px]" strokeWidth={2} />
      </span>
      {item.label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col border-r border-line bg-surface">
      <Link
        href="/"
        className="flex items-center gap-2.5 border-b border-line px-5 py-[18px]"
      >
        <Image
          src="/logo.png"
          alt=""
          width={36}
          height={36}
          priority
          className="h-9 w-9 object-contain"
        />
        <span className="min-w-0">
          <span className="block text-[16.5px] font-semibold leading-none tracking-tight text-ink">
            VariantPulse
          </span>
          <span className="mt-[5px] block whitespace-nowrap text-[10.5px] font-medium leading-none text-faint">
            Genomic Change Intelligence
          </span>
        </span>
      </Link>

      <nav className="vp-scroll flex-1 overflow-y-auto px-3 py-4" aria-label="Main">
        <ul className="space-y-0.5">
          {PRIMARY.map((item) => (
            <li key={item.href}>
              <NavLink item={item} active={isActive(pathname, item.href)} />
            </li>
          ))}
        </ul>

        <div className="my-4 border-t border-line" />

        <ul className="space-y-0.5">
          {SECONDARY.map((item) => (
            <li key={item.href}>
              <NavLink item={item} active={isActive(pathname, item.href)} />
            </li>
          ))}
        </ul>
      </nav>

      <div className="px-3 pb-3">
        <Link
          href="/variants/BRCA1:c.5522G>T"
          className="group relative block overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-[#FFF0F3] to-[#FDF3F5] p-4 transition-shadow hover:shadow-[0_10px_28px_-18px_rgba(40,42,120,0.5)]"
        >
          <HelixMotif className="pointer-events-none absolute -right-3 -top-4 h-28 w-24 opacity-70" />
          <p className="relative max-w-[8.5rem] text-[13.5px] font-semibold leading-snug tracking-tight text-ink">
            Your DNA didn&rsquo;t change.
            <br />
            Science did.
          </p>
          <span className="relative mt-3 grid h-7 w-7 place-items-center rounded-full bg-white text-accent shadow-[0_1px_3px_rgba(18,19,26,0.12)] transition-transform group-hover:translate-x-0.5">
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.4} />
          </span>
        </Link>
      </div>

      <div className="flex items-center gap-2.5 border-t border-line px-5 py-3.5">
        <Image
          src="/logo.png"
          alt=""
          width={22}
          height={22}
          className="h-[22px] w-[22px] object-contain opacity-80"
        />
        <span className="leading-tight">
          <span className="block text-[10.5px] text-faint">Built by</span>
          <span className="block text-[12.5px] font-semibold text-ink-2">Team Kanban</span>
        </span>
      </div>
    </aside>
  );
}

/** Decorative helix used in the sidebar panel. Purely presentational. */
function HelixMotif({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 110" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id="vp-sidebar-strand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FCA5B4" />
          <stop offset="50%" stopColor="#E14B6A" />
          <stop offset="100%" stopColor="#F9A8B8" />
        </linearGradient>
      </defs>
      {[0, 1].map((strand) => (
        <path
          key={strand}
          d={strandPath(strand === 0 ? 0 : Math.PI)}
          stroke="url(#vp-sidebar-strand)"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      ))}
      {Array.from({ length: 7 }, (_, i) => {
        const t = (i + 0.5) / 7;
        const y = t * 110;
        const x1 = 40 + 22 * Math.sin(t * Math.PI * 2.4);
        const x2 = 40 + 22 * Math.sin(t * Math.PI * 2.4 + Math.PI);
        return (
          <line
            key={i}
            x1={x1}
            y1={y}
            x2={x2}
            y2={y}
            stroke="#F3AFC0"
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity={0.55}
          />
        );
      })}
    </svg>
  );
}

function strandPath(phase: number): string {
  const points: string[] = [];
  for (let i = 0; i <= 40; i += 1) {
    const t = i / 40;
    const y = t * 110;
    const x = 40 + 22 * Math.sin(t * Math.PI * 2.4 + phase);
    points.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return points.join(" ");
}
