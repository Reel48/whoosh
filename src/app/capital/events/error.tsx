"use client";


export default function EventsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <>
      <main className="mx-auto w-full max-w-2xl px-6 py-24 text-center">
        <h1 className="font-display text-3xl font-black tracking-tight text-ink">
          Events board is down.
        </h1>
        <p className="mt-3 text-sm text-ink/70">
          We couldn&rsquo;t load the open events. Try again in a moment.
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-ink/50">ref: {error.digest}</p>
        )}
        <button
          type="button"
          onClick={() => reset()}
          className="mt-8 tap-press cursor-pointer rounded-full border-theme border-ink bg-ink px-6 py-3 text-sm font-bold text-white-smoke transition-opacity hover:opacity-90"
        >
          Try again
        </button>
      </main>
    </>
  );
}
