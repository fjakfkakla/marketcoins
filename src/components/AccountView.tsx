"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowDownToLine, ArrowUpFromLine, LogOut, ShieldCheck, Wallet } from "lucide-react";
import type { Market } from "@/data/markets";
import { useWallet } from "@/lib/wallet";
import { mult, pct, shortWallet, usd } from "@/lib/format";
import { currentPayout, share, withStakes } from "@/lib/parimutuel";
import { CopyButton } from "./CopyButton";

export function AccountView({ markets }: { markets: Market[] }) {
  const w = useWallet();

  // Cagnottes avec les mises locales de l'utilisateur incluses, pour estimer les gains du jour.
  const live = useMemo(() => new Map(markets.map((m) => [m.slug, withStakes(m, w.positions)])), [markets, w.positions]);

  if (!w.ready) return null;

  if (!w.connected) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center fade-up">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gold-soft text-gold-3"><Wallet size={26} /></div>
        <h1 className="text-xl font-bold">Connecte ton wallet</h1>
        <p className="mt-2 text-sm text-muted">Pour déposer des USDC, miser et suivre tes mises.</p>
        <button onClick={() => w.openModal("connect")} className="btn-gold mt-5 w-full py-3">Se connecter</button>
      </div>
    );
  }

  const rows = w.positions.map((p) => {
    const m = live.get(p.marketSlug);
    const o = m?.outcomes.find((x) => x.kol.id === p.kolId);
    const payout = m ? currentPayout(m, p.kolId, p.stake) : p.payoutAtBet;
    return { p, m, share: m && o ? share(m, o) : 0, payout };
  });
  const wagered = rows.reduce((s, r) => s + r.p.amount, 0);
  const estimated = rows.reduce((s, r) => s + r.payout, 0);

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
            <span className="pill-muted ml-1 py-0">{w.provider}</span>
          </div>
        </div>
        <button onClick={w.disconnect} className="btn-ghost ml-auto"><LogOut size={14} /> Déconnexion</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger">
        <div className="card p-5" style={{ background: "linear-gradient(135deg,#fff,#fff6d6)" }}>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">Solde disponible</div>
          <div className="mono mt-1 text-3xl font-bold">{usd(w.balance)}</div>
          <div className="mt-3 flex gap-2">
            <button onClick={() => w.openModal("deposit")} className="btn-gold flex-1 py-2"><ArrowDownToLine size={14} /> Déposer</button>
            <button onClick={() => w.openModal("withdraw")} className="btn-ghost flex-1 py-2"><ArrowUpFromLine size={14} /> Retirer</button>
          </div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">Total misé</div>
          <div className="mono mt-1 text-3xl font-bold">{usd(wagered)}</div>
          <div className="mt-1 text-xs text-muted">{w.positions.length} mise(s) en cours</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">Gain estimé</div>
          <div className="mono mt-1 text-3xl font-bold text-up">{usd(estimated)}</div>
          <div className="mt-1 text-xs text-muted">si tous tes KOLs gagnent, cagnotte actuelle</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">Profit estimé</div>
          <div className={`mono mt-1 text-3xl font-bold ${estimated - wagered >= 0 ? "text-up" : "text-down"}`}>{usd(estimated - wagered, { sign: true })}</div>
          <div className="mt-1 text-xs text-muted">varie jusqu&apos;à la clôture des mises</div>
        </div>
      </div>

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
                  <th className="px-3 py-2 text-right">Gain à la mise</th>
                  <th className="px-3 py-2 text-right">Gain estimé</th>
                  <th className="px-5 py-2 text-right">Cote</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ p, share: sh, payout }) => (
                  <tr key={p.id} className="border-t border-line">
                    <td className="max-w-[260px] truncate px-5 py-3"><Link href={`/market/${p.marketSlug}`} className="font-medium hover:text-gold-3">{p.marketTitle}</Link></td>
                    <td className="px-3 py-3"><span className="pill-gold">{p.kolName}</span></td>
                    <td className="mono px-3 py-3 text-right">{usd(p.amount)}</td>
                    <td className="mono px-3 py-3 text-right text-muted">{usd(p.stake)}</td>
                    <td className="mono px-3 py-3 text-right">{pct(sh)}</td>
                    <td className="mono px-3 py-3 text-right text-muted">{usd(p.payoutAtBet)}</td>
                    <td className="mono px-3 py-3 text-right font-semibold text-up">{usd(payout)}</td>
                    <td className="mono px-5 py-3 text-right font-semibold">{mult(p.amount > 0 ? payout / p.amount : 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-5 py-3 text-xs text-muted">Les mises sont définitives. Le gain estimé suit la cagnotte : il baisse quand d&apos;autres misent sur le même KOL, il monte quand ils misent ailleurs.</p>
          </div>
        )}
      </section>

      <section className="card fade-up">
        <h2 className="px-5 py-4 font-bold">Historique</h2>
        {w.activity.length === 0 ? (
          <p className="border-t border-line px-5 py-8 text-center text-sm text-muted">Aucune opération pour l&apos;instant.</p>
        ) : (
          <ul className="border-t border-line">
            {w.activity.map((a) => (
              <li key={a.id} className="flex items-center gap-3 border-b border-line px-5 py-3 text-sm last:border-b-0">
                <span className={`pill py-0.5 ${a.type === "DEPOT" ? "bg-up-soft text-up" : a.type === "MISE" ? "bg-gold-soft text-gold-3" : "bg-cream-2 text-muted"}`}>{a.type}</span>
                <span className="flex-1 truncate">{a.label}</span>
                <span className={`mono font-semibold ${a.amount >= 0 ? "text-up" : "text-ink"}`}>{usd(a.amount, { sign: true })}</span>
                <span className="hidden text-xs text-muted sm:inline">{new Date(a.at).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex items-start gap-3 rounded-2xl border border-line bg-white/60 p-4 text-xs text-muted fade-up">
        <ShieldCheck size={18} className="shrink-0 text-up" />
        <p>
          Marketcoins est non-custodial : tes fonds restent dans un smart contract Solana et tu signes chaque opération avec ton wallet.
          Nous ne stockons jamais de clé privée. <Link href="/conditions" className="underline">Conditions d&apos;utilisation</Link>.
        </p>
      </div>
    </div>
  );
}
