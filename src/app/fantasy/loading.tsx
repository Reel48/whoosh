import { Skeleton, SkeletonText } from "@/components/Skeleton";

export default function FantasyLoading() {
  return (
    <main className="ftb-page ftb-page--wide">
      <SkeletonText className="h-4 w-40" />
      <Skeleton className="mt-3 h-10 w-64 rounded-theme" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-40 rounded-theme" />
        <Skeleton className="h-40 rounded-theme" />
      </div>
      <Skeleton className="mt-6 h-64 rounded-theme" />
    </main>
  );
}
