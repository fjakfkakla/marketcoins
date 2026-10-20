import { BN, BorshAccountsCoder, type Idl, type Program } from "@anchor-lang/core";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import idl from "./idl/marketcoins.json";
import type { Marketcoins } from "./idl/marketcoins";
import { PROGRAM_ID, USDC_UNIT } from "./config";

/** Outils partagés serveur / client : adresses dérivées, décodage des comptes, conversions. */

export type MarketcoinsProgram = Program<Marketcoins>;
export const IDL = idl as Marketcoins;
export const programId = new PublicKey(PROGRAM_ID);

export const marketPda = (marketId: number) =>
  PublicKey.findProgramAddressSync([Buffer.from("market"), new BN(marketId).toArrayLike(Buffer, "le", 8)], programId)[0];

export const vaultPda = (market: PublicKey) => PublicKey.findProgramAddressSync([Buffer.from("vault"), market.toBuffer()], programId)[0];

export const betPda = (market: PublicKey, bettor: PublicKey, outcome: number) =>
  PublicKey.findProgramAddressSync([Buffer.from("bet"), market.toBuffer(), bettor.toBuffer(), Buffer.from([outcome])], programId)[0];

export const usdcAta = (owner: PublicKey, mint: PublicKey) => getAssociatedTokenAddressSync(mint, owner, true);

export const toUsd = (units: BN | number | bigint) => Number(units.toString()) / USDC_UNIT;
export const toUnits = (usd: number) => new BN(Math.round(usd * USDC_UNIT));

export type ChainStatus = "open" | "resolved" | "cancelled";

/** Compte `Market` décodé et converti en valeurs lisibles. */
export type OnchainMarket = {
  address: string;
  marketId: number;
  authority: string;
  resolver: string;
  mint: string;
  nOutcomes: number;
  feeBps: number;
  closesAt: number;
  endsAt: number;
  disputeSeconds: number;
  status: ChainStatus;
  /** Index du gagnant, null tant qu'il n'y en a pas. */
  winner: number | null;
  resolvedAt: number | null;
  /** Instant où la résolution devient définitive, null si pas résolu. */
  finalAt: number | null;
  /** Cagnotte par résultat, en USDC. */
  pools: number[];
  totalPool: number;
  totalVolume: number;
  feesAccrued: number;
};

export type OnchainBet = {
  address: string;
  market: string;
  bettor: string;
  outcome: number;
  amount: number;
  stake: number;
};

type RawMarket = {
  marketId: BN; authority: PublicKey; resolver: PublicKey; mint: PublicKey; nOutcomes: number; feeBps: number;
  closesAt: BN; endsAt: BN; disputeSeconds: BN; status: Record<string, object>; winner: number; resolvedAt: BN;
  pools: BN[]; totalPool: BN; totalVolume: BN; feesAccrued: BN;
};
type RawBet = { market: PublicKey; bettor: PublicKey; outcome: number; amount: BN; stake: BN };

const coder = new BorshAccountsCoder(idl as Idl);

/** Le coder brut garde les noms snake_case de l'IDL ; `Program` les met en camelCase. On aligne. */
function camel<T>(raw: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) out[k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())] = v;
  return out as T;
}

export function decodeMarket(address: PublicKey, data: Buffer): OnchainMarket {
  return rawToMarket(address, camel<RawMarket>(coder.decode("Market", data)));
}

export function rawToMarket(address: PublicKey, m: RawMarket): OnchainMarket {
  // Variante d'enum : « Open » via le coder brut, « open » via `Program`.
  const status = (Object.keys(m.status)[0] ?? "open").toLowerCase() as ChainStatus;
  const resolvedAt = status === "open" ? null : m.resolvedAt.toNumber();
  return {
    address: address.toBase58(),
    marketId: m.marketId.toNumber(),
    authority: m.authority.toBase58(),
    resolver: m.resolver.toBase58(),
    mint: m.mint.toBase58(),
    nOutcomes: m.nOutcomes,
    feeBps: m.feeBps,
    closesAt: m.closesAt.toNumber(),
    endsAt: m.endsAt.toNumber(),
    disputeSeconds: m.disputeSeconds.toNumber(),
    status,
    winner: status === "resolved" ? m.winner : null,
    resolvedAt,
    finalAt: status === "resolved" && resolvedAt !== null ? resolvedAt + m.disputeSeconds.toNumber() : null,
    pools: m.pools.slice(0, m.nOutcomes).map(toUsd),
    totalPool: toUsd(m.totalPool),
    totalVolume: toUsd(m.totalVolume),
    feesAccrued: toUsd(m.feesAccrued),
  };
}

export function decodeBet(address: PublicKey, data: Buffer): OnchainBet {
  return rawToBet(address, camel<RawBet>(coder.decode("Bet", data)));
}

export function rawToBet(address: PublicKey, b: RawBet): OnchainBet {
  return { address: address.toBase58(), market: b.market.toBase58(), bettor: b.bettor.toBase58(), outcome: b.outcome, amount: toUsd(b.amount), stake: toUsd(b.stake) };
}

/** Décalage du champ `bettor` dans un compte `Bet` : discriminant (8) + market (32). */
export const BET_BETTOR_OFFSET = 8 + 32;

/** Ce qu'une mise peut faire aujourd'hui, d'après l'état du marché on-chain. */
export type BetState = "pending" | "claimable" | "refundable" | "lost";

export function betState(market: OnchainMarket, bet: OnchainBet, now = Math.floor(Date.now() / 1000)): BetState {
  if (market.status === "cancelled") return "refundable";
  if (market.status === "resolved" && market.finalAt !== null && now >= market.finalAt) {
    return bet.outcome === market.winner ? "claimable" : "lost";
  }
  return "pending";
}

/** Gain d'une mise si son résultat gagne, avec la cagnotte actuelle (même formule que `claim` on-chain). */
export function betPayout(market: OnchainMarket, bet: OnchainBet): number {
  const pool = market.pools[bet.outcome] ?? 0;
  if (pool <= 0) return 0;
  return Math.floor((bet.stake * market.totalPool * USDC_UNIT) / pool) / USDC_UNIT;
}
