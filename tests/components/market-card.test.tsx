import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarketCard } from "@/components/MarketCard";
import type { MarketSummary } from "@/domain/types";

const baseMarket: MarketSummary = {
  id: "m1",
  title: "Will BTC stay above $60k by month-end?",
  category: "Crypto",
  topics: ["crypto"],
  status: "open",
  yesProbability: 0.62,
  yesPrice: 0.62,
  noPrice: 0.35,
  change24h: 0.04,
  volume24h: 180_000,
  totalVolume: 250_000,
  liquidity: 30_000,
  isHot: true,
  isSpike: false,
  polymarketUrl: "https://polymarket.com/event/m1",
  updatedAt: new Date().toISOString(),
  endDate: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
};

describe("MarketCard", () => {
  it("renders headline, stats, and link", () => {
    render(
      <MarketCard
        market={baseMarket}
        onToggleWatchlist={() => {}}
        isWatchlisted={false}
      />
    );

    expect(
      screen.getByText("Will BTC stay above $60k by month-end?")
    ).toBeInTheDocument();
    expect(screen.getByText(/62%/)).toBeInTheDocument();
    expect(screen.getByText(/24h Vol/)).toBeInTheDocument();
    expect(screen.getByText(/View on Polymarket/)).toBeInTheDocument();
  });

  it("shows hot badge and watchlist state", () => {
    render(
      <MarketCard
        market={{ ...baseMarket, isHot: true, isSpike: true }}
        onToggleWatchlist={() => {}}
        isWatchlisted
      />
    );

    expect(screen.getByText(/HOT/i)).toBeInTheDocument();
    expect(screen.getByText(/SPIKE/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Saved/i })).toBeInTheDocument();
  });
});
