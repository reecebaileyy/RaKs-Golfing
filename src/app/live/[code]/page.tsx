import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LiveBoard } from "@/components/LiveBoard";
import { getLiveView } from "@/lib/live";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const view = await getLiveView((await params).code);
  return { title: view ? `${view.players.map((p) => p.name.split(" ")[0]).join(" vs ")} · Live scorecard` : "Live scorecard" };
}

export default async function LiveMatchPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const view = await getLiveView(code);
  if (!view) notFound();
  return <LiveBoard code={code} initial={view} />;
}
