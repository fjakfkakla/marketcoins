"use client";

import { Check, Copy, X } from "lucide-react";
import { useState } from "react";
import { LogoMark } from "./Logo";
import { useI18n } from "@/i18n/client";

/**
 * Fenêtre flottante du contract address : en haut à droite sous la barre du haut (`top`, ordinateur),
 * en bas à droite sur mobile pour ne pas cacher le titre. Pas de libellé « Contract address » :
 * seulement l'adresse tronquée. Un clic copie l'adresse complète ; la croix la replie en pastille « CA ».
 */
export function CaFloat({ ca, top }: { ca: string; top: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(true);
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ca);
      setDone(true);
      setTimeout(() => setDone(false), 1600);
    } catch {}
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`pop fixed bottom-4 right-3 z-40 md:bottom-auto flex h-10 items-center gap-2 rounded-full border border-line bg-white/95 pl-1.5 pr-3.5 text-[13px] font-extrabold text-ink shadow-[0_18px_30px_-16px_rgba(5,18,60,.55)] backdrop-blur-md transition hover:-translate-y-0.5 md:right-6 ${top}`}
      >
        <LogoMark size={26} />
        CA
      </button>
    );
  }

  return (
    <div
      className={`fade-up fixed bottom-4 right-3 z-40 md:bottom-auto flex items-center gap-2.5 rounded-[18px] border border-line bg-white/95 py-2 pl-2 pr-1.5 shadow-[0_24px_50px_-22px_rgba(5,18,60,.6)] backdrop-blur-md md:right-6 md:gap-3 md:py-2.5 md:pl-2.5 ${top}`}
    >
      <LogoMark size={30} />
      <button
        type="button"
        onClick={copy}
        title={ca}
        className="min-w-0 font-display text-[14px] font-extrabold leading-none tracking-tight text-ink transition hover:text-blue md:text-[15px]"
      >
        {ca.slice(0, 5)}…{ca.slice(-5)}
      </button>
      <button
        type="button"
        onClick={copy}
        aria-label={t.common.copy}
        className={`plaque h-9 w-9 shrink-0 px-0 text-[13px] md:w-auto md:px-3.5 ${done ? "plaque-up" : ""}`}
      >
        {done ? <Check size={15} strokeWidth={3} /> : <Copy size={14} />}
        <span className="hidden md:inline">{done ? t.common.copied : t.common.copy}</span>
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label={t.common.close}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-faint transition hover:bg-relief hover:text-ink"
      >
        <X size={15} />
      </button>
    </div>
  );
}
