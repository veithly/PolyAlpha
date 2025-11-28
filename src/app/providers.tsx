'use client';

import { ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, lightTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';

import { config } from '../wagmi';
import { AiDrawerProvider } from '@/components/ai-drawer-context';
import { GlobalAiDrawer } from '@/components/GlobalAiDrawer';

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(() => new QueryClient());

  const walletTheme = lightTheme({
    accentColor: '#4C8DFF',
    accentColorForeground: '#0F1B3A',
    borderRadius: 'large',
    overlayBlur: 'small',
    fontStack: 'system',
  });

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={walletTheme}>
          <AiDrawerProvider>
            {children}
            <GlobalAiDrawer />
          </AiDrawerProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
