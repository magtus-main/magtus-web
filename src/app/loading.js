import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="flex items-center gap-3 text-primary">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
        <span className="text-sm font-semibold text-gray-600">Loading...</span>
      </div>
    </div>
  );
}
