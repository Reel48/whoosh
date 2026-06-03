# Whoosh Swift API client

A ready-to-use setup for generating a **type-safe Swift client** from the Whoosh
OpenAPI spec ([`openapi/whoosh-v1.yaml`](../../openapi/whoosh-v1.yaml)) using
Apple's [swift-openapi-generator](https://github.com/apple/swift-openapi-generator).

Nothing Swift is built in *this* (Next.js) repo — there's no Swift toolchain here.
This directory is the recipe to drop into the future iOS/SwiftUI repo, where the
`Client` type is generated at build time.

## Setup in the iOS repo

1. Create a SwiftPM package (or target) using [`Package.swift`](./Package.swift)
   as a starting point.
2. Copy [`openapi-generator-config.yaml`](./openapi-generator-config.yaml) and the
   spec (`whoosh-v1.yaml`, renamed to `openapi.yaml`) into the target's source
   directory. Keep the spec in sync — it's regenerated here with
   `npm run openapi:gen`; vendor it via a git submodule or a CI copy step so the
   client never drifts from the backend.
3. Build. The plugin generates `Client`, `Operations`, and `Components` (all the
   request/response types) from the spec.

## Using the client

```swift
import OpenAPIRuntime
import OpenAPIURLSession

// Sends the Supabase JWT as `Authorization: Bearer`.
struct BearerAuth: ClientMiddleware {
    let token: () async -> String?
    func intercept(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL,
                   operationID: String,
                   next: (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?))
        async throws -> (HTTPResponse, HTTPBody?) {
        var request = request
        if let token = await token() {
            request.headerFields[.authorization] = "Bearer \(token)"
        }
        // Tags this client for the per-client capability gating on the backend
        // (src/lib/api/client.ts) — lets betting / real-money-fantasy flows be
        // gated for iOS without forking.
        request.headerFields[.init("X-Client")!] = "ios"
        return try await next(request, body, baseURL)
    }
}

let client = Client(
    serverURL: URL(string: "https://<your-host>")!,   // matches the `servers` block
    transport: URLSessionTransport(),
    middlewares: [BearerAuth(token: { await Supabase.session?.accessToken })]
)

// Example: load the wallet dashboard.
let response = try await client.getWallet()
let wallet = try response.ok.body.json.data
```

## Notes

- The spec's success envelope is `{ ok, data }`; unwrap `.data` for the payload.
  Errors come back as `{ ok: false, error: { code, message } }` (the `ApiError`
  schema) on non-2xx — switch on `error.code` (stable) rather than the message.
- Public endpoints (`/wb/search`, `/capital/ticker`, `/news/scores`) need no
  bearer token; the middleware adding one is harmless for them.
- Purchases on iOS go through StoreKit/IAP, **not** these endpoints — the backend
  credits Whoosh Bucks from the App Store Server Notification webhook
  (`api/v1/iap/apple/notify`), documented under the spec's `webhooks`.
