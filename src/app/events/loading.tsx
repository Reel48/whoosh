import { Nav } from "@/components/Nav";
import { Skeleton, SkeletonText } from "@/components/Skeleton";

export default function EventsLoading() {
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-24">
        <SkeletonText className="h-4 w-32" />
        <div className="mt-8 space-y-6">
          <Skeleton className="h-44 rounded-3xl" />
          <Skeleton className="h-44 rounded-3xl" />
        </div>
      </main>
    </>
  );
}
