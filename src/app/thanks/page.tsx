import Image from "next/image";

const DISCORD_INVITE = "https://discord.gg/zzP8nFFzQt";

export const metadata = {
  title: "You're in — Whoosh",
};

function Bolt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 375 375" className={className} aria-hidden="true" fill="currentColor">
      <path d="M 212.199219 168.605469 L 269.113281 163.523438 C 269.796875 163.464844 270.253906 164.054688 269.84375 164.480469 C 227.035156 208.949219 179.03125 255.128906 125.265625 302.070312 C 96.945312 326.792969 68.757812 350.226562 40.90625 372.402344 C 40.285156 372.894531 39.234375 372.339844 39.617188 371.71875 C 58.9375 340.503906 79.519531 308.625 101.457031 276.179688 C 118.152344 251.484375 134.945312 227.484375 151.757812 204.175781 C 152.0625 203.75 151.621094 203.242188 150.996094 203.289062 C 130.617188 204.820312 110.238281 206.351562 89.859375 207.878906 C 89.167969 207.933594 88.726562 207.320312 89.160156 206.90625 C 123.707031 173.6875 161.773438 139.226562 203.628906 104.078125 C 247.824219 66.964844 291.429688 33.128906 333.578125 2.390625 C 334.234375 1.910156 335.246094 2.542969 334.792969 3.144531 C 293.671875 57.996094 252.550781 112.851562 211.429688 167.707031 C 211.105469 168.136719 211.558594 168.664062 212.199219 168.605469 Z M 212.199219 168.605469 " />
    </svg>
  );
}

export default function Thanks() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-clear-white px-6 py-24 text-center text-smooth-black">
      <Image
        src="/whoosh-wordmark-asphalt.svg"
        alt="Whoosh"
        width={1440}
        height={368}
        className="h-7 w-auto"
        priority
      />
      <Bolt className="mt-12 h-12 w-12 text-real-blue" />
      <h1 className="mt-6 font-heading text-4xl font-bold tracking-tight sm:text-5xl">
        You&rsquo;re in.
      </h1>
      <p className="mt-4 max-w-md text-lg text-smooth-black/60">
        Welcome to Whoosh Premium. Hop into Discord and the members-only
        channels are yours.
      </p>
      <a
        href={DISCORD_INVITE}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-9 inline-flex items-center justify-center gap-2 rounded-full bg-real-blue px-7 py-3.5 text-base font-medium text-clear-white transition-colors hover:bg-smudged-blue"
      >
        <Bolt className="h-5 w-5" /> Open Discord
      </a>
      <a
        href="/"
        className="mt-4 text-sm text-smooth-black/60 underline-offset-2 hover:underline"
      >
        Back to home
      </a>
    </main>
  );
}
