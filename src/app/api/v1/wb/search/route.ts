import { type NextRequest } from "next/server";
import { searchSymbols } from "@/lib/wb/symbolSearch";
import { jsonOk } from "@/lib/api/json";
import type { SearchResponse } from "@/lib/api/contracts";

export const runtime = "edge";

/** Public symbol typeahead. Shares `searchSymbols` with the form route. */
export async function GET(req: NextRequest) {
  const results = await searchSymbols(req.nextUrl.searchParams.get("q") ?? "");
  return jsonOk<SearchResponse>({ results });
}
