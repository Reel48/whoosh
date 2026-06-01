import { Skeleton } from "@/components/Skeleton";

export default function NewsLoading() {
  return (
    <main className="flex flex-1 flex-col py-2">
      {/* sport chips */}
      <div className="mx-auto flex w-full max-w-4xl gap-2 overflow-hidden px-6 py-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-20 shrink-0 rounded-theme" />
        ))}
      </div>
      {/* article cards */}
      <div className="mx-auto grid w-full max-w-4xl gap-3 px-6 pb-16">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-theme" />
        ))}
      </div>
    </main>
  );
}
