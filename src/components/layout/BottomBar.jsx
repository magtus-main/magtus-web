"use client";

export default function BottomBar({ children }) {
  return (
    <div className="border-t border-gray-200 bg-white px-6 py-3 flex items-center justify-between flex-shrink-0 shadow-[0_-2px_10px_rgba(0,0,0,0.04)]">
      {children}
    </div>
  );
}
