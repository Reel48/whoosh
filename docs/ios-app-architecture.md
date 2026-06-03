# Whoosh iOS app — architecture & first-run flow

Spec for the SwiftUI app (built in a **separate repo** — no Swift toolchain in
this backend repo). It consumes the generated OpenAPI client
([`clients/swift/`](../clients/swift/README.md)) against the `api/v1` surface
([`openapi/whoosh-v1.yaml`](../openapi/whoosh-v1.yaml)).

Two deliberate differences from the web app:
1. **No marketing landing.** The app opens straight into the logged-in home.
2. **Forced first-run profile creation.** A new user must pick a unique `@handle`
   and upload an avatar before reaching home.

## Routing state machine (the core)

`RootView` observes an `AppModel` that resolves to one of four states. There is
**no marketing/landing screen** — unauthenticated users go straight to sign-in.

```
              ┌──────────┐
              │ loading  │  check Supabase session (Supabase Swift SDK)
              └────┬─────┘
        no session │ session
        ┌──────────┴───────────┐
        ▼                      ▼
┌───────────────┐     GET /api/v1/account
│ unauthenticated│            │
│   AuthView     │     onboarded == false │ true
└───────────────┘     ┌───────┴────────┐
        ▲             ▼                ▼
        │      ┌──────────────┐  ┌──────────┐
        └──────┤ OnboardingView│  │ HomeView │
   sign out    └──────┬───────┘  └──────────┘
                      │ profile saved
                      └──────────▶ HomeView
```

```swift
enum AppState: Equatable { case loading, unauthenticated, onboarding, home }

@MainActor final class AppModel: ObservableObject {
    @Published var state: AppState = .loading
    private let api: Client            // generated OpenAPI client
    private let auth: SupabaseAuth     // wraps supabase-swift

    func bootstrap() async {
        guard (try? await auth.currentSession()) != nil else { state = .unauthenticated; return }
        // The account call carries the bearer token via the auth middleware.
        if let account = try? await api.getAccount().ok.body.json.data {
            state = account.onboarded ? .home : .onboarding
        } else {
            state = .unauthenticated   // token rejected → re-auth
        }
    }

    func didAuthenticate() async { await bootstrap() }     // re-run the branch
    func didFinishOnboarding() { state = .home }
    func signOut() async { try? await auth.signOut(); state = .unauthenticated }
}
```

```swift
struct RootView: View {
    @StateObject var model = AppModel()
    var body: some View {
        switch model.state {
        case .loading:        ProgressView().task { await model.bootstrap() }
        case .unauthenticated: AuthView(onAuth: { Task { await model.didAuthenticate() } })
        case .onboarding:     OnboardingView(onDone: model.didFinishOnboarding)
        case .home:           HomeView()
        }
    }
}
```

## AuthView — email + Sign in with Apple

- Use **supabase-swift** for auth. Offer **email/password** and **Sign in with
  Apple** (`signInWithIdToken(provider: .apple, ...)`).
- **Apple Guideline 4.8:** because we offer no other social login at sign-in
  (Discord is linked later, in Settings), including Sign in with Apple satisfies
  the requirement. Apple may withhold name/email (Hide My Email) — which is
  exactly why the next step (profile creation) is mandatory.
- On success, the Supabase session yields the JWT the API middleware sends as
  `Authorization: Bearer` (see `clients/swift/README.md`). Then call
  `model.didAuthenticate()`.

## OnboardingView — create your profile (first run only)

Reached only when `account.onboarded == false`. Cannot be skipped.

1. **Username** — a text field bound to a debounced availability check:
   `GET /api/v1/account/username-available?handle=…` → `{ available, normalized, reason }`.
   Show `normalized` as a hint and `reason` when taken/invalid. Enforce the same
   format client-side: `^[A-Za-z0-9_]{3,20}$`.
2. **Avatar** — `PhotosPicker` → upload via `POST /api/v1/account/avatar`
   (multipart `file`) → returns `{ avatarUrl }`. Optional but encouraged; the
   server falls back to initials if skipped.
3. **"Enter Whoosh"** — `POST /api/v1/account/profile { username }` sets the
   handle and marks the account onboarded. On `200`, call
   `model.didFinishOnboarding()`. Handle `409 conflict` (handle taken between
   check and submit) by re-prompting.

## HomeView — the logged-in landing

- Backed by a single call: `GET /api/v1/home` → `{ capital, board, topArticle,
  fantasyLink, sections }` (mirrors the web home; one round-trip on launch).
- A `TabView` shell over the sections (`Capital`, `Fantasy`, `Pool`, `News`) plus
  an `Account` tab. Drive tabs from `home.sections` (each `Section` carries
  `key`, `label`, `live`).
- **Account/Settings** hosts: link a Discord account, manage subscription
  (`POST /api/v1/portal` → open URL), and edit handle/avatar (reuses the
  onboarding endpoints).

## Payments

All purchases are **web Stripe link-out**, not in-app — see
[`ios-payments.md`](./ios-payments.md). Call the relevant `…/buy`, `…/checkout`,
`…/fantasy/checkout`, or `…/portal` endpoint, receive `{ url }`, and open it via
the External Purchase Link. The Stripe webhook credits the account; refresh
`GET /api/v1/home` (or `/account`) on return.

## Networking conventions

- Generated client + two middlewares (in `clients/swift/README.md`): bearer JWT
  from the Supabase session, and `X-Client: ios` (drives the backend's
  per-client capability gating — e.g. `real_money_fantasy`).
- Every response is the `{ ok, data }` envelope; unwrap `.data`. Errors are
  `{ ok: false, error: { code, message } }` — switch on the stable `code`
  (`unauthorized`, `conflict`, `insufficient_funds`, `not_entitled`, …), not the
  message. A `401` anywhere → drop to `unauthenticated`.

## Out of scope (later)

APNs push, Widgets/Live Activities, Face ID gate, offline caching, Android.
