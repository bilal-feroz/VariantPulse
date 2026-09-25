"use client";

/**
 * An absolute, locale-formatted timestamp for the audit trail. The server and
 * the browser can sit in different time zones, so the expected text
 * difference is suppressed rather than treated as a hydration error.
 */
export function Timestamp({ value, className }: { value: string; className?: string }) {
  const date = new Date(value);
  const text = Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(date);
  return (
    <time dateTime={value} className={className} suppressHydrationWarning>
      {text}
    </time>
  );
}
