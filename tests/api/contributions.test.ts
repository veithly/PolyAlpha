import { describe, expect, it, vi, beforeEach, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';

import { GET, POST } from '@/app/api/contributions/route';
import { POST as moderatePost } from '@/app/api/contributions/[id]/moderation/route';
import {
  DELETE as upvoteDelete,
  POST as upvotePost,
} from '@/app/api/contributions/[id]/upvote/route';
import {
  createContribution,
  listContributionsByMarket,
  listContributionsByWallet,
  moderateContribution,
  removeContributionUpvote,
  upvoteContribution,
} from '@/domain/contributions/service';

vi.mock('@/domain/contributions/service', () => ({
  createContribution: vi.fn(),
  listContributionsByMarket: vi.fn(),
  listContributionsByWallet: vi.fn(),
  moderateContribution: vi.fn(),
  upvoteContribution: vi.fn(),
  removeContributionUpvote: vi.fn(),
}));

const mockedCreate = vi.mocked(createContribution);
const mockedListByMarket = vi.mocked(listContributionsByMarket);
const mockedListByWallet = vi.mocked(listContributionsByWallet);
const mockedModerate = vi.mocked(moderateContribution);
const mockedUpvote = vi.mocked(upvoteContribution);
const mockedRemoveVote = vi.mocked(removeContributionUpvote);

beforeAll(() => {
  process.env.CONTRIBUTION_ADMIN_TOKEN = 'test-admin-token';
});

describe('/api/contributions', () => {
  beforeEach(() => {
    mockedCreate.mockReset();
    mockedListByMarket.mockReset();
    mockedListByWallet.mockReset();
    mockedModerate.mockReset();
    mockedUpvote.mockReset();
    mockedRemoveVote.mockReset();
  });

  it('requires query params on GET', async () => {
    const response = await GET(new NextRequest('http://localhost/api'));
    expect(response.status).toBe(400);
  });

  it('lists by market id', async () => {
    mockedListByMarket.mockResolvedValue({
      items: [
        {
          id: '1',
          walletAddress: '0x1',
          marketId: 'm',
          content: 'Test',
          upvotes: 0,
          status: 'approved',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });
    const response = await GET(
      new NextRequest('http://localhost/api?marketId=m')
    );
    const body = await response.json();
    expect(body.data.items).toHaveLength(1);
  });

  it('passes viewer wallet to list call', async () => {
    mockedListByMarket.mockResolvedValue({ items: [] });
    await GET(
      new NextRequest(
        'http://localhost/api?marketId=m&viewerWallet=0xabc123'
      )
    );
    expect(mockedListByMarket).toHaveBeenCalledWith('m', expect.objectContaining({
      viewerWallet: '0xabc123',
    }));
  });

  it('creates contribution', async () => {
    mockedCreate.mockResolvedValue({
      id: '1',
      walletAddress: '0x1',
      marketId: 'm',
      content: 'Test',
      upvotes: 0,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const response = await POST(
      new NextRequest('http://localhost/api', {
        method: 'POST',
        body: JSON.stringify({
          walletAddress: '0x1',
          marketId: 'm',
          content: 'Hello',
        }),
        headers: { 'content-type': 'application/json' },
      })
    );

    expect(response.status).toBe(201);
    expect(mockedCreate).toHaveBeenCalled();
  });

  it('validates contribution payload', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' },
      })
    );
    expect(response.status).toBe(400);
  });

  it('rejects moderation without admin token', async () => {
    const response = await moderatePost(
      new NextRequest('http://localhost/api/contributions/1/moderation', {
        method: 'POST',
        body: JSON.stringify({ status: 'approved' }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: { id: '1' } }
    );
    expect(response.status).toBe(401);
    expect(mockedModerate).not.toHaveBeenCalled();
  });

  it('moderates contribution when admin token provided', async () => {
    mockedModerate.mockResolvedValue({
      id: '1',
      walletAddress: '0x1',
      marketId: 'm',
      content: 'Test',
      upvotes: 0,
      status: 'approved',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const response = await moderatePost(
      new NextRequest('http://localhost/api/contributions/1/moderation', {
        method: 'POST',
        body: JSON.stringify({ status: 'approved' }),
        headers: {
          'content-type': 'application/json',
          'x-admin-token': 'test-admin-token',
        },
      }),
      { params: { id: '1' } }
    );
    expect(response.status).toBe(200);
    expect(mockedModerate).toHaveBeenCalledWith(
      '1',
      'approved',
      expect.any(Object)
    );
  });

  it('requires wallet on upvote', async () => {
    const response = await upvotePost(
      new NextRequest('http://localhost/api/contributions/1/upvote', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      }),
      { params: { id: '1' } }
    );
    expect(response.status).toBe(400);
  });

  it('upvotes and removes vote', async () => {
    mockedUpvote.mockResolvedValue({
      id: '1',
      walletAddress: '0x1',
      marketId: 'm',
      content: 'Test',
      upvotes: 1,
      status: 'approved',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mockedRemoveVote.mockResolvedValue({
      id: '1',
      walletAddress: '0x1',
      marketId: 'm',
      content: 'Test',
      upvotes: 0,
      status: 'approved',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const upvoteResponse = await upvotePost(
      new NextRequest('http://localhost/api/contributions/1/upvote', {
        method: 'POST',
        body: JSON.stringify({ walletAddress: '0xabc' }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: { id: '1' } }
    );
    expect(upvoteResponse.status).toBe(200);
    expect(mockedUpvote).toHaveBeenCalledWith('1', '0xabc');

    const removeResponse = await upvoteDelete(
      new NextRequest('http://localhost/api/contributions/1/upvote', {
        method: 'DELETE',
        body: JSON.stringify({ walletAddress: '0xabc' }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: { id: '1' } }
    );
    expect(removeResponse.status).toBe(200);
    expect(mockedRemoveVote).toHaveBeenCalledWith('1', '0xabc');
  });
});
