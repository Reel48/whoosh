/**
 * The single enumeration of the v1 API surface, used to generate the OpenAPI
 * spec (`scripts/generate-openapi.mts`) and guarded by `manifest.test.ts`
 * (every `route.ts` ↔ exactly one entry; every type name exists in
 * `contracts.ts`). Data only — no runtime imports — so it's safe to import from
 * both the generator (Node) and tests.
 *
 * `requestType`/`responseType` are exported type names from `src/lib/api/contracts.ts`.
 * The `api/v1/iap/apple/notify` webhook is intentionally absent: it's an
 * Apple→backend server notification, not a client call (it belongs under the
 * OpenAPI `webhooks` field, not `paths`).
 */

export type HttpMethod = "get" | "post";

export type QueryParam = { name: string; required: boolean; description?: string };

export type ApiOperation = {
  method: HttpMethod;
  /** OpenAPI path, with `{param}` placeholders. */
  path: string;
  operationId: string;
  summary: string;
  /** `bearer` → requires `Authorization: Bearer`; `public` → no auth. */
  auth: "bearer" | "public";
  /** Exported request DTO name in contracts.ts (POST bodies). */
  requestType?: string;
  /** Exported response DTO name in contracts.ts (the `data` payload). */
  responseType: string;
  query?: QueryParam[];
  pathParams?: string[];
  /** Per-client capability gate (see src/lib/api/client.ts) — adds a 403. */
  capability?: "wagering" | "real_money_fantasy";
  /** Extra error codes this op can return beyond the auth/validation defaults. */
  extraErrors?: string[];
};

export const API_TITLE = "Whoosh API";
export const API_VERSION = "1.0.0";

export const OPERATIONS: ApiOperation[] = [
  // ── Whoosh Bucks / Capital ────────────────────────────────────────────────
  {
    method: "get",
    path: "/api/v1/wb/wallet",
    operationId: "getWallet",
    summary: "The signed-in user's Capital/WB dashboard.",
    auth: "bearer",
    responseType: "WalletResponse",
  },
  {
    method: "post",
    path: "/api/v1/wb/wager",
    operationId: "placeWager",
    summary: "Place a wager on an event outcome.",
    auth: "bearer",
    requestType: "PlaceWagerRequest",
    responseType: "PlaceWagerResponse",
    capability: "wagering",
    extraErrors: ["insufficient_funds", "conflict"],
  },
  {
    method: "post",
    path: "/api/v1/wb/transfer",
    operationId: "transferWb",
    summary: "Send Whoosh Bucks to another user by username.",
    auth: "bearer",
    requestType: "TransferRequest",
    responseType: "TransferResponse",
    extraErrors: ["insufficient_funds", "not_found"],
  },
  {
    method: "post",
    path: "/api/v1/wb/invest/order",
    operationId: "placeInvestOrder",
    summary: "Buy or sell a symbol by USD amount or share count.",
    auth: "bearer",
    requestType: "InvestOrderRequest",
    responseType: "InvestOrderResponse",
    extraErrors: ["insufficient_funds", "not_found"],
  },
  {
    method: "post",
    path: "/api/v1/wb/bonus",
    operationId: "claimDailyBonus",
    summary: "Claim the daily bonus (idempotent per day).",
    auth: "bearer",
    responseType: "ClaimBonusResponse",
  },
  {
    method: "get",
    path: "/api/v1/wb/watchlist",
    operationId: "getWatchlist",
    summary: "The user's watched symbols.",
    auth: "bearer",
    responseType: "WatchlistResponse",
  },
  {
    method: "post",
    path: "/api/v1/wb/watchlist",
    operationId: "mutateWatchlist",
    summary: "Add or remove a symbol from the watchlist.",
    auth: "bearer",
    requestType: "WatchlistMutateRequest",
    responseType: "WatchlistMutateResponse",
  },
  {
    method: "get",
    path: "/api/v1/wb/notifications",
    operationId: "listNotifications",
    summary: "Recent notifications + unread count.",
    auth: "bearer",
    responseType: "NotificationsResponse",
  },
  {
    method: "post",
    path: "/api/v1/wb/notifications",
    operationId: "markNotificationsRead",
    summary: "Mark all notifications read.",
    auth: "bearer",
    responseType: "MarkReadResponse",
  },
  {
    method: "get",
    path: "/api/v1/wb/activity",
    operationId: "getActivity",
    summary: "Ledger entries (JSON sibling of the CSV export).",
    auth: "bearer",
    responseType: "ActivityResponse",
    query: [
      { name: "group", required: false, description: "Ledger kind group filter." },
      { name: "since", required: false, description: "ISO date lower bound." },
      { name: "until", required: false, description: "ISO date upper bound." },
    ],
  },
  {
    method: "get",
    path: "/api/v1/wb/quote",
    operationId: "getQuote",
    summary: "A single live quote for a symbol.",
    auth: "bearer",
    responseType: "QuoteResponse",
    query: [{ name: "symbol", required: true, description: "Ticker or crypto symbol." }],
    extraErrors: ["not_found"],
  },
  {
    method: "get",
    path: "/api/v1/wb/search",
    operationId: "searchSymbols",
    summary: "Symbol typeahead (stocks + crypto).",
    auth: "public",
    responseType: "SearchResponse",
    query: [{ name: "q", required: false, description: "Search query." }],
  },
  {
    method: "get",
    path: "/api/v1/capital/ticker",
    operationId: "getTicker",
    summary: "Market-strip quotes (public).",
    auth: "public",
    responseType: "TickerResponse",
  },

  // ── News ──────────────────────────────────────────────────────────────────
  {
    method: "get",
    path: "/api/v1/news/scores",
    operationId: "getScores",
    summary: "Live scores (public).",
    auth: "public",
    responseType: "ScoresResponse",
  },
  {
    method: "get",
    path: "/api/v1/news/feed",
    operationId: "getNewsFeed",
    summary: "Whoosh feed, or a sport's swipeable feed when ?sport= is given.",
    auth: "bearer",
    responseType: "NewsFeedResponse",
    query: [
      { name: "sport", required: false, description: "Sport key; omit for the Whoosh feed." },
      { name: "view", required: false, description: "`mine` for the viewer's kept articles." },
    ],
  },
  {
    method: "post",
    path: "/api/v1/news/swipe",
    operationId: "recordSwipe",
    summary: "Keep (right) / trash (left) / undo a news article.",
    auth: "bearer",
    requestType: "SwipeRequest",
    responseType: "SwipeResponse",
  },

  // ── Account ─────────────────────────────────────────────────────────────────
  {
    method: "get",
    path: "/api/v1/account",
    operationId: "getAccount",
    summary: "Profile, auth methods, referrals, achievements.",
    auth: "bearer",
    responseType: "AccountResponse",
  },

  // ── Fantasy ─────────────────────────────────────────────────────────────────
  {
    method: "get",
    path: "/api/v1/fantasy/overview",
    operationId: "getFantasyOverview",
    summary: "Fantasy home composition (leagues, rankings, pools, link).",
    auth: "bearer",
    responseType: "FantasyOverviewResponse",
  },
  {
    method: "get",
    path: "/api/v1/fantasy/rankings",
    operationId: "getFantasyRankings",
    summary: "Cross-league power-ranking scoreboard.",
    auth: "bearer",
    responseType: "FantasyRankingsResponse",
  },
  {
    method: "get",
    path: "/api/v1/fantasy/pools",
    operationId: "listFantasyPools",
    summary: "Pick'em / survivor pool summaries.",
    auth: "bearer",
    responseType: "FantasyPoolsResponse",
  },
  {
    method: "get",
    path: "/api/v1/fantasy/pools/{leagueId}",
    operationId: "getFantasyPool",
    summary: "A single pool's detail.",
    auth: "bearer",
    responseType: "FantasyPoolDetailResponse",
    pathParams: ["leagueId"],
    extraErrors: ["not_found"],
  },
  {
    method: "get",
    path: "/api/v1/fantasy/leagues/{leagueId}",
    operationId: "getFantasyLeague",
    summary: "A league's overview/standings (entitlement-gated when priced).",
    auth: "bearer",
    responseType: "FantasyLeagueResponse",
    pathParams: ["leagueId"],
    extraErrors: ["not_found", "not_entitled"],
  },
  {
    method: "get",
    path: "/api/v1/fantasy/matchups",
    operationId: "getFantasyMatchups",
    summary: "Current scoring week's matchups across H2H leagues.",
    auth: "bearer",
    responseType: "FantasyMatchupsResponse",
  },
  {
    method: "post",
    path: "/api/v1/fantasy/link",
    operationId: "linkSleeper",
    summary: "Link or unlink a Sleeper account.",
    auth: "bearer",
    requestType: "LinkSleeperRequest",
    responseType: "LinkSleeperResponse",
  },
];
