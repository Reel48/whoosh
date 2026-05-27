export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <span className="mb-6 inline-block rounded-full border border-black/10 px-4 py-1 text-sm font-medium tracking-wide text-black/60 dark:border-white/15 dark:text-white/60">
        Coming soon
      </span>

      <h1 className="text-6xl font-bold tracking-tight sm:text-7xl">Whoosh</h1>

      <p className="mt-6 max-w-xl text-lg text-black/70 dark:text-white/70">
        Premium Discord communities, powered by Whoosh. Subscribe to unlock
        members-only channels and perks in our server.
      </p>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <a
          href="#"
          className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          Join the Discord
        </a>
        <a
          href="#"
          className="rounded-full border border-black/10 px-6 py-3 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/15 dark:hover:bg-white/[.06]"
        >
          View plans
        </a>
      </div>
    </main>
  );
}
