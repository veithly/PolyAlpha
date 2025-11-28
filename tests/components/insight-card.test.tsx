import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InsightCard } from "@/components/InsightCard";

describe("InsightCard", () => {
  it("renders loading skeletons", () => {
    render(<InsightCard isLoading insight={undefined} />);
    expect(screen.getByText("Today’s AI outlook")).toBeInTheDocument();
    expect(screen.getByText(/Awaiting latest insight/i)).toBeInTheDocument();
  });

  it("shows insight bullets", () => {
    render(
      <InsightCard
        isLoading={false}
        insight={{
          dateKey: "2025-11-19",
          generatedAt: new Date().toISOString(),
          model: "qwen",
          sections: [{ heading: "Crypto", items: [{ title: "A", summary: "BTC rally" }] }],
        }}
      />
    );

    expect(screen.getByText(/Crypto/i)).toBeInTheDocument();
    expect(screen.getByText(/BTC rally/)).toBeInTheDocument();
  });
});
