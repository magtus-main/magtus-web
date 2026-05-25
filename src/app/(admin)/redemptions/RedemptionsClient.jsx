"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  RefreshCcw,
  Gift,
  Phone,
  ArrowLeft,
  Calendar,
  CheckCircle,
  XCircle,
  Copy,
  ShieldCheck,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  User,
  DollarSign,
  FileText,
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
import {
  decryptRedemptionKyc,
  approveRedemption,
  rejectRedemption,
} from "./actions";

const PAGE_SIZE = 20;

export default function RedemptionsClient({ initialRequests, initialCount }) {
  const [requests, setRequests] = useState(initialRequests || []);
  const [totalCount, setTotalCount] = useState(initialCount || 0);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("requested"); // 'requested' | 'approved' | 'rejected'
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [decryptedKyc, setDecryptedKyc] = useState(null);
  const [decrypting, setDecrypting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  const { isLoading, setLoading } = useLoader();
  const supabase = createClient();

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("redemption_requests")
        .select(`
          *,
          user:profiles!redemption_requests_user_id_fkey(id, full_name, phone),
          catalog_item:redemption_catalog(name, image_url, points_required)
        `, { count: "exact" })
        .order("created_at", { ascending: false })
        .range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1);

      // Filter by tab status
      query = query.eq("status", filterStatus);

      // Search filters (filters by User Name, Phone, or Request number)
      if (searchQuery.trim()) {
        query = query.or(
          `request_number.ilike.%${searchQuery}%,notes.ilike.%${searchQuery}%`
        );
      }

      const { data, count, error } = await query;
      if (error) throw error;

      // Filter on joined profile if search term matches user name or phone (since Supabase .or across joins has limitations)
      let filteredData = data || [];
      if (searchQuery.trim() && data) {
        const queryLower = searchQuery.toLowerCase();
        // If we want a robust client-side fallback for joined properties:
        const searchMatches = data.filter(req => 
          req.request_number?.toLowerCase().includes(queryLower) ||
          req.user?.full_name?.toLowerCase().includes(queryLower) ||
          req.user?.phone?.includes(queryLower)
        );
        if (searchMatches.length > 0 || searchQuery.length > 3) {
          filteredData = searchMatches;
        }
      }

      setRequests(filteredData);
      setTotalCount(count || filteredData.length);
    } catch (err) {
      console.error("Failed to fetch redemptions:", err);
      toast.error("Failed to load redemption requests");
    } finally {
      setLoading(false);
    }
  }, [currentPage, filterStatus, searchQuery, supabase, setLoading]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleOpenDetails = async (req) => {
    setSelectedRequest(req);
    setDecryptedKyc(null);
    setShowRejectForm(false);
    setRejectReason("");
    
    // Load decrypted details on-demand securely via server action
    setDecrypting(true);
    try {
      const decrypted = await decryptRedemptionKyc(req.id);
      setDecryptedKyc(decrypted);
    } catch (err) {
      console.error("KYC Decryption failed:", err);
      toast.error(err.message || "Unauthorized: Secure decryption failed.");
    } finally {
      setDecrypting(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;
    try {
      setLoading(true);
      const res = await approveRedemption(selectedRequest.id);
      if (res.success) {
        toast.success("Redemption request approved and completed!");
        setSelectedRequest(null);
        fetchRequests();
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to approve request");
    } finally {
      setLoading(false);
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRequest) return;
    if (!rejectReason.trim()) {
      return toast.error("Please enter a reason for rejection");
    }

    try {
      setLoading(true);
      const res = await rejectRedemption(selectedRequest.id, rejectReason.trim());
      if (res.success) {
        toast.success(`Request rejected. ${selectedRequest.points_spent} points refunded to Carpenter.`);
        setSelectedRequest(null);
        fetchRequests();
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to reject request");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status) => {
    if (status === "approved") return "bg-green-50 text-green-600 border border-green-200";
    if (status === "rejected") return "bg-red-50 text-red-600 border border-red-200";
    return "bg-yellow-50 text-yellow-600 border border-yellow-200";
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50">
      <PageHeader title="Points & Cash Redemptions">
        <button
          onClick={() => { setFilterStatus("requested"); setCurrentPage(1); }}
          className={`h-full flex items-center border-b-2 transition-colors ${
            filterStatus === "requested"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-gray-500 hover:text-primary hover:border-primary/30"
          }`}
        >
          Pending Requests
        </button>
        <button
          onClick={() => { setFilterStatus("approved"); setCurrentPage(1); }}
          className={`h-full flex items-center border-b-2 transition-colors ${
            filterStatus === "approved"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-gray-500 hover:text-primary hover:border-primary/30"
          }`}
        >
          Completed Transfers
        </button>
        <button
          onClick={() => { setFilterStatus("rejected"); setCurrentPage(1); }}
          className={`h-full flex items-center border-b-2 transition-colors ${
            filterStatus === "rejected"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-gray-500 hover:text-primary hover:border-primary/30"
          }`}
        >
          Rejected
        </button>
      </PageHeader>

      {/* Control Bar */}
      <div className="p-6 shrink-0 flex flex-col md:flex-row gap-4 justify-between items-center bg-white border-b border-gray-200 shadow-sm">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search request number or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-gray-50 border-gray-200 text-sm focus:bg-white"
          />
        </div>

        <div className="flex gap-2 w-full md:w-auto justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchRequests}
            className="flex items-center gap-1.5 border-gray-200 text-gray-700 font-semibold"
          >
            <RefreshCcw size={14} /> Refresh
          </Button>
        </div>
      </div>

      {/* Requests Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="font-bold">Request Info</TableHead>
                <TableHead className="font-bold">Carpenter</TableHead>
                <TableHead className="font-bold">Reward Type</TableHead>
                <TableHead className="font-bold text-right">Points spent</TableHead>
                <TableHead className="font-bold text-right">Value</TableHead>
                <TableHead className="font-bold">Requested At</TableHead>
                <TableHead className="font-bold">Status</TableHead>
                <TableHead className="font-bold text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((req) => {
                const isCashOut = !req.catalog_item_id;
                return (
                  <TableRow key={req.id} className="hover:bg-gray-50/50 cursor-pointer" onClick={() => handleOpenDetails(req)}>
                    <TableCell>
                      <p className="font-bold text-gray-900 text-sm">{req.request_number}</p>
                      {req.notes && (
                        <p className="text-xs text-gray-400 truncate max-w-xs">{req.notes}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                          {req.user?.full_name ? req.user.full_name.charAt(0).toUpperCase() : <User size={12} />}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{req.user?.full_name || "Unnamed Carpenter"}</p>
                          <p className="text-xs text-gray-400 flex items-center gap-1">
                            <Phone size={10} /> {req.user?.phone || "—"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {isCashOut ? (
                        <div className="flex items-center gap-1.5 text-amber-600 font-semibold text-sm">
                          <DollarSign size={14} className="text-amber-500" /> Direct Cash Out
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-gray-700 text-sm">
                          <Gift size={14} className="text-gray-400" /> {req.catalog_item?.name || "Catalog Reward"}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-bold text-gray-900">
                      {req.points_spent.toLocaleString("en-IN")} pts
                    </TableCell>
                    <TableCell className="text-right font-bold text-green-600">
                      ₹{req.points_spent.toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">
                      {formatDate(req.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] font-bold uppercase ${getStatusBadge(req.status)}`}>
                        {req.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-primary hover:bg-primary/5 font-bold"
                        onClick={() => handleOpenDetails(req)}
                      >
                        {req.status === "requested" ? "Process Transfer" : "View Details"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {requests.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-gray-400 text-sm">
                    No redemption requests found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-gray-200 bg-white flex justify-between items-center shrink-0">
          <span className="text-xs text-gray-500">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="border-gray-200"
            >
              <ChevronLeft size={16} /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="border-gray-200"
            >
              Next <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Decryption & Manual Transfer Details Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-100 max-w-lg w-full overflow-hidden animate-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-150 flex justify-between items-start">
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Redemption Request</span>
                <h3 className="text-lg font-bold text-gray-900">{selectedRequest.request_number}</h3>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              >
                <XCircle size={22} />
              </button>
            </div>

            {/* Modal Scroll Content */}
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* Point Value info */}
              <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg border border-gray-100">
                <div>
                  <span className="text-xs text-gray-400 font-semibold block uppercase">Amount Redeemed</span>
                  <span className="text-lg font-extrabold text-primary">{selectedRequest.points_spent.toLocaleString()} pts</span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-400 font-semibold block uppercase">Payable Cash</span>
                  <span className="text-xl font-extrabold text-green-600">₹{selectedRequest.points_spent.toLocaleString()}</span>
                </div>
              </div>

              {/* KYC & Bank Details Card */}
              <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50/50">
                <div className="bg-gray-100 px-4 py-3 border-b border-gray-200 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-primary" />
                  <span className="text-xs font-bold tracking-wider uppercase text-gray-700">KYC & Bank Details</span>
                </div>

                <div className="p-5 space-y-4">
                  {decrypting ? (
                    <div className="py-8 flex flex-col items-center justify-center gap-2 text-gray-500">
                      <RefreshCcw size={20} className="animate-spin text-primary" />
                      <p className="text-xs">Loading details...</p>
                    </div>
                  ) : decryptedKyc ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Aadhaar Name</span>
                          <p className="text-sm font-semibold text-gray-900">{decryptedKyc.decrypted_aadhaar_name || "—"}</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Bank Holder Name</span>
                          <p className="text-sm font-semibold text-gray-900">{decryptedKyc.decrypted_bank_holder_name || "—"}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-100">
                        <div>
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Bank Name</span>
                          <p className="text-xs font-semibold text-gray-700">{decryptedKyc.decrypted_bank_name || "—"}</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">IFSC Code</span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <code className="text-xs font-mono font-bold bg-white border border-gray-200 px-1.5 py-0.5 rounded text-gray-800">
                              {decryptedKyc.decrypted_bank_ifsc || "—"}
                            </code>
                            {decryptedKyc.decrypted_bank_ifsc && (
                              <button
                                onClick={() => handleCopy(decryptedKyc.decrypted_bank_ifsc, "IFSC Code")}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                                title="Copy IFSC"
                              >
                                <Copy size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-gray-100">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Bank Account Number</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <code className="text-sm font-mono font-bold tracking-wider bg-white border border-gray-200 px-2.5 py-1 rounded text-primary">
                            {decryptedKyc.decrypted_bank_account || "—"}
                          </code>
                          {decryptedKyc.decrypted_bank_account && (
                            <button
                              onClick={() => handleCopy(decryptedKyc.decrypted_bank_account, "Account Number")}
                              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                              title="Copy Account Number"
                            >
                              <Copy size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 flex flex-col items-center justify-center gap-2 text-red-500">
                      <XCircle size={20} />
                      <p className="text-xs text-center font-medium">Failed to load KYC and bank details.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Specific UI */}
              {selectedRequest.status === "rejected" && (
                <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                  <span className="text-xs text-red-700 font-bold block uppercase mb-1">Rejection Reason</span>
                  <p className="text-sm text-red-800">{selectedRequest.rejected_reason || "No reason specified"}</p>
                </div>
              )}

              {selectedRequest.status === "approved" && (
                <div className="bg-green-50 p-4 rounded-lg border border-green-100 flex items-center gap-2">
                  <CheckCircle size={18} className="text-green-600 shrink-0" />
                  <div>
                    <span className="text-xs text-green-700 font-bold block uppercase">Transferred & Approved</span>
                    <p className="text-xs text-green-600 font-medium">Completed on {formatDate(selectedRequest.approved_at)}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            {selectedRequest.status === "requested" && (
              <div className="p-6 border-t border-gray-150 bg-gray-50 flex flex-col gap-3">
                {showRejectForm ? (
                  <form onSubmit={handleRejectSubmit} className="space-y-3 w-full">
                    <span className="text-xs text-red-700 font-bold block uppercase">Input Rejection Reason</span>
                    <Input
                      placeholder="Why is this being rejected? (e.g. Account details mismatch)"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      required
                      className="bg-white border-gray-200 text-sm focus:border-red-500"
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowRejectForm(false)}
                        className="text-gray-500 text-xs font-semibold"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="destructive"
                        size="sm"
                        className="text-xs font-bold bg-red-600 hover:bg-red-700 ml-auto"
                      >
                        Reject & Refund Points
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex justify-between gap-3 w-full">
                    <Button
                      variant="outline"
                      onClick={() => setShowRejectForm(true)}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200 text-xs font-bold"
                    >
                      Reject Request
                    </Button>
                    <Button
                      disabled={!decryptedKyc}
                      onClick={handleApprove}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-extrabold"
                    >
                      I Have Transferred Cash (Approve & Complete)
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
