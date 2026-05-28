export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl border-2 border-ink/10 bg-ink/5 ${className}`}
    />
  );
}

export function SkeletonText({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-ink/10 ${className}`} />;
}
