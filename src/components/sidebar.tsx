"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ClipboardList,
  Dna,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  Gauge,
  Globe,
  Home,
  Server,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

interface NavGroup {
  label: string | null;
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      { href: "/", label: "Home", icon: Home },
      { href: "/review", label: "Clinical Review", icon: ClipboardList },
      { href: "/patients", label: "Patients", icon: Users },
      { href: "/variants", label: "Variants", icon: Dna },
      { href: "/evidence", label: "Evidence", icon: FileText },
      { href: "/regional", label: "Regional Insights", icon: Globe },
    ],
  },
  {
    label: "Pilot",
    items: [
      { href: "/pilot", label: "Silent Pilot", icon: FlaskConical },
      { href: "/onboarding", label: "Data Onboarding", icon: FileSpreadsheet },
      { href: "/oversight", label: "Oversight", icon: Gauge },
    ],
  },
  {
    label: "Assurance",
    items: [
      { href: "/activity", label: "Audit Trail", icon: Activity },
      { href: "/governance", label: "Trust & Governance", icon: ShieldCheck },
      { href: "/sources", label: "Data Sources", icon: Server },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
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
        "group flex items-center gap-3 rounded-xl px-3 py-[7px] text-[13px] font-medium transition-colors",
        active
          ? "bg-active-bg text-accent"
          : "text-muted hover:bg-surface-3 hover:text-ink",
      )}
    >
      <span
        className={cn(
          "grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors",
          active
            ? "text-accent"
            : "text-slate group-hover:text-ink-2",
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
    <aside className="flex h-full w-[224px] shrink-0 flex-col border-r border-line bg-canvas">
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

      <nav className="vp-scroll flex-1 overflow-y-auto px-3 py-3" aria-label="Main">
        {GROUPS.map((group, index) => (
          <div key={group.label ?? "workspace"} className={cn(index > 0 && "mt-3 border-t border-line pt-3")}>
            {group.label ? (
              <p className="px-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-faint">
                {group.label}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <NavLink item={item} active={isActive(pathname, item.href)} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

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
