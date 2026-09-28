import type { Metadata } from "next";

export const metadata: Metadata = { title: "Silent pilot" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
