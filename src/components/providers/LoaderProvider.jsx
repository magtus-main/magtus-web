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
        <div className="fixed inset-0 z-[9999] bg-white/50 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white p-5 rounded-2xl shadow-xl border border-gray-100 flex flex-col items-center gap-3 animate-in fade-in zoom-in duration-200">
            <Loader2 className="animate-spin text-primary w-10 h-10" />
            <span className="text-sm font-bold text-gray-700 tracking-wide">Processing...</span>
          </div>
        </div>
      )}
    </LoaderContext.Provider>
  );
}
