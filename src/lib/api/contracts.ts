/**
 * Request/response DTOs for the versioned JSON API (`src/app/api/v1/*`).
 *
 * This is the single source of truth for the API contract — the shape an iOS
 * (or any non-browser) client codes against. Response payloads reuse the domain
 * types from `src/lib/*` so the contract can never drift from what the handlers
 * actually return; request types are declared here because the form-POST routes
 * never had typed inputs.
 *
 * Stability rule (see the plan's coexistence section): within `v1`, changes are
 * additive only. Renaming or removing a field breaks shipped iOS builds that
 * cannot be force-updated — that requires a new `v2`.
 */
import type { DashboardData } from "@/lib/wb/dashboard";
import type { LedgerEntry } from "@/lib/wb/ledger";
import type { Notification } from "@/lib/wb/notifications";
import type { WatchEntry } from "@/lib/wb/watchlist";
import type { Quote } from "@/lib/wb/quotes";
import type { TickerQuote } from "@/lib/wb/marketTicker";
import type { Game } from "@/lib/news/scores";
import type { ReferralStats } from "@/lib/wb/referrals";
import type { EarnedAchievement } from "@/lib/wb/achievements";
import type { LeagueOverview } from "@/lib/fantasy/leagues";
import type { CrossLeagueScoreboard } from "@/lib/fantasy/rankings";
import type { PoolSummary, PoolDetail } from "@/lib/fantasy/pools";
import type { FantasyLink } from "@/lib/fantasy/link";
import type { Matchup } from "@/lib/fantasy/matchups";
import type { NflState } from "@/lib/sleeper/types";
import type { Article } from "@/lib/news/espn";
import type { WhooshEntry } from "@/lib/news/engagement";
import type { Section } from "@/lib/sections";
import type { BetEvent, UserWager } from "@/lib/wb/bets";
import type { StockSnapshot } from "@/lib/wb/history";
import type { CompanyProfile } from "@/lib/wb/profile";
import type { Order } from "@/lib/wb/invest";
import type {
  ChatOverview, ChatMessage, ChatLeaderboardRow, ChatAuthor, ChatMember, ChatRole,
} from "@/lib/chat/types";

/** POST /api/v1/wb/wager — place a wager on an event outcome. */
export type PlaceWagerRequest = {
  eventId: number;
  outcomeId: number;
  /** Stake in whole Whoosh Bucks (converted to cents server-side). */
  stake: number;
};
export type PlaceWagerResponse = { wagerId: number };

/** GET /api/v1/wb/wallet — the signed-in user's Capital/WB dashboard. */
export type WalletResponse = DashboardData;

/** POST /api/v1/wb/transfer — send WB to another user by username. */
export type TransferRequest = {
  recipient: string;
  /** Amount in whole WB; or pass `amountCents` directly. */
  amount?: number;
  amountCents?: number;
  memo?: string;
};
export type TransferResponse = { transferId: number };

/** POST /api/v1/wb/invest/order — buy/sell a symbol by USD amount or shares. */
export type InvestOrderRequest = {
  symbol: string;
  side: "buy" | "sell";
  /** USD amount (whole dollars) — or pass `shares`. */
  amount?: number;
  shares?: number;
};
export type InvestOrderResponse = { orderId: number; totalCents: number };

/** POST /api/v1/wb/bonus — claim the daily bonus. */
export type ClaimBonusResponse = { claimed: boolean; amountCents: number; streak: number };

/** GET /api/v1/wb/bonus — is today's bonus still claimable + current streak. */
export type BonusStatusResponse = { available: boolean; streak: number };

/** POST /api/v1/wb/watchlist — add/remove a symbol from the watchlist. */
export type WatchlistMutateRequest = { symbol: string; action: "add" | "remove" };
export type WatchlistMutateResponse = { symbol: string; watching: boolean };

/** GET /api/v1/wb/watchlist — the user's watched symbols. */
export type WatchlistResponse = { items: WatchEntry[] };

/** GET /api/v1/wb/notifications — recent notifications + unread count. */
export type NotificationsResponse = { items: Notification[]; unread: number };
/** POST /api/v1/wb/notifications — mark all read. */
export type MarkReadResponse = { unread: 0 };

/** GET /api/v1/wb/activity — ledger entries (JSON sibling of the CSV export). */
export type ActivityResponse = { entries: LedgerEntry[] };

/** GET /api/v1/wb/events — open house-wager events (with outcomes). */
export type EventsResponse = { events: BetEvent[] };

/** GET /api/v1/wb/bets — the signed-in user's wagers (newest first). */
export type BetsResponse = { wagers: UserWager[] };

/** GET /api/v1/wb/quote?symbol= — a single live quote. */
export type QuoteResponse = Quote;

/** GET /api/v1/wb/symbol?symbol=&range= — full stock detail for the invest view. */
export type SymbolDetailResponse = {
  snapshot: StockSnapshot;
  profile: CompanyProfile | null;
  quote: Quote | null;
};

/** GET /api/v1/wb/orders — the user's recent investing orders. */
export type OrdersResponse = { orders: Order[] };

/** GET /api/v1/wb/search?q= — symbol typeahead. */
export type SearchResult = { symbol: string; name: string; kind: "stock" | "crypto" };
export type SearchResponse = { results: SearchResult[] };

/** GET /api/v1/capital/ticker — market strip quotes (public). */
export type TickerResponse = { quotes: TickerQuote[] };

/** GET /api/v1/news/scores — live scores (public). */
export type ScoresResponse = { games: Game[] };

/** GET /api/v1/account — profile, auth methods, referrals, achievements. */
export type AccountResponse = {
  id: string;
  username: string;
  avatarUrl: string | null;
  discordUserId: string | null;
  isAdmin: boolean;
  /** Whether first-run onboarding is complete — the iOS app branches on this. */
  onboarded: boolean;
  /** Whether the user currently holds Whoosh Premium (perk tier). */
  premium: boolean;
  auth: { hasDiscord: boolean; hasPassword: boolean; email: string | null; emailVerified: boolean };
  referrals: ReferralStats;
  achievements: EarnedAchievement[];
};

// ── Onboarding / profile (iOS first-run) ─────────────────────────────────────

/** GET /api/v1/account/username-available?handle= */
export type UsernameAvailableResponse = {
  available: boolean;
  /** The handle normalized to the allowed format (suggested value). */
  normalized: string;
  /** Why unavailable, when `available` is false. */
  reason?: string;
};

/** POST /api/v1/account/profile — set @handle + mark onboarded. */
export type SetUsernameRequest = { username: string };
export type ProfileResponse = {
  id: string;
  username: string;
  avatarUrl: string | null;
  onboarded: boolean;
};

/** POST /api/v1/account/avatar — multipart image upload. */
export type AvatarResponse = { avatarUrl: string };

// ── Fantasy ──────────────────────────────────────────────────────────────────

/** GET /api/v1/fantasy/overview — the Fantasy home composition. */
export type FantasyOverviewResponse = {
  state: NflState | null;
  link: FantasyLink | null;
  board: CrossLeagueScoreboard;
  pools: PoolSummary[];
  leagues: LeagueOverview[];
};

/** GET /api/v1/fantasy/rankings */
export type FantasyRankingsResponse = CrossLeagueScoreboard;

/** GET /api/v1/fantasy/pools */
export type FantasyPoolsResponse = { pools: PoolSummary[] };

/** GET /api/v1/fantasy/pools/[leagueId] — pool detail + the user's join status. */
export type FantasyPoolDetailResponse = PoolDetail & { joined: boolean };

/** GET /api/v1/fantasy/leagues/[leagueId] — overview + the viewer's access. */
export type FantasyLeagueResponse = { overview: LeagueOverview; access: boolean };

/** GET /api/v1/fantasy/matchups — current scoring week across H2H leagues. */
export type FantasyMatchupsResponse = {
  week: number;
  blocks: { leagueId: string; leagueName: string; season: string; matchups: Matchup[] }[];
};

/** POST /api/v1/fantasy/link — link or unlink a Sleeper account. */
export type LinkSleeperRequest = { username?: string; action?: "link" | "unlink" };
export type LinkSleeperResponse = { link: FantasyLink | null };

// ── News ─────────────────────────────────────────────────────────────────────

/** POST /api/v1/news/swipe — keep (right) / trash (left) / undo. */
export type SwipeRequest = {
  action?: "swipe" | "undo";
  sport?: string;
  direction?: "left" | "right";
  guid?: string;
  article?: {
    guid?: string;
    title?: string;
    description?: string;
    link?: string;
    author?: string | null;
    image?: string | null;
    pubDate?: string | null;
  };
};
export type SwipeResponse = { points: number };

/**
 * GET /api/v1/news/feed — Whoosh feed (no sport) or a sport's swipeable feed.
 *   ?view=mine → the viewer's kept articles; default → community kept feed.
 *   ?sport=<key> → that sport's ESPN articles minus already-swiped.
 */
export type NewsFeedResponse =
  | { mode: "whoosh"; entries: WhooshEntry[] }
  | { mode: "sport"; sport: string; articles: Article[] };

// ── Payments (web Stripe link-out) ───────────────────────────────────────────
// iOS does NOT check out in-app. These endpoints return a hosted Stripe Checkout
// URL the app opens in the browser (Apple External Purchase Link). The existing
// Stripe webhook credits WB / grants premium on completion — no Apple server
// credentials involved. See docs/ios-payments.md.

/** A hosted Stripe URL for the client to open externally. */
export type CheckoutUrlResponse = { url: string };

/** POST /api/v1/wb/buy — start a Whoosh Bucks purchase. */
export type BuyWbRequest = {
  /** USD amount in whole dollars; or pass `amountCents`. */
  amount?: number;
  amountCents?: number;
};

/** POST /api/v1/checkout — start a premium subscription. */
export type SubscribeRequest = { interval: "monthly" | "six_months" | "annual" };

/** POST /api/v1/fantasy/checkout — start a league-group entry-fee purchase. */
export type FantasyCheckoutRequest = { groupKey: string };

// ── Home (iOS landing aggregate) ─────────────────────────────────────────────

/** GET /api/v1/home — one call powering the app's logged-in landing screen. */
export type HomeResponse = {
  capital: DashboardData;
  board: CrossLeagueScoreboard;
  topArticle: Article | null;
  fantasyLink: FantasyLink | null;
  sections: Section[];
};

// ── Chat (Discord-style) ─────────────────────────────────────────────────────

/** GET /api/v1/chat/overview — accessible categories/channels + the viewer's level/roles. */
export type ChatOverviewResponse = ChatOverview;

/** GET /api/v1/chat/channels/[id]/messages?before= — paginated, enriched history. */
export type ChatMessagesResponse = { messages: ChatMessage[] };

/** POST /api/v1/chat/channels/[id]/messages — send a message. */
export type SendChatMessageRequest = { body?: string; imageUrl?: string | null; replyTo?: number | null };
export type SendChatMessageResponse = { message: ChatMessage; level: number; leveledUp: boolean };

/** POST /api/v1/chat/messages/[id]/react — toggle a reaction; returns the emoji's new count. */
export type ChatReactRequest = { emoji: string; on: boolean };
export type ChatReactResponse = { count: number };

/** PATCH /api/v1/chat/messages/[id] — edit own message. */
export type ChatEditRequest = { body: string };

/** POST /api/v1/chat/upload — multipart image → public URL. */
export type ChatUploadResponse = { url: string };

/** GET /api/v1/chat/leaderboard — XP ranking. */
export type ChatLeaderboardResponse = { rows: ChatLeaderboardRow[] };

/** GET /api/v1/chat/starboard — most-starred messages. */
export type ChatStarboardResponse = { messages: ChatMessage[] };

/** GET /api/v1/chat/users?ids= — enrich authors for the realtime cache. */
export type ChatUsersResponse = { users: ChatAuthor[] };

/** GET /api/v1/chat/members?q= — @mention picker. */
export type ChatMembersResponse = { members: ChatMember[] };

/** GET /api/v1/chat/admin/roles — all roles (admin). */
export type ChatRolesResponse = { roles: ChatRole[] };
/** POST /api/v1/chat/admin/roles — create a custom role (admin). */
export type CreateChatRoleRequest = { key: string; name: string; color: string; priority?: number };
export type CreateChatRoleResponse = { role: ChatRole };
/** POST /api/v1/chat/admin/roles/assign — assign/remove (admin); `on:false` removes. */
export type ChatRoleAssignRequest = { userId: string; roleId: number; on?: boolean };
/** Generic acknowledgement for chat mutations with no payload. */
export type ChatOkResponse = { ok: boolean };
