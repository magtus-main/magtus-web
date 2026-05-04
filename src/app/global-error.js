"use client";

import { AlertTriangle, RefreshCcw } from "lucide-react";

export default function GlobalError({ error, reset }) {
  return (
    <html>
      <body className="bg-gray-50 font-sans">
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-xl border border-gray-200 shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
              <AlertTriangle className="text-red-500" size={32} />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h1>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              An unexpected error occurred. Please try again or contact support if the issue persists.
            </p>
            {process.env.NODE_ENV === "development" && error?.message && (
              <pre className="text-xs text-left bg-red-50 border border-red-100 rounded-lg p-4 mb-6 overflow-auto max-h-40 text-red-700">
                {error.message}
              </pre>
            )}
            <button
              onClick={() => reset()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#4f3a30] text-white text-sm font-semibold rounded-lg hover:bg-[#4f3a30]/90 transition-colors"
            >
              <RefreshCcw size={14} /> Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
