"use client";


export default function WalletError({
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
          Wallet hit a snag.
        </h1>
        <p className="mt-3 text-sm text-ink/70">
          Something went wrong loading your portfolio. Try again — and if it
          keeps happening, ping us in Discord.
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
