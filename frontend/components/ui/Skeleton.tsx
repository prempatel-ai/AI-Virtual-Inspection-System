import React from "react";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "h-4 w-full" }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse bg-border/50 rounded-sm ${className}`}
    />
  );
}

export function KpiGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-${count} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-bg border border-border rounded-md p-4 space-y-3 shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-8" />
          </div>
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-3 w-36" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({
  rows = 6,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  const colWidths = ["w-32", "w-20", "w-28", "w-24", "w-16", "w-36", "w-20"];

  return (
    <div className="w-full bg-bg border border-border rounded-md shadow-2xs overflow-hidden">
      {/* Header skeleton */}
      <div className="bg-surface border-b border-border py-3 px-4 flex items-center justify-between gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton
            key={i}
            className={`h-3.5 ${colWidths[i % colWidths.length]}`}
          />
        ))}
      </div>

      {/* Row skeletons */}
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="py-3.5 px-4 flex items-center justify-between gap-4"
          >
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton
                key={c}
                className={`h-3 ${
                  c === 0
                    ? "w-36"
                    : c === 1
                    ? "w-20"
                    : c === cols - 1
                    ? "w-16"
                    : "w-24"
                }`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton({
  className = "h-48",
  header = true,
}: {
  className?: string;
  header?: boolean;
}) {
  return (
    <div className="bg-bg border border-border rounded-md p-5 space-y-4 shadow-2xs">
      {header && (
        <div className="space-y-1.5 pb-2 border-b border-border">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-64" />
        </div>
      )}
      <div className={`w-full ${className} flex flex-col justify-center space-y-3`}>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}
