"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { TimeSeriesPoint } from "@/domain/types";

type Props = {
  data: TimeSeriesPoint[];
};

export function PriceTrendChart({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <div style={{ height: 260, display: "grid", placeItems: "center" }}>
        <p className="muted" style={{ margin: 0 }}>
          No price history yet.
        </p>
      </div>
    );
  }

  return (
    <div style={{ height: 260 }}>
      <ResponsiveContainer>
        <LineChart data={data}>
          <XAxis
            dataKey="timestamp"
            tickFormatter={(value) =>
              new Date(value).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            }
            stroke="var(--color-border-soft)"
          />
          <YAxis hide domain={[0, 1]} />
          <Tooltip
            labelFormatter={(value) => new Date(value).toLocaleString()}
            contentStyle={{ background: "#11151d", border: "none" }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--color-accent)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
