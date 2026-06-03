# Whoosh iOS — getting started (first-time iOS dev)

A concrete, click-by-click runbook to go from nothing to a running app. Pairs
with the architecture in [`ios-app-architecture.md`](./ios-app-architecture.md).
Everything through **Step 6 works in the Simulator with a free Apple ID** — you
do **not** need the paid Developer Program yet.

The Swift source for the app is pre-written in
[`../clients/swift/app/`](../clients/swift/app/) — you'll copy it into the
project in Step 4.

---

## Step 0 — Install Xcode (do this first; it's a big download)

- Mac App Store → search **Xcode** → Install (~15 GB, can take an hour).
- Open it once; accept the license; let it install "additional components".
- Sign in with your Apple ID: **Xcode → Settings → Accounts → +** → Apple ID.
  (Free is fine for now. Your pending Developer Program membership will attach to
  this same Apple ID once approved.)

## Step 1 — Create the GitHub repo

- Make a new **empty** repo named `whoosh-ios` (separate from the backend).
- Clone it locally, e.g. `~/whoosh-ios`.

## Step 2 — Create the Xcode project (inside the repo)

File → **New → Project…** → **iOS → App** → Next, then:

| Field | Value |
|---|---|
| Product Name | `Whoosh` |
| Team | None (until the paid account is approved) |
| Organization Identifier | `com.reel48` (→ bundle id `com.reel48.Whoosh`) |
| Interface | **SwiftUI** |
| Language | **Swift** |
| Storage | None |
| Testing System | None (add later) |

Save it **into the `whoosh-ios` folder** (uncheck "create git repository" — you
already have one). You'll get a `Whoosh.xcodeproj` plus `WhooshApp.swift` and
`ContentView.swift`. Press **▶︎ (⌘R)** — a blank app should launch in the
Simulator. That confirms the loop works.

Add a Swift `.gitignore` at the repo root (GitHub's Swift template), then commit.

## Step 3 — Add the one package dependency (Supabase)

File → **Add Package Dependencies…** → paste the URL → Add Package:

- `https://github.com/supabase/supabase-swift`  → add the **Supabase** library to
  the Whoosh target.

That's the only package the starter scaffold needs (the API client is
hand-written — see [`../clients/swift/app/README.md`](../clients/swift/app/README.md)
for why, and the generated-client upgrade path).

## Step 4 — Add the app source files

In Finder, copy everything from this repo's [`clients/swift/app/`](../clients/swift/app/)
into your Xcode project's `Whoosh/` group folder (keep the subfolders:
`Networking/`, `Auth/`, `Onboarding/`, `Home/`). Then in Xcode: right-click the
`Whoosh` group → **Add Files to "Whoosh"…** → select the copied files/folders →
ensure **"Copy items if needed"** and **target = Whoosh** are checked.

Delete the auto-generated `ContentView.swift` (the scaffold's `RootView` replaces
it). The scaffold's `WhooshApp.swift` replaces the auto-generated one — when Xcode
asks to replace, say yes.

## Step 5 — Fill in your config

Open `Config.swift` and set the three values (all non-secret / publishable):

- `apiBaseURL` — your deployed backend host, e.g. `https://app.whoosh.…`
  (the same origin the web app runs on; the OpenAPI `servers` URL).
- `supabaseURL` — `NEXT_PUBLIC_SUPABASE_URL` from the backend
  (`https://yjmohosxtemjamwrsffw.supabase.co`).
- `supabaseAnonKey` — the Supabase **publishable/anon** key
  (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). This is safe to ship in the app.

> For local testing against the backend dev server, point `apiBaseURL` at your
> Mac's LAN address (e.g. `http://192.168.x.x:3000`) — `localhost` won't reach
> the host from the Simulator reliably for all cases; LAN IP is safest.

## Step 6 — Build & run

Press **⌘R**. You should land on the **sign-in screen** (no marketing page).
Create an account with email → you'll be routed into **onboarding** (pick a
handle + photo) → then **home**. That's the full first-run flow against your live
backend.

**If you hit compile errors:** that's normal on a first integration — Supabase
SDK method names shift slightly between versions. Open a **Claude Code session in
the `whoosh-ios` repo** and ask it to fix the build; it can run `xcodebuild`,
read the errors, and reconcile against your installed package version. The two
files most likely to need a tweak are `Auth/SupabaseAuth.swift` and
`Networking/WhooshAPI.swift`; the SwiftUI views are standard.

---

## Step 7 — Capabilities (needs the paid Developer Program)

Once your membership is approved, in Xcode select the target → **Signing &
Capabilities**:

- Set **Team** to your team; enable **"Automatically manage signing"**.
- **+ Capability → Sign in with Apple.**
- In the **Supabase dashboard** → Authentication → Providers → enable **Apple**,
  and add your app's bundle id / configure the provider (follow Supabase's "Sign
  in with Apple" guide). Then the `signInWithApple()` path in the scaffold works.
- For payments, add the **External Purchase Link** entitlement and the
  `SKExternalPurchaseLink` Info.plist key — see [`ios-payments.md`](./ios-payments.md).

## Step 8 — Real device → TestFlight → App Store

- **Device:** plug in your iPhone, select it as the run target, ⌘R. (First time:
  trust the developer cert in iOS Settings → General → VPN & Device Management.)
- **TestFlight:** in Xcode, Product → **Archive** → Distribute → App Store
  Connect. Add testers in App Store Connect → TestFlight.
- **App Store:** create the app listing in App Store Connect (screenshots,
  description, **17+ age rating** for the simulated-gambling genre, privacy
  labels), attach the build, submit for review. Request the **External Purchase
  Link entitlement** early — its approval is the long pole.

---

## How the day-to-day loop works (vs. web)

- **You** keep Xcode open and press ⌘R to run / use **SwiftUI Previews** (the
  canvas) for fast per-view iteration.
- **Claude Code** (a session inside `whoosh-ios`) writes/edits the `.swift` files
  and can build via `xcodebuild` and read errors. It can't click the Xcode GUI or
  see the canvas — so you drive visual/interaction checks, Claude drives the code.
- There's no hot-reload-to-browser; Previews + ⌘R are the equivalents.

## File map (what the scaffold gives you)

| File | Role |
|---|---|
| `Config.swift` | Base URL + Supabase keys |
| `WhooshApp.swift` | `@main` entry; owns `AppModel`, shows `RootView` |
| `AppModel.swift` | The routing state machine (loading → auth → onboarding → home) |
| `RootView.swift` | Switches views on `AppModel.state` |
| `Auth/SupabaseAuth.swift` | Wraps supabase-swift (session, email, Apple, signOut) |
| `Auth/AuthView.swift` | Email + Sign in with Apple screen |
| `Networking/WhooshAPI.swift` | Hand-rolled API client (bearer + `X-Client: ios`, envelope) |
| `Networking/Models.swift` | Codable models mirroring the OpenAPI contract |
| `Onboarding/OnboardingView.swift` | Username (live check) + avatar upload |
| `Home/HomeView.swift` | Tab shell backed by `GET /api/v1/home` |
