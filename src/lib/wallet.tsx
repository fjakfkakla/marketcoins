"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Buffer } from "buffer";
import { AnchorProvider, Program } from "@anchor-lang/core";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction, getAccount } from "@solana/spl-token";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import {
  ConnectionProvider,
  WalletProvider as AdapterWalletProvider,
  useAnchorWallet,
  useConnection,
  useWallet as useAdapter,
} from "@solana/wallet-adapter-react";
import { RPC_URL, USDC_MINT } from "./solana/config";
import {
  BET_BETTOR_OFFSET,
  IDL,
  betPda,
  marketPda,
  rawToBet,
  toUnits,
  toUsd,
  usdcAta,
  vaultPda,
  type MarketcoinsProgram,
  type OnchainBet,
} from "./solana/program";

// web3.js et Anchor s'appuient sur Buffer, absent du navigateur.
if (typeof window !== "undefined" && !window.Buffer) window.Buffer = Buffer;

/**
 * Wallet Solana réel (Phantom, Solflare, Backpack… via Wallet Standard) et
 * accès au programme Marketcoins. Le solde affiché est l'USDC du wallet ;
 * les mises partent directement du wallet vers la cagnotte on-chain.
 */

export type WalletOption = { name: string; icon: string; installed: boolean };

type Modal = "connect" | "receive" | null;

type WalletState = {
  /** Vrai après montage : avant, rien n'est connu du wallet (SSR). */
  ready: boolean;
  connected: boolean;
  connecting: boolean;
  address: string | null;
  /** Nom du wallet connecté. */
  provider: string | null;
  /** Solde USDC du wallet. */
  balance: number;
  /** Mises on-chain du wallet, tous défis confondus. */
  bets: OnchainBet[];
  wallets: WalletOption[];
  modal: Modal;
  openModal: (m: Modal) => void;
  connect: (name: string) => Promise<void>;
  disconnect: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Mise de `amount` USDC sur le résultat `outcome` du défi `marketId`. Renvoie la signature. */
  placeBet: (marketId: number, outcome: number, amount: number) => Promise<string>;
  /** Retire le gain ou le remboursement d'une mise. Renvoie la signature. */
  claim: (bet: OnchainBet) => Promise<string>;
  /** Vrai si le programme est utilisable (mint USDC configuré). */
  enabled: boolean;
};

const Ctx = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConnectionProvider endpoint={RPC_URL} config={{ commitment: "confirmed" }}>
      <AdapterWalletProvider wallets={[]} autoConnect>
        <Inner>{children}</Inner>
      </AdapterWalletProvider>
    </ConnectionProvider>
  );
}

function Inner({ children }: { children: React.ReactNode }) {
  const adapter = useAdapter();
  const anchorWallet = useAnchorWallet();
  const { connection } = useConnection();
  // Vrai seulement après hydratation : le serveur ne sait rien du wallet.
  const ready = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [modal, setModal] = useState<Modal>(null);
  const [balance, setBalance] = useState(0);
  const [bets, setBets] = useState<OnchainBet[]>([]);

  const enabled = Boolean(USDC_MINT);
  const mint = useMemo(() => (enabled ? new PublicKey(USDC_MINT) : null), [enabled]);
  const pubkey = adapter.publicKey;

  const program = useMemo<MarketcoinsProgram | null>(() => {
    if (!anchorWallet) return null;
    const provider = new AnchorProvider(connection, anchorWallet, { commitment: "confirmed" });
    return new Program(IDL, provider);
  }, [anchorWallet, connection]);

  /** Lit le solde USDC et les mises du wallet, sans toucher à l'état React. */
  const load = useCallback(async (): Promise<{ balance: number; bets: OnchainBet[] }> => {
    if (!pubkey || !mint) return { balance: 0, bets: [] };
    let bal = 0;
    try {
      const acc = await getAccount(connection, usdcAta(pubkey, mint));
      bal = toUsd(acc.amount);
    } catch {
      bal = 0; // pas encore de compte USDC
    }
    let list: OnchainBet[] = [];
    if (program) {
      try {
        const all = await program.account.bet.all([{ memcmp: { offset: BET_BETTOR_OFFSET, bytes: pubkey.toBase58() } }]);
        list = all.map((a) => rawToBet(a.publicKey, a.account));
      } catch (e) {
        console.error("[wallet] lecture des mises :", (e as Error).message);
      }
    }
    return { balance: bal, bets: list };
  }, [pubkey, mint, connection, program]);

  const refresh = useCallback(async () => {
    const r = await load();
    setBalance(r.balance);
    setBets(r.bets);
  }, [load]);

  // Recharge à chaque changement de wallet ; ignore les réponses d'un wallet déjà remplacé.
  useEffect(() => {
    let alive = true;
    load().then((r) => {
      if (!alive) return;
      setBalance(r.balance);
      setBets(r.bets);
    });
    return () => {
      alive = false;
    };
  }, [load]);

  const wallets = useMemo<WalletOption[]>(
    () =>
      adapter.wallets.map((w) => ({
        name: w.adapter.name,
        icon: w.adapter.icon,
        installed: w.readyState === WalletReadyState.Installed || w.readyState === WalletReadyState.Loadable,
      })),
    [adapter.wallets],
  );

  const value = useMemo<WalletState>(
    () => ({
      ready,
      connected: adapter.connected,
      connecting: adapter.connecting,
      address: pubkey?.toBase58() ?? null,
      provider: adapter.wallet?.adapter.name ?? null,
      balance,
      bets,
      wallets,
      modal,
      openModal: setModal,
      enabled,
      connect: async (name) => {
        const w = adapter.wallets.find((x) => x.adapter.name === name);
        if (!w) throw new Error(`Wallet inconnu : ${name}`);
        adapter.select(w.adapter.name);
        // `select` ne connecte pas tout de suite : on ouvre le wallet directement puisque l'utilisateur a cliqué.
        await w.adapter.connect();
        setModal(null);
      },
      disconnect: () => adapter.disconnect(),
      refresh,
      placeBet: async (marketId, outcome, amount) => {
        if (!program || !pubkey || !mint) throw new Error("Wallet non connecté");
        const market = marketPda(marketId);
        const ata = usdcAta(pubkey, mint);
        const sig = await program.methods
          .placeBet(outcome, toUnits(amount))
          .accountsPartial({
            bettor: pubkey,
            market,
            bet: betPda(market, pubkey, outcome),
            bettorTokenAccount: ata,
            vault: vaultPda(market),
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          // Crée le compte USDC du wallet s'il n'existe pas encore (sans effet sinon).
          .preInstructions([createAssociatedTokenAccountIdempotentInstruction(pubkey, ata, pubkey, mint)])
          .rpc();
        await refresh();
        return sig;
      },
      claim: async (bet) => {
        if (!program || !pubkey || !mint) throw new Error("Wallet non connecté");
        const market = new PublicKey(bet.market);
        const ata = usdcAta(pubkey, mint);
        const sig = await program.methods
          .claim()
          .accountsPartial({
            bettor: pubkey,
            market,
            bet: new PublicKey(bet.address),
            bettorTokenAccount: ata,
            vault: vaultPda(market),
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .preInstructions([createAssociatedTokenAccountIdempotentInstruction(pubkey, ata, pubkey, mint)])
          .rpc();
        await refresh();
        return sig;
      },
    }),
    [ready, adapter, pubkey, balance, bets, wallets, modal, enabled, refresh, program, mint],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

const noopSubscribe = () => () => {};

export function useWallet() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWallet must be used within WalletProvider");
  return v;
}
