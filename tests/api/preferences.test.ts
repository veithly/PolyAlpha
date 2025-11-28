import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

import { GET, POST } from '@/app/api/user/preferences/route';
import {
  getUserPreferences,
  upsertUserPreferences,
} from '@/domain/preferences/service';

vi.mock('@/domain/preferences/service', () => ({
  getUserPreferences: vi.fn(),
  upsertUserPreferences: vi.fn(),
}));

const mockedGetPrefs = vi.mocked(getUserPreferences);
const mockedUpsertPrefs = vi.mocked(upsertUserPreferences);

describe('/api/user/preferences', () => {
  beforeEach(() => {
    mockedGetPrefs.mockReset();
    mockedUpsertPrefs.mockReset();
  });

  it('requires walletAddress on GET', async () => {
    const response = await GET(new NextRequest('http://localhost/api'));
    expect(response.status).toBe(400);
  });

  it('returns preferences', async () => {
    mockedGetPrefs.mockResolvedValue({
      walletAddress: '0xabc',
      topics: ['crypto'],
      notifyDaily: true,
      channels: ['email'],
      topicWeights: [{ topic: 'crypto', weight: 0.7 }],
      askLimit: 7,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const response = await GET(
      new NextRequest('http://localhost/api?walletAddress=0xabc')
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.walletAddress).toBe('0xabc');
  });

  it('returns defaults when prefs missing', async () => {
    mockedGetPrefs.mockResolvedValue(null);

    const response = await GET(
      new NextRequest('http://localhost/api?walletAddress=0xdef')
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.topics).toEqual(['crypto']);
    expect(body.data.notifyDaily).toBe(false);
  });

  it('validates POST payload', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' },
      })
    );
    expect(response.status).toBe(400);
  });

  it('saves preferences', async () => {
    mockedUpsertPrefs.mockResolvedValue({
      walletAddress: '0xabc',
      topics: ['crypto'],
      notifyDaily: false,
      channels: ['telegram'],
      topicWeights: [{ topic: 'crypto', weight: 0.5 }],
      askLimit: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const response = await POST(
      new NextRequest('http://localhost/api', {
        method: 'POST',
        body: JSON.stringify({
          walletAddress: '0xabc',
          topics: ['crypto'],
          notifyDaily: false,
          channels: ['telegram'],
          topicWeights: [{ topic: 'crypto', weight: 0.5 }],
          askLimit: 3,
        }),
        headers: { 'content-type': 'application/json' },
      })
    );

    expect(response.status).toBe(200);
    expect(mockedUpsertPrefs).toHaveBeenCalled();
  });
});
