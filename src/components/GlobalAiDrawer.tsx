import dynamic from "next/dynamic";
import { useAccount } from "wagmi";
import { useEffect, useMemo } from "react";

import { useAiDrawer } from "./ai-drawer-context";

const AskAiPanel = dynamic(
  () => import("@/components/AskAiPanel").then((mod) => mod.AskAiPanel),
  { ssr: false }
);

export function GlobalAiDrawer() {
  const { address } = useAccount();
  const { isOpen, setOpen, context } = useAiDrawer();

  const title = "PolyAlpha Agent";
  const odds = context?.yesProbability;
  const change = context?.change24h;
  const contextNote = useMemo(() => {
    if (!context) return undefined;
    const parts = [
      context.title,
      context.category,
      odds != null ? `Yes ${(odds * 100).toFixed(1)}%` : null,
      change != null ? `${(change * 100).toFixed(1)}% / 24h` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    const desc = context.summarySnippet ?? context.description;
    return [parts, desc].filter(Boolean).join(" — ");
  }, [change, context, odds]);

  const suggestions = useMemo(() => {
    const base = context
      ? [
          `Why is ${context.title} moving?`,
          "Top catalysts in the next 24h?",
          "What signals should I monitor?",
          "Summarize the bull vs bear cases.",
        ]
      : [
          "What are today’s top news movers?",
          "Give me 3 headline catalysts to watch.",
          "What’s hot in crypto, politics, and sports right now?",
          "Summarize the biggest market-moving event today.",
        ];
    if (context?.category) {
      base.push(`How does ${context.category} impact odds?`);
    }
    return Array.from(new Set(base)).slice(0, 4);
  }, [context]);

  // Prevent background scroll when drawer open
  useEffect(() => {
    if (isOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 1200,
        display: "flex",
        justifyContent: "flex-end",
      }}
      onClick={() => setOpen(false)}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(720px, 100%)",
          height: "100%",
          background: "var(--color-surface)",
          borderLeft: "2px solid var(--color-border-strong)",
          boxShadow: "-8px 0 28px rgba(0,0,0,0.35)",
          padding: 20,
          overflowY: "auto",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div>
            <div style={{ fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
              AI chat
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: 800 }}>{title}</div>
          </div>
          <button
            className="pill"
            onClick={() => setOpen(false)}
            style={{ borderColor: "var(--color-border-strong)" }}
          >
            Close
          </button>
        </header>

        <AskAiPanel
          marketId={context?.marketId ?? 'global'}
          walletAddress={address ?? undefined}
          contextNote={contextNote}
          page={context ? 'market' : 'dashboard'}
          marketTitle={context?.title}
          marketCategory={context?.category}
          suggestions={suggestions}
        />
      </aside>
    </div>
  );
}
