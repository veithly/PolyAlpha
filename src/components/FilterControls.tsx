import React from "react";

type Props = {
  liquidityMin?: number;
  liquidityMax?: number;
  volumeMin?: number;
  volumeMax?: number;
  changeMin?: number;
  changeMax?: number;
  onLiquidityChange: (value?: number) => void;
  onLiquidityMaxChange: (value?: number) => void;
  onVolumeChange: (value?: number) => void;
  onVolumeMaxChange: (value?: number) => void;
  onChangeMin: (value?: number) => void;
  onChangeMax: (value?: number) => void;
};

export function FilterControls({
  liquidityMin,
  liquidityMax,
  volumeMin,
  volumeMax,
  changeMin,
  changeMax,
  onLiquidityChange,
  onLiquidityMaxChange,
  onVolumeChange,
  onVolumeMaxChange,
  onChangeMin,
  onChangeMax,
}: Props) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: 12,
        marginTop: 8,
      }}
    >
      <DualRangeCard
        title="Liquidity range ($)"
        min={0}
        max={300000}
        step={5000}
        valueMin={liquidityMin ?? 0}
        valueMax={liquidityMax ?? 300000}
        formatter={(v) => `$${v.toLocaleString()}`}
        onChangeMin={(v) => onLiquidityChange(v === 0 ? undefined : v)}
        onChangeMax={(v) => onLiquidityMaxChange(v === 300000 ? undefined : v)}
      />
      <DualRangeCard
        title="24h volume range ($)"
        min={0}
        max={500000}
        step={10000}
        valueMin={volumeMin ?? 0}
        valueMax={volumeMax ?? 500000}
        formatter={(v) => `$${v.toLocaleString()}`}
        onChangeMin={(v) => onVolumeChange(v === 0 ? undefined : v)}
        onChangeMax={(v) => onVolumeMaxChange(v === 500000 ? undefined : v)}
      />
      <RangeCard
        title="24h change min (%)"
        value={(changeMin ?? 0) * 100}
        min={-50}
        max={50}
        step={1}
        formatter={(v) => `${v.toFixed(0)}%`}
        onChange={(v) => onChangeMin(v / 100)}
      />
      <RangeCard
        title="24h change max (%)"
        value={(changeMax ?? 0) * 100}
        min={-50}
        max={50}
        step={1}
        formatter={(v) => `${v.toFixed(0)}%`}
        onChange={(v) => onChangeMax(v / 100)}
      />
    </div>
  );
}

function DualRangeCard({
  title,
  valueMin,
  valueMax,
  min,
  max,
  step,
  formatter,
  onChangeMin,
  onChangeMax,
}: {
  title: string;
  valueMin: number;
  valueMax: number;
  min: number;
  max: number;
  step: number;
  formatter: (v: number) => string;
  onChangeMin: (v: number) => void;
  onChangeMax: (v: number) => void;
}) {
  const safeMin = Math.min(valueMin, valueMax - step);
  const safeMax = Math.max(valueMax, valueMin + step);
  return (
    <div className="card-soft">
      <strong style={{ display: "block", marginBottom: 6 }}>{title}</strong>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}
        >
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={safeMin}
            onChange={(e) => {
              const next = Number(e.target.value);
              onChangeMin(Math.min(next, safeMax - step));
            }}
          />
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={safeMax}
            onChange={(e) => {
              const next = Number(e.target.value);
              onChangeMax(Math.max(next, safeMin + step));
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "0.85rem",
            color: "var(--color-text-muted)",
          }}
        >
          <span>Min: {formatter(safeMin)}</span>
          <span>Max: {formatter(safeMax)}</span>
        </div>
      </div>
    </div>
  );
}

function RangeCard({
  title,
  value,
  min,
  max,
  step,
  formatter,
  onChange,
}: {
  title: string;
  value: number;
  min: number;
  max: number;
  step: number;
  formatter: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="card-soft">
      <strong style={{ display: "block", marginBottom: 6 }}>{title}</strong>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: 1 }}
        />
        <span className="muted" style={{ minWidth: 80, textAlign: "right" }}>
          {formatter(value)}
        </span>
      </div>
    </div>
  );
}
