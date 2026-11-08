import { Skeleton } from '../ui/Skeleton';

export function PageLoading() {
  return (
    <div role="status" aria-label="Loading page" className="container-page space-y-4 py-16">
      <Skeleton className="h-10 w-2/3" /><Skeleton className="h-5 w-full" /><Skeleton className="h-5 w-5/6" /><Skeleton className="h-48 w-full" />
    </div>
  );
}
