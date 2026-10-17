"use client";

import { useEffect, useState } from "react";
import type { LiveView } from "@/lib/live";
import { LiveGrid, LiveStatus } from "./LiveCard";

/** Subscribes to the match's event stream, falling back to polling every 5 s if it can't connect. */
export function useLiveView(code: string, initial: LiveView): { view: LiveView; connected: boolean } {
  const [view, setView] = useState(initial);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let stopped = false;
    let poll: ReturnType<typeof setInterval> | undefined;
    let source: EventSource | undefined;

    const fetchOnce = async () => {
      try {
        const res = await fetch(`/api/live/${code}`, { cache: "no-store" });
        if (res.ok && !stopped) setView(await res.json());
      } catch {}
    };
    const startPolling = () => {
      if (poll || stopped) return;
      setConnected(false);
      void fetchOnce();
      poll = setInterval(fetchOnce, 5000);
    };

    if (typeof EventSource === "undefined") startPolling();
    else {
      source = new EventSource(`/api/live/${code}/stream`);
      source.onopen = () => setConnected(true);
      source.onmessage = (e) => {
        try {
          setView(JSON.parse(e.data));
          setConnected(true);
        } catch {}
      };
      source.onerror = () => {
        source?.close();
        startPolling();
      };
    }
    return () => {
      stopped = true;
      source?.close();
      clearInterval(poll);
    };
  }, [code]);

  return { view, connected };
}

export function LiveBoard({ code, initial }: { code: string; initial: LiveView }) {
  const { view, connected } = useLiveView(code, initial);
  const [shared, setShared] = useState(false);

  async function share() {
    const url = `${window.location.origin}/live/${code}`;
    const title = `${view.players.map((p) => p.name.split(" ")[0]).join(" vs ")} at ${view.course.name}`;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch {}
  }

  const live = view.status === "LIVE";
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{view.players.map((p) => p.name.split(" ")[0]).join(view.sideNames.length === 2 && view.players.length === 4 ? ", " : " · ")}</h1>
          <p className="text-sm text-muted">{view.course.name}, {view.course.city}</p>
        </div>
        <span
          className={`mt-1 shrink-0 rounded-full px-3 py-1 text-xs font-bold ${live ? "bg-flame text-white" : "bg-fairway-100 text-fairway-900"}`}
          data-testid="live-status"
        >
          {live && connected ? "● LIVE" : statusWords[view.status] ?? view.status}
        </span>
      </div>
      <LiveStatus view={view} />
      <LiveGrid view={view} />
      <button type="button" onClick={share} className="w-full rounded-xl border border-line bg-card py-3 font-medium">
        {shared ? "Link copied" : "Share this scorecard"}
      </button>
    </div>
  );
}

const statusWords: Record<string, string> = {
  OPEN: "Waiting for players",
  READY: "Starting soon",
  LIVE: "Live",
  CONFIRMING: "Final, confirming",
  SETTLED: "Final",
  DISPUTED: "Final, disputed",
  VOID: "Void",
  CANCELLED: "Cancelled",
};
