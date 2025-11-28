"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { FormEvent, useMemo, useState } from "react";

type Contribution = {
  id: string;
  walletAddress: string;
  marketId: string;
  content: string;
  attachmentUrl?: string | null;
  parentId?: string | null;
  upvotes: number;
  status: "pending" | "approved" | "hidden" | "flagged" | "rejected" | "needs_review";
  createdAt: string;
  updatedAt: string;
  viewerHasUpvoted?: boolean;
  reputation?: string;
  replyCount?: number;
};

type Props = {
  marketId: string;
  walletAddress?: string;
};

type ViewMode = "community" | "mine";

export function ContributionList({ marketId, walletAddress }: Props) {
  const [content, setContent] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("community");
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const queryKey = useMemo(
    () => ["contributions", marketId, viewMode, walletAddress ?? "anon"],
    [marketId, viewMode, walletAddress]
  );

  const contributionsQuery = useQuery({
    queryKey,
    enabled: viewMode === "community" || Boolean(walletAddress),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (viewMode === "community") {
        params.set("marketId", marketId);
      } else if (walletAddress) {
        params.set("walletAddress", walletAddress);
      }
      if (walletAddress) {
        params.set("viewerWallet", walletAddress);
      }

      const response = await fetch(`/api/contributions?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to load contributions");
      const body = (await response.json()) as {
        data: { items: Contribution[] };
      };
      return body.data.items;
    },
  });

  const upvoteMutation = useMutation({
    mutationFn: async ({
      contributionId,
      currentlyUpvoted,
    }: {
      contributionId: string;
      currentlyUpvoted: boolean;
    }) => {
      if (!walletAddress) return;
      const response = await fetch(
        `/api/contributions/${contributionId}/upvote`,
        {
          method: currentlyUpvoted ? "DELETE" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress }),
        }
      );
      if (!response.ok) {
        throw new Error("Failed to update vote");
      }
      return response.json();
    },
    onSuccess: () => {
      contributionsQuery.refetch();
    },
  });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!content.trim()) return;
    if (!walletAddress) return;
    if (attachmentUrl && !isValidAttachment(attachmentUrl)) {
      setAttachmentUrl("");
      return;
    }
    try {
      const response = await fetch("/api/contributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId,
          walletAddress,
          content,
          attachmentUrl: attachmentUrl || null,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to submit");
      }
      setContent("");
      setAttachmentUrl("");
      contributionsQuery.refetch();
      setViewMode("community");
    } catch (error) {
      console.error(error);
    }
  }

  const communityView = viewMode === "community";

  const items = useMemo(() => {
    const dataset = contributionsQuery.data ?? [];
    const scoreByWallet = dataset.reduce<Record<string, number>>(
      (acc, item) => {
        acc[item.walletAddress] =
          (acc[item.walletAddress] ?? 0) + (item.upvotes ?? 0);
        return acc;
      },
      {}
    );
    const addBadge = (wallet: string) => buildReputationBadge(scoreByWallet[wallet] ?? 0);

    if (communityView) {
      return [...dataset].sort((a, b) => {
        if (b.upvotes === a.upvotes) {
          return (
            new Date(b.createdAt).getTime() -
            new Date(a.createdAt).getTime()
          );
        }
        return b.upvotes - a.upvotes;
      }).map((item) => ({ ...item, reputation: addBadge(item.walletAddress) }));
    }
    return dataset.map((item) => ({ ...item, reputation: addBadge(item.walletAddress) }));
  }, [communityView, contributionsQuery.data]);
  return (
    <section className="card" style={{ marginTop: 24 }}>
      <div className="section-heading" style={{ flexWrap: "wrap", gap: 12 }}>
        <div>
          <h3 style={{ margin: 0 }}>Community contributions</h3>
          <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
            Ranked by upvotes to surface the strongest theses.
          </p>
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            background: "var(--color-surface-alt)",
            padding: 4,
            borderRadius: 10,
            border: "2px solid var(--color-border-strong)",
            boxShadow: "0 3px 0 var(--shadow-lite)",
          }}
        >
          <button
            type="button"
            onClick={() => setViewMode("community")}
            className="pill-button"
            style={{
              padding: "6px 16px",
              background: communityView
                ? "var(--color-accent)"
                : "var(--color-surface)",
              color: communityView ? "#f7fbff" : "var(--color-text-primary)",
              borderColor: "var(--color-border-strong)",
              boxShadow: "0 3px 0 var(--shadow-lite)",
            }}
          >
            Top takes
          </button>
          <button
            type="button"
            onClick={() => walletAddress && setViewMode("mine")}
            className="pill-button"
            disabled={!walletAddress}
            style={{
              padding: "6px 16px",
              background:
                !communityView && walletAddress
                  ? "var(--color-accent)"
                  : "var(--color-surface)",
              color:
                !communityView && walletAddress
                  ? "#f7fbff"
                  : "var(--color-text-primary)",
              borderColor: "var(--color-border-strong)",
              boxShadow: "0 3px 0 var(--shadow-lite)",
              opacity: walletAddress ? 1 : 0.65,
            }}
          >
            My takes
          </button>
        </div>
      </div>

      {items.length === 0 && (
        <p className="muted" style={{ marginTop: 12 }}>
          {communityView
            ? "No submissions yet. Be the first to share a thesis."
            : "You have not posted any takes yet."}
        </p>
      )}

      {items.map((item) => (
        <article
          key={item.id}
          style={{
            marginTop: 16,
            paddingBottom: 12,
            borderBottom: "1px solid var(--color-border-soft)",
          }}
        >
          <p style={{ marginBottom: 12, whiteSpace: "pre-line" }}>
            {item.content}
          </p>
          {item.attachmentUrl && (
            <a
              href={item.attachmentUrl}
              target="_blank"
              rel="noreferrer"
              className="muted"
              style={{
                display: "inline-flex",
                gap: 6,
                alignItems: "center",
                fontSize: "0.85rem",
              }}
            >
              📎 Attachment
            </a>
          )}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div className="muted" style={{ fontSize: "0.85rem", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {shortAddress(item.walletAddress)} ·{" "}
              {new Date(item.createdAt).toLocaleString()}
              {item.status !== "approved" && (
                <StatusBadge status={item.status} />
              )}
              {item.reputation && (
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: 10,
                    background: "linear-gradient(180deg, rgba(47,107,255,0.14), rgba(47,107,255,0.08))",
                    border: "2px solid var(--color-border-strong)",
                    color: "var(--color-text-primary)",
                    fontSize: "0.75rem",
                    boxShadow: "0 3px 0 var(--shadow-lite)",
                  }}
                >
                  {item.reputation}
                </span>
              )}
              {item.replyCount ? (
                <span style={{ fontSize: "0.8rem" }}>
                  {item.replyCount} repl{item.replyCount === 1 ? "y" : "ies"}
                </span>
              ) : null}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                disabled={!walletAddress || upvoteMutation.isPending}
                onClick={() =>
                  upvoteMutation.mutate({
                    contributionId: item.id,
                    currentlyUpvoted: Boolean(item.viewerHasUpvoted),
                  })
                }
                className="pill-button"
                aria-pressed={Boolean(item.viewerHasUpvoted)}
                aria-label={
                  item.viewerHasUpvoted
                    ? `Remove upvote (${item.upvotes})`
                    : `Upvote take (${item.upvotes})`
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 12px",
                  borderRadius: 10,
                  border: item.viewerHasUpvoted
                    ? "2px solid var(--color-accent)"
                    : "2px solid var(--color-border-strong)",
                  background: item.viewerHasUpvoted
                    ? "linear-gradient(180deg, rgba(47,107,255,0.18), rgba(47,107,255,0.10))"
                    : "var(--color-surface)",
                  color: "var(--color-text-primary)",
                  boxShadow: "0 3px 0 var(--shadow-lite)",
                  cursor: walletAddress ? "pointer" : "not-allowed",
                }}
              >
                <span aria-hidden>▲</span>
                <strong>{item.upvotes}</strong>
              </button>
              <button
                type="button"
                className="pill-button pill-button--ghost"
                disabled={!walletAddress}
                onClick={() =>
                  setActiveReplyId((current) =>
                    current === item.id ? null : item.id
                  )
                }
              >
                Reply
              </button>
            </div>
          </div>
          {activeReplyId === item.id && walletAddress && (
            <ReplyThread
              contributionId={item.id}
              marketId={marketId}
              walletAddress={walletAddress}
              onClose={() => setActiveReplyId(null)}
            />
          )}
        </article>
      ))}

      <form
        onSubmit={handleSubmit}
        style={{
          marginTop: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={3}
          placeholder={
            walletAddress ? "Share your idea..." : "Connect wallet to contribute"
          }
          disabled={!walletAddress}
          style={{
            borderRadius: 12,
            border: "1px solid var(--color-border-soft)",
            background: "var(--color-surface-alt)",
            color: "var(--color-text-primary)",
            padding: 12,
            resize: "vertical",
          }}
        />
        <input
          type="url"
          value={attachmentUrl}
          onChange={(event) => setAttachmentUrl(event.target.value)}
          placeholder="Attachment URL (optional)"
          disabled={!walletAddress}
          style={{
            borderRadius: 12,
            border: "1px solid var(--color-border-soft)",
            background: "var(--color-surface-alt)",
            color: "var(--color-text-primary)",
            padding: 12,
          }}
        />
        <button
          type="submit"
          className="pill-button pill-button--primary"
          disabled={!walletAddress || !content.trim()}
        >
          Submit analysis
        </button>
        {!walletAddress && (
          <p className="muted" style={{ fontSize: "0.8rem", margin: 0 }}>
            Connect your Base wallet to post or upvote community takes.
          </p>
        )}
      </form>
    </section>
  );
}

function shortAddress(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function isValidUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidAttachment(value: string) {
  if (!isValidUrl(value)) return false;
  const lowered = value.toLowerCase();
  return (
    lowered.endsWith(".png") ||
    lowered.endsWith(".jpg") ||
    lowered.endsWith(".jpeg") ||
    lowered.endsWith(".gif") ||
    lowered.endsWith(".webp") ||
    lowered.endsWith(".pdf") ||
    lowered.endsWith(".mp4")
  );
}

function buildReputationBadge(score: number) {
  if (score >= 10) return "Pro contributor";
  if (score >= 4) return "Informed";
  if (score >= 1) return "New voice";
  return undefined;
}

function statusCopy(status: Contribution["status"]) {
  switch (status) {
    case "pending":
      return "Pending review";
    case "hidden":
      return "Hidden";
    case "flagged":
      return "Flagged";
    case "rejected":
      return "Rejected";
    case "needs_review":
      return "Needs review";
    default:
      return "Approved";
  }
}

function StatusBadge({ status }: { status: Contribution["status"] }) {
  if (status === "approved") return null;
  const palette =
    status === "pending"
      ? "var(--color-border-strong)"
      : status === "rejected"
      ? "#a94442"
      : "var(--color-accent)";
  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: 10,
        border: `2px solid ${palette}`,
        background: "var(--color-surface)",
        fontSize: "0.7rem",
        textTransform: "capitalize",
      }}
    >
      {statusCopy(status)}
    </span>
  );
}

function ReplyThread({
  contributionId,
  walletAddress,
  marketId,
  onClose,
}: {
  contributionId: string;
  walletAddress: string;
  marketId: string;
  onClose: () => void;
}) {
  const [reply, setReply] = useState("");
  const [attachment, setAttachment] = useState("");
  const repliesQuery = useQuery({
    queryKey: ["contribution-replies", contributionId, walletAddress],
    queryFn: async () => {
      const params = new URLSearchParams({
        viewerWallet: walletAddress,
      });
      const res = await fetch(
        `/api/contributions/${contributionId}/replies?${params.toString()}`
      );
      if (!res.ok) throw new Error("Failed to load replies");
      const body = (await res.json()) as {
        data: { items: Contribution[] };
      };
      return body.data.items;
    },
  });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!reply.trim()) return;
    if (attachment && !isValidAttachment(attachment)) {
      setAttachment("");
      return;
    }
    const res = await fetch("/api/contributions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletAddress,
        marketId,
        content: reply,
        parentId: contributionId,
        attachmentUrl: attachment || null,
      }),
    });
    if (!res.ok) {
      console.error("Failed to reply");
      return;
    }
    setReply("");
    setAttachment("");
    repliesQuery.refetch();
  };

  return (
  <div
    style={{
      marginTop: 12,
      padding: 12,
      borderRadius: 10,
      background: "var(--color-surface-alt)",
      border: "2px solid var(--color-border-strong)",
      boxShadow: "0 4px 0 var(--shadow-lite)",
      display: "flex",
      flexDirection: "column",
      gap: 8,
    }}
  >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>Replies</strong>
        <button
          type="button"
          className="pill-button pill-button--ghost"
          onClick={onClose}
        >
          Close
        </button>
      </div>
      {repliesQuery.isLoading && (
        <p className="muted">Loading replies…</p>
      )}
      {repliesQuery.data?.length === 0 && (
        <p className="muted" style={{ margin: 0 }}>
          No replies yet.
        </p>
      )}
      {repliesQuery.data?.map((replyItem) => (
        <div
          key={replyItem.id}
          style={{
            padding: 8,
            borderRadius: 8,
            border: "2px solid var(--color-border)",
            background: "var(--color-surface)",
            boxShadow: "0 3px 0 var(--shadow-lite)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.85rem",
              color: "var(--color-text-muted)",
            }}
          >
            <span>{shortAddress(replyItem.walletAddress)}</span>
            <span>{new Date(replyItem.createdAt).toLocaleString()}</span>
          </div>
          <p style={{ margin: "6px 0", whiteSpace: "pre-line" }}>
            {replyItem.content}
          </p>
          {replyItem.attachmentUrl && (
            <a
              href={replyItem.attachmentUrl}
              target="_blank"
              rel="noreferrer"
              className="muted"
              style={{ fontSize: "0.8rem" }}
            >
              📎 Attachment
            </a>
          )}
        </div>
      ))}
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          rows={2}
          placeholder="Add a reply"
          style={{
            borderRadius: 8,
            border: "2px solid var(--color-border-strong)",
            background: "var(--color-surface)",
            color: "var(--color-text-primary)",
            padding: 10,
          }}
        />
        <input
          type="url"
          value={attachment}
          onChange={(e) => setAttachment(e.target.value)}
          placeholder="Attachment URL (optional)"
          style={{
            borderRadius: 8,
            border: "1px solid var(--color-border-soft)",
            background: "var(--color-surface)",
            color: "var(--color-text-primary)",
            padding: 10,
          }}
        />
        <button
          type="submit"
          className="pill-button pill-button--primary"
          disabled={!reply.trim()}
        >
          Reply
        </button>
      </form>
    </div>
  );
}
