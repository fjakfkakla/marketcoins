import Link from "next/link";
import { ArrowRight, Calendar, CalendarDays, Flame, LayoutGrid, Sparkles, Trophy, Users } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { BinaryCard } from "@/components/BinaryCard";
import { MarketCard } from "@/components/MarketCard";
import { Countdown } from "@/components/Countdown";
import { BINARY_MARKETS } from "@/data/markets";
import { getKols, getMarkets } from "@/lib/data";
import { usd } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ period?: string; cat?: string }> }) {
  const [sp, MARKETS, KOLS] = await Promise.all([searchParams, getMarkets(), getKols()]);
  const period = sp.period === "7D" || sp.period === "30D" ? sp.period : null;
  const featured = MARKETS.find((m) => m.featured) ?? MARKETS[0];
  const KOL_SIDEBAR = KOLS.slice(0, 7);
  const SIDEBAR = [
    { label: "Tous", count: MARKETS.length + BINARY_MARKETS.length, icon: LayoutGrid, href: "/" },
    { label: "7 jours", count: MARKETS.filter((m) => m.period === "7D").length + BINARY_MARKETS.filter((b) => b.period === "7D").length, icon: Calendar, href: "/?period=7D" },
    { label: "30 jours", count: MARKETS.filter((m) => m.period === "30D").length + BINARY_MARKETS.filter((b) => b.period === "30D").length, icon: CalendarDays, href: "/?period=30D" },
    { label: "Défis", count: MARKETS.length, icon: Trophy, href: "/?cat=kol" },
    { label: "Nouveau", count: 3, icon: Sparkles, href: "/?sort=new" },
  ];
  const markets = period ? MARKETS.filter((m) => m.period === period) : MARKETS;
  const binaries = period ? BINARY_MARKETS.filter((b) => b.period === period) : BINARY_MARKETS;

  return (
    <div className="space-y-8">
      {/* Hero / défi en vedette */}
      <section className="card relative overflow-hidden p-6 fade-up md:p-8" style={{ background: "linear-gradient(120deg,#fff 0%,#fff8dc 60%,#ffeaa3 100%)" }}>
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-gold/25 blur-3xl" />
        <div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="pill-gold"><Flame size={12} /> Premier défi</span>
              <span className="pill-muted">Catégorie KOL</span>
              <span className="pill-muted">7D · 30D</span>
            </div>
            <h1 className="text-3xl font-bold leading-tight md:text-4xl">
              Quel KOL fera le plus de <span className="text-gold-3">profit</span> cette semaine ?
            </h1>
            <p className="mt-2 max-w-xl text-muted">
              7 KOLs, 7 wallets Solana publics, un seul gagnant : celui qui réalise le plus gros PnL sur la période.
              Mise sur ton KOL : s&apos;il gagne, toute la cagnotte est partagée entre ceux qui ont misé sur lui.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link href={`/market/${featured.slug}`} className="btn-gold px-5 py-3 text-base">
                Parier maintenant <ArrowRight size={16} />
              </Link>
              <Link href="/comment-ca-marche" className="btn-ghost py-3">Comment ça marche</Link>
              <div className="ml-1 flex -space-x-2">
                {KOLS.map((k) => <Avatar key={k.id} kol={k} size={30} className="ring-2 ring-white" />)}
              </div>
              <span className="flex items-center gap-1 text-xs text-muted"><Users size={13} /> {featured.traders} traders</span>
            </div>
          </div>
          <div className="card p-5 md:w-64">
            <Countdown to={featured.closesAt} frozenMs={featured.chronoFrozenMs} />
            <div className="mt-4 flex justify-between border-t border-line pt-3 text-sm">
              <span className="text-muted">Cagnotte</span>
              <span className="mono font-bold">{usd(featured.pool, { compact: true })}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Volume</span>
              <span className="mono font-bold">{usd(featured.volume, { compact: true })}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        {/* Sidebar */}
        <aside className="space-y-6">
          <nav className="card p-2">
            {SIDEBAR.map((s) => {
              const active = (s.href === "/" && !period) || (period && s.href.endsWith(period));
              return (
                <Link key={s.label} href={s.href} className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition ${active ? "bg-gold-soft text-ink" : "text-muted hover:bg-cream-2 hover:text-ink"}`}>
                  <s.icon size={16} /> <span className="flex-1">{s.label}</span>
                  <span className="text-xs text-muted">{s.count}</span>
                </Link>
              );
            })}
          </nav>
          <div className="card p-2">
            <div className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted">KOLs suivis</div>
            {KOL_SIDEBAR.map((k) => (
              <Link key={k.id} href={`/market/${featured.slug}`} className="flex items-center gap-2.5 rounded-xl px-3 py-1.5 text-sm font-semibold text-muted transition hover:bg-cream-2 hover:text-ink">
                <Avatar kol={k} size={22} /> <span className="flex-1 truncate">{k.name}</span>
                <span className="mono text-xs text-up">{usd(k.pnl7d, { compact: true, sign: true })}</span>
              </Link>
            ))}
          </div>
        </aside>

        {/* Grid */}
        <div className="space-y-8">
          <section>
            <div className="mb-3 flex items-center gap-3">
              <h2 className="text-xl font-bold">Défis KOL</h2>
              <div className="seg ml-auto">
                <Link href="/" className="seg-item" data-active={!period}>Tous</Link>
                <Link href="/?period=7D" className="seg-item" data-active={period === "7D"}>7D</Link>
                <Link href="/?period=30D" className="seg-item" data-active={period === "30D"}>30D</Link>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 stagger">
              {markets.map((m) => <MarketCard key={m.slug} market={m} />)}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">Marchés Oui / Non</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 stagger">
              {binaries.map((b) => <BinaryCard key={b.slug} market={b} />)}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
