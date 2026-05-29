import { ComingSoon } from "@/components/app/ComingSoon";

export const metadata = { title: "Fantasy — Whoosh" };

export default function FantasyHome() {
  return (
    <ComingSoon
      eyebrow="Fantasy Football"
      title="Draft day is coming."
      blurb="Fantasy football, built right into Whoosh — leagues with the crew, live scoring, and bragging rights on the line."
      bullets={[
        "Create or join leagues with other Whoosh members",
        "Live scoring and standings through the season",
        "Tie-ins with Capital — put Whoosh Bucks on the line",
      ]}
    />
  );
}
