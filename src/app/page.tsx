"use client";

export const runtime = 'nodejs';

import { useEffect, useMemo, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";

import { AppHeader } from "@/components/AppHeader";
import { TopicFilter } from "@/components/TopicFilter";
import { MarketCard } from "@/components/MarketCard";
import { useAiDrawer } from "@/components/ai-drawer-context";
import { FilterControls } from "@/components/FilterControls";
import { useMarketsStream } from "@/lib/useMarketsStream";
import { FilterIcon } from "@/components/icons";
import { FloatingAssistant } from "@/components/FloatingAssistant";

type MarketsResponse = {
  items: import("@/domain/types").MarketSummary[];
  cursor?: string;
};

type TopicFilterValue = import("@/domain/types").Topic | "all";
type TopicValue = import("@/domain/types").Topic;

const MARKET_FILTER_PRESETS = {
  all: {
    label: "All markets",
    description: "Default signal mix",
    params: {},
  },
  liquidity: {
    label: "High liquidity",
    description: "≥ $25k depth",
    params: { liquidityMin: 25000 },
  },
  whales: {
    label: "Whale volume",
    description: "≥ $75k 24h volume",
    params: { volume24hMin: 75000 },
  },
  momentum: {
    label: "Bullish momentum",
    description: "≥ +5% daily move",
    params: { change24hMin: 0.05 },
  },
  watchlist: {
    label: "My watchlist",
    description: "Saved markets",
    requiresWallet: true as const,
  },
} as const;

type MarketFilterPreset = keyof typeof MARKET_FILTER_PRESETS;

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { address, isConnected } = useAccount();
  const { setContext, setOpen } = useAiDrawer();
  const [guestMode, setGuestMode] = useState(false);
  const [activeTopic, setActiveTopic] = useState<TopicFilterValue>("all");
  const isMobile = useIsMobile();
  const [marketPreset, setMarketPreset] = useState<MarketFilterPreset>("all");
  const [stackedTopics, setStackedTopics] = useState<TopicValue[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [liquidityMin, setLiquidityMin] = useState<number | undefined>();
  const [liquidityMax, setLiquidityMax] = useState<number | undefined>();
  const [volumeMin, setVolumeMin] = useState<number | undefined>();
  const [volumeMax, setVolumeMax] = useState<number | undefined>();
  const [changeMin, setChangeMin] = useState<number | undefined>();
  const [changeMax, setChangeMax] = useState<number | undefined>();
  const [liveOverrides, setLiveOverrides] = useState<
    Record<
      string,
      Partial<import("@/domain/types").MarketSummary> & {
        smart?: import("@/lib/polymarket-ws").SmartPulse;
      }
    >
  >({});

  const toggleStackedTopic = (topic: TopicValue) => {
    setStackedTopics((prev) =>
      prev.includes(topic)
        ? prev.filter((t) => t !== topic)
        : [...prev, topic]
    );
  };

  useEffect(() => {
    if (marketPreset === "watchlist" && !address) {
      setMarketPreset("all");
    }
  }, [marketPreset, address]);

  useEffect(() => {
    // On desktop keep filters open; on mobile start closed.
    setFiltersOpen(!isMobile);
  }, [isMobile]);

  const isWatchlistMode = useMemo(
    () => marketPreset === "watchlist",
    [marketPreset]
  );

  const marketsQuery = useInfiniteQuery({
    enabled: !isWatchlistMode,
    initialPageParam: undefined as string | undefined,
    queryKey: [
      "markets",
      activeTopic,
      stackedTopics.slice().sort().join(","),
      marketPreset,
      liquidityMin,
      liquidityMax,
      volumeMin,
      volumeMax,
      changeMin,
      changeMax,
    ],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      const topics = [
        ...(activeTopic !== "all" ? [activeTopic] : []),
        ...stackedTopics,
      ];
      if (topics.length) {
        params.set("topics", Array.from(new Set(topics)).join(","));
      }
      params.set("limit", "12");
      if (pageParam) {
        params.set("cursor", String(pageParam));
      }
      const preset = MARKET_FILTER_PRESETS[marketPreset];
      if ("params" in preset && preset.params && marketPreset !== "watchlist") {
        Object.entries(preset.params).forEach(([key, value]) => {
          params.set(key, String(value));
        });
      }
      if (liquidityMin) params.set("liquidityMin", String(liquidityMin));
      if (liquidityMax) params.set("liquidityMax", String(liquidityMax));
      if (volumeMin) params.set("volume24hMin", String(volumeMin));
      if (volumeMax) params.set("volume24hMax", String(volumeMax));
      if (changeMin != null) params.set("change24hMin", String(changeMin));
      if (changeMax != null) params.set("change24hMax", String(changeMax));
      const response = await fetch(`/api/markets?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to load markets");
      const body = (await response.json()) as { data: MarketsResponse };
      return body.data;
    },
    getNextPageParam: (lastPage) => lastPage.cursor ?? undefined,
  });

  const watchlistQuery = useQuery({
    queryKey: ["watchlist", address],
    enabled: Boolean(address),
    queryFn: async () => {
      const response = await fetch("/api/markets/watchlist", {
        headers: {
          "x-wallet-address": address ?? "",
        },
      });
      if (!response.ok) throw new Error("Failed to load watchlist");
      const body = (await response.json()) as {
        data: { ids: string[]; items: MarketsResponse["items"] };
      };
      return body.data;
    },
  });

  const watchlistIds = useMemo(
    () => watchlistQuery.data?.ids ?? [],
    [watchlistQuery.data]
  );
  const watchlistSet = useMemo(() => new Set(watchlistIds), [watchlistIds]);
  const watchlistItems = useMemo(
    () => watchlistQuery.data?.items ?? [],
    [watchlistQuery.data]
  );

  const marketsList = useMemo(
    () => (marketsQuery.data?.pages ?? []).flatMap((page) => page.items),
    [marketsQuery.data?.pages]
  );

  const watchlistMutation = useMutation({
    mutationFn: async ({
      marketId,
      currentlyWatchlisted,
    }: {
      marketId: string;
      currentlyWatchlisted: boolean;
    }) => {
      if (!address) throw new Error("Wallet not connected");
      const headers = {
        "x-wallet-address": address,
        "content-type": "application/json",
      };
      if (currentlyWatchlisted) {
        const response = await fetch(`/api/markets/watchlist/${marketId}`, {
          method: "DELETE",
          headers,
        });
        if (!response.ok) {
          throw new Error("Failed to remove from watchlist");
        }
      } else {
        const response = await fetch("/api/markets/watchlist", {
          method: "POST",
          headers,
          body: JSON.stringify({ marketId }),
        });
        if (!response.ok) {
          throw new Error("Failed to add to watchlist");
        }
      }
    },
    onSuccess: () => {
      if (address) {
        queryClient.invalidateQueries({ queryKey: ["watchlist", address] });
      }
    },
  });

  const handleToggleWatchlist = (
    marketId: string,
    currentlyWatchlisted: boolean
  ) => {
    if (!address) return;
    watchlistMutation.mutate({ marketId, currentlyWatchlisted });
  };

  const displayedMarkets = useMemo(
    () => (isWatchlistMode ? watchlistItems : marketsList),
    [isWatchlistMode, watchlistItems, marketsList]
  );
  const marketsWithLive = useMemo(
    () =>
      displayedMarkets.map((market) => ({
        ...market,
        ...(liveOverrides[market.id] ?? {}),
        smart: liveOverrides[market.id]?.smart,
      })),
    [displayedMarkets, liveOverrides]
  );
  const marketsLoading = isWatchlistMode
    ? watchlistQuery.isLoading
    : marketsQuery.isLoading;
  const marketsFetchingMore = marketsQuery.isFetchingNextPage;
  const hasMoreMarkets = Boolean(
    !isWatchlistMode && marketsQuery.hasNextPage
  );

  useMarketsStream(
    marketsWithLive.map((m) => m.id),
    (tick) => {
      setLiveOverrides((prev) => ({
        ...prev,
        [tick.marketId]: {
          ...(prev[tick.marketId] ?? {}),
          yesProbability:
            typeof tick.price === "number"
              ? tick.price
              : prev[tick.marketId]?.yesProbability,
          smart: tick.smart ?? prev[tick.marketId]?.smart,
        },
      }));
    }
  );

  const shouldShowOnboarding = !isConnected && !guestMode;

  return (
    <div className="page-shell">
      <div className="container">
        <AppHeader />
        {shouldShowOnboarding ? (
          <OnboardingHero onExplore={() => setGuestMode(true)} />
        ) : (
          <main className="grid" style={{ gap: 24 }}>
            <section className="card">
              <div className="section-heading">
                <div>
                  <h2 style={{ margin: 0 }}>Newsfeed markets</h2>
                  <p className="muted" style={{ marginBottom: 0 }}>
                    Live Polymarket markets with AI news-style summaries.
                  </p>
                </div>
              </div>
              <TopicFilter
                active={activeTopic}
                onChange={setActiveTopic}
                stackedTopics={stackedTopics}
                onToggleStacked={toggleStackedTopic}
              />
              <FilterPresetChips
                activePreset={marketPreset}
                onChange={setMarketPreset}
                isConnected={isConnected}
              />
              <details className="filter-panel" open={filtersOpen} onToggle={(e) => setFiltersOpen((e.target as HTMLDetailsElement).open)}>
                <summary className="filter-toggle">
                  <FilterIcon aria-hidden />
                  <span>Advanced filters</span>
                  <span aria-hidden style={{ fontSize: "0.9rem", color: "var(--color-text-muted)" }}>
                    {filtersOpen ? "(collapse)" : "(expand)"}
                  </span>
                </summary>
                <div className="card-soft">
                  <strong style={{ display: "block", marginBottom: 8 }}>
                    Stack topics
                  </strong>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {["crypto", "politics", "sports", "meme", "macro"].map(
                      (topic) => (
                        <button
                          key={topic}
                          type="button"
                          className={`chip ${
                            stackedTopics.includes(topic as TopicValue)
                              ? "chip--active"
                              : ""
                          }`}
                          onClick={() => toggleStackedTopic(topic as TopicValue)}
                        >
                          {topic}
                        </button>
                      )
                    )}
                  </div>
                </div>
                <FilterControls
                  liquidityMin={liquidityMin}
                  liquidityMax={liquidityMax}
                  volumeMin={volumeMin}
                  volumeMax={volumeMax}
                  changeMin={changeMin}
                  changeMax={changeMax}
                  onLiquidityChange={(v) => setLiquidityMin(v || undefined)}
                  onLiquidityMaxChange={(v) => setLiquidityMax(v || undefined)}
                  onVolumeChange={(v) => setVolumeMin(v || undefined)}
                  onVolumeMaxChange={(v) => setVolumeMax(v || undefined)}
                  onChangeMin={(v) => setChangeMin(Number.isFinite(v) ? v : undefined)}
                  onChangeMax={(v) => setChangeMax(Number.isFinite(v) ? v : undefined)}
                />
              </details>
              <div style={{ marginTop: 20 }} className="cards-grid">
                {marketsLoading && marketsWithLive.length === 0 && (
                  <MarketSkeletons />
                )}
                {!marketsLoading &&
                  marketsWithLive.map((market) => (
                    <MarketCard
                      key={market.id}
                      market={market}
                      smartPulse={market.smart as import("@/lib/polymarket-ws").SmartPulse | undefined}
                      isWatchlisted={watchlistSet.has(market.id)}
                      onToggleWatchlist={
                        address ? handleToggleWatchlist : undefined
                      }
                      watchlistDisabled={watchlistMutation.isPending}
                    />
                  ))}
                {!marketsLoading && marketsWithLive.length === 0 && (
                  <p className="muted">
                    {isWatchlistMode
                      ? "You haven't saved any markets yet. Tap the ☆ button on a card to populate this list."
                      : "No markets found for this filter. Try switching presets or selecting “All markets”."
                    }
                  </p>
                )}
              </div>
              {hasMoreMarkets && (
                <div style={{ textAlign: "center", marginTop: 16 }}>
                  <button
                    type="button"
                    className="pill-button pill-button--primary"
                    onClick={() => marketsQuery.fetchNextPage()}
                    disabled={marketsFetchingMore}
                  >
                    {marketsFetchingMore ? "Loading more…" : "Load more"}
                  </button>
                </div>
              )}
            </section>

            <footer className="card">
              <p className="disclaimer">
                PolyAlpha is an intelligence layer only. Nothing here is investment
                advice. Always verify before trading on Polymarket.
              </p>
            </footer>
          </main>
        )}
      </div>
      <FloatingAssistant />
    </div>
  );
}

function OnboardingHero({ onExplore }: { onExplore: () => void }) {
  return (
    <section
      className="card"
      style={{
        textAlign: "center",
        padding: "52px 24px",
        marginTop: 32,
        background: "var(--color-surface)",
        borderColor: "var(--color-border-strong)",
      }}
    >
      <h1 style={{ fontSize: "2rem" }}>Polymarket intelligence, distilled.</h1>
      <p className="muted" style={{ maxWidth: 520, margin: "12px auto 32px" }}>
        Connect your Base wallet to sync preferences, or explore as a guest to see
        daily AI outlooks, trending markets, and Alpha-ready prompts.
      </p>
      <div className="onboarding-actions" style={{ display: "flex", justifyContent: "center", gap: 12 }}>
        <ConnectButton />
        <button
          type="button"
          className="pill-button pill-button--ghost"
          onClick={onExplore}
        >
          Explore without wallet
        </button>
      </div>
    </section>
  );
}

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return mobile;
}

function MarketSkeletons() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="card"
          style={{ height: 120, background: "var(--color-surface-alt)" }}
        />
      ))}
    </>
  );
}

function FilterPresetChips({
  activePreset,
  onChange,
  isConnected,
}: {
  activePreset: MarketFilterPreset;
  onChange: (preset: MarketFilterPreset) => void;
  isConnected: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        marginTop: 16,
      }}
    >
      {Object.entries(MARKET_FILTER_PRESETS).map(([preset, meta]) => {
        const id = preset as MarketFilterPreset;
        if ("requiresWallet" in meta && meta.requiresWallet && !isConnected) {
          return null;
        }
        const isActive = activePreset === id;
        return (
          <button
            key={id}
            type="button"
            className={`chip ${isActive ? "chip--active" : ""}`}
            style={{ textAlign: "left" }}
            aria-pressed={isActive}
            onClick={() => onChange(id)}
          >
            <div style={{ fontWeight: 600 }}>{meta.label}</div>
            <div
              className="muted"
              style={{ fontSize: "0.75rem", textTransform: "none" }}
            >
              {meta.description}
            </div>
          </button>
        );
      })}
    </div>
  );
}
