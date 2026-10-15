"use client";

import { useMarketingData } from "./MarketingContext";
import MarketingLoading from "./MarketingLoading";

export default function MarketingSyncIndicator() {
  const { loading, refreshing } = useMarketingData();

  if (!loading && !refreshing) return null;

  return <MarketingLoading />;
}
