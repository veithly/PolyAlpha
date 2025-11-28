"use client";

import { FormEvent, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type GuardrailMeta = { redacted?: boolean; redactions?: string[] };

type Props = {
  marketId: string;
  walletAddress?: string;
  contextNote?: string;
  page?: string;
  marketTitle?: string;
  marketCategory?: string;
  topics?: string[];
  suggestions?: string[]; // optional seed suggestions
};

export function AskAiPanel({
  marketId,
  walletAddress,
  contextNote,
  page = "dashboard",
  marketTitle,
  marketCategory,
  topics = [],
  suggestions = [],
}: Props) {
  const USE_STREAM = false;
  const [question, setQuestion] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">(
    "idle"
  );
  const [answer, setAnswer] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [remainingQuota, setRemainingQuota] = useState<number | null>(null);
  const [quotaLimit, setQuotaLimit] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [guardrailMeta, setGuardrailMeta] = useState<GuardrailMeta | null>(null);
  const queryClient = useQueryClient();
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [suggestionsState, setSuggestionsState] = useState<string[]>(suggestions.slice(0, 3));
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const logsQuery = useQuery({
    enabled: Boolean(walletAddress),
    queryKey: ["askLogs", walletAddress, marketId],
    queryFn: async () => {
      const response = await fetch(
        `/api/ask/logs?walletAddress=${walletAddress}&marketId=${marketId}`
      );
      if (!response.ok) {
        throw new Error("Failed to load conversation history");
      }
      const body = (await response.json()) as {
        data: { items: { id: string; question: string; answer: string; createdAt: string }[] };
      };
      return body.data;
    },
    staleTime: 30_000,
  });

  const conversation = logsQuery.data?.items ?? [];
  const visibleConversation = conversation.slice(-5);

  useEffect(() => {
    void refreshSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, marketId, walletAddress]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await sendQuestion(question);
  }

  async function sendQuestion(message: string) {
    if (!message.trim() || !walletAddress) return;
    if (streaming || status === "loading") return;
    setStatus("loading");
    setAnswer(null);
    setErrorMessage(null);
    setGuardrailMeta(null);
    setQuestion(message);
    if (USE_STREAM) {
      await runStreamingRequest(message);
    } else {
      await runStandardRequest(message);
    }
  }

  async function runStandardRequest(message: string) {
    setStreaming(false);
    setAbortController(null);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 22000);
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId,
          walletAddress,
          question: message,
          contextNote,
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));
      const body = (await response.json()) as {
        data: {
          answer: string;
          guardrail?: GuardrailMeta | null;
          limit?: number | null;
          remainingQuota?: number | null;
        };
        error?: { message?: string; details?: { limit?: number; remainingQuota?: number } };
      };
      if (!response.ok) {
        setStatus("error");
        if (response.status === 429) {
          setErrorMessage(body?.error?.message ?? "Daily limit reached.");
          setQuotaLimit(body?.error?.details?.limit ?? null);
          setRemainingQuota(body?.error?.details?.remainingQuota ?? 0);
          return;
        }
        throw new Error(body?.error?.message ?? "Failed");
      }
      setAnswer(body.data.answer as string);
      setGuardrailMeta(body.data.guardrail ?? null);
      setQuotaLimit(body.data.limit ?? quotaLimit);
      setRemainingQuota(body.data.remainingQuota ?? remainingQuota);
      setStatus("idle");
      setQuestion("");
      invalidateLogs();
      void refreshSuggestions();
    } catch (error) {
      console.error(error);
      setStatus("error");
      if (!errorMessage) {
        setErrorMessage("Unable to get an answer right now.");
      }
      setStreaming(false);
      setAbortController(null);
    }
  }

  async function runStreamingRequest(message: string) {
      const controller = new AbortController();
      setAbortController(controller);
      setStreaming(true);
      setAnswer("");
      setGuardrailMeta(null);
    const fallbackTimer = setTimeout(() => {
      controller.abort();
      setStreaming(false);
      setAbortController(null);
      runStandardRequest(message);
    }, 100000);
    try {
      const response = await fetch("/api/ask/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId,
          walletAddress,
          question: message,
          contextNote,
        }),
        signal: controller.signal,
      });
      clearTimeout(fallbackTimer);
      if (!response.ok || !response.body) {
        if (response.status === 429) {
          const body = (await response.json()) as {
            error?: { message?: string; details?: { limit?: number; remainingQuota?: number } };
          };
          setStatus("error");
          setErrorMessage(body?.error?.message ?? "Daily limit reached.");
          setQuotaLimit(body?.error?.details?.limit ?? null);
          setRemainingQuota(body?.error?.details?.remainingQuota ?? 0);
          return;
        }
        // fallback to normal call
        setStreaming(false);
        setAbortController(null);
        return runStandardRequest(message);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        setAnswer((prev) => (prev ?? "") + chunk);
      }
      accumulated += decoder.decode();
      setStatus("idle");
      setQuestion("");
      setStreaming(false);
      setAbortController(null);
      invalidateLogs();
      void refreshSuggestions();
    } catch (error) {
      clearTimeout(fallbackTimer);
      console.error(error);
      setStreaming(false);
      setAbortController(null);
      setStatus("error");
      if (!errorMessage) {
        setErrorMessage("Unable to stream an answer right now.");
      }
    }
  }

  useEffect(() => {
    if (
      status === "idle" &&
      logsQuery.isFetchedAfterMount &&
      (logsQuery.data?.items?.length ?? 0) > 0
    ) {
      setAnswer(null);
    }
  }, [logsQuery.data?.items?.[0]?.id, logsQuery.isFetchedAfterMount, status]);

  function invalidateLogs() {
    if (walletAddress) {
      queryClient.invalidateQueries({
        queryKey: ["askLogs", walletAddress, marketId],
      });
    }
  }

  function clearChat() {
    setAnswer(null);
    setQuestion("");
    setErrorMessage(null);
    setGuardrailMeta(null);
    setStatus("idle");
    if (walletAddress) {
      queryClient.removeQueries({
        queryKey: ["askLogs", walletAddress, marketId],
      });
    }
    setSuggestionsState(defaultSuggestions);
    void refreshSuggestions();
  }

  const defaultSuggestions = [
    "Give me 3 headline catalysts in this market today.",
    "What odds-shift would justify a trade here?",
    "Summarize key risks before I bet.",
  ];

  async function refreshSuggestions() {
    setSuggestionsLoading(true);
    try {
      const latest = visibleConversation.at(-1);
      const response = await fetch("/api/ask/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page,
          marketTitle,
          marketCategory,
          topics,
          recentQuestion: latest?.question,
          recentAnswer: latest?.answer,
        }),
      });
      if (!response.ok) throw new Error("Failed to fetch suggestions");
      const body = (await response.json()) as { data?: { questions?: string[] } };
      const incoming = body.data?.questions ?? [];
      const merged =
        incoming.length > 0 ? incoming.slice(0, 3) : suggestionsState.length ? suggestionsState : defaultSuggestions;
      setSuggestionsState(merged);
    } catch (error) {
      console.warn("[ask] suggestions fallback", error);
      if (!suggestionsState.length) setSuggestionsState(defaultSuggestions);
    } finally {
      setSuggestionsLoading(false);
    }
  }

  const suggestionList =
    suggestionsState && suggestionsState.length > 0
      ? suggestionsState.slice(0, 3)
      : defaultSuggestions;

  return (
    <section className="card" style={{ marginTop: 16, padding: 20 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h3 style={{ margin: 0 }}>AI chat</h3>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.9rem" }}>
            Keep it concise. Not investment advice.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {streaming && (
            <button
              type="button"
              className="pill-button pill-button--ghost"
              onClick={() => abortController?.abort()}
              style={{ fontSize: "0.85rem" }}
            >
              Stop
            </button>
          )}
          <button
            type="button"
            className="pill-button pill-button--ghost"
            onClick={clearChat}
            style={{ fontSize: "0.85rem" }}
          >
            Clear
          </button>
        </div>
      </div>

      {suggestionList.length ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginTop: 12,
          }}
        >
          {suggestionList.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="chip"
              onClick={() => sendQuestion(prompt)}
              disabled={streaming || status === "loading" || suggestionsLoading}
              style={{ textAlign: "left", maxWidth: "100%" }}
            >
              {prompt}
            </button>
          ))}
        </div>
      ) : null}

      <div
        style={{
          marginTop: 12,
          height: 360,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          padding: 12,
          background: "var(--color-surface)",
          borderRadius: 14,
          border: "2px solid var(--color-border-strong)",
          boxShadow: "0 3px 0 var(--shadow-lite)",
        }}
      >
        {visibleConversation.length === 0 && !answer && (
          <p className="muted" style={{ margin: 0 }}>
            No messages yet. Ask about catalysts, probabilities, or risks.
          </p>
        )}
        {visibleConversation.map((entry) => (
          <div key={entry.id} style={{ display: "grid", gap: 6 }}>
            <div style={{ justifySelf: "flex-end", maxWidth: "90%" }}>
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "var(--color-text-muted)",
                  textAlign: "right",
                }}
              >
                You · {new Date(entry.createdAt).toLocaleTimeString()}
              </div>
              <div
                style={{
                  background: "var(--color-surface)",
                  padding: 12,
                  borderRadius: 12,
                  border: "2px solid var(--color-border-strong)",
                  boxShadow: "0 3px 0 var(--shadow-lite)",
                }}
              >
                {entry.question}
              </div>
            </div>
            <div style={{ maxWidth: "94%" }}>
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "var(--color-text-muted)",
                  marginBottom: 4,
                }}
              >
                AI
              </div>
              <Bubble markdown>{entry.answer}</Bubble>
            </div>
          </div>
        ))}
        {answer && (
          <div style={{ maxWidth: "94%" }}>
            <div
              style={{
                fontSize: "0.8rem",
                color: "var(--color-text-muted)",
                marginBottom: 4,
              }}
            >
              AI (live)
            </div>
            <Bubble markdown>{answer}</Bubble>
          </div>
        )}
        {(status === "loading" || streaming) && (
          <p className="muted" style={{ fontSize: "0.9rem", margin: 0 }}>
            Generating…
          </p>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          marginTop: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: 10,
            borderRadius: 12,
            border: "2px solid var(--color-border-strong)",
            background: "var(--color-surface)",
          }}
        >
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask about odds shifts, catalysts, or risk factors…"
            disabled={!walletAddress}
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              fontSize: "1rem",
              background: "transparent",
            }}
          />
          <button
            id="ask-ai-submit"
            type="submit"
            className="pill-button pill-button--primary"
            disabled={status === "loading" || streaming || !walletAddress}
            style={{ padding: "10px 14px" }}
          >
            {status === "loading" || streaming ? "Sending…" : "Send"}
          </button>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span className="muted" style={{ fontSize: "0.85rem" }}>
            {walletAddress
              ? "FLock Qwen backed responses with guardrails."
              : "Connect your wallet to start chatting."}
          </span>
        </div>
      </form>

      {status === "error" && errorMessage && (
        <p className="muted" style={{ color: "var(--color-negative)" }}>
          {errorMessage}
        </p>
      )}
      {guardrailMeta?.redacted && (
        <p className="muted" style={{ marginTop: 6, fontSize: "0.8rem" }}>
          Guardrail: sensitive details were redacted ({guardrailMeta.redactions?.join(", ")})
        </p>
      )}
      <p className="muted" style={{ marginTop: 8 }}>
        {quotaLimit != null ? (
          <>
            Daily limit: {quotaLimit} · Remaining:{" "}
            {remainingQuota != null ? remainingQuota : quotaLimit}
          </>
        ) : (
          <>Daily limit applies once you ask (connect wallet to view quota).</>
        )}
      </p>
      <div className="disclaimer">
        AI output is experimental and may contain errors. Always verify before trading.
      </div>
    </section>
  );
}

function Bubble({ children, markdown }: { children: ReactNode; markdown?: boolean }) {
  return (
    <div
      style={{
        background: "#eef3ff",
        padding: 12,
        borderRadius: 12,
        border: "2px solid var(--color-border-soft)",
        boxShadow: "0 3px 0 var(--shadow-lite)",
        whiteSpace: "pre-wrap",
      }}
    >
      {markdown ? (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{String(children)}</ReactMarkdown>
      ) : (
        children
      )}
    </div>
  );
}
