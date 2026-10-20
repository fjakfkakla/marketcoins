import idl from "./idl/marketcoins.json";

/**
 * Configuration Solana, lue côté serveur et côté client (variables NEXT_PUBLIC_*).
 * Sans variables : devnet, programme de l'IDL, USDC devnet de Circle.
 */

export type Cluster = "localnet" | "devnet" | "mainnet-beta";

const DEFAULT_RPC: Record<Cluster, string> = {
  localnet: "http://127.0.0.1:8899",
  devnet: "https://api.devnet.solana.com",
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
};

/** USDC : mainnet (Circle) et devnet (faucet Circle). */
const DEFAULT_USDC: Record<Cluster, string> = {
  localnet: "",
  devnet: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  "mainnet-beta": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
};

const clusterEnv = process.env.NEXT_PUBLIC_SOLANA_CLUSTER;
export const CLUSTER: Cluster = clusterEnv === "localnet" || clusterEnv === "mainnet-beta" ? clusterEnv : "devnet";

export const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC || DEFAULT_RPC[CLUSTER];

export const PROGRAM_ID = process.env.NEXT_PUBLIC_MARKETCOINS_PROGRAM_ID || idl.address;

/** Mint USDC ; vide = programme pas utilisable (localnet sans mint configuré). */
export const USDC_MINT = process.env.NEXT_PUBLIC_USDC_MINT || DEFAULT_USDC[CLUSTER];

/** 1 USDC = 1 000 000 unités. */
export const USDC_DECIMALS = 6;
export const USDC_UNIT = 10 ** USDC_DECIMALS;

/** Lien explorateur vers une transaction ou une adresse. */
export const explorerUrl = (kind: "tx" | "address", id: string) => {
  const base = `https://explorer.solana.com/${kind}/${id}`;
  if (CLUSTER === "mainnet-beta") return base;
  if (CLUSTER === "devnet") return `${base}?cluster=devnet`;
  return `${base}?cluster=custom&customUrl=${encodeURIComponent(RPC_URL)}`;
};
