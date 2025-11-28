"use client";

export const runtime = 'nodejs';

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";

import { AppHeader } from "@/components/AppHeader";
import type {
  NotificationChannel,
  Topic,
  TopicWeight,
} from "@/domain/types";

const ALL_TOPICS: Topic[] = ["crypto", "politics", "sports", "meme", "macro"];
const CHANNEL_OPTIONS: NotificationChannel[] = ["email", "telegram", "farcaster"];

export default function SettingsPage() {
  const { address, isConnected } = useAccount();
  const queryClient = useQueryClient();
  const topicsQuery = useQuery({
    enabled: Boolean(address),
    queryKey: ["preferences", address],
    queryFn: async () => {
      const response = await fetch(`/api/user/preferences?walletAddress=${address}`);
      if (response.status === 404) {
        return { topics: ["crypto"] as Topic[], notifyDaily: false };
      }
      if (!response.ok) {
        throw new Error("Failed to load preferences");
      }
      const body = (await response.json()) as {
        data: {
          topics: Topic[];
          notifyDaily: boolean;
          channels?: NotificationChannel[];
          topicWeights?: TopicWeight[];
        };
      };
      return {
        topics: body.data.topics as Topic[],
        notifyDaily: body.data.notifyDaily as boolean,
        channels: (body.data.channels ?? []) as NotificationChannel[],
        topicWeights: (body.data.topicWeights ?? []) as TopicWeight[],
      };
    },
    placeholderData: {
      topics: ["crypto"] as Topic[],
      notifyDaily: false,
      channels: [] as NotificationChannel[],
      topicWeights: [] as TopicWeight[],
    },
  });

  const mutation = useMutation({
    mutationFn: async (payload: {
      topics: Topic[];
      notifyDaily: boolean;
      channels: NotificationChannel[];
      topicWeights: TopicWeight[];
    }) => {
      const response = await fetch("/api/user/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          topics: payload.topics,
          notifyDaily: payload.notifyDaily,
          channels: payload.channels,
          topicWeights: payload.topicWeights,
        }),
      });
      if (!response.ok) throw new Error("Failed to save preferences");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preferences", address] });
    },
  });

  if (!isConnected) {
    return (
      <div className="page-shell">
        <div className="container">
          <AppHeader />
          <div className="card">
            <p>Please connect your Base wallet to manage preferences.</p>
          </div>
        </div>
      </div>
    );
  }

  const currentTopics = topicsQuery.data?.topics ?? [];
  const notifyDaily = topicsQuery.data?.notifyDaily ?? false;
  const currentChannels = topicsQuery.data?.channels ?? [];
  const currentWeights = topicsQuery.data?.topicWeights ?? [];

  function buildWeightsFor(topics: Topic[]): TopicWeight[] {
    if (!topics.length) return [];
    const existingMap = new Map(
      currentWeights.map((entry) => [entry.topic, entry.weight])
    );
    const baseWeight = 1 / topics.length;
    return topics.map((topic) => ({
      topic,
      weight: existingMap.get(topic) ?? baseWeight,
    }));
  }

  function handleTopicChange(topic: Topic | "all") {
    if (topic === "all") {
      const topics = ["crypto", "politics", "sports", "meme", "macro"] as Topic[];
      mutation.mutate({
        topics,
        notifyDaily,
        channels: currentChannels,
        topicWeights: buildWeightsFor(topics),
      });
    } else {
      const nextTopics = currentTopics.includes(topic)
        ? currentTopics.filter((item) => item !== topic)
        : [...currentTopics, topic];
      mutation.mutate({
        topics: nextTopics,
        notifyDaily,
        channels: currentChannels,
        topicWeights: buildWeightsFor(nextTopics),
      });
    }
  }

  function handleToggleNotifications() {
    mutation.mutate({
      topics: currentTopics,
      notifyDaily: !notifyDaily,
      channels: currentChannels,
      topicWeights: currentWeights,
    });
  }

  function handleToggleChannel(channel: NotificationChannel) {
    const next = currentChannels.includes(channel)
      ? currentChannels.filter((value) => value !== channel)
      : [...currentChannels, channel];
    mutation.mutate({
      topics: currentTopics,
      notifyDaily,
      channels: next,
      topicWeights: currentWeights,
    });
  }

  return (
    <div className="page-shell">
      <div className="container">
        <AppHeader />
        <main
          className="grid"
          style={{
            gap: 24,
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          }}
        >
          <section className="card">
            <h2 style={{ marginTop: 0 }}>Topic preferences</h2>
            <p className="muted">
              Choose which Polymarket themes power your curated dashboard & notifications.
            </p>
            <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
              {ALL_TOPICS.map((topic) => {
                const isActive = currentTopics.includes(topic);
                return (
                  <button
                    key={topic}
                    type="button"
                    className={`chip ${isActive ? "chip--active" : ""}`}
                    onClick={() => handleTopicChange(topic)}
                  >
                    {topic}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="card">
            <h2 style={{ marginTop: 0 }}>Notifications</h2>
            <p className="muted">
              Receive the daily AI outlook covering your selected topics. Delivered inside the mini app; optional channels let you mirror alerts to email, Telegram, or Farcaster.
            </p>
            <button
              type="button"
              className="pill-button pill-button--primary"
              onClick={handleToggleNotifications}
            >
              {notifyDaily ? "Disable" : "Enable"} daily digest
            </button>
            <div style={{ marginTop: 16 }}>
              <p className="muted" style={{ marginBottom: 8 }}>
                Optional off-platform channels (for future use):
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {CHANNEL_OPTIONS.map((channel) => {
                  const active = currentChannels.includes(channel);
                  const label =
                    channel === "email"
                      ? "Email"
                      : channel === "telegram"
                      ? "Telegram"
                      : "Farcaster";
                  return (
                    <button
                      key={channel}
                      type="button"
                      className={`chip ${active ? "chip--active" : ""}`}
                      onClick={() => handleToggleChannel(channel)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
