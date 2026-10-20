"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, ExternalLink, Loader2, LogOut, ShieldCheck, Wallet } from "lucide-react";
import type { Market } from "@/data/markets";
import { useWallet } from "@/lib/wallet";
import { mult, pct, shortWallet, usd } from "@/lib/format";
import { share } from "@/lib/parimutuel";
import { explorerUrl } from "@/lib/solana/config";
import { betPayout, betState, type BetState, type OnchainBet } from "@/lib/solana/program";
import { CopyButton } from "./CopyButton";
import { humanError } from "./TradePanel";

const STATE_LABEL: Record<BetState, string> = {
  pending: "En cours",
  claimable: "Gagnée",
  refundable: "Remboursable",
  lost: "Perdue",
};

export function AccountView({ markets }: { markets: Market[] }) {
  const w = useWallet();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; sig?: string } | null>(null);

  if (!w.ready) return null;

  if (!w.connected) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center fade-up">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gold-soft text-gold-3"><Wallet size={26} /></div>
        <h1 className="text-xl font-bold">Connecte ton wallet</h1>
        <p className="mt-2 text-sm text-muted">Pour miser en USDC et suivre tes mises on-chain.</p>
        <button onClick={() => w.openModal("connect")} className="btn-gold mt-5 w-full py-3">Se connecter</button>
      </div>
    );
  }

  // Chaque mise on-chain retrouve son défi par l'adresse du compte Market.
  const rows = w.bets
    .map((bet) => {
      const market = markets.find((m) => m.chain?.address === bet.market);
      const chain = market?.chain;
      const outcome = market?.outcomes.find((o) => o.index === bet.outcome);
      const state: BetState = chain ? betState(chain, bet) : "pending";
      const payout = chain ? (state === "refundable" ? bet.amount : state === "lost" ? 0 : betPayout(chain, bet)) : 0;
      return { bet, market, chain, outcome, state, payout, sharePct: market && outcome ? share(market, outcome) : 0 };
    })
    .sort((a, b) => (a.state === "claimable" || a.state === "refundable" ? -1 : 0) - (b.state === "claimable" || b.state === "refundable" ? -1 : 0));

  const wagered = rows.reduce((s, r) => s + r.bet.amount, 0);
  const pending = rows.filter((r) => r.state === "pending").reduce((s, r) => s + r.payout, 0);
  const claimable = rows.filter((r) => r.state === "claimable" || r.state === "refundable").reduce((s, r) => s + r.payout, 0);

  const claim = async (bet: OnchainBet) => {
    setMsg(null);
    setBusy(bet.address);
    try {
      const sig = await w.claim(bet);
      setMsg({ ok: true, text: "Retrait effectué, les USDC sont dans ton wallet.", sig });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: humanError(e) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4 fade-up">
        <div className="grid h-14 w-14 place-items-center rounded-2xl text-xl font-bold text-ink" style={{ background: "linear-gradient(135deg,#ffd34d,#f7b801)" }}>
          {w.address!.slice(0, 2)}
        </div>
        <div>
          <h1 className="text-2xl font-bold">Mon compte</h1>
          <div className="mono flex items-center gap-1 text-sm text-muted">
            {shortWallet(w.address!)} <CopyButton value={w.address!} />
            <a href={explorerUrl("address", w.address!)} target="_blank" rel="noreferrer" className="hover:text-ink" title="Explorateur"><ExternalLink size={12} /></a>
            <span className="pill-muted ml-1 py-0">{w.provider}</span>
          </div>
        </div>
        <button onClick={w.disconnect} className="btn-ghost ml-auto"><LogOut size={14} /> Déconnexion</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger">
        <div className="card p-5" style={{ background: "linear-gradient(135deg,#fff,#fff6d6)" }}>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">USDC dans le wallet</div>
          <div className="mono mt-1 text-3xl font-bold">{usd(w.balance)}</div>
          <div className="mt-3 flex gap-2">
            <button onClick={() => w.openModal("receive")} className="btn-gold flex-1 py-2"><ArrowDownToLine size={14} /> Recevoir</button>
            <button onClick={() => w.refresh()} className="btn-ghost flex-1 py-2">Actualiser</button>
          </div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">Total misé</div>
          <div className="mono mt-1 text-3xl font-bold">{usd(wagered)}</div>
          <div className="mt-1 text-xs text-muted">{rows.length} mise(s) on-chain</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">Gain estimé</div>
          <div className="mono mt-1 text-3xl font-bold text-up">{usd(pending)}</div>
          <div className="mt-1 text-xs text-muted">mises en cours, si tous tes KOLs gagnent</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">À retirer</div>
          <div className={`mono mt-1 text-3xl font-bold ${claimable > 0 ? "text-up" : ""}`}>{usd(claimable)}</div>
          <div className="mt-1 text-xs text-muted">gains et remboursements disponibles</div>
        </div>
      </div>

      {msg && (
        <p className={`text-sm ${msg.ok ? "text-up" : "text-down"}`}>
          {msg.text}
          {msg.sig && (
            <a href={explorerUrl("tx", msg.sig)} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-0.5 underline">
              transaction <ExternalLink size={11} />
            </a>
          )}
        </p>
      )}

      <section id="positions" className="card fade-up">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="font-bold">Mes mises</h2>
          <Link href="/" className="text-sm font-semibold text-gold-3 hover:underline">Voir les défis</Link>
        </div>
        {rows.length === 0 ? (
          <p className="border-t border-line px-5 py-8 text-center text-sm text-muted">Aucune mise. Choisis un défi et mise sur ton KOL.</p>
        ) : (
          <div className="overflow-x-auto border-t border-line">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-2">Défi</th>
                  <th className="px-3 py-2">KOL</th>
                  <th className="px-3 py-2 text-right">Misé</th>
                  <th className="px-3 py-2 text-right">Dans la cagnotte</th>
                  <th className="px-3 py-2 text-right">Part du pool</th>
                  <th className="px-3 py-2 text-right">Gain</th>
                  <th className="px-3 py-2 text-right">Cote</th>
                  <th className="px-5 py-2 text-right">État</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ bet, market, outcome, state, payout, sharePct }) => (
                  <tr key={bet.address} className="border-t border-line">
                    <td className="max-w-[260px] truncate px-5 py-3">
                      {market ? (
                        <Link href={`/market/${market.slug}`} className="font-medium hover:text-gold-3">{market.title}</Link>
                      ) : (
                        <a href={explorerUrl("address", bet.market)} target="_blank" rel="noreferrer" className="mono text-xs text-muted">{shortWallet(bet.market)}</a>
                      )}
                    </td>
                    <td className="px-3 py-3"><span className="pill-gold">{outcome?.kol.name ?? `#${bet.outcome}`}</span></td>
                    <td className="mono px-3 py-3 text-right">{usd(bet.amount)}</td>
                    <td className="mono px-3 py-3 text-right text-muted">{usd(bet.stake)}</td>
                    <td className="mono px-3 py-3 text-right">{pct(sharePct)}</td>
                    <td className={`mono px-3 py-3 text-right font-semibold ${state === "lost" ? "text-muted" : "text-up"}`}>{usd(payout)}</td>
                    <td className="mono px-3 py-3 text-right">{mult(bet.amount > 0 ? payout / bet.amount : 0)}</td>
                    <td className="px-5 py-3 text-right">
                      {state === "claimable" || state === "refundable" ? (
                        <button onClick={() => claim(bet)} disabled={busy !== null} className="btn-gold py-1.5 text-xs">
                          {busy === bet.address ? <Loader2 size={12} className="animate-spin" /> : null}
                          {state === "claimable" ? "Retirer le gain" : "Me rembourser"}
                        </button>
                      ) : (
                        <span className={state === "lost" ? "pill-muted" : "pill-up"}>{STATE_LABEL[state]}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-5 py-3 text-xs text-muted">Les mises sont définitives. Le gain estimé suit la cagnotte jusqu&apos;à la clôture, puis 24 h de contestation après la résolution avant le retrait.</p>
          </div>
        )}
      </section>

      <div className="flex items-start gap-3 rounded-2xl border border-line bg-white/60 p-4 text-xs text-muted fade-up">
        <ShieldCheck size={18} className="shrink-0 text-up" />
        <p>
          Marketcoins est non-custodial : les cagnottes vivent dans un programme Solana et tu signes chaque opération avec ton wallet.
          Nous ne stockons jamais de clé privée. <Link href="/conditions" className="underline">Conditions d&apos;utilisation</Link>.
        </p>
      </div>
    </div>
  );
}
