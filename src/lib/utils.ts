import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const NUMBER = new Intl.NumberFormat("en-US");

export function formatNumber(value: number): string {
  return NUMBER.format(value);
}

/** Renders an ISO or `YYYY-MM-DD` date as `12 Mar 2024`. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "Not recorded";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/** Year component only, for the then-and-now comparison. */
export function formatYear(value: string | null | undefined): string {
  if (!value) return "-";
  const match = /(\d{4})/.exec(value);
  return match ? match[1] : "-";
}

/** Compact relative time such as `2m ago` or `3d ago`. */
export function relativeTime(value: string | null | undefined, now = Date.now()): string {
  if (!value) return "-";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "-";

  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

/** Splits `BRCA1:c.5056C>T` into its parts. */
export function parseVariantKey(key: string): { gene: string; hgvs: string } {
  const index = key.indexOf(":");
  if (index === -1) return { gene: key, hgvs: "" };
  return { gene: key.slice(0, index), hgvs: key.slice(index + 1) };
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}
