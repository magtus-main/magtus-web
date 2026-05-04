import { SearchX, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="max-w-md w-full text-center">
        <p className="text-8xl font-black text-gray-200 leading-none mb-4">404</p>
        <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <SearchX className="text-gray-400" size={28} />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Page Not Found</h1>
        <p className="text-sm text-gray-500 mb-6">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#4f3a30] text-white text-sm font-semibold rounded-lg hover:bg-[#4f3a30]/90 transition-colors"
        >
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
