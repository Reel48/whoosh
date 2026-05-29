import { ComingSoon } from "@/components/app/ComingSoon";

export const metadata = { title: "Pool — Whoosh" };

export default function PoolHome() {
  return (
    <ComingSoon
      eyebrow="Pool"
      title="Pool resources with the crew."
      blurb="Chip in together and go further. Pooled funds for group buys, shared bets, and crew-run pots — all tracked transparently."
      bullets={[
        "Start a pool and invite members to contribute",
        "Transparent tracking of every contribution and payout",
        "Powered by Whoosh Bucks from your Capital wallet",
      ]}
    />
  );
}
