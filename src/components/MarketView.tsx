"use client";

import Link from "next/link";
import { useState } from "react";
import { Bookmark, ChevronDown, Code2, ExternalLink, Link2, Send, TrendingDown, TrendingUp } from "lucide-react";
import { explorerUrl } from "@/lib/solana/config";
import type { Market, Period } from "@/data/markets";
import type { Kol } from "@/data/kols";
import { Avatar } from "./Avatar";
import { Countdown } from "./Countdown";
import { CopyButton } from "./CopyButton";
import { PnlChart } from "./PnlChart";
import { Podium } from "./Podium";
import { TradePanel } from "./TradePanel";
import { dateFr, mult, pct, shortWallet, usd } from "@/lib/format";
import { multiplier, share, totalPool } from "@/lib/parimutuel";

const ACTIVITY = [
  { who: "7Gx2…xVq", kol: "Cooker", amt: 250, ago: "il y a 12 s" },
  { who: "Bq91…aa4", kol: "zeropnl", amt: 40, ago: "il y a 48 s" },
  { who: "3Fkd…m0P", kol: "Cented", amt: 120, ago: "il y a 2 min" },
  { who: "9zLm…Qe7", kol: "decu", amt: 75, ago: "il y a 3 min" },
  { who: "Hh3s…k2R", kol: "Cooker", amt: 500, ago: "il y a 5 min" },
];

export function MarketView({ market, kols: KOLS, sibling }: { market: Market; kols: Kol[]; sibling?: Market }) {
  const [selectedId, setSelectedId] = useState(market.outcomes[0].kol.id);
  const selected = market.outcomes.find((o) => o.kol.id === selectedId) ?? market.outcomes[0];
  const [period, setPeriod] = useState<Period>(market.period);
  const [open, setOpen] = useState<"pool" | "activity" | null>("activity");
  const pnlKey = period === "7D" ? "pnl7d" : "pnl30d";
  const total = totalPool(market);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        {/* Header */}
        <div className="fade-up">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="pill-gold">Défi #{market.challenge}</span>
            <span className="pill-muted">KOL · {market.period}</span>
            <span className="pill-muted">{dateFr(market.startsAt)} → {dateFr(market.endsAt)}</span>
            {market.chain ? (
              <a href={explorerUrl("address", market.chain.address)} target="_blank" rel="noreferrer" className="pill-up" title="Cagnotte dans le programme Solana">
                <span className="h-1.5 w-1.5 rounded-full bg-up live-dot" /> on-chain · {market.chain.status === "open" ? "ouvert" : market.chain.status === "resolved" ? "résolu" : "annulé"}
              </a>
            ) : (
              <span className="pill-muted" title="Ce défi n'existe pas encore dans le programme Solana">démo</span>
            )}
            <span className="ml-auto flex items-center gap-1 text-muted">
              <Code2 size={16} className="cursor-pointer hover:text-ink" />
              <Link2 size={16} className="cursor-pointer hover:text-ink" />
              <Bookmark size={16} className="cursor-pointer hover:text-ink" />
            </span>
          </div>
          <div className="mt-3 flex items-start gap-4">
            <div className="flex -space-x-3">
              {market.outcomes.slice(0, 4).map((o) => (
                <Avatar key={o.kol.id} kol={o.kol} size={44} className="ring-2 ring-cream" />
              ))}
            </div>
            <div>
              <h1 className="text-2xl font-bold leading-tight md:text-3xl">{market.title}</h1>
              <p className="mt-1 text-sm text-muted">
                {usd(market.volume, { compact: true })} Vol. · {market.traders} traders · cagnotte {usd(total, { compact: true })}
              </p>
            </div>
          </div>
        </div>

        {/* Stats + countdown */}
        <div className="card flex flex-wrap items-center justify-between gap-6 p-5 fade-up">
          <div className="flex flex-wrap gap-8">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">Favori</div>
              <div className="mt-1 flex items-center gap-2 font-bold">
                <Avatar kol={market.outcomes[0].kol} size={22} /> {market.outcomes[0].kol.name}
                <span className="text-up">{pct(share(market, market.outcomes[0]))}</span>
                <span className="mono text-xs text-muted">{mult(multiplier(market, market.outcomes[0]))}</span>
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">Leader PnL {market.period}</div>
              <div className="mono mt-1 text-xl font-bold text-up">
                {usd(Math.max(...KOLS.map((k) => k[market.period === "7D" ? "pnl7d" : "pnl30d"])), { compact: true, sign: true })}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">Cagnotte</div>
              <div className="mono mt-1 text-xl font-bold">{usd(total, { compact: true })}</div>
            </div>
          </div>
          <Countdown to={market.closesAt} frozenMs={market.chronoFrozenMs} />
        </div>

        {/* Chart */}
        <div className="card p-5 fade-up">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="font-bold">Course au PnL</h2>
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-down live-dot" /> on-chain · MàJ 22:17
            </span>
            <div className="seg ml-auto">
              {(["7D", "30D"] as Period[]).map((p) => (
                <button key={p} className="seg-item" data-active={period === p} onClick={() => setPeriod(p)}>{p}</button>
              ))}
            </div>
          </div>
          <PnlChart kols={KOLS} period={period} highlight={selected.kol.id} />
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {KOLS.map((k) => (
              <button
                key={k.id}
                onClick={() => setSelectedId(k.id)}
                className={`flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition ${selected.kol.id === k.id ? "bg-cream-2 font-semibold" : "text-muted hover:text-ink"}`}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: k.color }} /> {k.name}
              </button>
            ))}
          </div>
        </div>

        {/* Outcomes */}
        <div className="card overflow-hidden fade-up">
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-line px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted md:grid-cols-[1fr_120px_110px_150px]">
            <span>KOL</span>
            <span className="hidden text-right md:block">PnL {market.period}</span>
            <span className="text-right">Part du pool</span>
            <span className="text-right md:text-center">Cote</span>
          </div>
          <ul className="stagger">
            {market.outcomes.map((o, i) => {
              const active = selected.kol.id === o.kol.id;
              return (
                <li
                  key={o.kol.id}
                  onClick={() => setSelectedId(o.kol.id)}
                  className={`grid cursor-pointer grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-line px-5 py-3 transition md:grid-cols-[1fr_120px_110px_150px] ${active ? "bg-gold-soft/40" : "hover:bg-cream-2/60"}`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="w-4 text-xs font-bold text-muted">{i + 1}</span>
                    <Avatar kol={o.kol} size={38} ring={active} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-semibold">
                        {o.kol.name}
                        {i === 0 && <span className="pill-gold py-0 text-[10px]">favori</span>}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted">
                        <a href={`https://x.com/${o.kol.handle}`} target="_blank" rel="noreferrer" className="hover:text-ink" onClick={(e) => e.stopPropagation()}>@{o.kol.handle}</a>
                        <span>·</span>
                        <span className="mono whitespace-nowrap">{shortWallet(o.kol.wallet)}</span>
                        <CopyButton value={o.kol.wallet} />
                      </div>
                    </div>
                  </div>
                  <div className="mono hidden text-right font-semibold text-up md:block">{usd(o.kol[pnlKey], { compact: true, sign: true })}</div>
                  <div className="text-right">
                    <div className="text-lg font-bold">{pct(share(market, o))}</div>
                    <div className={`flex items-center justify-end gap-0.5 text-[11px] ${o.change24h >= 0 ? "text-up" : "text-down"}`}>
                      {o.change24h >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                      {Math.abs(o.change24h).toFixed(1)} pts · {usd(o.pool, { compact: true })}
                    </div>
                  </div>
                  <div className="col-span-3 md:col-span-1">
                    <button onClick={(e) => { e.stopPropagation(); setSelectedId(o.kol.id); }} className={`btn w-full py-2 ${active ? "bg-gold text-ink shadow-sm" : "bg-gold-soft text-gold-3 hover:bg-gold hover:text-ink"}`}>
                      Miser · {mult(multiplier(market, o))}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Podium */}
        <div className="fade-up">
          <div className="mb-3 flex items-center gap-3">
            <h2 className="font-bold">Classement en direct · {period}</h2>
            <span className="text-xs text-muted">PnL réalisé sur le wallet listé</span>
          </div>
          <Podium kols={KOLS} period={period} />
        </div>

        {/* Répartition de la cagnotte / activité */}
        <div className="card fade-up">
          <button onClick={() => setOpen(open === "pool" ? null : "pool")} className="flex w-full items-center justify-between px-5 py-4 font-bold">
            <span>Répartition de la cagnotte <span className="ml-2 text-xs font-normal text-muted">où est l&apos;argent</span></span>
            <span className="flex items-center gap-3 text-xs font-normal text-muted">{usd(total, { compact: true })} <ChevronDown size={16} className={`transition ${open === "pool" ? "rotate-180" : ""}`} /></span>
          </button>
          {open === "pool" && (
            <div className="border-t border-line px-5 py-3 text-sm pop">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
                <span>KOL</span><span className="text-right">Misé</span><span className="text-right">Part</span><span className="text-right">Cote</span>
              </div>
              {market.outcomes.map((o) => {
                const sh = share(market, o);
                return (
                  <div key={o.kol.id} className="relative grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 py-1.5">
                    <span className="absolute inset-y-0 left-0 rounded-md opacity-[0.14]" style={{ width: `${sh * 100}%`, background: o.kol.color }} />
                    <span className="relative flex items-center gap-2 font-medium"><Avatar kol={o.kol} size={18} /> {o.kol.name}</span>
                    <span className="mono relative text-right">{usd(o.pool)}</span>
                    <span className="mono relative text-right font-semibold">{pct(sh)}</span>
                    <span className="mono relative text-right text-gold-3">{mult(multiplier(market, o))}</span>
                  </div>
                );
              })}
              <p className="mt-2 text-xs text-muted">Si un KOL gagne, toute la cagnotte est partagée entre ceux qui ont misé sur lui, au prorata. Plus sa part est petite, plus la cote est haute.</p>
            </div>
          )}
          <button onClick={() => setOpen(open === "activity" ? null : "activity")} className="flex w-full items-center justify-between border-t border-line px-5 py-4 font-bold">
            <span>Activité</span>
            <ChevronDown size={16} className={`text-muted transition ${open === "activity" ? "rotate-180" : ""}`} />
          </button>
          {open === "activity" && (
            <ul className="border-t border-line pop">
              {ACTIVITY.map((a, i) => {
                const k = KOLS.find((x) => x.name === a.kol) ?? KOLS[0];
                return (
                  <li key={i} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                    <span className="mono grid h-7 w-7 place-items-center rounded-full bg-cream-2 text-[10px] font-bold">{a.who.slice(0, 2)}</span>
                    <span className="mono text-xs text-muted">{a.who}</span>
                    <span>a misé</span>
                    <span className="mono font-semibold">{usd(a.amt)}</span>
                    <span>sur</span>
                    <Avatar kol={k} size={18} /> <span className="font-semibold">{a.kol}</span>
                    <span className="hidden text-xs text-muted sm:ml-auto sm:inline">{a.ago}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Rules */}
        <div className="card p-5 fade-up" id="regles">
          <h2 className="mb-3 font-bold">Règles</h2>
          <ol className="space-y-2 text-sm text-muted">
            {market.rules.map((r, i) => (
              <li key={i} className="flex gap-3">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gold-soft text-[11px] font-bold text-gold-3">{i + 1}</span>
                <span>{r}</span>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="pill-muted">Résolution : multisig 2/3 + 24h de contestation</span>
            <span className="pill-muted">Source : données on-chain publiques</span>
          </div>
        </div>

        {/* Traders & wallets */}
        <div className="card p-5 fade-up">
          <h2 className="mb-3 font-bold">Traders &amp; wallets suivis</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {KOLS.map((k) => (
              <div key={k.id} className="flex items-center gap-3 rounded-xl border border-line p-3 transition hover:border-gold">
                <Avatar kol={k} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{k.name}</div>
                  <div className="mono flex items-center gap-1 text-xs text-muted">{shortWallet(k.wallet)} <CopyButton value={k.wallet} /></div>
                </div>
                <div className="flex items-center gap-1 text-muted">
                  <a href={`https://x.com/${k.handle}`} target="_blank" rel="noreferrer" className="grid h-7 w-7 place-items-center rounded-md hover:bg-cream-2 hover:text-ink" title="X">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 2H22l-7.3 8.3L23 22h-6.8l-5.3-6.9L4.8 22H1.7l7.8-8.9L0 2h7l4.8 6.3L18.9 2zm-1.2 18h1.9L6.4 3.9H4.4L17.7 20z"/></svg>
                  </a>
                  <a href={`https://solscan.io/account/${k.wallet}`} target="_blank" rel="noreferrer" className="grid h-7 w-7 place-items-center rounded-md hover:bg-cream-2 hover:text-ink" title="Solscan">
                    <ExternalLink size={13} />
                  </a>
                  <span className="grid h-7 w-7 place-items-center rounded-md" title="Telegram"><Send size={13} /></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <aside className="space-y-4">
        <TradePanel market={market} outcome={selected} />
        {sibling && (
          <Link href={`/market/${sibling.slug}`} className="card card-hover flex items-center gap-3 p-4">
            <div className="flex -space-x-2">
              {sibling.outcomes.slice(0, 3).map((o) => <Avatar key={o.kol.id} kol={o.kol} size={26} className="ring-2 ring-white" />)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{sibling.title}</div>
              <div className="text-xs text-muted">{sibling.period} · {usd(sibling.volume, { compact: true })} Vol.</div>
            </div>
            <span className="font-bold text-up">{pct(share(sibling, sibling.outcomes[0]))}</span>
          </Link>
        )}
      </aside>
    </div>
  );
}
