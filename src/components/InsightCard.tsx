"use client";

import type { AiInsight, InsightCadence } from "@/domain/types";

type Props = {
  insight?: AiInsight;
  isLoading: boolean;
  cadence: InsightCadence;
  onCadenceChange: (cadence: InsightCadence) => void;
  onRegenerateSection?: (heading: string) => void;
  regeneratingSection?: string | null;
};

const CADENCE_OPTIONS: { id: InsightCadence; label: string }[] = [
  { id: "daily", label: "Daily" },
  { id: "hourly", label: "Hourly" },
  { id: "event", label: "Event" },
];

export function InsightCard({
  insight,
  isLoading,
  cadence,
  onCadenceChange,
  onRegenerateSection,
  regeneratingSection,
}: Props) {
  return (
    <section className="card">
      <div className="section-heading">
        <div>
          <h2 style={{ margin: 0 }}>AI outlook</h2>
          <div className="muted" style={{ fontSize: "0.85rem" }}>
            {insight
              ? `Updated ${new Date(insight.generatedAt).toLocaleTimeString()} • ${cadenceLabel(cadence)} cadence`
              : "Awaiting latest insight"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {CADENCE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`chip ${cadence === option.id ? "chip--active" : ""}`}
              aria-pressed={cadence === option.id}
              onClick={() => onCadenceChange(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      {isLoading && <SkeletonLines />}
      {!isLoading && insight && (
        <div style={{ marginTop: 16 }}>
          {insight.sections.slice(0, 4).map((section) => (
            <article key={section.heading} style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <strong>{section.heading}</strong>
                  {typeof section.confidence === "number" && (
                    <span className="chip" style={{ fontSize: "0.7rem" }}>
                      Confidence {(section.confidence * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
                {onRegenerateSection && (
                  <button
                    type="button"
                    className="pill-button pill-button--ghost"
                    onClick={() => onRegenerateSection(section.heading)}
                    disabled={regeneratingSection === section.heading}
                    style={{ fontSize: "0.75rem" }}
                  >
                    {regeneratingSection === section.heading ? "Refreshing…" : "Refresh section"}
                  </button>
                )}
              </div>
              <p className="muted" style={{ margin: "6px 0 0" }}>
                {section.items[0]?.summary ?? "Awaiting details"}
              </p>
            </article>
          ))}
        </div>
      )}
      {!isLoading && !insight && (
        <p className="muted">AI summary is not available right now.</p>
      )}
      <div className="disclaimer">Not investment advice. AI summaries may be imperfect.</div>
    </section>
  );
}

function cadenceLabel(value: InsightCadence) {
  switch (value) {
    case "hourly":
      return "Hourly";
    case "event":
      return "Event";
    default:
      return "Daily";
  }
}

function SkeletonLines() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          style={{
            height: 12,
            borderRadius: 6,
            background: "rgba(47,107,255,0.15)",
            width: `${80 - index * 10}%`,
          }}
        />
      ))}
    </div>
  );
}
