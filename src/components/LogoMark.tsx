"use client";

type LogoMarkProps = {
  size?: number;
};

/**
 * Blue/white logomark:
 * - White canvas with electric-blue frame
 * - Candlestick + sheet + spark motif (markets + insights + AI)
 * - Square, pixel-friendly geometry for the pixel UI theme.
 */
export function LogoMark({ size = 40 }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="PolyAlpha logo"
    >
      <defs>
        <linearGradient id="logoGrad" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#2f6bff" />
          <stop offset="100%" stopColor="#5f94ff" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="8" fill="#f7fbff" stroke="url(#logoGrad)" strokeWidth="3" />
      <rect x="7" y="7" width="50" height="50" rx="6" fill="#ffffff" stroke="#b5cdfc" strokeWidth="2" />

      {/* sheet backdrop */}
      <rect x="14" y="14" width="36" height="36" rx="5" fill="#f7fbff" stroke="#7aa4f6" strokeWidth="2" />
      <rect x="18" y="18" width="28" height="22" rx="3" fill="#ffffff" stroke="#2f6bff" strokeWidth="2" />

      {/* candlesticks */}
      <rect x="20" y="24" width="6" height="14" rx="1" fill="#2f6bff" />
      <rect x="29" y="20" width="6" height="18" rx="1" fill="#ffffff" stroke="#2f6bff" strokeWidth="1.2" />
      <rect x="38" y="28" width="6" height="10" rx="1" fill="#2f6bff" />
      <rect x="32" y="18" width="2" height="24" fill="#5f94ff" opacity="0.9" />

      {/* AI spark */}
      <polygon points="44,16 46,18 49,18 47,20 48,23 45,21 42,23 43,20 41,18 44,18" fill="#2f6bff" stroke="#5f94ff" strokeWidth="1" />

      {/* folded corner hint */}
      <path d="M44 18 L52 26 L52 18 Z" fill="url(#logoGrad)" opacity="0.75" />
    </svg>
  );
}
