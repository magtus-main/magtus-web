"use client";

import { AlertTriangle, RefreshCcw, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function AdminError({ error, reset }) {
  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="text-red-500" size={28} />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Page Error</h2>
        <p className="text-sm text-gray-500 mb-5 leading-relaxed">
          This page encountered an error while loading. You can try again or go back to the dashboard.
        </p>
        {process.env.NODE_ENV === "development" && error?.message && (
          <pre className="text-xs text-left bg-red-50 border border-red-100 rounded-lg p-3 mb-5 overflow-auto max-h-32 text-red-700">
            {error.message}
          </pre>
        )}
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-sm font-semibold rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft size={14} /> Dashboard
          </Link>
          <button
            onClick={() => reset()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors"
          >
            <RefreshCcw size={14} /> Retry
          </button>
        </div>
      </div>
    </div>
  );
}
