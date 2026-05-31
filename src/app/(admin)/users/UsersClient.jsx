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
  Building2,
  UserCheck,
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

import { hasModulePermission } from "@/utils/permissions";

export default function UsersClient({ initialUsers, initialCount, profile, orgMember }) {
  const [users, setUsers] = useState(initialUsers || []);
  const [organizations, setOrganizations] = useState([]);
  const [totalCount, setTotalCount] = useState(initialCount || 0);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [showActionMenu, setShowActionMenu] = useState(null);

  const { isLoading, setLoading } = useLoader();
  const supabase = createClient();

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      if (filterRole === "organization") {
        let query = supabase
          .from("organizations")
          .select(`
            *,
            creator:profiles!created_by(id, full_name, phone),
            members:organization_members(id, is_active)
          `, { count: "exact" })
          .order("created_at", { ascending: false })
          .range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1);

        if (searchQuery.trim()) {
          query = query.or(`name.ilike.%${searchQuery}%,gst_number.ilike.%${searchQuery}%`);
        }

        const { data, count, error } = await query;
        if (error) throw error;

        setOrganizations(data || []);
        setTotalCount(count || 0);
      } else {
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
            `full_name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`
          );
        }

        const { data, count, error } = await query;
        if (error) throw error;

        setUsers(data || []);
        setTotalCount(count || 0);
      }
    } catch (err) {
      console.error("Failed to fetch:", err);
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

      let staffMembers = [];
      let orgMembers = [];
      let belongsTo = null;

      if (user.role === 'carpenter') {
        const { data: acceptedInvites } = await supabase
          .from("invitations")
          .select("id, accepted_by")
          .eq("invited_by", user.id)
          .eq("status", "accepted");

        if (acceptedInvites && acceptedInvites.length > 0) {
          const memberIds = acceptedInvites.map(i => i.accepted_by).filter(Boolean);
          const inviteIds = acceptedInvites.map(i => i.id);
          const { data: staffData } = await supabase
            .from("organization_members")
            .select(`
              id,
              role_name,
              joined_at,
              profile:profiles!member_id(id, full_name, phone, role, status, total_points)
            `)
            .in("member_id", memberIds)
            .in("invitation_id", inviteIds)
            .eq("is_active", true);
          staffMembers = staffData || [];
        }
      } else if (user.role === 'dealer') {
        const { data: orgData } = await supabase
          .from("organizations")
          .select("id")
          .eq("created_by", user.id)
          .limit(1);
          
        if (orgData && orgData.length > 0) {
          const orgId = orgData[0].id;
          const { data: membersData } = await supabase
            .from("organization_members")
            .select(`
              id,
              role_name,
              joined_at,
              profile:profiles!member_id(id, full_name, phone, role, status, total_points)
            `)
            .eq("organization_id", orgId)
            .eq("is_active", true);
          orgMembers = membersData || [];
        }
      } else if (user.role === 'member') {
        const { data: memberOrgLink } = await supabase
          .from("organization_members")
          .select(`
            id,
            organization_id,
            invitation_id
          `)
          .eq("member_id", user.id)
          .eq("is_active", true)
          .limit(1);

        if (memberOrgLink && memberOrgLink.length > 0) {
          const link = memberOrgLink[0];
          if (link.organization_id) {
            const { data: orgDetail } = await supabase
              .from("organizations")
              .select(`
                id,
                name,
                creator:profiles!created_by(id, full_name, phone)
              `)
              .eq("id", link.organization_id)
              .single();
            if (orgDetail) belongsTo = { type: 'organization', name: orgDetail.name, owner: orgDetail.creator };
          } else if (link.invitation_id) {
            const { data: inviteDetail } = await supabase
              .from("invitations")
              .select(`
                id,
                inviter:profiles!invited_by(id, full_name, phone)
              `)
              .eq("id", link.invitation_id)
              .single();
            if (inviteDetail) belongsTo = { type: 'carpenter', name: inviteDetail.inviter.full_name, owner: inviteDetail.inviter };
          }
        }
      }

      setSelectedUser({
        ...user,
        recentOrders: ordersRes.data || [],
        recentPoints: pointsRes.data || [],
        recentScans: scansRes.data || [],
        staffMembers,
        orgMembers,
        belongsTo,
      });
    } catch (err) {
      console.error(err);
      setSelectedUser(user);
    } finally {
      setLoading(false);
    }
  };

  const handleViewOrgDetails = async (org) => {
    try {
      setLoading(true);
      const { data: members, error } = await supabase
        .from("organization_members")
        .select(`
          id,
          role_name,
          joined_at,
          profile:profiles!member_id(id, full_name, phone, role, status, total_points)
        `)
        .eq("organization_id", org.id)
        .eq("is_active", true);

      if (error) throw error;

      setSelectedOrg({
        ...org,
        members: members || []
      });
    } catch (err) {
      console.error("Failed to fetch org details:", err);
      toast.error("Failed to fetch organization details");
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

            {/* Team Members Card */}
            {selectedUser.role === 'carpenter' && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-200">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                    <UserCheck size={14} className="text-primary" /> Staff Members (Carpentry Team)
                  </h3>
                </div>
                <div className="p-5">
                  {(selectedUser.staffMembers || []).length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-gray-50">
                          <TableRow>
                            <TableHead>Staff Member</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Points Bal.</TableHead>
                            <TableHead>Joined</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedUser.staffMembers.map((staff) => (
                            <TableRow key={staff.id} className="hover:bg-gray-50/50 cursor-pointer" onClick={() => setSelectedUser(staff.profile || staff)}>
                              <TableCell>
                                <p className="font-semibold text-gray-900 text-sm">{staff.profile?.full_name || "Unnamed Staff"}</p>
                              </TableCell>
                              <TableCell>
                                <Badge className="bg-orange-50 text-orange-600 border-0 font-semibold text-[10px]">
                                  {staff.role_name || "Staff"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span className="text-xs text-gray-600">{staff.profile?.phone || "—"}</span>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm font-bold text-gray-950">{(staff.profile?.total_points || 0).toLocaleString("en-IN")} pts</span>
                              </TableCell>
                              <TableCell>
                                <span className="text-xs text-gray-500">{formatDate(staff.joined_at)}</span>
                              </TableCell>
                              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-primary hover:text-primary/80 text-xs font-semibold"
                                  onClick={() => setSelectedUser(staff.profile || staff)}
                                >
                                  View details
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-4">No staff members registered under this carpenter</p>
                  )}
                </div>
              </div>
            )}

            {selectedUser.role === 'dealer' && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-200">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                    <Building2 size={14} className="text-primary" /> Organization Team Members (Dealer Team)
                  </h3>
                </div>
                <div className="p-5">
                  {(selectedUser.orgMembers || []).length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-gray-50">
                          <TableRow>
                            <TableHead>Team Member</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Points Bal.</TableHead>
                            <TableHead>Joined</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedUser.orgMembers.map((member) => (
                            <TableRow key={member.id} className="hover:bg-gray-50/50 cursor-pointer" onClick={() => setSelectedUser(member.profile || member)}>
                              <TableCell>
                                <p className="font-semibold text-gray-900 text-sm">{member.profile?.full_name || "Unnamed Staff"}</p>
                              </TableCell>
                              <TableCell>
                                <Badge className="bg-blue-50 text-blue-600 border-0 font-semibold text-[10px]">
                                  {member.role_name || "Staff"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span className="text-xs text-gray-600">{member.profile?.phone || "—"}</span>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm font-bold text-gray-950">{(member.profile?.total_points || 0).toLocaleString("en-IN")} pts</span>
                              </TableCell>
                              <TableCell>
                                <span className="text-xs text-gray-500">{formatDate(member.joined_at)}</span>
                              </TableCell>
                              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-primary hover:text-primary/80 text-xs font-semibold"
                                  onClick={() => setSelectedUser(member.profile || member)}
                                >
                                  View details
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-4">No team members registered under this dealer organization</p>
                  )}
                </div>
              </div>
            )}

            {selectedUser.role === 'member' && selectedUser.belongsTo && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <UserCheck size={14} className="text-primary" /> Associated Team
                </h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary text-lg font-bold">
                      {selectedUser.belongsTo.type === 'organization' ? <Building2 size={24} /> : <UsersIcon size={24} />}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{selectedUser.belongsTo.name}</p>
                      <p className="text-xs text-gray-400">
                        {selectedUser.belongsTo.type === 'organization' ? "Dealer Organization" : "Carpenter Team"} · Owned by {selectedUser.belongsTo.owner?.full_name || "—"}
                      </p>
                    </div>
                  </div>
                  {selectedUser.belongsTo.owner && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-gray-200 text-gray-700 font-semibold"
                      onClick={() => setSelectedUser(selectedUser.belongsTo.owner)}
                    >
                      View Owner Profile
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Organization Detail View
  if (selectedOrg) {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-gray-50">
        <PageHeader title="Organizations">
          <button className="h-full flex items-center border-b-2 border-primary text-primary font-semibold">
            Organization Details
          </button>
        </PageHeader>

        <div className="p-6 flex-1 overflow-auto">
          <div className="max-w-5xl mx-auto space-y-6">
            <button
              onClick={() => setSelectedOrg(null)}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary transition-colors font-medium"
            >
              <ArrowLeft size={16} /> Back to Organizations
            </button>

            {/* Org Header Card */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-start gap-5">
                <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center flex-shrink-0 text-white">
                  <Building2 size={32} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-xl font-bold text-gray-900">{selectedOrg.name || "Unnamed Organization"}</h2>
                    <Badge className={`text-[10px] font-bold tracking-wider uppercase border-0 ${selectedOrg.kyc_verified ? "bg-green-50 text-green-600" : "bg-yellow-50 text-yellow-600"}`}>
                      {selectedOrg.kyc_verified ? "KYC Verified" : "KYC Pending"}
                    </Badge>
                  </div>
                  {selectedOrg.gst_number && (
                    <p className="text-sm text-gray-500 font-medium">GSTIN: {selectedOrg.gst_number}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    {selectedOrg.phone && (
                      <span className="flex items-center gap-1"><Phone size={12} /> {selectedOrg.phone}</span>
                    )}
                    {(selectedOrg.city || selectedOrg.state) && (
                      <span className="flex items-center gap-1"><MapPin size={12} /> {[selectedOrg.city, selectedOrg.state].filter(Boolean).join(", ")}</span>
                    )}
                    <span className="flex items-center gap-1"><Calendar size={12} /> Registered {formatDate(selectedOrg.created_at)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-primary">{selectedOrg.members?.length || 0}</p>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Total Members</p>
                </div>
              </div>
            </div>

            {/* Members Section */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-200">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                  <UserCheck size={14} className="text-primary" /> Members List
                </h3>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Org Role</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Points Bal.</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedOrg.members.map((mem) => {
                      const profile = mem.profile || {};
                      return (
                        <TableRow key={mem.id} className="hover:bg-gray-50/50 cursor-pointer" onClick={() => { setSelectedUser(profile); setSelectedOrg(null); }}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 text-primary font-bold text-xs">
                                {(profile.full_name || "M").charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900 text-sm">{profile.full_name || "Unnamed Member"}</p>
                                <p className="text-xs text-gray-400 capitalize">{profile.role || "Member"}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-gray-100 text-gray-700 border-0 font-bold text-[10px] uppercase">
                              {mem.role_name || "Staff"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-gray-600 flex items-center gap-1">
                              <Phone size={11} className="text-gray-400" /> {profile.phone || "—"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-bold text-gray-900">
                              {(profile.total_points || 0).toLocaleString("en-IN")} pts
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge className={`text-[9px] font-bold tracking-wider uppercase border-0 ${getStatusBadge(profile.status || "active")}`}>
                              {profile.status || "active"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-primary hover:text-primary/80 text-xs font-semibold"
                              onClick={() => { setSelectedUser(profile); setSelectedOrg(null); }}
                            >
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {selectedOrg.members.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-gray-400 text-sm">
                          No members in this organization.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
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
        <button
          onClick={() => { setFilterRole("organization"); setCurrentPage(1); }}
          className={`h-full flex items-center border-b-2 transition-colors ${
            filterRole === "organization"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-gray-500 hover:text-primary hover:border-primary/30"
          }`}
        >
          Organizations
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
                {filterRole === "organization" ? (
                  organizations.map((org) => (
                    <TableRow key={org.id} className="hover:bg-gray-50/50 cursor-pointer transition-colors" onClick={() => handleViewOrgDetails(org)}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 text-primary">
                            <Building2 size={16} />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{org.name || "Unnamed Org"}</p>
                            {org.gst_number && <p className="text-xs text-gray-400">GST: {org.gst_number}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium text-gray-900">{org.creator?.full_name || "—"}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600 flex items-center gap-1.5">
                          <Phone size={13} className="text-gray-400" /> {org.phone || org.creator?.phone || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-semibold text-gray-700">
                          {org.members?.filter(m => m.is_active).length || 0} members
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-500">{formatDate(org.created_at)}</span>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] font-bold tracking-wider uppercase border-0 ${org.kyc_verified ? "bg-green-50 text-green-600" : "bg-yellow-50 text-yellow-600"}`}>
                          {org.kyc_verified ? "Verified" : "Pending"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-primary hover:text-primary/80 font-semibold"
                          onClick={() => handleViewOrgDetails(org)}
                        >
                          View Org
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  users.map((user) => (
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
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-500 hover:text-black rounded-lg"
                            onClick={() => handleViewDetails(user)}
                            title="View Details"
                          >
                            <Eye size={16} />
                          </Button>
                          
                          {hasModulePermission(profile, orgMember, 'users', 'edit') && (
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
                                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-1 min-w-[150px]">
                                  <button
                                    className="w-full text-left px-4 py-2 text-xs font-semibold flex items-center gap-2 hover:bg-gray-50 text-gray-700"
                                    onClick={() => handleToggleStatus(user.id, user.status || "active")}
                                  >
                                    {(user.status || "active") === "active" ? (
                                      <><ShieldX size={14} className="text-red-500" /> Suspend User</>
                                    ) : (
                                      <><ShieldCheck size={14} className="text-green-500" /> Activate User</>
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
                {((filterRole === "organization" ? organizations.length : users.length) === 0) && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-16 text-gray-500">
                      {filterRole === "organization" ? (
                        <>
                          <Building2 className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                          <p className="font-medium text-lg">No organizations found</p>
                          <p className="text-sm text-gray-400 mt-1">
                            {searchQuery ? "Try adjusting your search query." : "Organizations will appear here once created."}
                          </p>
                        </>
                      ) : (
                        <>
                          <UsersIcon className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                          <p className="font-medium text-lg">No users found</p>
                          <p className="text-sm text-gray-400 mt-1">
                            {searchQuery ? "Try adjusting your search." : "Users will appear here when they register."}
                          </p>
                        </>
                      )}
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
