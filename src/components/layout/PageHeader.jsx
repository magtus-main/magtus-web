"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function PageHeader({ title, tabs = [], children }) {
  const pathname = usePathname();

  return (
    <div className="h-14 border-b border-gray-200 bg-white flex items-center px-6 shrink-0 w-full">
      <div className="text-primary font-bold text-sm tracking-wide border-r border-gray-200 pr-6 mr-6 h-full flex items-center">
        {title}
      </div>
      
      <nav className="flex items-center gap-8 text-sm font-medium h-full">
        {tabs.map((tab) => {
          // Exact match for root-like paths or prefix match for sub-pages
          const isActive = tab.href === "/" 
            ? pathname === "/" 
            : pathname === tab.href || pathname.startsWith(tab.href + '/');
            
          return (
            <Link 
              key={tab.href}
              href={tab.href}
              className={`h-full flex items-center border-b-2 transition-colors ${
                isActive 
                  ? "border-primary text-primary font-semibold" 
                  : "border-transparent text-gray-500 hover:text-primary hover:border-primary/30"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
        {children}
      </nav>
    </div>
  );
}
