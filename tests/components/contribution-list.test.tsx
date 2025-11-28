import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ContributionList } from "@/components/ContributionList";

function renderWithQuery(ui: ReactNode) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  );
}

describe("ContributionList", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders community contributions and disables upvote without wallet", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          items: [
            {
              id: "1",
              walletAddress: "0x1234567890abcdef",
              marketId: "m",
              content: "Community alpha",
              upvotes: 3,
              status: "approved",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        },
      }),
    } as Response);

    renderWithQuery(<ContributionList marketId="m" />);

    expect(await screen.findByText("Community alpha")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: /upvote take/i });
    expect(button).toBeDisabled();
    expect(
      screen.getByText(/Connect your Base wallet/i)
    ).toBeInTheDocument();
  });

  it("switches to my takes view and shows pending badge", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { items: [] } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            items: [
              {
                id: "2",
                walletAddress: "0xabc",
                marketId: "m",
                content: "Waiting for review",
                upvotes: 0,
                status: "pending",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
          },
        }),
      } as Response);

    renderWithQuery(
      <ContributionList marketId="m" walletAddress="0xABC" />
    );

    const myTakesButton = await screen.findByRole("button", {
      name: "My takes",
    });
    fireEvent.click(myTakesButton);

    await waitFor(() =>
      expect(screen.getByText(/Waiting for review/)).toBeInTheDocument()
    );
    expect(screen.getByText(/Pending review/i)).toBeInTheDocument();
  });
});
