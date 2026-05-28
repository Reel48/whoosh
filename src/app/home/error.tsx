"use client";

import { MinimalHeader } from "@/components/MinimalHeader";

export default function HomeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <>
      <MinimalHeader />
      <main className="mx-auto w-full max-w-2xl px-6 py-24 text-center">
        <h1 className="font-heading text-3xl font-black tracking-tight text-ink">
          Couldn&rsquo;t load your home.
        </h1>
        <p className="mt-3 text-sm text-ink/70">
          A backend service may be down. Try again in a moment.
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-ink/50">ref: {error.digest}</p>
        )}
        <button
          type="button"
          onClick={() => reset()}
          className="tap-press mt-8 cursor-pointer rounded-full border-2 border-ink bg-ink px-6 py-3 text-sm font-bold text-white-smoke"
        >
          Try again
        </button>
      </main>
    </>
  );
}
