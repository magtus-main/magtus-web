export default function Loading() {
  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50 animate-pulse">
      {/* Page Header Bar Skeleton */}
      <div className="h-14 bg-white border-b border-gray-200 px-6 flex items-center justify-between shrink-0">
        <div className="h-5 w-32 bg-gray-200 rounded-md" />
        <div className="flex items-center gap-3">
          <div className="h-7 w-20 bg-gray-100 rounded-md" />
          <div className="h-7 w-20 bg-gray-100 rounded-md" />
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className="p-6 flex-1 overflow-auto space-y-6">
        {/* Filter / Search Bar Skeleton */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 flex items-center justify-between gap-4 shadow-sm">
          <div className="h-9 w-72 bg-gray-100 rounded-lg" />
          <div className="flex items-center gap-2">
            <div className="h-9 w-20 bg-gray-100 rounded-lg" />
            <div className="h-9 w-24 bg-gray-100 rounded-lg" />
          </div>
        </div>

        {/* Content Table / Cards Skeleton */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="h-10 bg-gray-50 border-b border-gray-200 px-6 flex items-center justify-between">
            <div className="h-3.5 w-24 bg-gray-200 rounded" />
            <div className="h-3.5 w-20 bg-gray-200 rounded" />
            <div className="h-3.5 w-28 bg-gray-200 rounded" />
            <div className="h-3.5 w-16 bg-gray-200 rounded" />
          </div>
          <div className="divide-y divide-gray-100 p-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="px-4 py-3.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-9 h-9 rounded-lg bg-gray-100 shrink-0" />
                  <div className="space-y-1.5 flex-1 max-w-xs">
                    <div className="h-3.5 w-3/4 bg-gray-200 rounded" />
                    <div className="h-2.5 w-1/2 bg-gray-100 rounded" />
                  </div>
                </div>
                <div className="h-4 w-20 bg-gray-100 rounded" />
                <div className="h-5 w-16 bg-gray-100 rounded-full" />
                <div className="h-7 w-16 bg-gray-100 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
