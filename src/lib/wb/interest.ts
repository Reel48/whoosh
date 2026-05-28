import { supabase } from "@/lib/supabase";

const FRED_SERIES = "DTB3"; // 3-month T-bill secondary market rate (daily, %)

export type InterestRate = {
  effectiveDate: string;
  apyBps: number;
  source: string;
};

/** Most recent rate on or before today. */
export async function getCurrentRate(): Promise<InterestRate | null> {
  const { data, error } = await supabase()
    .from("interest_rate")
    .select("effective_date, apy_bps, source")
    .lte("effective_date", new Date().toISOString().slice(0, 10))
    .order("effective_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getCurrentRate failed: ${error.message}`);
  if (!data) return null;
  return {
    effectiveDate: data.effective_date,
    apyBps: data.apy_bps,
    source: data.source,
  };
}

/** Admin-set override. Source typically 'admin_override' or 'fred_dtb3'. */
export async function setRate(
  effectiveDate: string,
  apyBps: number,
  source: string,
): Promise<void> {
  if (!Number.isInteger(apyBps) || apyBps < 0 || apyBps > 5000) {
    throw new Error("apyBps must be 0..5000");
  }
  const { error } = await supabase().rpc("fn_set_interest_rate", {
    p_effective_date: effectiveDate,
    p_apy_bps: apyBps,
    p_source: source,
  });
  if (error) throw new Error(`setRate failed: ${error.message}`);
}

/** Accrue interest for a given date. Returns number of accrual rows inserted. */
export async function accrueInterest(date: string): Promise<number> {
  const { data, error } = await supabase().rpc("fn_accrue_interest", { p_date: date });
  if (error) throw new Error(`accrueInterest failed: ${error.message}`);
  return Number(data ?? 0);
}

/** Post accrued interest up through a date. Returns number of users credited. */
export async function postInterest(throughDate: string): Promise<number> {
  const { data, error } = await supabase().rpc("fn_post_interest", {
    p_through_date: throughDate,
  });
  if (error) throw new Error(`postInterest failed: ${error.message}`);
  return Number(data ?? 0);
}

/** Total WB outstanding across all wallets, in cents. */
export async function getTotalOutstanding(): Promise<number> {
  const { data, error } = await supabase().rpc("fn_total_wb_outstanding");
  if (error) throw new Error(`getTotalOutstanding failed: ${error.message}`);
  return Number(data ?? 0);
}

/**
 * Pull the most recent DTB3 (3-mo T-bill secondary market) observation from
 * FRED and convert percentage points into basis points. Used as a SPAXX yield
 * proxy. Requires FRED_API_KEY (free tier: register at fred.stlouisfed.org).
 *
 * Returns null on network failure or if FRED has no fresh observation — the
 * caller should fall back to the last known rate.
 */
export async function fetchFredRateBps(): Promise<{
  apyBps: number;
  observationDate: string;
} | null> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    console.warn("FRED_API_KEY not set — skipping FRED rate refresh.");
    return null;
  }
  const url = new URL("https://api.stlouisfed.org/fred/series/observations");
  url.searchParams.set("series_id", FRED_SERIES);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("sort_order", "desc");
  url.searchParams.set("limit", "1");

  let res: Response;
  try {
    res = await fetch(url.toString(), { cache: "no-store" });
  } catch (e) {
    console.error("FRED fetch failed:", e);
    return null;
  }
  if (!res.ok) {
    console.error(`FRED fetch failed: ${res.status} ${await res.text()}`);
    return null;
  }
  const json = (await res.json()) as {
    observations?: { date: string; value: string }[];
  };
  const obs = json.observations?.[0];
  // FRED returns "." for missing observations (weekends, holidays).
  if (!obs || obs.value === "." || obs.value === "") return null;
  const pct = Number(obs.value);
  if (!Number.isFinite(pct) || pct < 0) return null;
  return {
    apyBps: Math.round(pct * 100), // 4.25% → 425 bps
    observationDate: obs.date,
  };
}
