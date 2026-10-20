import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Coins, Gavel, PiggyBank, ShieldCheck, Wallet, Vote } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { MARKETS } from "@/data/markets";
import { mult, pct, usd } from "@/lib/format";
import { multiplier, quote, share, totalPool } from "@/lib/parimutuel";

export const metadata: Metadata = { title: "Comment ça marche" };

const STEPS = [
  { icon: Wallet, title: "Connecte ton wallet", text: "Phantom, Solflare ou Backpack. Marketcoins ne détient jamais tes clés : tu signes chaque opération." },
  { icon: Coins, title: "Dépose des USDC", text: "Sur Solana, en quelques secondes et pour une fraction de centime de frais." },
  { icon: Vote, title: "Mise sur ton KOL", text: "Ta mise rejoint la cagnotte du défi, sur le KOL que tu as choisi. La cote affichée, c'est la part de la cagnotte déjà placée sur lui." },
  { icon: Gavel, title: "Résolution on-chain", text: "À la fin de la période, le PnL réalisé de chaque wallet est comparé. Toute la cagnotte va à ceux qui ont misé sur le gagnant, au prorata." },
];

export default function HowPage() {
  // Exemple chiffré sur le défi en vedette, avec la répartition de démo.
  const market = MARKETS.find((m) => m.featured) ?? MARKETS[0];
  const fav = market.outcomes[0];
  const outsider = market.outcomes[market.outcomes.length - 1];
  const total = totalPool(market);
  const amount = 100;
  const qFav = quote(market, fav, amount);
  const qOut = quote(market, outsider, amount);

  return (
    <div className="space-y-10">
      <section className="text-center fade-up">
        <h1 className="text-3xl font-bold md:text-4xl">Comment ça marche</h1>
        <p className="mx-auto mt-2 max-w-xl text-muted">Une cagnotte par défi. Tu mises sur le KOL qui fera le plus de profit, chiffres on-chain à l&apos;appui, et les gagnants se partagent tout.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-4 stagger">
        {STEPS.map((s, i) => (
          <div key={s.title} className="card relative p-5">
            <span className="absolute right-4 top-4 text-4xl font-black text-cream-2">{i + 1}</span>
            <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-gold-soft text-gold-3"><s.icon size={22} /></div>
            <h3 className="font-bold">{s.title}</h3>
            <p className="mt-1 text-sm text-muted">{s.text}</p>
          </div>
        ))}
      </section>

      <section className="card p-6 md:p-8 fade-up">
        <h2 className="text-xl font-bold">Exemple concret</h2>
        <p className="mt-1 text-sm text-muted">Cagnotte actuelle du défi : <b className="text-ink">{usd(total)}</b>. Tu mises {usd(amount)}, dont 2 % de frais : {usd(qFav.stake)} entrent dans la cagnotte.</p>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl bg-cream-2 p-5">
            <div className="mb-3 flex items-center gap-3">
              <Avatar kol={fav.kol} size={44} ring />
              <div>
                <div className="font-bold">{fav.kol.name} <span className="pill-gold ml-1 py-0 text-[10px]">favori</span></div>
                <div className="text-xs text-muted">{pct(share(market, fav))} de la cagnotte · cote {mult(multiplier(market, fav))}</div>
              </div>
            </div>
            <div className="mono space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted">Mise</span><span>{usd(amount)}</span></div>
              <div className="flex justify-between"><span className="text-muted">Déjà misé sur lui</span><span>{usd(fav.pool)}</span></div>
              <div className="flex justify-between border-t border-line pt-1 font-bold"><span>S&apos;il gagne</span><span className="text-up">{usd(qFav.payout)}</span></div>
            </div>
            <p className="mt-3 text-xs text-muted">Beaucoup de monde a misé sur lui : la cagnotte se partage entre beaucoup de mises, le gain est modeste.</p>
          </div>
          <div className="rounded-2xl bg-cream-2 p-5">
            <div className="mb-3 flex items-center gap-3">
              <Avatar kol={outsider.kol} size={44} ring />
              <div>
                <div className="font-bold">{outsider.kol.name} <span className="pill-muted ml-1 py-0 text-[10px]">outsider</span></div>
                <div className="text-xs text-muted">{pct(share(market, outsider))} de la cagnotte · cote {mult(multiplier(market, outsider))}</div>
              </div>
            </div>
            <div className="mono space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted">Mise</span><span>{usd(amount)}</span></div>
              <div className="flex justify-between"><span className="text-muted">Déjà misé sur lui</span><span>{usd(outsider.pool)}</span></div>
              <div className="flex justify-between border-t border-line pt-1 font-bold"><span>S&apos;il gagne</span><span className="text-up">{usd(qOut.payout)}</span></div>
            </div>
            <p className="mt-3 text-xs text-muted">Presque personne n&apos;a misé sur lui : s&apos;il gagne, tu prends une grosse part de toute la cagnotte.</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted">
          Formule : <span className="mono text-ink">gain = ta mise ÷ total misé sur ton KOL × cagnotte totale</span>. Si ton KOL ne termine pas n°1, ta mise est perdue.
        </p>
      </section>

      <section className="card p-6 md:p-8 fade-up">
        <div className="flex items-center gap-2"><PiggyBank className="text-gold-3" /><h2 className="text-xl font-bold">Pourquoi une cagnotte, et pas un prix fixe</h2></div>
        <div className="mt-3 grid gap-4 text-sm text-muted md:grid-cols-3">
          <p><b className="text-ink">La foule fixe la cote.</b> Chaque mise sur un KOL grossit sa part de la cagnotte et fait baisser sa cote. Un KOL très fort devient vite peu rentable, un oublié devient intéressant.</p>
          <p><b className="text-ink">Le gain bouge jusqu&apos;à la clôture.</b> Ce que tu vois est une estimation sur la cagnotte du moment. Miser tôt ne donne pas un meilleur prix : si d&apos;autres te suivent sur le même KOL, ton gain baisse ; s&apos;ils misent ailleurs, il monte.</p>
          <p><b className="text-ink">Toujours payé.</b> Les gains viennent uniquement de la cagnotte, jamais d&apos;une promesse. Marketcoins prélève 2 % sur chaque mise, rien d&apos;autre.</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3 stagger">
        <div className="card p-5">
          <ShieldCheck className="mb-2 text-up" />
          <h3 className="font-bold">Non-custodial</h3>
          <p className="mt-1 text-sm text-muted">Les fonds vivent dans un smart contract Solana. Pas de clé privée côté serveur, rien à hacker.</p>
        </div>
        <div className="card p-5">
          <Gavel className="mb-2 text-gold-3" />
          <h3 className="font-bold">Résolution transparente</h3>
          <p className="mt-1 text-sm text-muted">Règle publiée à l&apos;avance, données publiques, comité multisig et 24 h de contestation.</p>
        </div>
        <div className="card p-5">
          <Coins className="mb-2 text-blue" />
          <h3 className="font-bold">Frais clairs</h3>
          <p className="mt-1 text-sm text-muted">2 % sur chaque mise, c&apos;est tout. Mises définitives, retraits du solde libres à tout moment.</p>
        </div>
      </section>

      <div className="text-center">
        <Link href={`/market/${market.slug}`} className="btn-gold px-6 py-3 text-base">Voir le défi en cours <ArrowRight size={16} /></Link>
      </div>
    </div>
  );
}
