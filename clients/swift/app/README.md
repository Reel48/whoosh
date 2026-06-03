# Whoosh iOS — app source scaffold

Pre-written SwiftUI source for the `whoosh-ios` app. **This is a staging copy** —
there's no Swift toolchain in the backend repo, so these files are authored here
and **copied into the Xcode project** (see
[`../../../docs/ios-getting-started.md`](../../../docs/ios-getting-started.md),
Step 4). They are not compiled or tested in this repo.

## What this implements

The architecture in [`../../../docs/ios-app-architecture.md`](../../../docs/ios-app-architecture.md):
the `loading → unauthenticated → onboarding → home` routing state machine (no
marketing screen), forced first-run profile creation (unique handle + avatar),
and a home screen backed by the `GET /api/v1/home` aggregate — all against the
live `api/v1` backend.

## Two networking choices (and why this scaffold hand-rolls it)

- **This scaffold:** a small hand-written client (`Networking/WhooshAPI.swift` +
  `Models.swift`) over `URLSession` + `Codable`. It injects the `Authorization:
  Bearer` and `X-Client: ios` headers and unwraps the `{ ok, data }` / `{ ok,
  error }` envelope. **It compiles immediately — no build-tool plugin to
  configure** — which is the right starting point for a first iOS build. The
  models mirror `openapi/whoosh-v1.yaml`; Codable ignores fields we don't declare,
  so the models are intentionally partial (just what the screens render).

- **Upgrade path (later):** swap the hand-rolled client for the fully type-safe
  **generated** client described in [`../README.md`](../README.md)
  (Apple's swift-openapi-generator). Do this once the app is running and you want
  every endpoint/type generated from the spec. The `WhooshAPI` facade is the only
  thing the views depend on, so the swap is localized.

## Files

```
Config.swift                 base URL + Supabase keys (fill in)
WhooshApp.swift              @main entry
AppModel.swift               routing state machine
RootView.swift               state → view switch
Auth/SupabaseAuth.swift      supabase-swift wrapper (session/email/Apple/signOut)
Auth/AuthView.swift          sign-in screen
Networking/WhooshAPI.swift   API client (headers + envelope + calls)
Networking/Models.swift      Codable models (mirror the OpenAPI contract)
Onboarding/OnboardingView.swift  handle (live availability) + avatar upload
Home/HomeView.swift          tab shell + /api/v1/home
```

The only files likely to need a tweak on first build are `SupabaseAuth.swift`
and `WhooshAPI.swift` (SDK/URLSession API names vary by version) — a Claude Code
session in the iOS repo can reconcile them against your installed packages.
