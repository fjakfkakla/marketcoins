import type { Market, Outcome } from "@/data/markets";

/**
 * Modèle parimutuel (cagnotte).
 *
 * Chaque mise, après frais, rejoint la cagnotte du KOL choisi. À la résolution,
 * toute la cagnotte du défi est partagée entre les mises placées sur le KOL
 * gagnant, au prorata. Il n'y a ni prix fixe ni revente : la « cote » affichée
 * est simplement la part de la cagnotte déjà placée sur ce KOL, et le
 * multiplicateur est ce que rapporterait 1 $ si ce KOL gagnait maintenant.
 */

/** Frais prélevés sur chaque mise, avant entrée dans la cagnotte. */
export const FEE = 0.02;

/** Cagnotte totale du défi (somme des mises nettes). */
export const totalPool = (m: Market) => m.outcomes.reduce((s, o) => s + o.pool, 0);

/** Part de la cagnotte placée sur ce KOL, 0..1. */
export const share = (m: Market, o: Outcome) => {
  const t = totalPool(m);
  return t > 0 ? o.pool / t : 0;
};

/** Gain brut par dollar misé si ce KOL gagne, selon la cagnotte actuelle. `Infinity` si personne n'a encore misé dessus. */
export const multiplier = (m: Market, o: Outcome) => (o.pool > 0 ? totalPool(m) / o.pool : Infinity);

export type Quote = {
  amount: number;
  fee: number;
  /** Mise nette, celle qui entre dans la cagnotte. */
  stake: number;
  /** Ce que rapporterait la mise si le KOL gagnait avec la cagnotte telle qu'elle serait juste après. */
  payout: number;
  profit: number;
  /** Multiplicateur effectif de la mise (payout / amount). */
  multiplier: number;
  /** Part de la cagnotte sur ce KOL, une fois la mise incluse. */
  shareAfter: number;
};

/** Estime une mise de `amount` $ sur `o`. Le gain final dépendra de la cagnotte à la clôture. */
export function quote(m: Market, o: Outcome, amount: number): Quote {
  const a = Math.max(0, amount);
  const fee = round2(a * FEE);
  const stake = round2(a - fee);
  const poolAfter = o.pool + stake;
  const totalAfter = totalPool(m) + stake;
  const payout = poolAfter > 0 ? round2((stake / poolAfter) * totalAfter) : 0;
  return {
    amount: a,
    fee,
    stake,
    payout,
    profit: round2(payout - a),
    multiplier: a > 0 ? payout / a : 0,
    shareAfter: totalAfter > 0 ? poolAfter / totalAfter : 0,
  };
}

/** Une mise placée par l'utilisateur, telle que stockée côté wallet. */
export type Stake = { marketSlug: string; kolId: string; amount: number; stake: number };

/**
 * Renvoie le marché avec les mises de l'utilisateur ajoutées à la cagnotte,
 * trié par part décroissante. Sert à faire bouger les cotes après une mise
 * tant que le backend n'existe pas.
 */
export function withStakes(m: Market, stakes: Stake[]): Market {
  const mine = stakes.filter((s) => s.marketSlug === m.slug);
  if (mine.length === 0) return m;
  const outcomes = m.outcomes
    .map((o) => {
      const add = mine.filter((s) => s.kolId === o.kol.id).reduce((t, s) => t + s.stake, 0);
      return add > 0 ? { ...o, pool: round2(o.pool + add) } : o;
    })
    .sort((a, b) => b.pool - a.pool);
  const volume = m.volume + mine.reduce((t, s) => t + s.amount, 0);
  return { ...m, outcomes, pool: outcomes.reduce((s, o) => s + o.pool, 0), volume };
}

/** Gain estimé aujourd'hui d'une mise déjà placée (sa part de la cagnotte si son KOL gagne). */
export function currentPayout(m: Market, kolId: string, stake: number): number {
  const o = m.outcomes.find((x) => x.kol.id === kolId);
  if (!o || o.pool <= 0) return 0;
  return round2((stake / o.pool) * totalPool(m));
}

const round2 = (n: number) => Math.round(n * 100) / 100;
