"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  RefreshCcw,
  Download,
  ChevronLeft,
  ChevronRight,
  Users as UsersIcon,
  Phone,
  MoreHorizontal,
  Eye,
  ShieldCheck,
  ShieldX,
  Star,
  ArrowLeft,
  MapPin,
  Calendar,
  Package,
  QrCode,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useLoader } from "@/components/providers/LoaderProvider";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import PageHeader from "@/components/layout/PageHeader";

const PAGE_SIZE = 20;

export default function UsersClient({ initialUsers, initialCount }) {
  const [users, setUsers] = useState(initialUsers || []);
  const [totalCount, setTotalCount] = useState(initialCount || 0);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showActionMenu, setShowActionMenu] = useState(null);

  const { isLoading, setLoading } = useLoader();
  const supabase = createClient();

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("profiles")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1);

      if (filterRole !== "all") {
        query = query.eq("role", filterRole);
      }

      if (searchQuery.trim()) {
        query = query.or(
          `full_name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,business_name.ilike.%${searchQuery}%`
        );
      }

      const { data, count, error } = await query;
      if (error) throw error;

      setUsers(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, filterRole, searchQuery]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleToggleStatus = async (userId, currentStatus) => {
    const newStatus = currentStatus === "active" ? "suspended" : "active";
    try {
      setLoading(true);
      const { error } = await supabase
        .from("profiles")
        .update({ status: newStatus })
        .eq("id", userId);
      if (error) throw error;
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: newStatus } : u))
      );
      setShowActionMenu(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update user status");
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (user) => {
    try {
      setLoading(true);
      // Fetch user with recent activity
      const [ordersRes, pointsRes, scansRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id, order_number, total, status, created_at")
          .eq("dealer_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("reward_points_ledger")
          .select("id, points, txn_type, description, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("qr_codes")
          .select("id, created_at, status")
          .eq("scanned_by", user.id)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      setSelectedUser({
        ...user,
        recentOrders: ordersRes.data || [],
        recentPoints: pointsRes.data || [],
        recentScans: scansRes.data || [],
      });
    } catch (err) {
      console.error(err);
      setSelectedUser(user);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const csvRows = [
      ["Name", "Role", "Phone", "Business", "Points", "Status", "Joined"].join(","),
      ...users.map((u) =>
        [
          u.full_name || "",
          u.role,
          u.phone || "",
          u.business_name || "",
          u.total_points || 0,
          u.status || "active",
          new Date(u.created_at).toLocaleDateString("en-IN"),
        ].join(",")
      ),
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getRoleBadge = (role) => {
    if (role === "dealer") return "bg-blue-50 text-blue-600";
    if (role === "carpenter") return "bg-orange-50 text-orange-600";
    if (role === "admin") return "bg-purple-50 text-purple-600";
    return "bg-gray-50 text-gray-600";
  };

  const getStatusBadge = (status) => {
    if (status === "active") return "bg-green-50 text-green-600";
    if (status === "suspended") return "bg-red-50 text-red-600";
    return "bg-yellow-50 text-yellow-600";
  };

  // User Detail View
  if (selectedUser) {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-gray-50">
        <PageHeader title="Users">
          <button className="h-full flex items-center border-b-2 border-primary text-primary font-semibold">
            User Details
          </button>
        </PageHeader>

        <div className="p-6 flex-1 overflow-auto">
          <div className="max-w-5xl mx-auto space-y-6">
            <button
              onClick={() => setSelectedUser(null)}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary transition-colors font-medium"
            >
              <ArrowLeft size={16} /> Back to Users
            </button>

            {/* User Header Card */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-start gap-5">
                <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center flex-shrink-0">
                  {selectedUser.avatar_url ? (
                    <img src={selectedUser.avatar_url} alt="" className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <span className="text-white text-2xl font-bold">
                      {(selectedUser.full_name || "U").charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-xl font-bold text-gray-900">{selectedUser.full_name || "Unnamed User"}</h2>
                    <Badge className={`text-[10px] font-bold tracking-wider uppercase ${getRoleBadge(selectedUser.role)}`}>
                      {selectedUser.role}
                    </Badge>
                    <Badge className={`text-[10px] font-bold tracking-wider uppercase ${getStatusBadge(selectedUser.status || "active")}`}>
                      {selectedUser.status || "active"}
                    </Badge>
                  </div>
                  {selectedUser.business_name && (
                    <p className="text-sm text-gray-500 font-medium">{selectedUser.business_name}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    {selectedUser.phone && (
                      <span className="flex items-center gap-1"><Phone size={12} /> {selectedUser.phone}</span>
                    )}
                    {(selectedUser.city || selectedUser.state) && (
                      <span className="flex items-center gap-1"><MapPin size={12} /> {[selectedUser.city, selectedUser.state].filter(Boolean).join(", ")}</span>
                    )}
                    <span className="flex items-center gap-1"><Calendar size={12} /> Joined {formatDate(selectedUser.created_at)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-primary">{(selectedUser.total_points || 0).toLocaleString("en-IN")}</p>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Total Points</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Recent Orders */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-200">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <Package size={14} /> Recent Orders
                  </h3>
                </div>
                <div className="p-5 space-y-3">
                  {(selectedUser.recentOrders || []).length > 0 ? (
                    selectedUser.recentOrders.map((order) => (
                      <div key={order.id} className="flex justify-between items-center pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{order.order_number}</p>
                          <p className="text-xs text-gray-400">{formatDate(order.created_at)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold">₹{(order.total || 0).toLocaleString("en-IN")}</p>
                          <Badge className="text-[9px] bg-gray-100 text-gray-600">{order.status}</Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-4">No orders yet</p>
                  )}
                </div>
              </div>

              {/* Recent Points Activity */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-200">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <Star size={14} /> Points History
                  </h3>
                </div>
                <div className="p-5 space-y-3">
                  {(selectedUser.recentPoints || []).length > 0 ? (
                    selectedUser.recentPoints.map((pt) => (
                      <div key={pt.id} className="flex justify-between items-center pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{pt.description || pt.txn_type}</p>
                          <p className="text-xs text-gray-400">{formatDate(pt.created_at)}</p>
                        </div>
                        <span className={`text-sm font-bold ${pt.points > 0 ? "text-green-600" : "text-red-500"}`}>
                          {pt.points > 0 ? "+" : ""}{pt.points}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-4">No points activity yet</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Users List View
  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50">
      <PageHeader title="Users">
        <button
          onClick={() => { setFilterRole("all"); setCurrentPage(1); }}
          className={`h-full flex items-center border-b-2 transition-colors ${
            filterRole === "all"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-gray-500 hover:text-primary hover:border-primary/30"
          }`}
        >
          All Users
        </button>
        <button
          onClick={() => { setFilterRole("dealer"); setCurrentPage(1); }}
          className={`h-full flex items-center border-b-2 transition-colors ${
            filterRole === "dealer"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-gray-500 hover:text-primary hover:border-primary/30"
          }`}
        >
          Dealers
        </button>
        <button
          onClick={() => { setFilterRole("carpenter"); setCurrentPage(1); }}
          className={`h-full flex items-center border-b-2 transition-colors ${
            filterRole === "carpenter"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-gray-500 hover:text-primary hover:border-primary/30"
          }`}
        >
          Carpenters
        </button>
      </PageHeader>

      <div className="p-6 flex-1 overflow-hidden flex flex-col">
        <div className="flex flex-col flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          {/* Top Actions */}
          <div className="flex items-center gap-4 p-6 border-b border-gray-200 flex-shrink-0">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <Input
                type="text"
                placeholder="Search by name, phone or business..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="pl-9 bg-gray-50 border-gray-200 focus-visible:ring-primary"
              />
            </div>
            <Button variant="outline" size="icon" onClick={fetchUsers} className="border-gray-200 text-gray-600 hover:bg-gray-50">
              <RefreshCcw size={16} />
            </Button>
            <Button onClick={handleExport} className="bg-primary hover:bg-primary/90 text-white text-xs font-semibold tracking-wider">
              <Download size={14} className="mr-2" /> EXPORT
            </Button>
          </div>

          {/* Users Table */}
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Points Bal.</TableHead>
                  <TableHead>Joined Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} className="hover:bg-gray-50/50 cursor-pointer transition-colors" onClick={() => handleViewDetails(user)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt="" className="w-full h-full object-cover rounded-lg" />
                          ) : (
                            <span className="text-primary font-bold text-sm">
                              {(user.full_name || "U").charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{user.full_name || "Unnamed"}</p>
                          {user.business_name && <p className="text-xs text-gray-400">{user.business_name}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] font-bold tracking-wider uppercase border-0 ${getRoleBadge(user.role)}`}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600 flex items-center gap-1.5">
                        <Phone size={13} className="text-gray-400" /> {user.phone || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-bold text-gray-900">
                        {(user.total_points || 0).toLocaleString("en-IN")} pts
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-500">{formatDate(user.created_at)}</span>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] font-bold tracking-wider uppercase border-0 ${getStatusBadge(user.status || "active")}`}>
                        {user.status || "active"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="relative inline-block">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-gray-700"
                          onClick={() => setShowActionMenu(showActionMenu === user.id ? null : user.id)}
                        >
                          <MoreHorizontal size={16} />
                        </Button>
                        {showActionMenu === user.id && (
                          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-1 min-w-[160px]">
                            <button
                              className="w-full text-left px-4 py-2 text-sm font-medium flex items-center gap-2 hover:bg-gray-50 text-gray-700"
                              onClick={() => { handleViewDetails(user); setShowActionMenu(null); }}
                            >
                              <Eye size={14} className="text-gray-400" /> View Details
                            </button>
                            <button
                              className="w-full text-left px-4 py-2 text-sm font-medium flex items-center gap-2 hover:bg-gray-50 text-gray-700"
                              onClick={() => handleToggleStatus(user.id, user.status || "active")}
                            >
                              {(user.status || "active") === "active" ? (
                                <><ShieldX size={14} className="text-red-400" /> Suspend User</>
                              ) : (
                                <><ShieldCheck size={14} className="text-green-400" /> Activate User</>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-16 text-gray-500">
                      <UsersIcon className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                      <p className="font-medium text-lg">No users found</p>
                      <p className="text-sm text-gray-400 mt-1">
                        {searchQuery ? "Try adjusting your search." : "Users will appear here when they register."}
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalCount > 0 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50/50 flex-shrink-0">
              <span className="text-xs text-gray-500 font-medium">
                {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}>
                  <ChevronLeft size={14} />
                </Button>
                <span className="text-xs font-medium text-gray-700 px-2">{currentPage} / {totalPages}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
                  <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
