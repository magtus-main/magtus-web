"use client";

import React, { createContext, useContext, useState } from "react";
import { Loader2 } from "lucide-react";

const LoaderContext = createContext({
  isLoading: false,
  setLoading: () => {},
});

export function useLoader() {
  return useContext(LoaderContext);
}

export function LoaderProvider({ children }) {
  const [isLoading, setLoading] = useState(false);

  return (
    <LoaderContext.Provider value={{ isLoading, setLoading }}>
      {children}
      {isLoading && (
        <>
          {/* Subtle top progress indicator */}
          <div className="fixed top-0 left-0 right-0 z-[99999] pointer-events-none h-[3px]">
            <div className="h-full bg-primary animate-pulse shadow-[0_0_8px_#4f3a30]" />
          </div>

          {/* Minimalist non-blocking corner pill */}
          <div className="fixed bottom-5 right-5 z-[99999] pointer-events-none flex items-center gap-2 bg-white/95 text-gray-700 px-3.5 py-1.5 rounded-full shadow-md border border-gray-200 text-xs font-semibold animate-in fade-in slide-in-from-bottom-2 duration-150 backdrop-blur-sm">
            <Loader2 className="animate-spin text-primary w-3.5 h-3.5" />
            <span>Loading...</span>
          </div>
        </>
      )}
    </LoaderContext.Provider>
  );
}
