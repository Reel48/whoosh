import { MinimalHeader } from "@/components/MinimalHeader";
import { Skeleton, SkeletonText } from "@/components/Skeleton";

export default function HomeLoading() {
  return (
    <>
      <MinimalHeader />
      <main className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-16">
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-full" />
          <div className="flex-1">
            <SkeletonText className="h-3 w-32" />
            <SkeletonText className="mt-2 h-5 w-40" />
          </div>
        </div>
        <SkeletonText className="mt-8 h-10 w-72" />
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          <Skeleton className="h-56 rounded-3xl" />
          <Skeleton className="h-56 rounded-3xl" />
          <Skeleton className="h-56 rounded-3xl" />
        </div>
      </main>
    </>
  );
}
