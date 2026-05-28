import { Nav } from "@/components/Nav";
import { Skeleton, SkeletonText } from "@/components/Skeleton";

export default function WalletLoading() {
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-24">
        <SkeletonText className="h-4 w-32" />
        <Skeleton className="mt-6 h-44 rounded-3xl" />
        <Skeleton className="mt-8 h-40 rounded-3xl" />
        <Skeleton className="mt-8 h-56 rounded-3xl" />
        <Skeleton className="mt-8 h-80 rounded-3xl" />
      </main>
    </>
  );
}
