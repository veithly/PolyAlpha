"use client";

const docLinks = [
  {
    title: "Product Requirements",
    path: "/docs/polymarket_ai_alpha_base_mini_app_prd.md",
  },
  {
    title: "Architecture",
    path: "/docs/polymarket_ai_alpha_技术架构（含_sqlite_mermaid）.md",
  },
  {
    title: "API Contracts",
    path: "/docs/polymarket_ai_alpha_api_接口设计规范.md",
  },
  {
    title: "UI Spec",
    path: "/docs/polymarket_ai_alpha_ui_交互详细设计.md",
  },
];

export function DocsPanel() {
  return (
    <section className="card">
      <div className="section-heading">
        <h2 style={{ margin: 0 }}>Source documents</h2>
        <span className="muted">Always in sync with the PRD</span>
      </div>
      <div className="grid docs-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {docLinks.map((doc) => (
          <a
            key={doc.path}
            href={doc.path}
            target="_blank"
            rel="noreferrer"
            className="card"
            style={{
              background: "var(--color-surface-alt)",
              border: "1px dashed var(--color-border-soft)",
            }}
          >
            <h3 style={{ marginTop: 0 }}>{doc.title}</h3>
            <code style={{ fontSize: "0.75rem" }}>{doc.path.replace("/docs/", "")}</code>
          </a>
        ))}
      </div>
    </section>
  );
}
