// push-apns — send an APNs push for a chat notification row.
//
// Invoked by the `trg_notify_push` trigger (via pg_net). Auth is a shared secret
// header `x-webhook-secret` (== WEBHOOK_SECRET), so no Supabase key is handled by
// the trigger. Body: { record: <notification row> }. Looks up the recipient's
// device tokens and pushes via token-based APNs (ES256 JWT signed from the .p8).
// Stale tokens (410 / BadDeviceToken) are pruned.
//
// Edge Function secrets: APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID,
//   APNS_PRIVATE_KEY (.p8 as base64 OR raw PEM), APNS_ENV ('production'|'sandbox'),
//   WEBHOOK_SECRET. SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are auto-injected.
//
// Deployed with verify_jwt = false (auth is the shared-secret header).
import { createClient } from "jsr:@supabase/supabase-js@2";

const enc = new TextEncoder();
const b64url = (data: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof data === "string" ? enc.encode(data)
    : data instanceof Uint8Array ? data : new Uint8Array(data);
  let s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

function pemToDer(pem: string): Uint8Array {
  const body = pem.replace(/-----BEGIN [^-]+-----/, "").replace(/-----END [^-]+-----/, "").replace(/\s+/g, "");
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

let cachedKey: CryptoKey | null = null;
let cachedJwt: { token: string; at: number } | null = null;

async function apnsJwt(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && now - cachedJwt.at < 2400) return cachedJwt.token;
  const keyId = Deno.env.get("APNS_KEY_ID")!;
  const teamId = Deno.env.get("APNS_TEAM_ID")!;
  if (!cachedKey) {
    let pem = Deno.env.get("APNS_PRIVATE_KEY")!;
    if (!pem.includes("BEGIN")) pem = atob(pem); // base64-wrapped .p8
    cachedKey = await crypto.subtle.importKey(
      "pkcs8", pemToDer(pem), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  }
  const header = b64url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const payload = b64url(JSON.stringify({ iss: teamId, iat: now }));
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" }, cachedKey, enc.encode(`${header}.${payload}`));
  const token = `${header}.${payload}.${b64url(sig)}`;
  cachedJwt = { token, at: now };
  return token;
}

Deno.serve(async (req) => {
  try {
    if (req.headers.get("x-webhook-secret") !== Deno.env.get("WEBHOOK_SECRET")) {
      return new Response("unauthorized", { status: 401 });
    }
    const { record } = await req.json();
    if (!record?.discord_user_id) return new Response("no recipient", { status: 200 });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: tokens } = await supabase
      .from("device_token").select("token").eq("user_id", record.discord_user_id);
    if (!tokens?.length) return new Response("no devices", { status: 200 });

    const jwt = await apnsJwt();
    const bundle = Deno.env.get("APNS_BUNDLE_ID")!;
    const host = (Deno.env.get("APNS_ENV") ?? "production") === "sandbox"
      ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com";
    const payload = JSON.stringify({
      aps: { alert: { title: record.title, body: record.body ?? "" }, sound: "default", "mutable-content": 1 },
      href: record.href ?? null,
      meta: record.metadata ?? {},
    });

    const results = await Promise.all((tokens as { token: string }[]).map(async ({ token }) => {
      const res = await fetch(`${host}/3/device/${token}`, {
        method: "POST",
        headers: {
          authorization: `bearer ${jwt}`,
          "apns-topic": bundle,
          "apns-push-type": "alert",
          "content-type": "application/json",
        },
        body: payload,
      });
      if (res.status === 410 || res.status === 400) {
        await supabase.from("device_token").delete().eq("token", token);
      }
      return { token: token.slice(0, 8), status: res.status };
    }));

    return new Response(JSON.stringify({ sent: results.length, results }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
