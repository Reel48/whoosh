import { NextResponse, type NextRequest } from "next/server";
import { searchSymbols } from "@/lib/wb/symbolSearch";

export const runtime = "edge";

/**
 * Symbol typeahead for the invest view. Logic lives in `searchSymbols` so the
 * JSON API (`/api/v1/wb/search`) returns identical results.
 */
export async function GET(req: NextRequest) {
  const results = await searchSymbols(req.nextUrl.searchParams.get("q") ?? "");
  return NextResponse.json({ results });
}
