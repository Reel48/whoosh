import { LOCAL_SUPABASE_URL, LOCAL_SERVICE_ROLE_KEY } from "./local";

/**
 * Fail fast with a clear message if the local Supabase stack isn't up, instead
 * of letting every test die with an opaque connection error.
 */
export default async function setup() {
  try {
    const res = await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/`, {
      headers: {
        apikey: LOCAL_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${LOCAL_SERVICE_ROLE_KEY}`,
      },
    });
    // PostgREST answers the root with 200; anything that responds is "up".
    if (res.status >= 500) throw new Error(`PostgREST returned ${res.status}`);
  } catch (e) {
    throw new Error(
      `Local Supabase is not reachable at ${LOCAL_SUPABASE_URL}.\n` +
        "Start it first:  npx supabase start  (then  npx supabase db reset).\n" +
        `Underlying error: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}
