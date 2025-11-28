-- CreateTable
CREATE TABLE "UserPreference" (
    "id" SERIAL NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "topics" TEXT NOT NULL,
    "notify_daily" BOOLEAN NOT NULL DEFAULT false,
    "channels_json" TEXT,
    "topic_weights_json" TEXT,
    "ask_limit" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiInsight" (
    "id" SERIAL NOT NULL,
    "date_key" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "topics" TEXT,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cadence" TEXT NOT NULL DEFAULT 'daily',

    CONSTRAINT "AiInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketSummary" (
    "id" SERIAL NOT NULL,
    "market_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "model" TEXT,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserContribution" (
    "id" SERIAL NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attachment_url" TEXT,
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "parent_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QaLog" (
    "id" SERIAL NOT NULL,
    "wallet_address" TEXT,
    "market_id" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QaLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AskAiQuota" (
    "id" SERIAL NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "date_key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AskAiQuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CachedMarket" (
    "id" SERIAL NOT NULL,
    "market_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "topics" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "yes_probability" DOUBLE PRECISION NOT NULL,
    "yes_price" DOUBLE PRECISION NOT NULL,
    "change_24h" DOUBLE PRECISION NOT NULL,
    "volume_24h" DOUBLE PRECISION NOT NULL,
    "total_volume" DOUBLE PRECISION,
    "liquidity" DOUBLE PRECISION,
    "polymarket_url" TEXT NOT NULL,
    "is_hot" BOOLEAN NOT NULL,
    "is_spike" BOOLEAN NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CachedMarket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContributionUpvote" (
    "id" SERIAL NOT NULL,
    "contribution_id" INTEGER NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContributionUpvote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContributionAuditLog" (
    "id" SERIAL NOT NULL,
    "contribution_id" INTEGER NOT NULL,
    "previous_status" TEXT NOT NULL,
    "new_status" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContributionAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketWatchlist" (
    "id" SERIAL NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketWatchlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuardrailLog" (
    "id" SERIAL NOT NULL,
    "question" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "model" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuardrailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_wallet_address_key" ON "UserPreference"("wallet_address");

-- CreateIndex
CREATE UNIQUE INDEX "AiInsight_date_key_key" ON "AiInsight"("date_key");

-- CreateIndex
CREATE INDEX "AiInsight_cadence_idx" ON "AiInsight"("cadence");

-- CreateIndex
CREATE UNIQUE INDEX "AiInsight_cadence_date_key_key" ON "AiInsight"("cadence", "date_key");

-- CreateIndex
CREATE UNIQUE INDEX "MarketSummary_market_id_key" ON "MarketSummary"("market_id");

-- CreateIndex
CREATE INDEX "UserContribution_market_id_status_idx" ON "UserContribution"("market_id", "status");

-- CreateIndex
CREATE INDEX "UserContribution_parent_id_idx" ON "UserContribution"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "AskAiQuota_wallet_address_date_key_key" ON "AskAiQuota"("wallet_address", "date_key");

-- CreateIndex
CREATE UNIQUE INDEX "CachedMarket_market_id_key" ON "CachedMarket"("market_id");

-- CreateIndex
CREATE UNIQUE INDEX "ContributionUpvote_contribution_id_wallet_address_key" ON "ContributionUpvote"("contribution_id", "wallet_address");

-- CreateIndex
CREATE INDEX "ContributionAuditLog_contribution_id_idx" ON "ContributionAuditLog"("contribution_id");

-- CreateIndex
CREATE INDEX "MarketWatchlist_wallet_address_idx" ON "MarketWatchlist"("wallet_address");

-- CreateIndex
CREATE UNIQUE INDEX "MarketWatchlist_wallet_address_market_id_key" ON "MarketWatchlist"("wallet_address", "market_id");

-- CreateIndex
CREATE INDEX "GuardrailLog_created_at_idx" ON "GuardrailLog"("created_at");

-- AddForeignKey
ALTER TABLE "UserContribution" ADD CONSTRAINT "UserContribution_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "UserContribution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributionUpvote" ADD CONSTRAINT "ContributionUpvote_contribution_id_fkey" FOREIGN KEY ("contribution_id") REFERENCES "UserContribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributionAuditLog" ADD CONSTRAINT "ContributionAuditLog_contribution_id_fkey" FOREIGN KEY ("contribution_id") REFERENCES "UserContribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

