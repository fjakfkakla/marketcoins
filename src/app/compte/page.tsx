import type { Metadata } from "next";
import { AccountView } from "@/components/AccountView";
import { getMarkets } from "@/lib/data";

export const metadata: Metadata = { title: "Mon compte" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const markets = await getMarkets();
  return <AccountView markets={markets} />;
}
