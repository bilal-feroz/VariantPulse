import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { Sidebar } from "@/components/sidebar";
import { SyncOverlay } from "@/components/sync";
import { Topbar } from "@/components/topbar";
import { analyseWorkspace } from "@/lib/analysis";
import { serialiseAnalysis } from "@/lib/dto";
import { timed } from "@/lib/impact";
import { WorkspaceProvider } from "@/state/workspace";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "VariantPulse · Genomic Change Intelligence",
    template: "%s · VariantPulse",
  },
  description:
    "VariantPulse continuously monitors historical genomic findings against evolving scientific evidence and identifies when old patient records may require clinical review.",
  applicationName: "VariantPulse",
};

export const viewport: Viewport = {
  themeColor: "#f7f4ed",
  width: "device-width",
  initialScale: 1,
};

// Every page carries the evidence read at request time. Left static, a build
// would prerender each page with whatever evidence the build machine saw,
// and because the ClinVar read never throws, Next's signal that the read is
// request-time is swallowed by its fallback, freezing a "cached" state in.
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Timed so the dashboard can show how long the scan behind it really took.
  const { result, durationMs } = await timed(() => analyseWorkspace());
  const analysis = serialiseAnalysis(result);

  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <WorkspaceProvider initial={analysis} initialScanMs={durationMs}>
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
