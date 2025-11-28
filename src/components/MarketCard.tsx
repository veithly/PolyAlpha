"use client";

import React from "react";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { MarketSummary } from "@/domain/types";
import type { SmartPulse } from "@/lib/polymarket-ws";
import { useAiDrawer } from "./ai-drawer-context";

type Props = {
  market: MarketSummary;
  isWatchlisted?: boolean;
  onToggleWatchlist?: (marketId: string, isWatchlisted: boolean) => void;
  watchlistDisabled?: boolean;
  smartPulse?: SmartPulse | null;
};

export function MarketCard({
  market,
  isWatchlisted = false,
  onToggleWatchlist,
  watchlistDisabled = false,
  smartPulse = null,
}: Props) {
  const { setOpen, setContext } = useAiDrawer();
  const [live, setLive] = useState<MarketSummary>(market);
  const changeClass =
    live.change24h > 0
      ? "positive"
      : live.change24h < 0
      ? "negative"
      : "";

  useEffect(() => {
    setLive(market);
  }, [market]);

  return (
    <article
      className="card market-card"
      style={{
        position: "relative",
        display: "grid",
        gap: 14,
        borderColor: "var(--color-border-strong)",
        background: "linear-gradient(180deg, #ffffff 0%, #f6f8ff 100%)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          alignItems: "flex-start",
          gap: 14,
        }}
      >
        <div style={{ display: "grid", gap: 8 }}>
          <div className="muted" style={{ fontSize: "0.85rem" }}>
            {live.category}
          </div>
          <Link href={`/market/${live.id}`}>
            <h3 style={{ margin: 0, fontSize: "1.15rem", lineHeight: 1.3 }}>
              {live.title}
            </h3>
          </Link>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {live.topics.map((topic) => (
              <span
                key={topic}
                className="chip"
                style={{ fontSize: "0.8rem", padding: "6px 10px" }}
              >
                {topic}
              </span>
            ))}
            {smartPulse?.whaleScore != null && (
              <span
                className="chip"
                style={{ fontSize: "0.75rem", color: "var(--color-positive)" }}
              >
                Smart score {smartPulse.whaleScore}
              </span>
            )}
            {smartPulse?.inflowUsd && smartPulse.inflowUsd > 0 && (
              <span
                className="chip"
                style={{ fontSize: "0.75rem", color: "var(--color-positive)" }}
              >
                Smart ${Math.round(smartPulse.inflowUsd / 1000)}k
              </span>
            )}
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gap: 10,
            justifyItems: "end",
          }}
        >
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {live.isHot && (
              <span
                style={{
                  padding: "4px 10px",
                  borderRadius: 10,
                  background: "rgba(76,141,255,0.16)",
                  border: "1px solid var(--color-border-strong)",
                  fontWeight: 700,
                  fontSize: "0.75rem",
                }}
              >
                HOT
              </span>
            )}
            {live.isSpike && (
              <span
                style={{
                  padding: "4px 10px",
                  borderRadius: 10,
                  background: "rgba(232,76,76,0.14)",
                  border: "1px solid var(--color-border-strong)",
                  fontWeight: 700,
                  fontSize: "0.75rem",
                }}
              >
                SPIKE
              </span>
            )}
          </div>
          {onToggleWatchlist && (
            <button
              type="button"
              className="pill"
              aria-pressed={isWatchlisted}
              onClick={() => onToggleWatchlist(market.id, isWatchlisted)}
              disabled={watchlistDisabled}
              style={{
                fontSize: "0.9rem",
                borderColor: isWatchlisted ? "var(--color-accent)" : "var(--color-border-strong)",
                background: isWatchlisted
                  ? "linear-gradient(180deg, rgba(47, 107, 255, 0.18), rgba(47, 107, 255, 0.08))"
                  : "var(--color-surface)",
                boxShadow: "0 3px 0 var(--shadow-lite)",
                cursor: watchlistDisabled ? "not-allowed" : "pointer",
                color: "var(--color-text-primary)",
                opacity: watchlistDisabled ? 0.75 : 1,
                minWidth: 96,
              }}
            >
              {isWatchlisted ? "★ Saved" : "☆ Save"}
            </button>
          )}
          <div
            style={{
              minWidth: 150,
              textAlign: "right",
              background: "rgba(76,141,255,0.12)",
              borderRadius: 14,
              padding: "10px 12px",
              border: "1px solid var(--color-border-strong)",
              boxShadow: "0 3px 0 var(--shadow-lite)",
            }}
          >
            <div style={{ fontSize: "2rem", fontWeight: 800, lineHeight: 1 }}>
              {formatProbability(live.yesProbability)}
            </div>
            <div
              className="muted"
              style={{
                color:
                  changeClass === "positive"
                    ? "var(--color-positive)"
                    : changeClass === "negative"
                    ? "var(--color-negative)"
                    : "var(--color-text-muted)",
              }}
            >
              {formatChange(live.change24h)}
              <span style={{ fontSize: "0.8rem", marginLeft: 4 }}>24h</span>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
          borderTop: "1px dashed var(--color-border)",
          paddingTop: 10,
        }}
      >
        <div className="muted" style={{ fontSize: "0.9rem" }}>
          Liquidity: ${Math.round((live.liquidity ?? 0) / 1000)}k · 24h Vol: $
          {Math.round((live.volume24h ?? 0) / 1000)}k
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            className="pill-button pill-button--primary"
            onClick={() => {
              setContext({
                marketId: live.id,
                title: live.title,
                yesProbability: live.yesProbability,
                change24h: live.change24h,
                category: live.category,
                summarySnippet: (live as any)?.description ?? "",
              });
              setOpen(true);
            }}
            style={{ fontSize: "0.9rem" }}
          >
            Ask AI
          </button>
        <Link
          href={live.polymarketUrl}
          style={{ fontSize: "0.95rem", color: "var(--color-accent)", fontWeight: 700 }}
          target="_blank"
          rel="noreferrer"
        >
          View on Polymarket ↗
        </Link>
        </div>
      </div>
    </article>
  );
}

function formatProbability(value: number) {
  const pct = value * 100;
  if (pct > 0 && pct < 0.1) return "<0.1%";
  return `${pct.toFixed(pct < 1 ? 1 : 0)}%`;
}

function formatChange(value: number) {
  const pct = value * 100;
  if (pct === 0) return "+0.0%";
  if (Math.abs(pct) < 0.1) return `${pct > 0 ? "+" : "-"}<0.1%`;
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
}
