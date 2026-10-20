"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Info, Loader2, Wallet } from "lucide-react";
import type { Market, Outcome } from "@/data/markets";
import { useWallet } from "@/lib/wallet";
import { mult, pct, usd } from "@/lib/format";
import { multiplier, quote, share, totalPool } from "@/lib/parimutuel";
import { explorerUrl } from "@/lib/solana/config";
import { Avatar } from "./Avatar";

/**
 * Panneau de mise parimutuel : on choisit un KOL et un montant, la mise part du
 * wallet vers la cagnotte on-chain. Le gain affiché est une estimation sur la
 * cagnotte actuelle.
 */
export function TradePanel({ market, outcome }: { market: Market; outcome: Outcome }) {
  const w = useWallet();
  const router = useRouter();
  const [amount, setAmount] = useState(10);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; sig?: string } | null>(null);

  const q = quote(market, outcome, amount);
  const before = multiplier(market, outcome);
  const total = totalPool(market);

  const chain = market.chain;
  const now = useSyncExternalStore(everySecond, () => Math.floor(Date.now() / 1000), () => 0);
  const closed = chain ? chain.status !== "open" || (now > 0 && now >= chain.closesAt) : false;
  const blocked = !w.enabled ? "Programme non configuré sur ce déploiement." : !chain ? "Ce défi n'est pas encore ouvert on-chain." : closed ? "Les mises sont fermées." : null;

  const submit = async () => {
    setMsg(null);
    if (!w.connected) return w.openModal("connect");
    if (blocked) return setMsg({ ok: false, text: blocked });
    if (amount <= 0) return setMsg({ ok: false, text: "Montant invalide." });
    if (amount > w.balance) return setMsg({ ok: false, text: "Solde USDC insuffisant." });
    setBusy(true);
    try {
      const sig = await w.placeBet(chain!.marketId, outcome.index, amount);
      setMsg({ ok: true, text: `Mise placée : ${usd(q.amount)} sur ${outcome.kol.name}. Gain estimé ${usd(q.payout)} s'il gagne.`, sig });
      router.refresh(); // recharge les cagnottes on-chain
    } catch (e) {
      setMsg({ ok: false, text: humanError(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card sticky top-28 p-5">
      <div className="mb-4 flex items-center gap-3">
        <Avatar kol={outcome.kol} size={40} ring />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs text-muted">{market.question}</div>
          <div className="font-bold">Miser sur {outcome.kol.name}</div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-cream-2 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">Part du pool</div>
          <div className="mono mt-0.5 text-lg font-bold">{pct(share(market, outcome))}</div>
          <div className="text-[11px] text-muted">{usd(outcome.pool, { compact: true })} sur {usd(total, { compact: true })}</div>
        </div>
        <div className="rounded-xl bg-gold-soft p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-gold-3">Cote actuelle</div>
          <div className="mono mt-0.5 text-lg font-bold text-gold-3">{mult(before)}</div>
          <div className="text-[11px] text-muted">par $ misé s&apos;il gagne</div>
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted">
        <span>Montant</span>
        {w.connected && <span className="mono normal-case tracking-normal">Solde {usd(w.balance)}</span>}
      </div>
      <div className="relative mb-2">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xl font-bold text-muted">$</span>
        <input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
          className="input mono pl-8 text-2xl font-bold"
        />
      </div>
      <div className="mb-4 grid grid-cols-4 gap-2">
        {[1, 20, 100].map((v) => (
          <button key={v} onClick={() => setAmount((a) => a + v)} className="btn-ghost py-1.5">+${v}</button>
        ))}
        <button onClick={() => setAmount(Math.floor(w.balance))} className="btn-ghost py-1.5">Max</button>
      </div>

      <div className="mb-4 rounded-xl bg-cream-2 p-3 text-sm">
        <div className="flex justify-between py-0.5">
          <span className="text-muted">Frais (2 %)</span>
          <span className="mono font-semibold">{usd(q.fee)}</span>
        </div>
        <div className="flex justify-between py-0.5">
          <span className="text-muted">Mise dans la cagnotte</span>
          <span className="mono font-semibold">{usd(q.stake)}</span>
        </div>
        <div className="flex justify-between py-0.5">
          <span className="text-muted">Ta cote après mise</span>
          <span className="mono font-semibold">{mult(q.multiplier)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-line pt-2">
          <span className="font-semibold">Gain estimé si {outcome.kol.name} gagne</span>
          <span className="mono font-bold text-up">
            {usd(q.payout)} <span className="text-xs">({q.profit >= 0 ? "+" : ""}{((q.profit / Math.max(q.amount, 1)) * 100).toFixed(0)} %)</span>
          </span>
        </div>
      </div>

      {msg && (
        <p className={`mb-3 text-sm ${msg.ok ? "text-up" : "text-down"}`}>
          {msg.text}
          {msg.sig && (
            <a href={explorerUrl("tx", msg.sig)} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-0.5 underline">
              transaction <ExternalLink size={11} />
            </a>
          )}
        </p>
      )}

      {w.connected && blocked ? (
        <button disabled className="btn-ghost w-full py-3 text-base">{blocked}</button>
      ) : (
        <button onClick={submit} disabled={busy} className="btn-gold w-full py-3 text-base">
          {busy ? (
            <><Loader2 size={16} className="animate-spin" /> Signature dans le wallet…</>
          ) : w.connected ? (
            `Miser ${usd(q.amount)} sur ${outcome.kol.name}`
          ) : (
            <><Wallet size={16} /> Connecter le wallet</>
          )}
        </button>
      )}

      <p className="mt-3 flex items-start gap-1.5 text-[11px] text-muted">
        <Info size={12} className="mt-0.5 shrink-0" />
        <span>
          Mise définitive, sans revente. Le gain final dépend de la cagnotte à la clôture : plus il y a de mises sur ton KOL après toi, plus il baisse. En misant, tu acceptes les <a href="/conditions" className="underline">conditions d&apos;utilisation</a>.
        </span>
      </p>
    </div>
  );
}

function everySecond(cb: () => void) {
  const id = setInterval(cb, 1000);
  return () => clearInterval(id);
}

/** Message lisible pour les erreurs les plus courantes du wallet et du programme. */
export function humanError(e: unknown): string {
  const err = e as { message?: string; error?: { errorCode?: { code?: string }; errorMessage?: string } };
  const code = err.error?.errorCode?.code;
  if (code === "BetsClosed") return "Les mises sont fermées.";
  if (code === "MarketNotOpen") return "Ce défi n'accepte plus de mises.";
  if (code === "DisputeWindowOpen") return "Fenêtre de contestation en cours, retrait possible après.";
  if (code === "LosingBet") return "Cette mise n'a pas gagné.";
  if (err.error?.errorMessage) return err.error.errorMessage;
  const m = err.message ?? "";
  if (/rejected|cancel|denied/i.test(m)) return "Transaction refusée dans le wallet.";
  if (/insufficient|0x1\b/i.test(m)) return "Solde insuffisant (USDC ou SOL pour les frais de réseau).";
  return m || "Transaction échouée.";
}
