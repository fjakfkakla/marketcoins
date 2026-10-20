import { KOLS, type Kol } from "./kols";
import type { OnchainMarket } from "@/lib/solana/program";

export type Period = "7D" | "30D";

export type Outcome = {
  kol: Kol;
  /** Index du résultat dans le programme on-chain (stable, fixé à la création du marché). */
  index: number;
  /** Cagnotte placée sur ce KOL, en USD (mises nettes de frais). */
  pool: number;
  /** Variation de la part de cagnotte sur 24h, en points */
  change24h: number;
};

export type Market = {
  slug: string;
  title: string;
  question: string;
  category: "KOL";
  period: Period;
  /** Numéro du défi */
  challenge: number;
  startsAt: string;
  endsAt: string;
  closesAt: string;
  volume: number;
  /** Cagnotte totale du défi : somme des `outcomes[].pool`. */
  pool: number;
  traders: number;
  rules: string[];
  outcomes: Outcome[];
  featured?: boolean;
  /** Chrono figé (CHRONO=NO) : durée affichée en ms, sans défilement */
  chronoFrozenMs?: number;
  /** État du marché on-chain quand le défi existe dans le programme (`market_id` = `challenge`). */
  chain?: OnchainMarket;
};

/**
 * Répartition de démo de la cagnotte entre les KOLs : les parieurs ont surtout
 * misé sur ceux qui ont le meilleur PnL, sans que le leader écrase tout.
 * Avec un backend, chaque cagnotte est la somme réelle des mises.
 */
function poolsFromPnl(period: Period, total: number): Outcome[] {
  const key = period === "7D" ? "pnl7d" : "pnl30d";
  const weights = KOLS.map((k) => Math.pow(Math.max(k[key], 1000), 1.35));
  const sum = weights.reduce((a, b) => a + b, 0);
  const changes = [2.4, -0.8, 1.1, -1.6, 0.6, -0.9, -0.8];
  return KOLS.map((kol, i) => ({ kol, index: i, pool: Math.round((total * weights[i]) / sum), change24h: changes[i] }))
    .sort((a, b) => b.pool - a.pool);
}

export const MARKETS: Market[] = [
  {
    slug: "kol-top-profit-7d",
    title: "Quel KOL fera le plus de profit sur 7 jours ?",
    question: "Quel KOL fera le plus de profit ?",
    category: "KOL",
    period: "7D",
    challenge: 1,
    startsAt: "2026-10-13T00:00:00+02:00",
    endsAt: "2026-10-19T20:00:00+02:00",
    closesAt: "2026-10-13T00:00:00+02:00",
    volume: 48210,
    pool: 31940,
    traders: 312,
    featured: true,
    rules: [
      "Le KOL gagnant est celui dont le wallet Solana listé affiche le PnL réalisé le plus élevé entre le lundi 13 octobre 00:00 et le dimanche 19 octobre 20:00 (heure de Paris).",
      "Le PnL est mesuré en USD sur les ventes effectivement réalisées, hors positions ouvertes. Source : données on-chain publiques du wallet.",
      "Chaque mise rejoint la cagnotte du défi après 2 % de frais. À la résolution, toute la cagnotte est partagée entre ceux qui ont misé sur le KOL gagnant, au prorata de leur mise.",
      "Les mises ferment au début de la période et sont définitives : pas de revente. Les cotes affichées sont la répartition actuelle de la cagnotte, le gain final dépend de la cagnotte à la clôture.",
      "En cas d'égalité, de wallet changé ou de données indisponibles, le marché est annulé et toutes les mises sont remboursées.",
    ],
    outcomes: poolsFromPnl("7D", 31940),
  },
  {
    slug: "kol-top-profit-30d",
    title: "Quel KOL fera le plus de profit sur 30 jours ?",
    question: "Quel KOL fera le plus de profit ?",
    category: "KOL",
    period: "30D",
    challenge: 2,
    startsAt: "2026-10-13T00:00:00+02:00",
    endsAt: "2026-11-11T20:00:00+01:00",
    closesAt: "2026-10-13T00:00:00+02:00",
    volume: 17840,
    pool: 12300,
    traders: 141,
    rules: [
      "Le KOL gagnant est celui dont le wallet Solana listé affiche le PnL réalisé le plus élevé sur 30 jours, du 13 octobre 00:00 au 11 novembre 20:00 (heure de Paris).",
      "Le PnL est mesuré en USD sur les ventes réalisées, hors positions ouvertes.",
      "Chaque mise rejoint la cagnotte après 2 % de frais ; la cagnotte est partagée entre les mises sur le KOL gagnant, au prorata. Les mises sont définitives.",
      "En cas d'égalité ou de données indisponibles, le marché est annulé et remboursé.",
    ],
    outcomes: poolsFromPnl("30D", 12300),
  },
];

export const marketBySlug = (slug: string) => MARKETS.find((m) => m.slug === slug);

/** Marchés secondaires "Oui / Non" : même cagnotte, mais à deux résultats. `yes` = part de la cagnotte sur Oui. */
export type BinaryMarket = {
  slug: string;
  title: string;
  kolId: string;
  period: Period;
  yes: number;
  volume: number;
};

export const BINARY_MARKETS: BinaryMarket[] = [
  { slug: "cooker-50k-7d", title: "Cooker dépassera-t-il +50K$ de profit cette semaine ?", kolId: "cooker", period: "7D", yes: 0.34, volume: 9120 },
  { slug: "cented-top3-7d", title: "Cented finira-t-il dans le top 3 sur 7 jours ?", kolId: "cented", period: "7D", yes: 0.71, volume: 6480 },
  { slug: "decu-positive-7d", title: "decu terminera-t-il la semaine en positif ?", kolId: "decu", period: "7D", yes: 0.82, volume: 4310 },
  { slug: "blu6k-winrate-30d", title: "blu6k gardera-t-il un winrate > 60 % sur 30 jours ?", kolId: "blu6k", period: "30D", yes: 0.57, volume: 2890 },
  { slug: "chester-beats-cooker-7d", title: "chester battra-t-il Cooker sur 7 jours ?", kolId: "chester", period: "7D", yes: 0.18, volume: 5260 },
  { slug: "zeropnl-100k-30d", title: "zeropnl atteindra-t-il +100K$ sur 30 jours ?", kolId: "zeropnl", period: "30D", yes: 0.09, volume: 1740 },
];
