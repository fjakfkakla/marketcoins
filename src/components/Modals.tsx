"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink, X } from "lucide-react";
import { useWallet } from "@/lib/wallet";
import { CLUSTER, explorerUrl } from "@/lib/solana/config";
import { CopyButton } from "./CopyButton";

function Shell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-md p-6 pop" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-cream-2 hover:text-ink">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const INSTALL = [
  { name: "Phantom", href: "https://phantom.com/download" },
  { name: "Solflare", href: "https://solflare.com/download" },
  { name: "Backpack", href: "https://backpack.app/download" },
];

function ConnectModal() {
  const w = useWallet();
  const [accepted, setAccepted] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const installed = w.wallets.filter((x) => x.installed);

  const connect = async (name: string) => {
    setErr(null);
    try {
      await w.connect(name);
    } catch (e) {
      setErr((e as Error).message || "Connexion refusée.");
    }
  };

  return (
    <Shell title="Se connecter" onClose={() => w.openModal(null)}>
      <p className="mb-4 text-sm text-muted">
        Connecte ton wallet Solana. Marketcoins ne détient jamais tes clés privées : tu signes chaque
        transaction toi-même.
      </p>
      {installed.length > 0 ? (
        <div className="space-y-2">
          {installed.map((p) => (
            <button
              key={p.name}
              disabled={!accepted || w.connecting}
              onClick={() => connect(p.name)}
              className="flex w-full items-center gap-3 rounded-xl border border-line p-3 text-left transition hover:border-gold hover:bg-gold-soft/40 disabled:opacity-40"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- icône fournie par le wallet (data URI) */}
              <img src={p.icon} alt="" className="h-9 w-9 rounded-lg" />
              <span className="flex-1 font-semibold">{p.name}</span>
              <span className="text-xs text-muted">{w.connecting ? "connexion…" : "Solana"}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-xl bg-cream-2 p-4 text-sm">
          <div className="font-semibold">Aucun wallet détecté</div>
          <p className="mt-1 text-muted">Installe une extension, puis recharge la page.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {INSTALL.map((i) => (
              <a key={i.name} href={i.href} target="_blank" rel="noreferrer" className="btn-ghost py-1.5 text-xs">
                {i.name} <ExternalLink size={12} />
              </a>
            ))}
          </div>
        </div>
      )}
      {err && <p className="mt-3 text-sm text-down">{err}</p>}
      <label className="mt-4 flex cursor-pointer items-start gap-2 text-xs text-muted">
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 accent-gold" />
        <span>
          J&apos;ai plus de 18 ans et j&apos;accepte les{" "}
          <a href="/conditions" className="font-semibold text-ink underline">conditions d&apos;utilisation</a>. Je comprends que les
          marchés de prédiction comportent un risque de perte.
        </span>
      </label>
    </Shell>
  );
}

function ReceiveModal() {
  const w = useWallet();
  const address = w.address ?? "";
  return (
    <Shell title="Recevoir des USDC" onClose={() => w.openModal(null)}>
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-xl bg-cream-2 p-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[#2775ca] font-bold text-white">$</span>
          <div className="flex-1">
            <div className="font-semibold">USDC · réseau Solana</div>
            <div className="text-xs text-muted">Les mises partent directement de ton wallet. Pas de dépôt chez nous.</div>
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Ton adresse</div>
          <div className="flex items-center gap-2 rounded-xl border border-line bg-white p-3">
            <code className="mono flex-1 break-all text-xs">{address}</code>
            <CopyButton value={address} />
          </div>
          <a href={explorerUrl("address", address)} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
            Voir sur l&apos;explorateur <ExternalLink size={11} />
          </a>
        </div>
        {CLUSTER === "devnet" && (
          <div className="rounded-xl bg-gold-soft p-3 text-xs">
            <b>Réseau de test (devnet).</b> Récupère des USDC de test sur{" "}
            <a href="https://faucet.circle.com" target="_blank" rel="noreferrer" className="underline">faucet.circle.com</a> et des SOL sur{" "}
            <a href="https://faucet.solana.com" target="_blank" rel="noreferrer" className="underline">faucet.solana.com</a>.
          </div>
        )}
        <div className="flex items-start gap-2 rounded-xl bg-down-soft p-3 text-xs text-down">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          N&apos;envoie que des USDC sur Solana. Garde aussi un peu de SOL pour les frais de réseau.
        </div>
      </div>
    </Shell>
  );
}

export function Modals() {
  const w = useWallet();
  if (w.modal === "connect") return <ConnectModal />;
  if (w.modal === "receive") return <ReceiveModal />;
  return null;
}
