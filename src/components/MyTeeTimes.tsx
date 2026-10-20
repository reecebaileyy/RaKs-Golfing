"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatCents } from "@/lib/money";
import { GOLFER_KEY } from "@/lib/storage";

interface Item {
  confirmationCode: string;
  status: "CONFIRMED" | "CANCELLED";
  players: number;
  dueAtCourseCents: number;
  teeTime: { startsAt: string; course: { name: string; timezone: string } };
}

export function MyTeeTimes() {
  const [email, setEmail] = useState("");
  const [items, setItems] = useState<Item[] | null>(null);

  async function load(addr: string) {
    const res = await fetch(`/api/reservations?email=${encodeURIComponent(addr)}`);
    setItems(res.ok ? (await res.json()).reservations : []);
  }

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(GOLFER_KEY) ?? "null");
      if (saved?.email) {
        setEmail(saved.email);
        load(saved.email);
      }
    } catch {}
  }, []);

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          load(email);
        }}
        className="flex gap-2"
      >
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email you booked with"
          aria-label="Email you booked with"
          className="min-w-0 flex-1 rounded-xl border border-line bg-card px-4 py-3 text-base outline-none focus:border-fairway-600"
        />
        <button className="rounded-xl bg-fairway-700 px-4 font-semibold text-white">Find</button>
      </form>
      {items?.length === 0 && <p className="card p-6 text-center text-muted">No reservations for that email yet.</p>}
      <ul className="space-y-3">
        {items?.map((r) => {
          const start = new Date(r.teeTime.startsAt);
          const tz = r.teeTime.course.timezone;
          return (
            <li key={r.confirmationCode}>
              <Link href={`/reservations/${r.confirmationCode}`} className="card flex items-center justify-between p-4">
                <div>
                  <p className="font-semibold">{r.teeTime.course.name}</p>
                  <p className="text-sm text-muted">
                    {start.toLocaleDateString("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" })} ·{" "}
                    {start.toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" })} · {r.players}{" "}
                    {r.players === 1 ? "golfer" : "golfers"}
                  </p>
                </div>
                <span className={`text-sm ${r.status === "CANCELLED" ? "text-muted" : "text-fairway-600"}`}>
                  {r.status === "CANCELLED" ? "Cancelled" : r.dueAtCourseCents ? `${formatCents(r.dueAtCourseCents)} at course` : "Paid"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
