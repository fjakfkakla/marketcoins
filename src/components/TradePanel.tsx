"use client";

import { useState } from "react";
import { Info, Wallet } from "lucide-react";
import type { Market, Outcome } from "@/data/markets";
import { useWallet } from "@/lib/wallet";
import { mult, pct, usd } from "@/lib/format";
import { multiplier, quote, share, totalPool } from "@/lib/parimutuel";
import { Avatar } from "./Avatar";

/**
 * Panneau de mise parimutuel : on choisit un KOL et un montant, la mise rejoint
 * la cagnotte. Le gain affiché est une estimation sur la cagnotte actuelle.
 */
export function TradePanel({ market, outcome }: { market: Market; outcome: Outcome }) {
  const w = useWallet();
  const [amount, setAmount] = useState(10);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const q = quote(market, outcome, amount);
  const before = multiplier(market, outcome);
  const total = totalPool(market);

  const submit = () => {
    setMsg(null);
    if (!w.connected) return w.openModal("connect");
    if (amount <= 0) return setMsg({ ok: false, text: "Montant invalide." });
    const ok = w.bet({
      marketSlug: market.slug,
      marketTitle: market.title,
      kolId: outcome.kol.id,
      kolName: outcome.kol.name,
      amount: q.amount,
      fee: q.fee,
      stake: q.stake,
      payoutAtBet: q.payout,
    });
    setMsg(
      ok
        ? { ok: true, text: `Mise placée : ${usd(q.amount)} sur ${outcome.kol.name}. Gain estimé ${usd(q.payout)} s'il gagne.` }
        : { ok: false, text: "Solde insuffisant. Dépose des USDC." },
    );
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

      {msg && <p className={`mb-3 text-sm ${msg.ok ? "text-up" : "text-down"}`}>{msg.text}</p>}

      <button onClick={submit} className="btn-gold w-full py-3 text-base">
        {w.connected ? `Miser ${usd(q.amount)} sur ${outcome.kol.name}` : <><Wallet size={16} /> Connecter le wallet</>}
      </button>

      <p className="mt-3 flex items-start gap-1.5 text-[11px] text-muted">
        <Info size={12} className="mt-0.5 shrink-0" />
        <span>
          Mise définitive, sans revente. Le gain final dépend de la cagnotte à la clôture : plus il y a de mises sur ton KOL après toi, plus il baisse. En misant, tu acceptes les <a href="/conditions" className="underline">conditions d&apos;utilisation</a>.
        </span>
      </p>
    </div>
  );
}
