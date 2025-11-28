"use client";

import type { Topic } from "@/domain/types";

const TOPIC_OPTIONS: { label: string; value: Topic | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Crypto", value: "crypto" },
  { label: "Politics", value: "politics" },
  { label: "Sports", value: "sports" },
  { label: "Meme", value: "meme" },
  { label: "Macro", value: "macro" },
];

type Props = {
  active: Topic | "all";
  onChange: (value: Topic | "all") => void;
  stackedTopics?: Topic[];
  onToggleStacked?: (topic: Topic) => void;
};

export function TopicFilter({
  active,
  onChange,
  stackedTopics = [],
  onToggleStacked,
}: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {TOPIC_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`chip ${active === option.value ? "chip--active" : ""}`}
            onClick={() => onChange(option.value)}
            onContextMenu={(e) => {
              if (!onToggleStacked || option.value === "all") return;
              e.preventDefault();
              onToggleStacked(option.value as Topic);
            }}
            title={
              option.value === "all"
                ? "Show everything"
                : "Click to filter; right-click to stack with others"
            }
          >
            {option.label}
          </button>
        ))}
      </div>
      {stackedTopics.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            alignItems: "center",
            fontSize: "0.85rem",
          }}
        >
          <span className="muted">Stacked:</span>
          {stackedTopics.map((topic) => (
            <button
              key={topic}
              type="button"
              className="chip chip--active"
              onClick={() => onToggleStacked?.(topic)}
              style={{ textTransform: "capitalize" }}
            >
              {topic} ✕
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
