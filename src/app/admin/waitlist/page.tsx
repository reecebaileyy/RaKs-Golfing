import { notFound } from "next/navigation";
import { AdminCommentToggle } from "@/components/AdminCommentToggle";
import { requireUser } from "@/lib/auth";
import { listComments, waitlistStats } from "@/lib/waitlist";
import { METHOD_LABEL, type JoinMethod } from "@/lib/waitlistMath";

export const dynamic = "force-dynamic";

const ROUNDS_LABEL: Record<string, string> = {
  "0-1": "0 to 1 rounds a month",
  "2-4": "2 to 4 rounds a month",
  "5+": "5 or more rounds a month",
  "not given": "Not given",
};

const signUps = (n: number) => `${n} ${n === 1 ? "sign-up" : "sign-ups"}`;

/** "2026-10-03" -> "Oct 3". The date is already a calendar day, so no zone conversion. */
const dayLabel = (ymd: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(new Date(`${ymd}T00:00:00Z`));

function Tile({ label, value, testId }: { label: string; value: number; testId?: string }) {
  return (
    <div className="card p-4">
      <p data-testid={testId} className="text-3xl font-bold tabular-nums">{value}</p>
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

function BarList({ title, rows, total }: { title: string; rows: { label: string; count: number }[]; total?: number }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <section className="card space-y-3 p-4">
      <h2 className="font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">Nothing yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.label}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 break-words">{r.label}</span>
                <span className="shrink-0 tabular-nums text-muted">
                  {r.count}
                  {total ? ` · ${Math.round((r.count / total) * 100)}%` : ""}
                </span>
              </div>
              <div aria-hidden className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--line)]">
                <div className="h-full rounded-full bg-fairway-600" style={{ width: `${(r.count / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function WaitlistDashboardPage() {
  const me = await requireUser("/admin/waitlist");
  if (!me.isAdmin) notFound();
  const [stats, comments] = await Promise.all([waitlistStats(), listComments({ limit: 100, includeHidden: true })]);

  const { daily } = stats;
  const peak = daily.reduce((best, d) => (d.count > best.count ? d : best), daily[0] ?? { date: "", count: 0 });
  const dailyTotal = daily.reduce((sum, d) => sum + d.count, 0);
  const first = daily[0];
  const last = daily[daily.length - 1];
  const chartSummary = first && last
    ? `Daily sign-ups, ${dayLabel(first.date)} to ${dayLabel(last.date)}: ${signUps(dailyTotal)} in total${peak.count > 0 ? `, busiest day ${dayLabel(peak.date)} with ${peak.count}` : ""}.`
    : "No daily sign-ups to show.";

  const commentTime = new Intl.DateTimeFormat("en-US", { timeZone: stats.timeZone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const rounds = [...stats.byRounds].sort((a, b) => Number(a.rounds === "not given") - Number(b.rounds === "not given"));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Waitlist</h1>
        <a href="/api/admin/waitlist/export" className="rounded-xl bg-fairway-700 px-4 py-2 text-sm font-semibold text-white">
          Download CSV
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Tile label="Total sign-ups" value={stats.total} testId="waitlist-total" />
        <Tile label="Today" value={stats.today} />
        <Tile label="Last 7 days" value={stats.last7} />
        <Tile label="Joined from a friend's link" value={stats.referred} />
        <Tile label="With email" value={stats.withEmail} />
        <Tile label="With phone" value={stats.withPhone} />
      </div>

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">Sign-ups per day</h2>
        <div role="img" aria-label={chartSummary} className="flex h-32 items-end gap-px">
          {daily.map((d) => (
            <div key={d.date} title={`${dayLabel(d.date)}: ${signUps(d.count)}`} className="flex h-full flex-1 items-end">
              <div
                className={`w-full rounded-t-sm ${d.count > 0 ? "bg-fairway-600" : "bg-[var(--line)]"}`}
                style={{ height: d.count > 0 ? `${Math.max(4, (d.count / peak.count) * 100)}%` : "2px" }}
              />
            </div>
          ))}
        </div>
        {first && last && (
          <div aria-hidden className="flex justify-between text-xs text-muted">
            <span>{dayLabel(first.date)}</span>
            <span>{dayLabel(last.date)}</span>
          </div>
        )}
        <table className="sr-only">
          <caption>Daily sign-ups</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Sign-ups</th>
            </tr>
          </thead>
          <tbody>
            {daily.map((d) => (
              <tr key={d.date}>
                <th scope="row">{dayLabel(d.date)}</th>
                <td>{d.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <BarList
        title="Signed up with"
        total={stats.total}
        rows={stats.byMethod.map((m) => ({ label: METHOD_LABEL[m.method as JoinMethod] ?? m.method, count: m.count }))}
      />
      <BarList title="Where they came from" total={stats.total} rows={stats.bySource.map((s) => ({ label: s.source, count: s.count }))} />
      <BarList
        title="How often they play"
        total={stats.total}
        rows={rounds.map((r) => ({ label: ROUNDS_LABEL[r.rounds] ?? r.rounds, count: r.count }))}
      />
      <BarList title="Top ZIP codes" rows={stats.topZips.map((z) => ({ label: z.zip, count: z.count }))} />

      <p className="text-xs text-muted">
        &ldquo;Today&rdquo; and the daily counts use {stats.timeZone} time. Source comes from the campaign link, or &ldquo;referral&rdquo; when a friend&apos;s link
        brought them, or &ldquo;direct&rdquo;.
      </p>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Golf talk</h2>
          <p className="text-sm text-muted">
            {stats.comments} showing, {stats.hiddenComments} hidden. Newest first, up to 100.
          </p>
        </div>
        {comments.length === 0 ? (
          <p className="text-sm text-muted">Nobody has posted yet.</p>
        ) : (
          <ul className="space-y-3">
            {comments.map((c) => (
              <li key={c.id} data-testid="admin-comment" className="card flex items-start justify-between gap-3 p-4">
                <div className={`min-w-0 space-y-1 ${c.hidden ? "opacity-70" : ""}`}>
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <span className="font-semibold">{c.author}</span>
                    <span className="text-muted">{commentTime.format(c.createdAt)}</span>
                    {c.hidden && <span className="rounded-full border border-flame px-2 py-0.5 text-xs font-semibold">Hidden</span>}
                  </p>
                  <p className="break-words text-sm">{c.body}</p>
                </div>
                <AdminCommentToggle id={c.id} hidden={c.hidden} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
