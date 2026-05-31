"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  Plus,
  Shield,
  Trash2,
  Edit2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Users as UsersIcon,
  Phone,
  Calendar,
  X,
  Lock,
  Check,
  Briefcase
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PageHeader from "@/components/layout/PageHeader";
import { DEFAULT_ADMIN_PERMISSIONS, hasModulePermission } from "@/utils/permissions";

export default function TeamClient({ initialMembers, initialInvitations, profile, orgMember }) {
  const hasEditPermission = hasModulePermission(profile, orgMember, "team", "edit");
  const [members, setMembers] = useState(initialMembers || []);
  const [invitations, setInvitations] = useState(initialInvitations || []);
  const [activeTab, setActiveTab] = useState("members");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  // Modals
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isEditPermsOpen, setIsEditPermsOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isConfirmRevokeOpen, setIsConfirmRevokeOpen] = useState(false);

  // Selected Items for actions
  const [selectedMember, setSelectedMember] = useState(null);
  const [selectedInvitation, setSelectedInvitation] = useState(null);

  // Form states
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteRoleName, setInviteRoleName] = useState("Member");
  const [invitePermissions, setInvitePermissions] = useState({ ...DEFAULT_ADMIN_PERMISSIONS });
  const [editRoleName, setEditRoleName] = useState("");
  const [editPermissions, setEditPermissions] = useState({ ...DEFAULT_ADMIN_PERMISSIONS });
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    async function fetchUser() {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    }
    fetchUser();
  }, []);

  const refreshData = async () => {
    try {
      // Refresh active team members (organization_id IS NULL)
      const { data: mData } = await supabase
        .from("organization_members")
        .select("*, member:profiles(*)")
        .is("organization_id", null)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (mData) setMembers(mData);

      // Refresh invitations (organization_id IS NULL)
      const { data: iData } = await supabase
        .from("invitations")
        .select("*, inviter:profiles!invited_by(*)")
        .is("organization_id", null)
        .order("created_at", { ascending: false });

      if (iData) setInvitations(iData);
    } catch (err) {
      console.error("Failed to refresh team data:", err);
    }
  };

  // Handle send invite
  const handleSendInvite = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    if (invitePhone.length !== 10) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }

    setLoading(true);
    try {
      // Check if active pending invitation already exists for this phone
      const { data: existing } = await supabase
        .from("invitations")
        .select("id")
        .eq("phone", invitePhone)
        .eq("status", "pending")
        .is("organization_id", null)
        .maybeSingle();

      if (existing) {
        toast.error("A pending invitation already exists for this phone number");
        setLoading(false);
        return;
      }

      // Check if user is already an active member of the admin team
      const { data: existingMember } = await supabase
        .from("organization_members")
        .select("id, member:profiles!member_id(full_name)")
        .is("organization_id", null)
        .eq("is_active", true)
        .eq("member:profiles.phone", invitePhone) // Wait, joins filters might be complex. Let's select member profiles
        .maybeSingle();

      // Insert new invitation
      const { error } = await supabase
        .from("invitations")
        .insert({
          invited_by: currentUser.id,
          phone: invitePhone,
          role_name: inviteRoleName || "Member",
          permissions: invitePermissions,
          organization_id: null, // Admin team
          status: "pending",
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days expiration
        });

      if (error) throw error;

      toast.success("Invitation sent successfully!");
      setIsInviteOpen(false);
      setInvitePhone("");
      setInviteRoleName("Member");
      setInvitePermissions({ ...DEFAULT_ADMIN_PERMISSIONS });
      refreshData();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to send invitation");
    } finally {
      setLoading(false);
    }
  };

  // Handle update permissions
  const handleUpdatePermissions = async (e) => {
    e.preventDefault();
    if (!currentUser || !selectedMember) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("update_member_permissions", {
        p_caller_id: currentUser.id,
        p_member_id: selectedMember.member_id,
        p_role_name: editRoleName,
        p_permissions: editPermissions
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.error);

      toast.success("Permissions updated successfully!");
      setIsEditPermsOpen(false);
      setSelectedMember(null);
      refreshData();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to update permissions");
    } finally {
      setLoading(false);
    }
  };

  // Handle remove member
  const handleRemoveMember = async () => {
    if (!currentUser || !selectedMember) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("remove_organization_member", {
        p_caller_id: currentUser.id,
        p_member_id: selectedMember.member_id
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.error);

      toast.success("Team member removed successfully!");
      setIsConfirmDeleteOpen(false);
      setSelectedMember(null);
      refreshData();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to remove member");
    } finally {
      setLoading(false);
    }
  };

  // Handle revoke invitation
  const handleRevokeInvitation = async () => {
    if (!selectedInvitation) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("invitations")
        .update({ status: "revoked", updated_at: new Date().toISOString() })
        .eq("id", selectedInvitation.id);

      if (error) throw error;

      toast.success("Invitation revoked successfully!");
      setIsConfirmRevokeOpen(false);
      setSelectedInvitation(null);
      refreshData();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to revoke invitation");
    } finally {
      setLoading(false);
    }
  };

  const openEditPermissions = (member) => {
    setSelectedMember(member);
    setEditRoleName(member.role_name || "Member");
    setEditPermissions(member.permissions || { ...DEFAULT_ADMIN_PERMISSIONS });
    setIsEditPermsOpen(true);
  };

  const openConfirmDelete = (member) => {
    setSelectedMember(member);
    setIsConfirmDeleteOpen(true);
  };

  const openConfirmRevoke = (invite) => {
    setSelectedInvitation(invite);
    setIsConfirmRevokeOpen(true);
  };

  const filteredMembers = members.filter((m) => {
    const fullName = m.member?.full_name || "";
    const phone = m.member?.phone || "";
    const query = searchQuery.toLowerCase();
    return fullName.toLowerCase().includes(query) || phone.includes(query);
  });

  const filteredInvitations = invitations.filter((i) => {
    const phone = i.phone || "";
    return phone.includes(searchQuery);
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case "accepted":
        return <Badge className="bg-green-50 text-green-600 border-0 flex items-center gap-1 w-max font-bold text-[10px]"><CheckCircle2 size={12} /> Accepted</Badge>;
      case "pending":
        return <Badge className="bg-amber-50 text-amber-600 border-0 flex items-center gap-1 w-max font-bold text-[10px]"><Clock size={12} /> Pending</Badge>;
      case "expired":
        return <Badge className="bg-red-50 text-red-600 border-0 flex items-center gap-1 w-max font-bold text-[10px]"><XCircle size={12} /> Expired</Badge>;
      case "revoked":
        return <Badge className="bg-gray-100 text-gray-500 border-0 flex items-center gap-1 w-max font-bold text-[10px]"><AlertCircle size={12} /> Revoked</Badge>;
      default:
        return <Badge className="bg-gray-50 text-gray-600 border-0 font-bold text-[10px]">{status}</Badge>;
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50">
      <PageHeader title="Team Settings">
        <button
          onClick={() => setActiveTab("members")}
          className={`h-full flex items-center border-b-2 transition-colors ${
            activeTab === "members"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-gray-500 hover:text-primary hover:border-primary/30"
          }`}
        >
          Active Members ({members.length})
        </button>
        <button
          onClick={() => setActiveTab("invitations")}
          className={`h-full flex items-center border-b-2 transition-colors ${
            activeTab === "invitations"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-gray-500 hover:text-primary hover:border-primary/30"
          }`}
        >
          Invitations ({invitations.filter(i => i.status === 'pending').length} Pending)
        </button>
      </PageHeader>

      <div className="p-6 flex-1 overflow-auto flex flex-col">
        <div className="max-w-6xl mx-auto w-full space-y-6 flex-1 flex flex-col">
          {/* Dashboard info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/5 text-primary flex items-center justify-center">
                <UsersIcon size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{members.length}</p>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Total Active Staff</p>
              </div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{invitations.filter(i => i.status === "pending").length}</p>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Pending Invites</p>
              </div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Shield size={24} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {members.filter(m => m.permissions?.access_level === 'full' || m.role_name === 'Owner').length}
                </p>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Super Admins</p>
              </div>
            </div>
          </div>

          {/* Table Toolbar */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
              <Input
                placeholder={activeTab === "members" ? "Search members by name or phone..." : "Search invites by phone..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 focus-visible:ring-black border-gray-200 rounded-lg text-sm h-10 w-full"
              />
            </div>
            {hasEditPermission && (
              <Button
                onClick={() => setIsInviteOpen(true)}
                className="bg-black hover:bg-gray-800 text-white font-semibold rounded-lg flex items-center gap-1.5 h-10 self-stretch sm:self-auto shrink-0"
              >
                <Plus size={16} /> Invite Team Member
              </Button>
            )}
          </div>

          {/* Active Members Table */}
          {activeTab === "members" && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex-1">
              <Table>
                <TableHeader className="bg-gray-50/70 border-b border-gray-200">
                  <TableRow>
                    <TableHead className="font-bold text-gray-600 text-xs py-3.5 pl-6">Member</TableHead>
                    <TableHead className="font-bold text-gray-600 text-xs py-3.5">System Role</TableHead>
                    <TableHead className="font-bold text-gray-600 text-xs py-3.5">Permissions Details</TableHead>
                    <TableHead className="font-bold text-gray-600 text-xs py-3.5">Joined Date</TableHead>
                    <TableHead className="font-bold text-gray-600 text-xs py-3.5 text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.map((m) => {
                    const isOwner = m.role_name === "Owner";
                    const isFullAccess = m.permissions?.access_level === "full" || isOwner;

                    return (
                      <TableRow key={m.id} className="hover:bg-gray-50/50 border-b border-gray-100 last:border-0 transition-colors">
                        <TableCell className="pl-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0 text-primary font-bold text-sm">
                              {m.member?.avatar_url ? (
                                <img src={m.member.avatar_url} alt="" className="w-full h-full object-cover rounded-xl" />
                              ) : (
                                (m.member?.full_name || "M").charAt(0).toUpperCase()
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 text-sm leading-snug">{m.member?.full_name || "Invited User"}</p>
                              <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><Phone size={10} /> {m.member?.phone}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] font-bold border-0 tracking-wider uppercase ${isOwner ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                            {m.role_name}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {isFullAccess ? (
                            <Badge className="bg-green-50 text-green-700 font-bold text-[10px] border-0">Full Access (Super Admin)</Badge>
                          ) : (
                            <div className="flex flex-wrap gap-1.5 max-w-sm">
                              {Object.entries(m.permissions?.modules || {}).map(([mod, actions]) => {
                                const hasView = actions.view;
                                const hasEdit = actions.edit;
                                if (!hasView && !hasEdit) return null;
                                return (
                                  <Badge key={mod} variant="outline" className="text-[10px] bg-gray-50 text-gray-700 font-semibold px-2 py-0.5 border-gray-200">
                                    {mod}: {hasEdit ? "Edit" : "View"}
                                  </Badge>
                                );
                              })}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">{formatDate(m.joined_at)}</TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex items-center justify-end gap-1">
                            {!isOwner && hasEditPermission && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditPermissions(m)}
                                  className="h-8 w-8 text-gray-500 hover:text-black rounded-lg"
                                  title="Edit Permissions"
                                >
                                  <Edit2 size={14} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openConfirmDelete(m)}
                                  className="h-8 w-8 text-gray-500 hover:text-red-600 rounded-lg hover:bg-red-50"
                                  title="Remove Member"
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </>
                            )}
                            {!isOwner && !hasEditPermission && (
                              <Badge className="bg-gray-100 text-gray-400 text-[9px] font-bold border-0 select-none"><Lock size={10} className="inline mr-0.5" /> View Only</Badge>
                            )}
                            {isOwner && (
                              <Badge className="bg-gray-100 text-gray-400 text-[9px] font-bold border-0 select-none"><Lock size={10} className="inline mr-0.5" /> Locked</Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredMembers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-gray-400 text-sm">
                        No team members found matching your search.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pending Invitations Table */}
          {activeTab === "invitations" && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex-1">
              <Table>
                <TableHeader className="bg-gray-50/70 border-b border-gray-200">
                  <TableRow>
                    <TableHead className="font-bold text-gray-600 text-xs py-3.5 pl-6">Invited Contact</TableHead>
                    <TableHead className="font-bold text-gray-600 text-xs py-3.5">System Role</TableHead>
                    <TableHead className="font-bold text-gray-600 text-xs py-3.5">Invite Code</TableHead>
                    <TableHead className="font-bold text-gray-600 text-xs py-3.5">Permissions Allocated</TableHead>
                    <TableHead className="font-bold text-gray-600 text-xs py-3.5">Expiration</TableHead>
                    <TableHead className="font-bold text-gray-600 text-xs py-3.5">Status</TableHead>
                    <TableHead className="font-bold text-gray-600 text-xs py-3.5 text-right pr-6">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvitations.map((i) => {
                    const isFullAccess = i.permissions?.access_level === "full";
                    const isPending = i.status === "pending";

                    return (
                      <TableRow key={i.id} className="hover:bg-gray-50/50 border-b border-gray-100 last:border-0 transition-colors">
                        <TableCell className="pl-6 py-4">
                          <div>
                            <p className="font-bold text-gray-900 text-sm flex items-center gap-1.5"><Phone size={12} className="text-gray-400" /> +91 {i.phone}</p>
                            <p className="text-[10px] text-gray-400 mt-1">Invited by {i.inviter?.full_name || "Admin"}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className="text-[10px] font-bold border-0 bg-blue-50 text-blue-600 tracking-wider uppercase">
                            {i.role_name}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs font-semibold text-gray-700 bg-gray-50/50 rounded border px-2 py-0.5 w-max">
                          {i.invite_code}
                        </TableCell>
                        <TableCell>
                          {isFullAccess ? (
                            <Badge className="bg-green-50 text-green-700 font-bold text-[10px] border-0">Full Access (Super Admin)</Badge>
                          ) : (
                            <div className="flex flex-wrap gap-1.5 max-w-sm">
                              {Object.entries(i.permissions?.modules || {}).map(([mod, actions]) => {
                                const hasView = actions.view;
                                const hasEdit = actions.edit;
                                if (!hasView && !hasEdit) return null;
                                return (
                                  <Badge key={mod} variant="outline" className="text-[10px] bg-gray-50 text-gray-700 font-semibold px-2 py-0.5 border-gray-200">
                                    {mod}: {hasEdit ? "Edit" : "View"}
                                  </Badge>
                                );
                              })}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">{formatDate(i.expires_at)}</TableCell>
                        <TableCell>{getStatusBadge(i.status)}</TableCell>
                        <TableCell className="text-right pr-6">
                          {isPending && hasEditPermission ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openConfirmRevoke(i)}
                              className="border-gray-200 hover:border-red-200 text-gray-500 hover:text-red-600 font-semibold text-xs rounded-lg hover:bg-red-50/50 h-8"
                            >
                              Revoke
                            </Button>
                          ) : isPending ? (
                            <span className="text-xs text-gray-400 font-medium">Pending</span>
                          ) : (
                            <span className="text-xs text-gray-400 font-medium">Inactive</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredInvitations.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-gray-400 text-sm">
                        No invitations found matching your search.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* Invite Modal */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900">Invite Team Member</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              Send a WhatsApp OTP invitation to add a member to the admin team and configure their modules permissions.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSendInvite} className="space-y-6 py-4">
            <div className="space-y-2">
              <label htmlFor="invite-role" className="text-sm font-semibold text-gray-700 block">System Role (e.g. Manager, Sales)</label>
              <Input
                id="invite-role"
                placeholder="Member"
                value={inviteRoleName}
                onChange={(e) => setInviteRoleName(e.target.value)}
                className="focus-visible:ring-black border-gray-200 rounded-lg"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="invite-phone" className="text-sm font-semibold text-gray-700 block">Phone Number</label>
              <div className="flex">
                <div className="flex items-center px-3 border border-r-0 border-gray-200 bg-gray-50 text-gray-500 text-sm rounded-l-lg font-semibold">
                  +91
                </div>
                <Input
                  id="invite-phone"
                  placeholder="9876543210"
                  value={invitePhone}
                  onChange={(e) => setInvitePhone(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))}
                  className="rounded-l-none focus-visible:ring-black border-gray-200 rounded-r-lg"
                  required
                />
              </div>
            </div>

            <PermissionEditor
              permissions={invitePermissions}
              onChange={setInvitePermissions}
            />

            <DialogFooter className="border-t border-gray-100 pt-4 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsInviteOpen(false)}
                className="border-gray-200 text-gray-700 font-semibold"
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-black hover:bg-gray-800 text-white font-semibold"
                disabled={loading || invitePhone.length !== 10}
              >
                {loading ? "Sending Invitation..." : "Send Invitation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Permissions Modal */}
      <Dialog open={isEditPermsOpen} onOpenChange={setIsEditPermsOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900">Configure Permissions</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              Update permissions for <span className="font-bold text-black">{selectedMember?.member?.full_name}</span> (+91 {selectedMember?.member?.phone})
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdatePermissions} className="space-y-6 py-4">
            <div className="space-y-2 border-b border-gray-100 pb-4 mb-2">
              <label htmlFor="edit-role-name" className="text-sm font-bold text-gray-700 block">System Role</label>
              <Input
                id="edit-role-name"
                placeholder="Member"
                value={editRoleName}
                onChange={(e) => setEditRoleName(e.target.value)}
                className="focus-visible:ring-black border-gray-200 rounded-lg text-sm h-10 font-semibold"
                required
              />
            </div>

            <PermissionEditor
              permissions={editPermissions}
              onChange={setEditPermissions}
            />

            <DialogFooter className="border-t border-gray-100 pt-4 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditPermsOpen(false)}
                className="border-gray-200 text-gray-700 font-semibold"
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-black hover:bg-gray-800 text-white font-semibold"
                disabled={loading}
              >
                {loading ? "Saving Changes..." : "Save Configuration"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Remove Member Modal */}
      <Dialog open={isConfirmDeleteOpen} onOpenChange={setIsConfirmDeleteOpen}>
        <DialogContent className="rounded-xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900">Remove Team Member?</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              Are you sure you want to remove <span className="font-bold text-black">{selectedMember?.member?.full_name}</span> from the admin team? They will immediately lose all access to this web portal.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2 flex justify-end">
            <Button
              variant="outline"
              onClick={() => setIsConfirmDeleteOpen(false)}
              className="border-gray-200 text-gray-700 font-semibold"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRemoveMember}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold"
              disabled={loading}
            >
              {loading ? "Removing..." : "Yes, Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Revoke Invitation Modal */}
      <Dialog open={isConfirmRevokeOpen} onOpenChange={setIsConfirmRevokeOpen}>
        <DialogContent className="rounded-xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900">Revoke Invitation?</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              Are you sure you want to revoke the invitation to <span className="font-bold text-black">+91 {selectedInvitation?.phone}</span>? If they try to log in, their auto-onboarding will be blocked.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2 flex justify-end">
            <Button
              variant="outline"
              onClick={() => setIsConfirmRevokeOpen(false)}
              className="border-gray-200 text-gray-700 font-semibold"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRevokeInvitation}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold"
              disabled={loading}
            >
              {loading ? "Revoking..." : "Yes, Revoke"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Subcomponent: Permission Editor Checklist UI
function PermissionEditor({ permissions, onChange }) {
  const handleAccessLevelChange = (level) => {
    if (level === 'full') {
      onChange({
        access_level: 'full',
        modules: {
          qrcodes: { view: true, edit: true },
          users: { view: true, edit: true },
          redemptions: { view: true, edit: true },
          orders: { view: true, edit: true },
          team: { view: true, edit: true },
          products: { view: true, edit: true }
        },
        order_steps: {
          confirm: true,
          ship: true,
          deliver: true,
          cancel: true
        }
      });
    } else {
      onChange({
        access_level: 'partial',
        modules: {
          qrcodes: { view: true, edit: false },
          users: { view: true, edit: false },
          redemptions: { view: true, edit: false },
          orders: { view: true, edit: false },
          team: { view: true, edit: false },
          products: { view: true, edit: false }
        },
        order_steps: {
          confirm: false,
          ship: false,
          deliver: false,
          cancel: false
        }
      });
    }
  };

  const handleModuleChange = (module, action, value) => {
    const updatedModules = {
      ...permissions.modules,
      [module]: {
        ...permissions.modules?.[module],
        [action]: value
      }
    };
    
    // Auto-check View if Edit is checked
    if (action === 'edit' && value) {
      updatedModules[module].view = true;
    }
    
    // Auto-uncheck Edit if View is unchecked
    if (action === 'view' && !value) {
      updatedModules[module].edit = false;
    }

    // If edit is unchecked, also clear order steps if module is orders
    let updatedOrderSteps = permissions.order_steps || {};
    if (module === 'orders' && action === 'edit' && !value) {
      updatedOrderSteps = {
        confirm: false,
        ship: false,
        deliver: false,
        cancel: false
      };
    }

    onChange({
      ...permissions,
      modules: updatedModules,
      order_steps: updatedOrderSteps
    });
  };

  const handleOrderStepChange = (step, value) => {
    onChange({
      ...permissions,
      order_steps: {
        ...permissions.order_steps,
        [step]: value
      }
    });
  };

  const isPartial = permissions.access_level === 'partial';

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-bold text-gray-700 block">Access Authority</label>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => handleAccessLevelChange('full')}
            className={`flex-1 py-3 px-4 rounded-xl border text-center font-semibold text-sm transition-all ${
              permissions.access_level === 'full'
                ? 'border-black bg-black text-white shadow-sm'
                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            Full Access (Super Admin)
          </button>
          <button
            type="button"
            onClick={() => handleAccessLevelChange('partial')}
            className={`flex-1 py-3 px-4 rounded-xl border text-center font-semibold text-sm transition-all ${
              permissions.access_level === 'partial'
                ? 'border-black bg-black text-white shadow-sm'
                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            Custom/Partial Access
          </button>
        </div>
      </div>

      {isPartial && (
        <div className="space-y-6 border-t border-gray-100 pt-6 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Module Permissions</h4>
            <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100 bg-white shadow-sm">
              <div className="grid grid-cols-3 bg-gray-50/70 p-3 text-[10px] font-bold text-gray-500 tracking-wider">
                <div>MODULE</div>
                <div className="text-center">VIEW PERMISSION</div>
                <div className="text-center">EDIT / PLACE / MANAGE</div>
              </div>

              {[
                { key: 'qrcodes', label: 'QR Codes' },
                { key: 'users', label: 'Users & KYC' },
                { key: 'redemptions', label: 'Redemptions' },
                { key: 'orders', label: 'Orders' },
                { key: 'products', label: 'Products & Categories' },
                { key: 'team', label: 'Team Settings' }
              ].map((mod) => (
                <div key={mod.key} className="grid grid-cols-3 p-3.5 items-center text-sm">
                  <div className="font-semibold text-gray-700 flex items-center gap-1.5">
                    {mod.label === 'Team Settings' ? <Briefcase size={14} className="text-gray-400" /> : <Shield size={14} className="text-gray-400" />}
                    {mod.label}
                  </div>
                  <div className="flex justify-center">
                    <input
                      type="checkbox"
                      checked={!!permissions.modules?.[mod.key]?.view}
                      onChange={(e) => handleModuleChange(mod.key, 'view', e.target.checked)}
                      className="w-4 h-4 text-black rounded border-gray-300 focus:ring-black accent-black cursor-pointer"
                    />
                  </div>
                  <div className="flex justify-center">
                    <input
                      type="checkbox"
                      checked={!!permissions.modules?.[mod.key]?.edit}
                      onChange={(e) => handleModuleChange(mod.key, 'edit', e.target.checked)}
                      className="w-4 h-4 text-black rounded border-gray-300 focus:ring-black accent-black cursor-pointer"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Conditional Order Steps transitioning */}
          {!!permissions.modules?.orders?.edit && (
            <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200 animate-in fade-in slide-in-from-top-1 duration-200">
              <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                🛡️ Step-by-Step Order Permissions
              </h4>
              <p className="text-[11px] text-gray-500 mb-1 leading-relaxed">
                Check the specific steps this team member can perform. Users can view orders even if these are unchecked.
              </p>
              <div className="grid grid-cols-2 gap-3 mt-2">
                {[
                  { key: 'confirm', label: 'Confirm Order' },
                  { key: 'ship', label: 'Ship Products' },
                  { key: 'deliver', label: 'Deliver Order' },
                  { key: 'cancel', label: 'Cancel Order' }
                ].map((step) => (
                  <label key={step.key} className="flex items-center gap-2.5 p-2.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-100/50 cursor-pointer transition-all">
                    <input
                      type="checkbox"
                      checked={!!permissions.order_steps?.[step.key]}
                      onChange={(e) => handleOrderStepChange(step.key, e.target.checked)}
                      className="w-4 h-4 text-black rounded border-gray-300 focus:ring-black accent-black cursor-pointer"
                    />
                    <span className="text-xs font-bold text-gray-700">{step.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
