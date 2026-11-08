import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { CoinScene } from "@/components/landing/CoinScene";
import { FeesSection } from "@/components/landing/FeesSection";
import { FinalCta } from "@/components/landing/FinalCta";
import { HeroScene } from "@/components/landing/HeroScene";
import { MarketsScreen } from "@/components/landing/MarketsScreen";
import { LandingNav } from "@/components/landing/LandingNav";
import { LockProvider } from "@/components/landing/AppLink";
import { COIN_MARKETS } from "@/data/coins";
import { getKols, getMarkets, requestTime } from "@/lib/data";
import { getLaunch } from "@/lib/launch";
import { getI18n } from "@/i18n/server";
import { localizeCoinMarket, localizeMarket } from "@/i18n/content";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: { absolute: t.meta.landingTitle } };
}

export default async function Landing() {
  const [markets, kols, { t }] = await Promise.all([getMarkets(), getKols(), getI18n()]);
  const launch = getLaunch();
  const raw = markets.find((m) => m.period === "7D") ?? markets[0];
  const kolMarket = localizeMarket(raw, t);
  const coinMarket = localizeCoinMarket(COIN_MARKETS[0], t);
  return (
    <LockProvider locked={!launch.open} at={launch.at} serverNow={requestTime()}>
      <LandingNav />
      <main className="flex-1">
        <HeroScene market={kolMarket} kols={kols} coins={coinMarket.outcomes} />
        <CoinScene market={coinMarket} />
        <MarketsScreen />
        <FeesSection />
        <FinalCta kols={kols} kolMarket={kolMarket} coinMarket={coinMarket} />
      </main>
      <Footer />
    </LockProvider>
  );
}
