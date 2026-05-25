"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { ExternalLink, HelpCircle, Bell, LogOut } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function TopNav({ profile }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const navItems = [
    { label: "Dashboard", href: "/" },
    { label: "Products", href: "/products" },
    { label: "Orders", href: "/orders" },
    { label: "Users", href: "/users" },
    { label: "QR Codes", href: "/qrcodes" },
    { label: "Redemptions", href: "/redemptions" },
    { label: "Settings", href: "/settings" },
  ];

  const getInitials = (name) => {
    if (!name) return "A";
    return name.charAt(0).toUpperCase();
  };

  return (
    <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2">
          <Image
            src="/magtus_logo.png"
            alt="Magtus Logo"
            width={120}
            height={70}
            style={{ width: "auto", height: "auto" }}
            className="object-contain"
            priority
          />
        </div>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-500">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={isActive
                  ? "text-primary bg-primary/10 px-3 py-1.5 rounded-md font-semibold transition-colors"
                  : "hover:text-primary transition-colors"}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>


      <div className="flex items-center gap-3">
        <button className="text-gray-400 hover:text-primary transition-colors">
          <HelpCircle size={20} strokeWidth={1.5} />
        </button>
        <button className="text-gray-400 hover:text-primary transition-colors relative">
          <Bell size={20} strokeWidth={1.5} />
        </button>

        <div
          className="relative flex items-center gap-3 ml-2 cursor-pointer group"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          ref={dropdownRef}
        >
          <div className="flex flex-col items-end">
            <span className="text-xs font-medium text-gray-900 group-hover:text-primary transition-colors">
              {profile?.full_name || 'Admin'}
            </span>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
              {profile?.role || 'ADMIN'}
            </span>
          </div>
          <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center overflow-hidden">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-primary-foreground text-xs font-bold">
                {getInitials(profile?.full_name)}
              </span>
            )}
          </div>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-1">
                <button
                  onClick={(e) => { e.stopPropagation(); handleLogout(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
                >
                  <LogOut size={16} />
                  <span>Log out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
