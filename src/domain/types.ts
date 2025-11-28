export type Topic =
  | 'crypto'
  | 'politics'
  | 'sports'
  | 'meme'
  | 'macro'
  | 'other';

export type MarketStatus = 'open' | 'closed' | 'resolving' | 'resolved';

export type ISODateTime = string;
export type Probability = number; // 0-1
export type Percent = number; // 0-100

export interface MarketSummary {
  id: string;
  title: string;
  category: string;
  topics: Topic[];
  status: MarketStatus;
  yesProbability: Probability;
  yesPrice: number;
  noPrice?: number;
  change24h: number;
  volume24h: number;
  totalVolume?: number;
  liquidity?: number;
  isHot: boolean;
  isSpike: boolean;
  polymarketUrl: string;
  updatedAt: ISODateTime;
  endDate?: ISODateTime;
}

export interface TimeSeriesPoint {
  timestamp: ISODateTime;
  value: number;
}

export interface MarketDetail extends MarketSummary {
  description?: string;
  createdAt?: ISODateTime;
  priceSeries: TimeSeriesPoint[];
  volumeSeries: TimeSeriesPoint[];
}

export type InsightCadence = 'daily' | 'hourly' | 'event';

export interface AiInsightSectionItem {
  title: string;
  marketId?: string;
  marketTitle?: string;
  summary: string;
  topic?: Topic;
  score?: number;
}

export interface AiInsightSection {
  topic?: Topic | 'global';
  heading: string;
  items: AiInsightSectionItem[];
  confidence?: number;
}

export interface AiInsight {
  dateKey: string;
  generatedAt: ISODateTime;
  model: string;
  cadence: InsightCadence;
  sections: AiInsightSection[];
}

export interface UserPreferences {
  walletAddress: string;
  topics: Topic[];
  notifyDaily: boolean;
  channels?: NotificationChannel[];
  topicWeights?: TopicWeight[];
  askLimit?: number;
  subscriptions?: {
    cadence: 'daily' | 'hourly';
    topics?: Topic[];
  };
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type NotificationChannel = 'email' | 'telegram' | 'none' | 'farcaster';

export interface TopicWeight {
  topic: Topic;
  weight: number; // 0-1
}

export interface AiMarketSummary {
  marketId: string;
  summary: string;
  language: string;
  model: string;
  generatedAt: ISODateTime;
}

export interface UserContribution {
  id: string;
  walletAddress: string;
  marketId: string;
  content: string;
  attachmentUrl?: string | null;
  parentId?: string | null;
  upvotes: number;
  status: ContributionStatus;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  viewerHasUpvoted?: boolean;
  replyCount?: number;
}

export interface ContributionReputation {
  walletAddress: string;
  contributions: number;
  upvotes: number;
}

export interface AiInsightRecord {
  dateKey: string;
  content: string;
  topics: Topic[];
  generatedAt: ISODateTime;
  cadence: InsightCadence;
}

export interface QaLog {
  id: string;
  walletAddress?: string;
  marketId?: string;
  question: string;
  answer: string;
  createdAt: ISODateTime;
}

export type ContributionStatus =
  | 'pending'
  | 'approved'
  | 'hidden'
  | 'flagged'
  | 'rejected'
  | 'needs_review';
