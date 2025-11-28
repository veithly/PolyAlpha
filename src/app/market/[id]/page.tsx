export const runtime = 'nodejs';

import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";

import { MarketDetailScreen } from "./MarketDetailScreen";

const APP_BASE_URL =
  process.env.APP_BASE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://127.0.0.1:3000");

export default async function MarketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const queryClient = new QueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ["market-detail", id],
      queryFn: () => fetchApi(`/api/markets/${id}`),
    }),
    queryClient.prefetchQuery({
      queryKey: ["market-summary", id],
      queryFn: () => fetchApi(`/api/markets/${id}/summary`),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <MarketDetailScreen marketId={id} />
    </HydrationBoundary>
  );
}

async function fetchApi<T>(pathname: string): Promise<T> {
  const response = await fetch(new URL(pathname, APP_BASE_URL), {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to load ${pathname}: ${response.status}`);
  }
  const body = (await response.json()) as { data: T };
  return body.data;
}
