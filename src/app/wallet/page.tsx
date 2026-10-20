import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { formatCents } from "@/lib/money";
import { getBalances, listHistory } from "@/lib/wagers/ledger";
import { WalletWithdrawForm } from "@/components/WalletWithdrawForm";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  WAGER_HOLD: "Wager held",
  PRESS_HOLD: "Press held",
  SETTLE: "Match settled",
  REFUND: "Wager refunded",
  WITHDRAW: "Withdrawn to bank",
};

function signed(cents: number) {
  return `${cents > 0 ? "+" : ""}${formatCents(cents)}`;
}

export default async function WalletPage() {
  const user = await requireUser("/wallet");
  const [balances, history] = await Promise.all([getBalances(user.id), listHistory(user.id)]);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Wallet</h1>
      <p className="rounded-xl bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-900">Demo money: no real cards are charged</p>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-fairway-700 p-4 text-white">
          <p className="text-sm opacity-80">Available</p>
          <p data-testid="wallet-available" className="text-2xl font-bold">{formatCents(balances.walletCents)}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-muted">Held in matches</p>
          <p data-testid="wallet-held" className="text-2xl font-bold">{formatCents(balances.heldCents)}</p>
        </div>
      </div>
      <p className="text-xs text-muted">
        Wagers are held from your card when you book or join. When a match settles, what you get back and what you win land in
        Available. No cut is taken from wagers.
      </p>

      <WalletWithdrawForm walletCents={balances.walletCents} />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">History</h2>
        {history.length === 0 ? (
          <p className="card p-4 text-center text-sm text-muted">Nothing yet. Book a tee time to start a match.</p>
        ) : (
          <ul className="card divide-y divide-[var(--line)]">
            {history.map((h) => (
              <li key={h.txId} className="flex items-start justify-between gap-3 p-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{KIND_LABEL[h.kind] ?? h.kind}</p>
                  <p className="text-xs text-muted">
                    {h.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" })}
                    {h.matchCode && (
                      <>
                        {" · "}
                        <Link href={`/matches/${h.matchCode}`} className="text-fairway-600">Match {h.matchCode}</Link>
                      </>
                    )}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {h.walletCents !== 0 && <p className={h.walletCents > 0 ? "font-semibold text-fairway-700" : "font-semibold"}>{signed(h.walletCents)}</p>}
                  {h.heldCents !== 0 && <p className="text-xs text-muted">Held {signed(h.heldCents)}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
