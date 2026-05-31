"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { ExternalLink, HelpCircle, Bell, LogOut, User } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { hasModulePermission } from "@/utils/permissions";

export default function TopNav({ profile, orgMember }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Notifications State & Realtime Hook
  const [notifications, setNotifications] = useState([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifDropdownRef = useRef(null);

  const fetchNotifications = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("type", "system")
      .eq("is_read", false)
      .order("created_at", { ascending: false })
      .limit(10);
    setNotifications(data || []);
  };

  useEffect(() => {
    fetchNotifications();

    const supabase = createClient();
    const channel = supabase
      .channel("system_notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: "type=eq.system" },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(event.target)) {
        setIsNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAsRead = async (notifId) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notifId);
    if (!error) {
      setNotifications(prev => prev.filter(n => n.id !== notifId));
    }
  };

  const handleMarkAllAsRead = async () => {
    if (notifications.length === 0) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .in("id", notifications.map(n => n.id));
    if (!error) {
      setNotifications([]);
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const allNavItems = [
    { label: "Dashboard", href: "/", show: true },
    { label: "Products", href: "/products", show: hasModulePermission(profile, orgMember, "products", "view") },
    { label: "Orders", href: "/orders", show: hasModulePermission(profile, orgMember, "orders", "view") },
    { label: "Users", href: "/users", show: hasModulePermission(profile, orgMember, "users", "view") },
    { label: "QR Codes", href: "/qrcodes", show: hasModulePermission(profile, orgMember, "qrcodes", "view") },
    { label: "Redemptions", href: "/redemptions", show: hasModulePermission(profile, orgMember, "redemptions", "view") },
    { label: "Team", href: "/team", show: hasModulePermission(profile, orgMember, "team", "view") },
    { label: "Settings", href: "/settings", show: profile?.role === "admin" },
  ];

  const navItems = allNavItems.filter((item) => item.show);

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
        <div className="relative" ref={notifDropdownRef}>
          <button 
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="text-gray-400 hover:text-primary transition-colors relative p-1.5 rounded-full hover:bg-gray-105 flex items-center justify-center"
          >
            <Bell size={20} strokeWidth={1.5} />
            {notifications.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white animate-pulse" />
            )}
          </button>

          {isNotifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-3 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Notifications ({notifications.length})
                </span>
                {notifications.length > 0 && (
                  <button 
                    onClick={handleMarkAllAsRead}
                    className="text-[10px] font-bold text-primary hover:underline"
                  >
                    Clear All
                  </button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-gray-400">
                    No new stock alerts or warnings
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className="p-3 hover:bg-gray-50 flex items-start gap-2.5 group">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-900">{n.title}</p>
                        <p className="text-[11px] text-gray-600 mt-0.5 leading-relaxed">
                          {n.body}
                        </p>
                        <span className="text-[9px] text-gray-400 mt-1 block">
                          {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <button 
                        onClick={() => handleMarkAsRead(n.id)}
                        className="text-[9px] font-bold text-gray-400 hover:text-primary transition-colors opacity-0 group-hover:opacity-100 self-center border border-gray-200 rounded px-1.5 py-0.5 bg-white shadow-sm shrink-0"
                      >
                        Read
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

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
                <Link
                  href="/profile"
                  onClick={() => setIsDropdownOpen(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors font-semibold"
                >
                  <User size={16} />
                  <span>My Profile</span>
                </Link>
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
