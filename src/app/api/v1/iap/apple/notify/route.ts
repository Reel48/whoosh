import {
  appleIapConfigured,
  creditAppleIapTransaction,
  verifySignedPayload,
} from "@/lib/wb/appleIap";
import { jsonError, jsonOk, readJson } from "@/lib/api/json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * App Store Server Notifications V2 webhook (SCAFFOLD). Mirrors the structure of
 * `src/app/api/webhook/stripe/route.ts`: a server-to-server callback authed by
 * the payload's own signature (JWS), not a user session — so no bearer auth.
 *
 * Until App Store Connect is configured ({@link appleIapConfigured}) this returns
 * 501 and credits nothing. Once configured, `verifySignedPayload` decodes the
 * transaction and `creditAppleIapTransaction` credits WB idempotently.
 * TODO(apple-setup): finish JWS verification + map the full notification types.
 */
export async function POST(req: Request) {
  if (!appleIapConfigured()) {
    return jsonError("internal", "Apple IAP is not configured yet.", 501);
  }

  const body = await readJson<{ signedPayload?: string }>(req);
  if (!body?.signedPayload) return jsonError("validation", "signedPayload required.");

  const verified = await verifySignedPayload(body.signedPayload);
  if (!verified.ok) return jsonError("validation", `Unverified payload: ${verified.reason}`);

  const result = await creditAppleIapTransaction(verified.tx);
  return jsonOk({ credited: result.credited, reason: result.reason ?? null });
}
