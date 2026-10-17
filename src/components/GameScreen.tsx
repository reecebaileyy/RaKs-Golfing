"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { detectHole, isAtCourse } from "@/lib/geo";
import type { PlayView } from "@/lib/live";
import { GameFinal } from "./GameFinal";
import { GamePress } from "./GamePress";
import { LiveGrid, LiveStatus } from "./LiveCard";

const CONSENT_KEY = "raks_geo_ok";

function readConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === "1";
  } catch {
    return false;
  }
}

function saveConsent() {
  try {
    localStorage.setItem(CONSENT_KEY, "1");
  } catch {}
}

const first = (name: string) => name.trim().split(/\s+/)[0];

export function GameScreen({ code, initial }: { code: string; initial: PlayView }) {
  const [data, setData] = useState(initial);
  const [tab, setTab] = useState<"hole" | "card">("hole");
  const [hole, setHole] = useState(() => Math.min(18, Math.max(1, initial.holesCompleted + 1)));
  const [drafts, setDrafts] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auto, setAuto] = useState(false);
  const [geoNote, setGeoNote] = useState<string | null>(null);
  const lastDetected = useRef<number | null>(null);

  const editable = ["READY", "LIVE", "CONFIRMING"].includes(data.status);
  const h = data.holes[hole - 1];

  // Other golfers in the group enter scores too, and the status changes with them.
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/play/${code}`, { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } catch {}
  }, [code]);
  useEffect(() => {
    const t = setInterval(() => {
      if (!saving) void refresh();
    }, 5000);
    return () => clearInterval(t);
  }, [refresh, saving]);

  // Location: pick the hole you're standing on. Only started after a tap the first time.
  useEffect(() => {
    if (!auto) return;
    if (!navigator.geolocation) {
      setGeoNote("This device can't share its location.");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        saveConsent();
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (!isAtCourse(here, data.courseLocation, data.courseLocation.geofenceMeters)) {
          setGeoNote("You're not at the course yet, so the hole won't change on its own.");
          return;
        }
        const det = detectHole(here, data.geo, lastDetected.current);
        if (!det) return setGeoNote("This course has no hole map yet.");
        setGeoNote(null);
        if (det.hole !== lastDetected.current) {
          lastDetected.current = det.hole;
          setHole(det.hole);
        }
      },
      (err) => {
        setGeoNote(err.code === err.PERMISSION_DENIED ? "Location is blocked. Pick the hole yourself." : "Can't find you right now.");
        setAuto(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [auto, data.courseLocation, data.geo]);
  useEffect(() => {
    if (readConsent()) setAuto(true);
  }, []);

  const saved = (userId: string, n: number) => data.players.find((p) => p.userId === userId)?.gross[n - 1] ?? null;
  const value = (userId: string) => drafts[`${hole}:${userId}`] ?? saved(userId, hole) ?? h.par;
  const holeSaved = (n: number) => data.players.every((p) => p.gross[n - 1] != null);

  function step(userId: string, delta: number) {
    setDrafts((d) => ({ ...d, [`${hole}:${userId}`]: Math.min(15, Math.max(1, value(userId) + delta)) }));
  }

  async function saveHole() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/play/${code}/scores`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ holeNumber: hole, scores: data.players.map((p) => ({ userId: p.userId, strokes: value(p.userId) })) }),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) return setError(body.error ?? "Couldn't save. Try again.");
    setData(body);
    setDrafts((d) => Object.fromEntries(Object.entries(d).filter(([k]) => !k.startsWith(`${hole}:`))));
    if (hole < 18) setHole(hole + 1);
  }

  async function post(path: string, payload?: unknown): Promise<string | null> {
    const res = await fetch(`/api/play/${code}/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload ?? {}),
    });
    const body = await res.json();
    if (!res.ok) return body.error ?? "Something went wrong.";
    setData(body);
    return null;
  }

  const live = data.status === "LIVE" || data.status === "READY";
  const dirty = data.players.some((p) => drafts[`${hole}:${p.userId}`] !== undefined && drafts[`${hole}:${p.userId}`] !== p.gross[hole - 1]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold leading-tight">{data.course.name}</h1>
          <p className="text-sm text-muted">{data.formatLabel}</p>
        </div>
        <a href={`/live/${code}`} className="text-sm font-medium text-fairway-600 underline">Public card</a>
      </div>

      {!live && <GameFinal view={data} onConfirm={() => post("confirm")} onDispute={(reason) => post("dispute", { reason })} />}

      <div role="tablist" aria-label="Game screen" className="grid grid-cols-2 rounded-xl border border-line bg-card p-1 text-center font-semibold">
        {(["hole", "card"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-lg py-3 ${tab === t ? "bg-fairway-700 text-white" : ""}`}
          >
            {t === "hole" ? "Hole" : "Scorecard"}
          </button>
        ))}
      </div>

      {tab === "card" ? (
        <>
          <LiveStatus view={data} />
          <LiveGrid view={data} />
        </>
      ) : (
        <>
          <nav aria-label="Pick a hole" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {data.holes.map((x) => (
              <button
                key={x.number}
                aria-label={`Hole ${x.number}`}
                aria-current={x.number === hole ? "step" : undefined}
                onClick={() => setHole(x.number)}
                className={`h-12 w-12 shrink-0 rounded-xl border-2 text-lg font-bold tabular-nums ${
                  x.number === hole
                    ? "border-fairway-900 bg-fairway-700 text-white"
                    : holeSaved(x.number)
                      ? "border-fairway-600 bg-fairway-100 text-fairway-900"
                      : "border-line bg-card"
                }`}
              >
                {x.number}
              </button>
            ))}
          </nav>

          <section aria-label={`Hole ${hole}`} className="card p-4 text-center">
            <div className="flex items-center justify-between text-sm text-muted">
              <span>{data.status === "LIVE" || data.status === "READY" ? `Thru ${data.holesCompleted}` : ""}</span>
              <button
                type="button"
                onClick={() => {
                  setAuto((a) => !a);
                  setGeoNote(null);
                }}
                aria-pressed={auto}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${auto ? "border-fairway-700 bg-fairway-700 text-white" : "border-line"}`}
              >
                Auto hole: {auto ? "on" : "off"}
              </button>
            </div>
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">Hole</p>
            <p className="text-8xl font-black leading-none tabular-nums" data-testid="current-hole">{hole}</p>
            <p className="mt-2 text-xl font-bold">
              Par {h.par} <span className="text-muted">·</span> SI {h.strokeIndex}
              {h.yards ? <> <span className="text-muted">·</span> {h.yards} yds</> : null}
            </p>
            {geoNote && <p className="mt-2 text-xs text-muted">{geoNote}</p>}
          </section>

          {editable && <GamePress view={data} onCall={(opponentSide, holeNumber) => post("press", { opponentSide, holeNumber })} />}

          {editable ? (
            <>
              {data.status === "CONFIRMING" && (
                <p className="rounded-xl border border-flame p-3 text-sm">Fixing a score clears everyone&apos;s confirmation. They&apos;ll need to confirm the card again.</p>
              )}
              <ul className="space-y-3">
                {data.players.map((p) => {
                  const dots = p.strokesReceived[hole - 1] ?? 0;
                  return (
                    <li key={p.userId} className="card flex items-center justify-between gap-2 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-bold">{first(p.name)}</p>
                        <p className="text-sm text-flame" aria-label={dots ? `Gets ${dots} stroke${dots > 1 ? "s" : ""}` : "No stroke"}>
                          {dots ? "•".repeat(dots) + (dots === 1 ? " gets a stroke" : ` gets ${dots} strokes`) : <span className="text-muted">no stroke</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={`${first(p.name)} minus one`}
                          onClick={() => step(p.userId, -1)}
                          className="h-14 w-14 rounded-xl border-2 border-fairway-700 text-3xl font-bold text-fairway-700 active:bg-fairway-100"
                        >
                          −
                        </button>
                        <output aria-label={`${first(p.name)} strokes`} className="w-14 text-center text-5xl font-black tabular-nums">{value(p.userId)}</output>
                        <button
                          type="button"
                          aria-label={`${first(p.name)} plus one`}
                          onClick={() => step(p.userId, 1)}
                          className="h-14 w-14 rounded-xl bg-fairway-700 text-3xl font-bold text-white active:bg-fairway-900"
                        >
                          +
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {error && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
              <div className="sticky bottom-16 z-10">
                <button
                  type="button"
                  onClick={saveHole}
                  disabled={saving}
                  className="w-full rounded-xl bg-fairway-900 py-4 text-lg font-bold text-white shadow-lg disabled:opacity-60"
                >
                  {saving ? "Saving…" : hole === 18 ? "Save hole 18" : dirty || !holeSaved(hole) ? `Save hole ${hole}` : `Update hole ${hole}`}
                </button>
              </div>
            </>
          ) : (
            <p className="card p-4 text-sm text-muted">The card is closed. Open the Scorecard tab to see every hole.</p>
          )}

          <LiveStatus view={data} />
        </>
      )}
    </div>
  );
}
