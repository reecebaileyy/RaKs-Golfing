"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { isAtCourse } from "@/lib/geo";

interface Active {
  code: string;
  courseName: string;
  lat: number;
  lng: number;
  geofenceMeters: number;
  startsAt: string;
  timeZone: string;
}

const CONSENT_KEY = "raks_geo_ok";

function hasConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY) === "1";
  } catch {
    return false;
  }
}

/** Shown to a signed-in golfer whose round is about to start: asks where they are, then offers the game screen. */
export function ArrivalBanner() {
  const pathname = usePathname();
  const [active, setActive] = useState<Active | null>(null);
  const [atCourse, setAtCourse] = useState(false);
  const [asking, setAsking] = useState(false);
  const [denied, setDenied] = useState(false);
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/play/active", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => alive && setActive(b?.match ?? null))
      .catch(() => {});
    setConsent(hasConsent());
    return () => {
      alive = false;
    };
  }, [pathname]);

  const locate = () => {
    if (!active || !navigator.geolocation) return;
    setAsking(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setAsking(false);
        try {
          localStorage.setItem(CONSENT_KEY, "1");
        } catch {}
        setConsent(true);
        setAtCourse(isAtCourse({ lat: pos.coords.latitude, lng: pos.coords.longitude }, active, active.geofenceMeters));
      },
      () => {
        setAsking(false);
        setDenied(true);
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 },
    );
  };

  // Once the golfer has said yes before, check quietly.
  useEffect(() => {
    if (active && consent && !denied) locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, consent]);

  if (!active || pathname.startsWith("/play/")) return null;
  const time = new Intl.DateTimeFormat("en-US", { timeZone: active.timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(active.startsAt));

  return (
    <div role="status" className="mb-4 space-y-2 rounded-2xl border-2 border-flame bg-card p-4">
      {atCourse ? (
        <>
          <p className="font-bold">You&apos;re at {active.courseName}.</p>
          <Link href={`/play/${active.code}`} className="block rounded-xl bg-fairway-700 py-3 text-center font-bold text-white">
            Open the game screen
          </Link>
        </>
      ) : (
        <>
          <p className="font-bold">Your round at {active.courseName} is at {time}.</p>
          <div className="grid grid-cols-2 gap-2">
            {!consent && !denied && (
              <button type="button" onClick={locate} disabled={asking} className="rounded-xl border border-line py-3 font-semibold disabled:opacity-60">
                {asking ? "Finding you…" : "Use my location"}
              </button>
            )}
            <Link href={`/play/${active.code}`} className={`rounded-xl bg-fairway-700 py-3 text-center font-bold text-white ${consent || denied ? "col-span-2" : ""}`}>
              Start round
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
