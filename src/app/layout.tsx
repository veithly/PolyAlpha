import type { Metadata } from 'next';
import { Providers } from './providers';

import '@rainbow-me/rainbowkit/styles.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'PolyAlpha — Polymarket AI Copilot',
  description:
    'Wallet-connected intelligence layer for Polymarket users built with RainbowKit, wagmi, and Next.js.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
