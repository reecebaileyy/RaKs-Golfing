import Link from "next/link";
import { notFound } from "next/navigation";
import { VerifiedAdminButtons } from "@/components/VerifiedAdminButtons";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function VerifyQueuePage() {
  const me = await requireUser("/admin/verify");
  if (!me.isAdmin) notFound();
  const queue = await db.user.findMany({
    where: { ghinNumber: { not: null }, ghinVerifiedAt: null },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { scoreCards: true } } },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Verify GHIN numbers</h1>
      <p className="card p-4 text-sm text-muted">
        This is a manual check until USGA GHIN access is licensed. Look the number up in GHIN, confirm the name and index match, then mark it verified.
        Rejecting clears the number from the golfer&apos;s profile.
      </p>
      {queue.length === 0 ? (
        <p className="text-sm text-muted">Nobody is waiting for a check.</p>
      ) : (
        <ul className="space-y-3">
          {queue.map((u) => (
            <li key={u.id} data-testid={`verify-${u.email}`} className="card space-y-3 p-4">
              <div>
                <Link href={`/golfers/${u.id}`} className="font-semibold">{u.name}</Link>
                <p className="text-sm text-muted">{u.email}</p>
                <p className="mt-1 text-sm">
                  GHIN <span className="font-mono">{u.ghinNumber}</span> · index {u.ghinIndex ?? "–"}{u.state ? ` · ${u.state}` : ""}
                </p>
                <p className="text-xs text-muted">{u._count.scoreCards} {u._count.scoreCards === 1 ? "round" : "rounds"} entered</p>
              </div>
              <VerifiedAdminButtons userId={u.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
