# PolyAlpha · Polymarket AI Alpha

PolyAlpha is the Base Mini App + web front-end described in the Polymarket AI Alpha PRD. It uses RainbowKit + wagmi for wallet connectivity, a Next.js (App Router) monolith for UI and API routes, and SQLite (managed through Prisma) for caching AI insights, user preferences, and contributions.

## Repository Layout

```
docs/                      # PRD, architecture, API specs, implementation notes
src/
  app/                     # Next.js routes (App Router), layouts, client screens
  components/              # Reusable UI pieces (cards, filters, panels)
  domain/                  # Typed domain models + Prisma-backed service facades
  lib/                     # Infrastructure helpers (Prisma client, AI, Polymarket HTTP)
tests/                     # Vitest suites mirroring src/ structure
data/                      # SQLite files (gitignored, tracked via .gitkeep)
prisma/                    # Prisma schema + migrations
```

Refer to `docs/IMPLEMENTATION_NOTES.md` for the high-level roadmap distilled from the PRD, architecture, and API specification.

## Getting Started

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Create an environment file**
   ```bash
   cp .env.example .env.local
   ```
   Populate the values (WalletConnect project ID, Base RPC URL, FLock API key, etc.).
3. **Apply database migrations**
   ```bash
   npx prisma migrate dev
   ```
4. **Run the development server**
   ```bash
   npm run dev
   ```
   The app runs on [http://localhost:3000](http://localhost:3000) (Next will choose a free port automatically).

## Commands

| Command        | Description                                      |
| -------------- | ------------------------------------------------ |
| `npm run dev`  | Start the Next.js dev server with RainbowKit     |
| `npm run build`| Create an optimized production build             |
| `npm run start`| Serve the production build                       |
| `npm run lint` | Run Next.js/ESLint checks                        |
| `npm run test` | Execute Vitest suites under `tests/` (API, domain, UI) |
| `npm run test:e2e` | Run Playwright smoke tests (spins up `npm run dev` automatically) |
| `npm run analyze` | Produce bundle analysis artifacts under `.next/analyze/**` |
| `npm run jobs:snapshot` | Run the Polymarket snapshot + AI cache warmer |
| `npm run cf:build` | Build Cloudflare Pages worker output via `@cloudflare/next-on-pages` |
| `npm run cf:dev` | Build, then preview locally with `wrangler pages dev` (requires `wrangler` login) |
| `npm run cf:deploy` | Build then deploy to Cloudflare Pages |
| `npm run cf:build:worker` | Build OpenNext worker bundle for Cloudflare Workers |
| `npm run cf:deploy:worker` | Build and deploy to Cloudflare Workers via `wrangler deploy --config wrangler.worker.toml` |

## Environment Variables

See `.env.example` for the complete list. Key values include:

- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` – WalletConnect Cloud ID for RainbowKit.
- If absent or placeholder, the app falls back to injected/Coinbase-only connectors (WalletConnect modal disabled).
- `BASE_RPC_URL` / `NEXT_PUBLIC_BASE_CHAIN_ID` – RPC endpoint + chain id for Base.
- `FLOCK_API_KEY` / `FLOCK_MODEL` / `FLOCK_API_URL` – Credentials for FLock (Qwen) API calls (the key is sent as `x-litellm-api-key` for `chat/completions` and `x-api-key` for conversational endpoints).
- `POLYMARKET_API_BASE` – Override for the Polymarket market list endpoint. Leave unset to use the live Gamma events API (recommended).
- `SQLITE_DATA_DIR` / `SQLITE_DB_PATH` – Optional overrides for the local SQLite location.
- `DATABASE_URL` – Prisma connection string (defaults to `file:./data/app.db`).
- `NEXT_PUBLIC_ENABLE_TESTNETS` – `"true"` to expose testnet chains (e.g., Base Sepolia) in RainbowKit.
- `APP_BASE_URL` – Absolute origin used by server components (prefetch + bundle analyzer) to call internal APIs (e.g., `http://localhost:3000` for local dev).
- `CONTRIBUTION_ADMIN_TOKEN` – Shared secret used by moderation endpoints (send via `x-admin-token` or `Authorization: Bearer …`).
- Notifications (optional): `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`, `EMAIL_WEBHOOK_URL` / `EMAIL_WEBHOOK_TOKEN`, `FC_WEBHOOK_URL` / `FC_WEBHOOK_TOKEN` (Farcaster or other webhook-compatible push channel).
- Cloudflare Pages: `CF_PAGES` is injected by the platform; the D1 database is exposed as the `DB` binding declared in `wrangler.toml` (no env var needed).
- Cloudflare Workers (OpenNext): bindings pulled from `wrangler.worker.toml`; D1 binding name must be `DB` to match Prisma.

## Architecture Notes

- The project follows the single Next.js monolith described in `docs/polymarket_ai_alpha_技术架构（含_sqlite_mermaid）.md`.
- API routes live under `src/app/api/*` and call domain services in `src/domain/**`.
- SQLite is accessed exclusively through Prisma (`prisma/schema.prisma` + `src/lib/prisma.ts`). Run `npx prisma migrate dev` whenever the schema changes.
- AI interactions use FLock’s OpenAI-compatible endpoint via `src/lib/ai.ts` and prompt templates in `src/lib/prompts.ts`.
- Ask AI supports both JSON and SSE streaming: `/api/ask` (batched) and `/api/ask/stream` (token stream). UI toggle defaults to streaming; limits respect per-wallet `askLimit` from preferences or `ASK_AI_DAILY_LIMIT`.
- Guardrails: `src/lib/guardrails.ts` performs keyword + optional FLock moderation and logs decisions; blocked prompts return `ASK_GUARDRAIL_TRIGGERED`.
- Polymarket data aggregation lives in `src/lib/polymarket.ts` and feeds both domain services and API routes.
- Insights: `/api/insights/{cadence}` (daily/hourly/event) returns cached AI sections with confidence badges, and `/api/insights/{cadence}/sections` regenerates individual sections on demand.
- Watchlists live under `/api/markets/watchlist` (requires `x-wallet-address` header); dashboard `MarketCard` components expose a ☆ button to persist favorites, and the “My watchlist” preset pulls those saved markets.
- Ask AI short-term memory lives in `qa_logs`; `/api/ask` injects the last 5 Q&A pairs, redacts sensitive output, and `/api/ask/logs` supports clearing history via `DELETE`.
- `/api/markets` now accepts numeric filters (`volume24hMin`, `liquidityMin`, `change24hMin`, `change24hMax`), surfaced via dashboard preset chips (All / High Liquidity / Whale Volume / Bullish Momentum) **and supports cursor pagination** (`cursor` returned in response; dashboard loads 12 at a time).
- Contribution moderation & voting:
  - `/api/contributions` filters to approved takes; admins can pass `status=pending`/`status=all` alongside `x-admin-token`.
  - `/api/contributions/[id]/moderation` (POST) moves contributions between `pending`, `approved`, and `hidden` states (admin token required).
  - `/api/contributions/[id]/upvote` (POST/DELETE) toggles wallet-scoped votes and updates aggregates used in `ContributionList`.

## Testing & QA

- Vitest + React Testing Library power the automated suite (`tests/**`).
- Coverage areas:
  - Domain services (Polymarket fetchers, Prisma-backed repositories).
  - API handlers (`tests/api/*.test.ts`) via mocked dependencies.
  - UI components (`tests/components/*.test.ts`).
  - AI helper logic (`tests/lib/ai.test.ts`) with mocked FLock responses.
- Run `npm run test` locally/CI. The command also validates mocked fetch flows and Prisma abstractions.
- End-to-end smoke tests live under `tests/e2e` (Playwright). Run `npm run test:e2e` to launch a dev server, mock API responses, and verify onboarding → dashboard → market flows.
- Schedule `npm run jobs:snapshot` (via cron/GitHub Actions) to hydrate cached markets and AI outputs ahead of demo time. Export `DATABASE_URL`, `FLOCK_API_KEY`, etc., before invoking the job.
- Send daily digests (console delivery stub) with `npx tsx scripts/jobs/sendDigests.ts`; uses `user_preferences.notify_daily` + channels to route. Replace `deliver()` with your email/Telegram infra.

## Documentation

- Product requirements: `docs/polymarket_ai_alpha_base_mini_app_prd.md`
- Technical architecture (Mermaid diagrams + SQLite schema): `docs/polymarket_ai_alpha_技术架构（含_sqlite_mermaid）.md`
- API specification: `docs/polymarket_ai_alpha_api_接口设计规范.md`
- Implementation summary: `docs/IMPLEMENTATION_NOTES.md`

Keep these documents as the source of truth for future features and PRDs. Update `README.md` whenever new commands or external dependencies are introduced.

## Deployment

1. **Local / self-hosted (recommended for SQLite writes)**
   ```bash
   npm run build
   npm run start
   ```
   Ensure `.env` contains the same variables as `.env.local` (including `DATABASE_URL` pointing at a writable location).

2. **Base Mini App packaging**
   - Follow `docs/BASE_MINI_APP.md` for the complete checklist.
   - Update `minikit.config.ts` and `deploy/base-mini-app.manifest.json` with production URLs, host the manifest on HTTPS, and submit it to Base Mini Apps.
   - Run `npm run jobs:snapshot` (optional but recommended) followed by `npm run build:mini` to produce the bundle used by your hosting target (Vercel SSR or `next export`ed static bundle).
   - Ensure the hosting provider has all required env vars (WalletConnect ID, Base RPC/chain ID, FLock credentials, Polymarket API base, contribution admin token).

3. **Vercel (read-only demo)**
   - Vercel’s filesystem is ephemeral, so cache-only flows (insights, summaries) will regenerate per request.
   - Provide a remote SQLite (e.g., Turso, Neon) if persistent caching is required, or switch Prisma’s `DATABASE_URL` accordingly.

4. **Cloudflare Pages (edge + D1)**
   - Install `wrangler` and log in once: `npx wrangler login`.
   - Create a D1 database: `wrangler d1 create polyalpha-db` then paste the returned `database_id` into `wrangler.toml`.
   - Apply migrations/schema: `wrangler d1 migrations apply polyalpha-db` (or `wrangler d1 execute polyalpha-db --file=./prisma/migrations/.../migration.sql`).
   - Build worker output: `npm run cf:build`.
   - Preview locally (with D1 binding): `npm run cf:dev`.
   - Deploy: `wrangler pages deploy .vercel/output`. The Pages runtime provides the `DB` binding; Prisma auto-switches to the D1 adapter.

5. **Cloudflare Workers (OpenNext)**
   - Create/attach the same D1 database in `wrangler.worker.toml` (`binding = "DB"`).
   - Build worker bundle: `npm run cf:build:worker` (uses `open-next.config.ts`, outputs `.open-next`).
   - Deploy: `npm run cf:deploy:worker` (uses `wrangler.worker.toml`).
   - Optional: serve assets from `.open-next/assets` binding `ASSETS`; adjust `wrangler.worker.toml` if you place assets elsewhere.

4. **Farcaster Mini App packaging**
   - Mirror the Base deployment artifact but host `farcaster.json` (see `docs/FARCASTER_MINI_APP.md`) at your production origin.
   - Copy the template from `deploy/farcaster-mini-app.manifest.json`, sign the `accountAssociation`, and add the `fc:miniapp` meta tag to your landing page.
   - Test inside Warpcast (or `miniapps.farcaster.xyz` sandbox) before submitting for review.
   
## Observability & Logging

- Every API route now passes through `withApiLogging` (`src/lib/logging.ts`), emitting structured JSON logs to stdout: method, path, status, duration, optional wallet, and timestamp. Ship those logs to Logtail/OTLP during deployment.
- Ask AI requests continue to produce `event: "ask_ai"` telemetry; use both feeds to monitor rate limits and latency envelopes.

## Performance Optimizations

- Heavy UI modules are dynamically imported (`AskAiPanel`, `PriceTrendChart`) so the dashboard first-load bundle stays near ~316 kB (market detail ~320 kB). Run `npm run analyze` to regenerate bundle reports in `.next/analyze/{client,edge,nodejs}.html`.
- Market detail routes prefetch data server-side via React Query + `HydrationBoundary`, and charts only render on the client, reducing expensive SSR work.
- Mobile-specific CSS tokens in `globals.css` keep the Polymarket blue/white theme usable on Base Mini App and Farcaster clients without duplicating layouts.

For judges/reviewers, share the manifest URL plus a short video. The Base Mini App deployment doc includes a QA checklist to run through before submission.
