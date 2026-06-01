"use client";

export default function NewsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16 text-center">
      <h1 className="font-display text-3xl font-black tracking-tight text-ink">
        Couldn&apos;t load the news.
      </h1>
      <p className="mt-3 text-sm text-ink/70">
        ESPN&apos;s feed may be slow to respond. This is read-only — just try again in a moment.
      </p>
      {error.digest && <p className="mt-1 text-xs text-ink/40">ref: {error.digest}</p>}
      <button
        type="button"
        onClick={() => reset()}
        className="mt-8 inline-flex items-center rounded-theme border-theme border-ink bg-ink px-5 py-2 text-sm font-bold text-white"
      >
        Try again
      </button>
    </main>
  );
}
