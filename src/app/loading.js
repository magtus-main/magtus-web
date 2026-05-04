import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="fixed inset-0 z-[9999] bg-white/50 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-white p-5 rounded-2xl shadow-xl border border-gray-100 flex flex-col items-center gap-3 animate-in fade-in zoom-in duration-200">
        <Loader2 className="animate-spin text-primary w-10 h-10" />
        <span className="text-sm font-bold text-gray-700 tracking-wide">Loading...</span>
      </div>
    </div>
  );
}
