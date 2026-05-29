"use client";

export default function FantasyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="ftb-page" style={{ textAlign: "center" }}>
      <h1 className="text-h1 ftb-mt-lg">Fantasy is on a timeout.</h1>
      <p className="text-body-sm ftb-mt">
        Sleeper may be slow to respond. Standings and scores are read-only — just
        try again in a moment.
      </p>
      {error.digest && <p className="text-caption ftb-mt-1">ref: {error.digest}</p>}
      <button type="button" onClick={() => reset()} className="btn btn-primary ftb-mt-lg">
        Try again
      </button>
    </main>
  );
}
