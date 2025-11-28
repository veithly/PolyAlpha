"use client";

import { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function baseProps(size?: number): Partial<IconProps> {
  return {
    width: size ?? 22,
    height: size ?? 22,
    strokeWidth: 2.2,
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    role: "img",
  };
}

export function HomeIcon({ size, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(size)} {...rest}>
      <path
        d="M4 11.5 12 5l8 6.5"
        fill="none"
      />
      <rect
        x="6"
        y="11"
        width="12"
        height="9"
        rx="2"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
      />
      <path d="M10 20v-5h4v5" />
    </svg>
  );
}

export function MarketsIcon({ size, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(size)} {...rest}>
      <rect x="4" y="11" width="4.5" height="8" rx="1.2" fill="currentColor" fillOpacity="0.14" />
      <rect x="9.5" y="7.5" width="4.5" height="11.5" rx="1.2" fill="currentColor" fillOpacity="0.18" />
      <rect x="15" y="5.5" width="4.5" height="13.5" rx="1.2" fill="currentColor" fillOpacity="0.22" />
      <path d="M4 11 9 7 12 8.5 16 5l4 3" />
    </svg>
  );
}

export function SettingsIcon({ size, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(size)} {...rest}>
      <rect x="9.25" y="4" width="5.5" height="3.5" rx="1" fill="currentColor" fillOpacity="0.16" />
      <rect x="4" y="10" width="16" height="7" rx="2" fill="currentColor" fillOpacity="0.12" />
      <path d="M8 5h8" />
      <path d="M6 13.5h12" />
      <circle cx="12" cy="13.5" r="2.6" />
    </svg>
  );
}

export function SparkIcon({ size, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(size)} {...rest}>
      <path
        d="M12 3.5 14.8 9.2 21 12l-6.2 2.8L12 20.5 9.2 14.8 3 12l6.2-2.8Z"
        fill="currentColor"
        fillOpacity="0.16"
      />
      <path d="M12 4.9 14.2 9.4 18.9 12 14.2 14.6 12 19.1 9.8 14.6 5.1 12l4.7-2.6Z" />
    </svg>
  );
}

export function FilterIcon({ size, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps(size)} {...rest}>
      <path d="M4 6h16" />
      <path d="M7 12h10" />
      <path d="M10 18h4" />
      <circle cx="9" cy="6" r="2" fill="currentColor" />
      <circle cx="15" cy="12" r="2" fill="currentColor" />
      <circle cx="12" cy="18" r="2" fill="currentColor" />
    </svg>
  );
}
