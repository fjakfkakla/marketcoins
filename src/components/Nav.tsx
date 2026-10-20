"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, CircleHelp, Flame, Search, Wallet } from "lucide-react";
import { Logo } from "./Logo";
import { useWallet } from "@/lib/wallet";
import { shortWallet, usd } from "@/lib/format";

const CATEGORIES = [
  { label: "Tendances", href: "/", icon: true },
  { label: "KOL", href: "/?cat=kol" },
  { label: "7 jours", href: "/?period=7D" },
  { label: "30 jours", href: "/?period=30D" },
  { label: "Nouveau", href: "/?sort=new" },
  { label: "Crypto", href: "/?cat=crypto", soon: true },
  { label: "Memecoins", href: "/?cat=memes", soon: true },
  { label: "Traders", href: "/?cat=traders", soon: true },
  { label: "Devs", href: "/?cat=devs", soon: true },
  { label: "Snipers", href: "/?cat=snipers", soon: true },
];

export function Nav() {
  const w = useWallet();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-cream/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Logo />

        <label className="relative hidden flex-1 md:block">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder="Rechercher un KOL, un marché…" />
        </label>

        <nav className="ml-auto flex items-center gap-2">
          <Link href="/comment-ca-marche" className="btn-ghost hidden border-transparent bg-transparent text-muted hover:text-ink sm:inline-flex">
            <CircleHelp size={16} /> Comment ça marche
          </Link>

          {w.ready && w.connected ? (
            <>
              <button onClick={() => w.openModal("receive")} className="btn-gold hidden sm:inline-flex">
                Recevoir
              </button>
              <Link
                href="/compte"
                className={`btn-ghost gap-3 ${pathname === "/compte" ? "border-gold" : ""}`}
              >
                <span className="mono font-semibold">{usd(w.balance)}</span>
                <span className="hidden items-center gap-1.5 text-xs text-muted sm:flex">
                  <span className="h-1.5 w-1.5 rounded-full bg-up live-dot" />
                  {shortWallet(w.address!)}
                </span>
              </Link>
            </>
          ) : (
            <>
              <button onClick={() => w.openModal("connect")} className="btn-ghost hidden sm:inline-flex">
                Se connecter
              </button>
              <button onClick={() => w.openModal("connect")} className="btn-gold">
                <Wallet size={16} /> S&apos;inscrire
              </button>
            </>
          )}
        </nav>
      </div>

      <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 pb-2 scrollbar-none">
        {CATEGORIES.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              c.soon ? "text-muted/60 hover:text-muted" : "text-muted hover:bg-white hover:text-ink"
            }`}
            aria-disabled={c.soon}
          >
            {c.icon && <Flame size={14} className="text-gold-3" />}
            {c.label}
            {c.soon && <span className="rounded bg-cream-2 px-1 text-[10px] uppercase">bientôt</span>}
          </Link>
        ))}
        <ChevronRight size={16} className="ml-auto shrink-0 text-muted" />
      </div>
    </header>
  );
}
