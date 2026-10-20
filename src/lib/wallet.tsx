"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * État wallet côté client, mocké pour l'instant.
 * À remplacer par @solana/wallet-adapter (Phantom, Solflare, Backpack)
 * et une lecture du solde USDC on-chain. Aucune clé privée ne transite ici.
 */

/** Une mise parimutuel : définitive, elle rejoint la cagnotte du KOL choisi. */
export type Position = {
  id: string;
  marketSlug: string;
  marketTitle: string;
  kolId: string;
  kolName: string;
  /** Montant débité du solde. */
  amount: number;
  /** Frais (2 %) prélevés sur le montant. */
  fee: number;
  /** Mise nette, entrée dans la cagnotte. */
  stake: number;
  /** Gain estimé au moment de la mise, si le KOL gagne. */
  payoutAtBet: number;
  createdAt: number;
};

export type Activity = {
  id: string;
  type: "DEPOT" | "RETRAIT" | "MISE";
  label: string;
  amount: number;
  at: number;
};

type Modal = "connect" | "deposit" | "withdraw" | null;

type WalletState = {
  ready: boolean;
  connected: boolean;
  address: string | null;
  provider: string | null;
  balance: number;
  positions: Position[];
  activity: Activity[];
  modal: Modal;
  openModal: (m: Modal) => void;
  connect: (provider: string) => void;
  disconnect: () => void;
  deposit: (amount: number) => void;
  withdraw: (amount: number) => boolean;
  /** Place une mise. Renvoie false si le solde est insuffisant. */
  bet: (p: Omit<Position, "id" | "createdAt">) => boolean;
};

const Ctx = createContext<WalletState | null>(null);
// v2 : passage du modèle « parts à prix fixe » au modèle parimutuel (mises).
const KEY = "marketcoins.wallet.v2";

const DEMO_ADDRESS = "7Gx2kQmFpZ9vN4tLd8sH3rWcA1eB6yU5oP0jK2nM9xVq";

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [positions, setPositions] = useState<Position[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [modal, setModal] = useState<Modal>(null);

  // Hydrate from localStorage after mount (never during SSR) to avoid markup mismatches.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const s = JSON.parse(raw);
          setConnected(!!s.connected);
          setProvider(s.provider ?? null);
          setBalance(Number(s.balance) || 0);
          setPositions(Array.isArray(s.positions) ? s.positions : []);
          setActivity(Array.isArray(s.activity) ? s.activity : []);
        }
      } catch {}
      setReady(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ connected, provider, balance, positions, activity }));
    } catch {}
  }, [ready, connected, provider, balance, positions, activity]);

  const log = useCallback((a: Omit<Activity, "id" | "at">) => {
    setActivity((prev) => [{ ...a, id: crypto.randomUUID(), at: Date.now() }, ...prev].slice(0, 50));
  }, []);

  const value = useMemo<WalletState>(
    () => ({
      ready,
      connected,
      address: connected ? DEMO_ADDRESS : null,
      provider,
      balance,
      positions,
      activity,
      modal,
      openModal: setModal,
      connect: (p) => {
        setProvider(p);
        setConnected(true);
        setModal(null);
      },
      disconnect: () => {
        setConnected(false);
        setProvider(null);
      },
      deposit: (amount) => {
        setBalance((b) => Math.round((b + amount) * 100) / 100);
        log({ type: "DEPOT", label: "Dépôt USDC (Solana)", amount });
        setModal(null);
      },
      withdraw: (amount) => {
        if (amount > balance) return false;
        setBalance((b) => Math.round((b - amount) * 100) / 100);
        log({ type: "RETRAIT", label: "Retrait USDC vers le wallet", amount: -amount });
        setModal(null);
        return true;
      },
      bet: (p) => {
        if (p.amount <= 0 || p.amount > balance) return false;
        setBalance((b) => Math.round((b - p.amount) * 100) / 100);
        setPositions((prev) => [{ ...p, id: crypto.randomUUID(), createdAt: Date.now() }, ...prev]);
        log({ type: "MISE", label: `Mise sur ${p.kolName}`, amount: -p.amount });
        return true;
      },
    }),
    [ready, connected, provider, balance, positions, activity, modal, log],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWallet must be used within WalletProvider");
  return v;
}
