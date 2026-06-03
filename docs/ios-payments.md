# iOS payments — web Stripe link-out

**Decision:** the iOS app does **not** check out in-app. All payments (Whoosh
Bucks, premium subscription, fantasy entry) go through the **existing web Stripe
checkout**, opened in the browser via Apple's **External Purchase Link**. No
Apple In-App Purchase, no Apple commission, and **no Apple server credentials**
are involved on the backend. Initial launch is **US-only**.

This works because of the April 2025 *Epic v. Apple* ruling, which lets US apps
link out to external web purchases for digital goods commission-free. Outside the
US this is more restricted (see [Going global](#going-global)).

## How it works

```
iOS app                         backend (this repo)              Stripe
  │  POST /api/v1/wb/buy  ─────────▶  createWbPurchaseCheckoutUrl
  │  (bearer JWT)                     (reuses the web flow)  ───▶  create Checkout Session
  │  ◀──── { url } ───────────────────────────────────────────   hosted URL
  │
  │  open `url` via SKExternalPurchaseLink (Safari) ──────────▶  user pays on Stripe
  │                                                              │
  │                          POST /api/webhook/stripe  ◀─────────  checkout.session.completed
  │                          (existing) → creditLedger / premium
  │
  │  return to app, GET /api/v1/wb/wallet → balance updated
```

The backend payment logic is **already built and live** — these endpoints just
hand the iOS client the same hosted URL the web app redirects to, and the
existing `src/app/api/webhook/stripe/route.ts` credits the account on completion
(idempotent via `(refKind, refId)` in `src/lib/wb/ledger.ts`).

## The endpoints (all bearer-authed, return `{ url }`)

| Endpoint | Purpose | Reuses |
|---|---|---|
| `POST /api/v1/wb/buy` | Buy Whoosh Bucks (`{ amount }` USD) | `src/lib/wb/purchase.ts` |
| `POST /api/v1/checkout` | Premium subscription (`{ interval }`) | `src/lib/checkout.ts` |
| `POST /api/v1/portal` | Manage/cancel subscription (Billing Portal) | `src/lib/stripe.ts` |
| `POST /api/v1/fantasy/checkout` | League entry (`{ groupKey }`) | `src/lib/fantasy/checkout.ts` |

All four are in the OpenAPI spec (`openapi/whoosh-v1.yaml`) and the generated
Swift client. `fantasy/checkout` is gated by the `real_money_fantasy` capability
(`src/lib/api/client.ts`) — see [Fantasy caveat](#fantasy-entry-caveat).

## iOS app side (in the future SwiftUI repo)

1. **Entitlement:** add `com.apple.developer.storekit.external-purchase-link` and
   request it from Apple (account-gated — see checklist).
2. **Info.plist:** declare the external purchase link with the allowed country:
   ```xml
   <key>SKExternalPurchaseLink</key>
   <dict>
     <key>us</key>
     <string>https://<your-host></string>
   </dict>
   ```
3. **Flow:** call the relevant endpoint → receive `{ url }` → open it with
   `ExternalPurchaseLink` / `openURL` (per Apple's StoreKit External Purchase API)
   → on return, refresh `GET /api/v1/wb/wallet` (or `/account`).
4. **Return UX (optional polish):** the Stripe `success_url` currently lands on a
   web page (`/capital/wallet`, `/thanks`). Later we can pass an app universal
   link / custom scheme so Safari bounces the user back into the app
   automatically — a small change to the `createCheckout*` helpers.

## When-approved checklist (Apple account)

- [ ] Register the **App ID / bundle ID**; create the **App Store Connect** app record.
- [ ] Apply for the **External Purchase Link Entitlement** (US). Approval can take time — request early.
- [ ] Add the entitlement + `SKExternalPurchaseLink` Info.plist (host = prod domain) to the iOS app.
- [ ] Set `NEXT_PUBLIC_SITE_URL` to the production host (the checkout helpers build success/cancel URLs from it).
- [ ] Sandbox-test the full loop: app → endpoint → Safari → Stripe test card → webhook credits → wallet refresh.
- [ ] (Separate) APNs auth key if/when push notifications are added.

**No `APPLE_*` env vars are needed for payments** — those only exist for the
dormant IAP path below.

## Going global

US-only is the safe lane for link-out. For other storefronts, Apple may still
require IAP or charge commission on external links (EU operates under the DMA
with different terms). Before expanding beyond the US, re-confirm Apple's current
terms per region — that may mean enabling the dormant IAP path.

## Dormant IAP path

The earlier-built Apple IAP seam — `src/lib/wb/appleIap.ts` and
`src/app/api/v1/iap/apple/notify/route.ts` — is **retained but inactive** (returns
`501` until `APPLE_*` env is configured). It's the fallback if a future global
launch requires in-app purchase in some regions. Leaving it in place costs
nothing and keeps that option one configuration away.
