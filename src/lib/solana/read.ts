import "server-only";
import { Connection } from "@solana/web3.js";
import type { Market } from "@/data/markets";
import { RPC_URL, USDC_MINT } from "./config";
import { decodeMarket, marketPda, type OnchainMarket } from "./program";

/**
 * Lecture serveur des marchés on-chain. Un défi du site (`challenge`) = un
 * `market_id` du programme. Si le compte existe, ses cagnottes, dates et
 * statut remplacent ceux de la base ou du mock.
 */

let connection: Connection | null = null;
const conn = () => (connection ??= new Connection(RPC_URL, "confirmed"));

export async function fetchOnchainMarkets(marketIds: number[]): Promise<Map<number, OnchainMarket>> {
  const out = new Map<number, OnchainMarket>();
  if (marketIds.length === 0 || !USDC_MINT) return out;
  try {
    const pdas = marketIds.map(marketPda);
    const infos = await conn().getMultipleAccountsInfo(pdas);
    infos.forEach((info, i) => {
      if (!info) return;
      try {
        out.set(marketIds[i], decodeMarket(pdas[i], info.data));
      } catch (e) {
        console.error(`[solana] compte ${pdas[i].toBase58()} illisible :`, (e as Error).message);
      }
    });
  } catch (e) {
    console.error("[solana] lecture des marchés impossible :", (e as Error).message);
  }
  return out;
}

const iso = (unix: number) => new Date(unix * 1000).toISOString();

/** Remplace les cagnottes et dates des marchés par leurs valeurs on-chain quand elles existent. */
export async function overlayOnchain(markets: Market[]): Promise<Market[]> {
  const chain = await fetchOnchainMarkets(markets.map((m) => m.challenge));
  if (chain.size === 0) return markets;
  return markets.map((m) => {
    const c = chain.get(m.challenge);
    if (!c) return m;
    const outcomes = m.outcomes
      .map((o) => ({ ...o, pool: c.pools[o.index] ?? 0 }))
      .sort((a, b) => b.pool - a.pool);
    return {
      ...m,
      outcomes,
      pool: c.totalPool,
      volume: c.totalVolume,
      closesAt: iso(c.closesAt),
      endsAt: iso(c.endsAt),
      chain: c,
    };
  });
}
