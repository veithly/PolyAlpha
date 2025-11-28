import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { coinbaseWallet, injected } from 'wagmi/connectors';
import { createConfig, http } from 'wagmi';
import {
  arbitrum,
  base,
  baseSepolia,
  mainnet,
  optimism,
  polygon,
  sepolia,
} from 'wagmi/chains';

const projectId = (
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? 'demo-walletconnect-id'
).trim();

const chains = [
  base,
  ...(process.env.NEXT_PUBLIC_ENABLE_TESTNETS === 'true'
    ? [baseSepolia]
    : []),
] as const;

const hasValidWalletConnectId =
  Boolean(projectId) &&
  projectId !== 'demo-walletconnect-id' &&
  !projectId.includes('your-walletconnect');

// Preferred path: full RainbowKit config with WalletConnect Cloud ID.
// Fallback: injected + Coinbase only so users can still connect if projectId is missing/invalid.
export const config = hasValidWalletConnectId
  ? getDefaultConfig({
      appName: 'PolyAlpha',
      projectId,
      chains,
      ssr: true,
    })
  : createConfig({
      chains,
      connectors: [
        injected({ shimDisconnect: true }),
        coinbaseWallet({ appName: 'PolyAlpha' }),
      ],
      transports: chains.reduce(
        (acc, chain) => ({
          ...acc,
          [chain.id]: http(
            chain.id === base.id
              ? process.env.BASE_RPC_URL ?? 'https://mainnet.base.org'
              : undefined
          ),
        }),
        {} as Record<number, ReturnType<typeof http>>
      ),
      ssr: true,
    });

if (!hasValidWalletConnectId) {
  console.warn(
    '[wallet] NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is missing or placeholder; using injected-only fallback (MetaMask/Coinbase).'
  );
}
