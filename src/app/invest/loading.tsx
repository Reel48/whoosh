import { Nav } from "@/components/Nav";
import { Skeleton, SkeletonText } from "@/components/Skeleton";

export default function InvestLoading() {
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-5xl px-6 py-16 sm:py-24">
        <SkeletonText className="h-4 w-40" />
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
        <Skeleton className="mt-8 h-32 rounded-3xl" />
        <Skeleton className="mt-6 h-96 rounded-3xl" />
      </main>
    </>
  );
}
