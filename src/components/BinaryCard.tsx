import Link from "next/link";
import { Bookmark } from "lucide-react";
import type { BinaryMarket } from "@/data/markets";
import { kolById } from "@/data/kols";
import { Avatar } from "./Avatar";
import { mult, pct, usd } from "@/lib/format";

export function BinaryCard({ market }: { market: BinaryMarket }) {
  const kol = kolById(market.kolId)!;
  return (
    <Link href={`/market/kol-top-profit-${market.period.toLowerCase()}`} className="card card-hover group block p-4">
      <div className="mb-4 flex items-start gap-3">
        <Avatar kol={kol} size={40} className="ring-2 ring-white" />
        <h3 className="line-clamp-2 flex-1 font-semibold leading-snug group-hover:text-gold-3">{market.title}</h3>
        <div className="relative grid h-12 w-12 shrink-0 place-items-center">
          <svg viewBox="0 0 36 36" className="h-12 w-12 -rotate-90">
            <circle cx="18" cy="18" r="15" fill="none" stroke="#ebe4d3" strokeWidth="3.5" />
            <circle cx="18" cy="18" r="15" fill="none" stroke={market.yes >= 0.5 ? "#16a34a" : "#dc2626"} strokeWidth="3.5"
              strokeDasharray={`${market.yes * 94.2} 94.2`} strokeLinecap="round" />
          </svg>
          <div className="absolute text-center leading-none">
            <div className="text-[11px] font-bold">{pct(market.yes)}</div>
            <div className="text-[9px] text-muted">Oui</div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <span className="btn-up">Oui {pct(market.yes)} · {mult(1 / market.yes)}</span>
        <span className="btn-down">Non {pct(1 - market.yes)} · {mult(1 / (1 - market.yes))}</span>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-down live-dot" />
          <span className="font-semibold text-down">EN DIRECT</span>
          <span>· {usd(market.volume, { compact: true })} Vol. · {market.period}</span>
        </span>
        <Bookmark size={14} />
      </div>
    </Link>
  );
}
