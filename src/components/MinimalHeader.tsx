import Image from "next/image";
import Link from "next/link";

/**
 * Bare logo header for error boundaries and other contexts where the full
 * server Nav (which awaits Discord session/admin checks) can't be rendered.
 * Pure client-safe — no server-only imports.
 */
export function MinimalHeader() {
  return (
    <header className="border-b-2 border-ink bg-white-smoke">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="block" aria-label="Whoosh — home">
          <Image
            src="/whoosh-wordmark-ink.svg"
            alt="Whoosh"
            width={1440}
            height={368}
            className="h-6 w-auto"
            priority
          />
        </Link>
      </div>
    </header>
  );
}
