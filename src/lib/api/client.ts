import { NextResponse } from "next/server";
import { jsonError, type ApiErr } from "@/lib/api/json";

/**
 * Per-client capability gating for the v1 API.
 *
 * The same backend serves web and (future) native clients, but Apple's App
 * Review applies rules that don't touch the web — notably extra scrutiny of
 * betting/contest mechanics (Guideline 5.3) and the real-money Fantasy entry
 * fees. This module is the hook that lets those flows be gated *per client*
 * without forking the codebase: the route asks `requireCapability`, and the
 * on/off policy lives in one config table below.
 *
 * The actual policy is a product/App-Review decision made later — the default
 * keeps everything enabled so nothing changes for the web app today.
 */
export type ClientKind = "web" | "ios" | "android";
export type Capability = "wagering" | "real_money_fantasy" | "chat";

/** Identify the calling client from the `X-Client` header (defaults to web). */
export function clientFromReq(req: Request): ClientKind {
  const v = (req.headers.get("x-client") ?? "").toLowerCase();
  return v === "ios" ? "ios" : v === "android" ? "android" : "web";
}

// Which clients may exercise each capability. Flip an entry to `false` to gate
// it (e.g. set `wagering.ios = false` if App Review requires it). Web stays true.
const CAPABILITY_POLICY: Record<Capability, Record<ClientKind, boolean>> = {
  wagering: { web: true, ios: true, android: true },
  real_money_fantasy: { web: true, ios: true, android: true },
  // Chat/DMs are a native-app feature only — never exposed on the web client.
  chat: { web: false, ios: true, android: true },
};

export function clientAllows(client: ClientKind, capability: Capability): boolean {
  return CAPABILITY_POLICY[capability][client];
}

/**
 * Returns a 403 `forbidden` envelope if the calling client may not use
 * `capability`, or `null` if allowed. Use like the auth guards:
 *
 * ```ts
 * const gate = requireCapability(req, "wagering");
 * if (gate) return gate;
 * ```
 */
export function requireCapability(
  req: Request,
  capability: Capability,
): NextResponse<ApiErr> | null {
  const client = clientFromReq(req);
  if (clientAllows(client, capability)) return null;
  return jsonError("forbidden", `This action is not available on ${client}.`);
}
