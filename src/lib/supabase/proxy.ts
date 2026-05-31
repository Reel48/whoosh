import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresh the Supabase Auth session on every matched request and propagate any
 * rotated auth cookies onto the response.
 *
 * Unlike the stock Supabase example, this does NOT redirect unauthenticated
 * users: the Whoosh site has public marketing pages (`/`, `/privacy`, `/terms`,
 * …), and per-route protection lives in the section `layout.tsx` files via
 * `requireSession`. The proxy's sole job here is to keep tokens fresh so SSR
 * reads of the user don't randomly log people out.
 *
 * `getClaims()` (not `getSession()`) is called because it verifies the JWT
 * signature — the documented, trustworthy way to touch auth in a proxy.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  // If auth isn't configured yet, pass through untouched rather than 500-ing.
  if (!url || !key) return supabaseResponse;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // Do not run code between createServerClient and getClaims() — a stray await
  // here can desync cookies and randomly log users out.
  await supabase.auth.getClaims();

  return supabaseResponse;
}
