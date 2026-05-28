import { Nav } from "@/components/Nav";
import { Skeleton, SkeletonText } from "@/components/Skeleton";

export default function HomeLoading() {
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-3xl px-6 py-8 sm:py-12">
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-full" />
          <div className="flex-1">
            <SkeletonText className="h-3 w-32" />
            <SkeletonText className="mt-2 h-5 w-40" />
          </div>
        </div>
        <Skeleton className="mt-6 h-40 rounded-3xl" />
        <Skeleton className="mt-6 h-28 rounded-3xl" />
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-28 rounded-3xl" />
          <Skeleton className="h-28 rounded-3xl" />
          <Skeleton className="h-28 rounded-3xl" />
          <Skeleton className="h-28 rounded-3xl" />
        </div>
        <Skeleton className="mt-8 h-48 rounded-3xl" />
        <Skeleton className="mt-6 h-48 rounded-3xl" />
      </main>
    </>
  );
}
