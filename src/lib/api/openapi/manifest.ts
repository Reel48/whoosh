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

export type HttpMethod = "get" | "post" | "patch" | "delete";

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
  /**
   * Request content type. Defaults to `application/json` (using `requestType`).
   * Set `multipart/form-data` for file uploads — the generator emits a binary
   * `fileField` part instead of a JSON `$ref`.
   */
  requestContentType?: "multipart/form-data";
  /** Form field name for the uploaded file (multipart requests only). */
  fileField?: string;
  /** Exported response DTO name in contracts.ts (the `data` payload). */
  responseType: string;
  query?: QueryParam[];
  pathParams?: string[];
  /** Per-client capability gate (see src/lib/api/client.ts) — adds a 403. */
  capability?: "wagering" | "real_money_fantasy" | "chat";
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
    method: "get",
    path: "/api/v1/wb/bonus",
    operationId: "getBonusStatus",
    summary: "Whether today's daily bonus is claimable + current streak.",
    auth: "bearer",
    responseType: "BonusStatusResponse",
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
    path: "/api/v1/wb/events",
    operationId: "listEvents",
    summary: "Open house-wager events with outcomes.",
    auth: "bearer",
    responseType: "EventsResponse",
  },
  {
    method: "get",
    path: "/api/v1/wb/bets",
    operationId: "listMyBets",
    summary: "The signed-in user's wagers (newest first).",
    auth: "bearer",
    responseType: "BetsResponse",
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
    path: "/api/v1/wb/symbol",
    operationId: "getSymbolDetail",
    summary: "Full stock detail: snapshot + candles + profile + quote.",
    auth: "bearer",
    responseType: "SymbolDetailResponse",
    query: [
      { name: "symbol", required: true, description: "Ticker or crypto symbol." },
      { name: "range", required: false, description: "1m|3m|6m|1y|5y (default 1y)." },
    ],
    extraErrors: ["not_found"],
  },
  {
    method: "get",
    path: "/api/v1/wb/orders",
    operationId: "getOrders",
    summary: "The user's recent investing orders.",
    auth: "bearer",
    responseType: "OrdersResponse",
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
    method: "post",
    path: "/api/v1/fantasy/leagues/{leagueId}/chat",
    operationId: "openLeagueChat",
    summary: "Open the league's member-gated group chat (returns a channel).",
    auth: "bearer",
    responseType: "FantasyChatResponse",
    pathParams: ["leagueId"],
    capability: "chat",
    extraErrors: ["forbidden", "not_found"],
  },
  {
    method: "post",
    path: "/api/v1/fantasy/pools/{leagueId}/chat",
    operationId: "openPoolChat",
    summary: "Open the pool's member-gated group chat (returns a channel).",
    auth: "bearer",
    responseType: "FantasyChatResponse",
    pathParams: ["leagueId"],
    capability: "chat",
    extraErrors: ["forbidden", "not_found"],
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

  // ── Onboarding / profile (iOS first-run) ────────────────────────────────────
  {
    method: "get",
    path: "/api/v1/account/username-available",
    operationId: "checkUsernameAvailable",
    summary: "Live @handle availability check for onboarding.",
    auth: "bearer",
    responseType: "UsernameAvailableResponse",
    query: [{ name: "handle", required: true, description: "Candidate @handle." }],
  },
  {
    method: "post",
    path: "/api/v1/account/profile",
    operationId: "setProfile",
    summary: "Set the user's @handle and mark them onboarded.",
    auth: "bearer",
    requestType: "SetUsernameRequest",
    responseType: "ProfileResponse",
    extraErrors: ["conflict"],
  },
  {
    method: "post",
    path: "/api/v1/account/avatar",
    operationId: "uploadAvatar",
    summary: "Upload a profile avatar image.",
    auth: "bearer",
    requestContentType: "multipart/form-data",
    fileField: "file",
    responseType: "AvatarResponse",
  },
  {
    method: "post",
    path: "/api/v1/account/device-token",
    operationId: "registerDeviceToken",
    summary: "Register this device's APNs token for push notifications.",
    auth: "bearer",
    requestType: "DeviceTokenRequest",
    responseType: "DeviceTokenResponse",
  },
  {
    method: "get",
    path: "/api/v1/home",
    operationId: "getHome",
    summary: "Aggregate data for the logged-in landing screen.",
    auth: "bearer",
    responseType: "HomeResponse",
  },

  // ── Payments (web Stripe link-out — iOS opens these URLs in the browser) ────
  {
    method: "post",
    path: "/api/v1/wb/buy",
    operationId: "buyWhooshBucks",
    summary: "Start a Whoosh Bucks purchase; returns a hosted Stripe Checkout URL.",
    auth: "bearer",
    requestType: "BuyWbRequest",
    responseType: "CheckoutUrlResponse",
  },
  {
    method: "post",
    path: "/api/v1/checkout",
    operationId: "startSubscription",
    summary: "Start a premium subscription; returns a hosted Stripe Checkout URL.",
    auth: "bearer",
    requestType: "SubscribeRequest",
    responseType: "CheckoutUrlResponse",
  },
  {
    method: "post",
    path: "/api/v1/portal",
    operationId: "billingPortal",
    summary: "Stripe Billing Portal URL for managing/cancelling the subscription.",
    auth: "bearer",
    responseType: "CheckoutUrlResponse",
    extraErrors: ["not_found"],
  },
  {
    method: "post",
    path: "/api/v1/fantasy/checkout",
    operationId: "fantasyCheckout",
    summary: "Start a fantasy league-group entry purchase; returns a Stripe URL.",
    auth: "bearer",
    requestType: "FantasyCheckoutRequest",
    responseType: "CheckoutUrlResponse",
    capability: "real_money_fantasy",
  },

  // ── Chat (Discord-style) ───────────────────────────────────────────────────
  {
    method: "get",
    path: "/api/v1/chat/overview",
    capability: "chat",
    operationId: "getChatOverview",
    summary: "Accessible categories/channels + the viewer's level and roles.",
    auth: "bearer",
    responseType: "ChatOverviewResponse",
  },
  {
    method: "get",
    path: "/api/v1/chat/channels/{channelId}/messages",
    capability: "chat",
    operationId: "getChatMessages",
    summary: "Paginated, enriched message history for a channel.",
    auth: "bearer",
    responseType: "ChatMessagesResponse",
    pathParams: ["channelId"],
    query: [
      { name: "before", required: false, description: "Return messages with id < before (older page)." },
      { name: "after", required: false, description: "Return messages with id > after (jump to unread)." },
    ],
    extraErrors: ["forbidden"],
  },
  {
    method: "post",
    path: "/api/v1/chat/channels/{channelId}/messages",
    capability: "chat",
    operationId: "sendChatMessage",
    summary: "Post a message (grants XP/level).",
    auth: "bearer",
    requestType: "SendChatMessageRequest",
    responseType: "SendChatMessageResponse",
    pathParams: ["channelId"],
    extraErrors: ["forbidden"],
  },
  {
    method: "post",
    path: "/api/v1/chat/messages/{messageId}/react",
    capability: "chat",
    operationId: "reactChatMessage",
    summary: "Toggle a reaction; returns the emoji's new count.",
    auth: "bearer",
    requestType: "ChatReactRequest",
    responseType: "ChatReactResponse",
    pathParams: ["messageId"],
    extraErrors: ["forbidden"],
  },
  {
    method: "patch",
    path: "/api/v1/chat/messages/{messageId}",
    capability: "chat",
    operationId: "editChatMessage",
    summary: "Edit your own message.",
    auth: "bearer",
    requestType: "ChatEditRequest",
    responseType: "ChatOkResponse",
    pathParams: ["messageId"],
    extraErrors: ["forbidden"],
  },
  {
    method: "delete",
    path: "/api/v1/chat/messages/{messageId}",
    capability: "chat",
    operationId: "deleteChatMessage",
    summary: "Delete your own message (admins may delete any).",
    auth: "bearer",
    responseType: "ChatOkResponse",
    pathParams: ["messageId"],
    extraErrors: ["forbidden"],
  },
  {
    method: "post",
    path: "/api/v1/chat/channels/{channelId}/read",
    capability: "chat",
    operationId: "markChatRead",
    summary: "Advance the viewer's last-read mark for a channel.",
    auth: "bearer",
    requestType: "ChatReadRequest",
    responseType: "ChatOkResponse",
    pathParams: ["channelId"],
    extraErrors: ["forbidden"],
  },
  {
    method: "post",
    path: "/api/v1/chat/upload",
    capability: "chat",
    operationId: "uploadChatImage",
    summary: "Upload a chat image (multipart) → public URL.",
    auth: "bearer",
    requestContentType: "multipart/form-data",
    fileField: "file",
    responseType: "ChatUploadResponse",
  },
  {
    method: "get",
    path: "/api/v1/chat/leaderboard",
    capability: "chat",
    operationId: "getChatLeaderboard",
    summary: "XP leaderboard.",
    auth: "bearer",
    responseType: "ChatLeaderboardResponse",
  },
  {
    method: "get",
    path: "/api/v1/chat/starboard",
    capability: "chat",
    operationId: "getChatStarboard",
    summary: "Most-starred messages.",
    auth: "bearer",
    responseType: "ChatStarboardResponse",
  },
  {
    method: "get",
    path: "/api/v1/chat/users",
    capability: "chat",
    operationId: "getChatUsers",
    summary: "Enrich a set of user ids for the realtime author cache.",
    auth: "bearer",
    responseType: "ChatUsersResponse",
    query: [{ name: "ids", required: false, description: "Comma-separated user ids." }],
  },
  {
    method: "get",
    path: "/api/v1/chat/members",
    capability: "chat",
    operationId: "searchChatMembers",
    summary: "@mention picker: profiles by username prefix.",
    auth: "bearer",
    responseType: "ChatMembersResponse",
    query: [{ name: "q", required: false, description: "Username prefix." }],
  },
  {
    method: "get",
    path: "/api/v1/chat/search",
    capability: "chat",
    operationId: "searchChatMessages",
    summary: "Full-text search over messages the viewer can read.",
    auth: "bearer",
    responseType: "ChatSearchResponse",
    query: [
      { name: "q", required: true, description: "Search query (websearch syntax)." },
      { name: "channelId", required: false, description: "Restrict to a single channel." },
    ],
  },
  {
    method: "get",
    path: "/api/v1/chat/dms",
    capability: "chat",
    operationId: "listChatDms",
    summary: "The viewer's DM conversations (most recent first).",
    auth: "bearer",
    responseType: "ChatDmsResponse",
  },
  {
    method: "post",
    path: "/api/v1/chat/dms",
    capability: "chat",
    operationId: "openChatDm",
    summary: "Open or create the 1:1 DM with another user.",
    auth: "bearer",
    requestType: "ChatDmOpenRequest",
    responseType: "ChatDmOpenResponse",
    extraErrors: ["not_found"],
  },
  {
    method: "get",
    path: "/api/v1/chat/admin/roles",
    capability: "chat",
    operationId: "listChatRoles",
    summary: "All chat roles (admin).",
    auth: "bearer",
    responseType: "ChatRolesResponse",
    extraErrors: ["forbidden"],
  },
  {
    method: "post",
    path: "/api/v1/chat/admin/roles",
    capability: "chat",
    operationId: "createChatRole",
    summary: "Create a custom assignable role (admin).",
    auth: "bearer",
    requestType: "CreateChatRoleRequest",
    responseType: "CreateChatRoleResponse",
    extraErrors: ["forbidden"],
  },
  {
    method: "post",
    path: "/api/v1/chat/admin/roles/assign",
    capability: "chat",
    operationId: "assignChatRole",
    summary: "Assign or remove a role for a user (admin).",
    auth: "bearer",
    requestType: "ChatRoleAssignRequest",
    responseType: "ChatOkResponse",
    extraErrors: ["forbidden"],
  },
];
