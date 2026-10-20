import "server-only";
import { KOLS, type Kol } from "@/data/kols";
import { MARKETS, type Market, type Outcome, type Period } from "@/data/markets";
import { applyLaunch } from "./launch";
import { supabase } from "./supabase";

/**
 * Couche d'accès aux données.
 * Si Supabase est configuré (variables d'environnement), on lit la base.
 * Sinon, ou en cas d'erreur, on retombe sur les données mock pour que le site
 * reste toujours affichable.
 */

type KolRow = { id: string; name: string; handle: string; wallet: string; avatar_url: string | null; color: string };
type StatRow = { kol_id: string; period: Period; pnl_usd: number; volume_usd: number; win_rate: number | null; trades: number | null };
type SeriesRow = { kol_id: string; snapshot_date: string; cumulative_pnl_usd: number };
type MarketRow = {
  id: string; slug: string; title: string; question: string; category: string; period: Period;
  challenge_no: number | null; starts_at: string; ends_at: string; closes_at: string; status: string;
  rules: string[]; featured: boolean;
  outcomes: { id: string; kol_id: string; position: number; pool_usd: number; change_24h: number }[];
};
type StatsRow = { market_id: string; volume_usd: number; traders: number };

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

/** Série cumulée des `n` derniers jours, ramenée à 0 au premier point. */
function windowSeries(rows: SeriesRow[], n: number): number[] {
  const last = rows.slice(-n).map((r) => num(r.cumulative_pnl_usd));
  if (last.length === 0) return Array(n).fill(0);
  const base = last.length > 1 ? last[0] : 0;
  const series = last.map((v) => Math.round(v - base));
  while (series.length < n) series.unshift(0);
  return series;
}

export async function getKols(): Promise<Kol[]> {
  const sb = supabase();
  if (!sb) return KOLS;
  try {
    const [kols, stats, series] = await Promise.all([
      sb.from("kols").select("id,name,handle,wallet,avatar_url,color").eq("active", true),
      sb.from("kol_stats").select("kol_id,period,pnl_usd,volume_usd,win_rate,trades"),
      sb.from("kol_pnl_series").select("kol_id,snapshot_date,cumulative_pnl_usd").order("snapshot_date"),
    ]);
    if (kols.error || stats.error || series.error || !kols.data?.length) throw kols.error ?? stats.error ?? series.error ?? new Error("vide");

    const statFor = (id: string, p: Period) => (stats.data as StatRow[]).find((s) => s.kol_id === id && s.period === p);
    return (kols.data as KolRow[]).map((k) => {
      const s7 = statFor(k.id, "7D");
      const s30 = statFor(k.id, "30D");
      const rows = (series.data as SeriesRow[]).filter((r) => r.kol_id === k.id);
      return {
        id: k.id,
        name: k.name,
        handle: k.handle,
        wallet: k.wallet,
        avatar: k.avatar_url,
        color: k.color,
        pnl7d: num(s7?.pnl_usd),
        pnl30d: num(s30?.pnl_usd),
        volume7d: num(s7?.volume_usd),
        winRate: num(s7?.win_rate),
        trades7d: num(s7?.trades),
        series7d: windowSeries(rows, 7),
        series30d: windowSeries(rows, 30),
      };
    }).sort((a, b) => b.pnl7d - a.pnl7d);
  } catch (e) {
    console.error("[data] getKols → mock :", (e as Error).message);
    return KOLS;
  }
}

export async function getMarkets(): Promise<Market[]> {
  return applyLaunch(await loadMarkets());
}

async function loadMarkets(): Promise<Market[]> {
  const sb = supabase();
  if (!sb) return MARKETS;
  try {
    const [kols, markets, stats] = await Promise.all([
      getKols(),
      sb.from("markets")
        .select("id,slug,title,question,category,period,challenge_no,starts_at,ends_at,closes_at,status,rules,featured,outcomes(id,kol_id,position,pool_usd,change_24h)")
        .neq("status", "DRAFT")
        .order("challenge_no"),
      sb.from("market_stats").select("market_id,volume_usd,traders"),
    ]);
    if (markets.error || !markets.data?.length) throw markets.error ?? new Error("aucun marché");
    const kolById = new Map(kols.map((k) => [k.id, k]));
    const statFor = (id: string) => (stats.data as StatsRow[] | null)?.find((s) => s.market_id === id);

    return (markets.data as unknown as MarketRow[]).map((m) => {
      const st = statFor(m.id);
      // Cagnotte par KOL (outcomes.pool_usd, maintenue par trigger sur `bets`).
      const outcomes: Outcome[] = m.outcomes
        .map((o) => ({ kol: kolById.get(o.kol_id), pool: num(o.pool_usd), change24h: num(o.change_24h) }))
        .filter((o): o is Outcome => Boolean(o.kol))
        .sort((a, b) => b.pool - a.pool);
      return {
        slug: m.slug,
        title: m.title,
        question: m.question,
        category: "KOL",
        period: m.period,
        challenge: m.challenge_no ?? 0,
        startsAt: m.starts_at,
        endsAt: m.ends_at,
        closesAt: m.closes_at,
        volume: num(st?.volume_usd),
        pool: outcomes.reduce((t, o) => t + o.pool, 0),
        traders: num(st?.traders),
        rules: m.rules ?? [],
        featured: m.featured,
        outcomes,
      };
    });
  } catch (e) {
    console.error("[data] getMarkets → mock :", (e as Error).message);
    return MARKETS;
  }
}

export async function getMarket(slug: string): Promise<Market | null> {
  const all = await getMarkets();
  return all.find((m) => m.slug === slug) ?? null;
}
