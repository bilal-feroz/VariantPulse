import { Card, Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="px-5 pb-12 sm:px-6 lg:px-8" aria-busy="true" aria-live="polite">
      <div className="pb-6 pt-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="mt-3 h-8 w-72" />
        <Skeleton className="mt-3 h-4 w-[28rem] max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="p-5">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="mt-3 h-3.5 w-32" />
            <Skeleton className="mt-2 h-3 w-24" />
          </Card>
        ))}
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {[0, 1].map((i) => (
          <Card key={i} className="p-5">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="mt-4 h-24 w-full" />
            <Skeleton className="mt-3 h-4 w-40" />
          </Card>
        ))}
      </div>
      <span className="sr-only">Loading workspace</span>
    </div>
  );
}
