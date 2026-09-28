import type { Metadata } from "next";

export const metadata: Metadata = { title: "Regional insights" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
