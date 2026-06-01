import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Capital's landing is the wallet, which is the real dashboard (equity,
 * allocation, lifetime returns, leaderboard, positions, activity). The old
 * lightweight "Overview" page was retired in favor of it, so /capital just
 * forwards to /capital/wallet.
 */
export default function CapitalIndex() {
  redirect("/capital/wallet");
}
