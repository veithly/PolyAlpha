"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useAccount } from "wagmi";
import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { AppHeader } from "@/components/AppHeader";
import { ContributionList } from "@/components/ContributionList";
import type { MarketDetail } from "@/domain/types";
import { useAiDrawer } from "@/components/ai-drawer-context";

const PriceTrendChart = dynamic(
  () =>
    import("@/components/PriceTrendChart").then(
      (mod) => mod.PriceTrendChart
    ),
  {
    ssr: false,
    loading: () => (
      <div style={{ height: 260 }}>
        <p className="muted">Loading chart…</p>
      </div>
    ),
  }
);

type Props = {
  marketId: string;
};

export function MarketDetailScreen({ marketId }: Props) {
  const { address } = useAccount();
  const [summaryNonce, setSummaryNonce] = useState(0);
  const { setContext, setOpen } = useAiDrawer();
  const detailQuery = useQuery({
    enabled: Boolean(marketId),
    queryKey: ["market-detail", marketId],
    queryFn: async () => {
      const response = await fetch(`/api/markets/${marketId}`);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error("Failed to load market");
      const body = (await response.json()) as { data: MarketDetail };
      return body.data;
    },
  });

  const summaryQuery = useQuery({
    enabled: Boolean(marketId),
    queryKey: ["market-summary", marketId, summaryNonce],
    queryFn: async () => {
      const force = summaryNonce > 0;
      const response = await fetch(
        `/api/markets/${marketId}/summary${force ? "?force=true" : ""}`
      );
      if (!response.ok) throw new Error("Failed to load summary");
      const body = (await response.json()) as {
        data: { summary: string; generatedAt: string };
      };
      return body.data;
    },
  });

  const marketFromDetail = detailQuery.data;
  const smartMoneyQuery = useQuery({
    enabled: Boolean(marketFromDetail?.id),
    queryKey: ["smart-money", marketFromDetail?.id],
    queryFn: async () => {
      if (!marketFromDetail?.id) {
        throw new Error("missing market id");
      }
      const res = await fetch(`/api/markets/${marketFromDetail.id}/smart-money`);
      if (!res.ok) throw new Error("Failed smart money");
      return (await res.json()) as { data: { inflowUsd: number; depthDeltaUsd: number } };
    },
  });

  useEffect(() => {
    if (detailQuery.data) {
      const market = detailQuery.data;
      const description =
        market.description?.slice(0, 260) ??
        summaryQuery.data?.summary?.slice(0, 260);
      setContext({
        marketId: market.id,
        title: market.title,
        yesProbability: market.yesProbability,
        change24h: market.change24h,
        category: market.category,
        description,
        summarySnippet: summaryQuery.data?.summary?.slice(0, 260),
        news: summaryQuery.data
          ? [{ title: "AI summary updated", link: undefined }]
          : undefined,
      });
    }
  }, [detailQuery.data, summaryQuery.data, setContext]);

  if (detailQuery.isLoading) {
    return (
      <div className="page-shell">
        <div className="container">
          <AppHeader />
          <div className="card">Loading market…</div>
        </div>
      </div>
    );
  }

  if (!detailQuery.data) {
    return (
      <div className="page-shell">
        <div className="container">
          <AppHeader />
          <div className="card">Market not found.</div>
        </div>
      </div>
    );
  }

  const market = detailQuery.data;
  const priceSeries =
    market.priceSeries && market.priceSeries.length
      ? market.priceSeries
      : buildFlatSeries(market);

  return (
    <div className="page-shell">
      <div className="container">
        <AppHeader />
        <main className="grid" style={{ gap: 24 }}>
          <section className="card">
            <div className="section-heading" style={{ flexWrap: "wrap", alignItems: "flex-start", gap: 12 }}>
              <div>
                <p className="muted" style={{ margin: 0 }}>
                  {market.category}
                </p>
                <h1 style={{ margin: "6px 0 0" }}>{market.title}</h1>
              </div>
              <Link
                href={market.polymarketUrl}
                className="pill-button pill-button--primary"
                target="_blank"
                rel="noreferrer"
              >
                View on Polymarket ↗
              </Link>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 14,
                marginTop: 20,
              }}
            >
              <Stat
                label="Yes probability"
                value={`${(market.yesProbability * 100).toFixed(1)}%`}
              />
              <Stat
                label="24h change"
                value={`${(market.change24h * 100).toFixed(1)}%`}
              />
              <Stat
                label="24h volume"
                value={`$${market.volume24h.toLocaleString()}`}
              />
              {smartMoneyQuery.data?.data?.inflowUsd ? (
                <Stat
                  label="Smart inflow"
                  value={`$${Math.round(
                    smartMoneyQuery.data.data.inflowUsd
                  ).toLocaleString()}`}
                />
              ) : null}
            </div>
          </section>

          <section className="card">
            <h3 style={{ marginTop: 0 }}>Price trend</h3>
            <PriceTrendChart data={priceSeries} />
          </section>

          <section className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <h3 style={{ marginTop: 0 }}>AI summary</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="pill"
                  onClick={() => setSummaryNonce((n) => n + 1)}
                  disabled={summaryQuery.isFetching}
                >
                  {summaryQuery.isFetching ? "Refreshing…" : "Refresh insight"}
                </button>
                <button
                  type="button"
                  className="pill-button pill-button--primary"
                  onClick={() => setOpen(true)}
                >
                  Open AI drawer
                </button>
              </div>
            </div>
            {summaryQuery.isLoading && <p className="muted">Generating summary…</p>}
            {summaryQuery.data && (
              <article className="prose">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {summaryQuery.data.summary}
                </ReactMarkdown>
                <p className="muted" style={{ marginTop: 8, fontSize: "0.85rem" }}>
                  Updated {new Date(summaryQuery.data.generatedAt).toLocaleString()}
                </p>
              </article>
            )}
            {summaryQuery.isError && (
              <p className="muted">Unable to load summary right now.</p>
            )}
            <div className="disclaimer">
              Generated by Qwen via FLock. Always verify sources before acting.
            </div>
          </section>

          <section className="card">
            <h3 style={{ marginTop: 0 }}>Market context</h3>
            {market.description ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {market.description}
              </ReactMarkdown>
            ) : (
              <p className="muted">No additional description provided.</p>
            )}
          </section>

          <ContributionList marketId={market.id} walletAddress={address} />
        </main>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="muted" style={{ margin: 0 }}>
        {label}
      </p>
      <p style={{ fontSize: "1.4rem", margin: 0 }}>{value}</p>
    </div>
  );
}

function buildFlatSeries(market: MarketDetail) {
  const ts =
    market.updatedAt ??
    market.createdAt ??
    new Date().toISOString();
  const anchor = {
    timestamp: ts,
    value: market.yesProbability,
  };
  // duplicate point so Recharts renders a line
  return [anchor, { ...anchor, timestamp: market.endDate ?? ts }];
}
