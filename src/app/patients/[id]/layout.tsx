import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  // A nested segment's plain title drops the root template, so the suffix is set here.
  return { title: { absolute: `${decodeURIComponent(id)} · VariantPulse` } };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
