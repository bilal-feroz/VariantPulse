import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { Sidebar } from "@/components/sidebar";
import { SyncOverlay } from "@/components/sync";
import { Topbar } from "@/components/topbar";
import { analyseWorkspace } from "@/lib/analysis";
import { serialiseAnalysis } from "@/lib/dto";
import { WorkspaceProvider } from "@/state/workspace";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "VariantPulse — Genomic Change Intelligence",
    template: "%s — VariantPulse",
  },
  description:
    "VariantPulse continuously monitors historical genomic findings against evolving scientific evidence and identifies when old patient records may require clinical review.",
  applicationName: "VariantPulse",
};

export const viewport: Viewport = {
  themeColor: "#eceef5",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const analysis = serialiseAnalysis(await analyseWorkspace());

  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">
        <WorkspaceProvider initial={analysis}>
          <a
            href="#workspace-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-[13px] focus:text-white"
          >
            Skip to content
          </a>
          <div className="flex h-dvh overflow-hidden bg-surface">
            <div className="hidden lg:block">
              <Sidebar />
            </div>
            <div className="relative flex min-w-0 flex-1 flex-col bg-canvas lg:rounded-l-[26px] lg:border-l lg:border-line">
              <Topbar />
              <main
                id="workspace-content"
                className="vp-scroll min-w-0 flex-1 overflow-y-auto overflow-x-hidden"
              >
                {children}
              </main>
            </div>
          </div>
          <SyncOverlay />
        </WorkspaceProvider>
      </body>
    </html>
  );
}
