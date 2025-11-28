import { describe, expect, it } from 'vitest';

import { computeSmartPulse } from '@/lib/polymarket-ws';

describe('computeSmartPulse', () => {
  it('combines trades and orderbook depth', () => {
    const pulse = computeSmartPulse(
      [
        { amount: 1000, price: 0.4 },
        { amount: 2000, price: 0.6 },
      ],
      {
        bids: [
          { price: 0.45, size: 2000 },
          { price: 0.44, size: 1500 },
        ],
        asks: [
          { price: 0.55, size: 1000 },
          { price: 0.60, size: 1200 },
        ],
      }
    );

    expect(pulse.inflowUsd).toBeGreaterThan(0);
    expect(pulse.bookDepthUsd).toBeGreaterThan(0);
    expect(typeof pulse.whaleScore).toBe('number');
  });
});
