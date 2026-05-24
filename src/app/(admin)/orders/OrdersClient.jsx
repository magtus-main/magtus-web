"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  Filter,
  RefreshCcw,
  Download,
  Eye,
  ChevronLeft,
  ChevronRight,
  Package,
  X,
  Truck,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeft,
  Phone,
  MapPin,
  Calendar,
  ShieldCheck,
  Ban,
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

// Order timeline: pending → confirmed → shipped → delivered  (cancel anytime)
// DB enum: 'pending','confirmed','processing','shipped','delivered','cancelled','on_hold'
const STATUS_OPTIONS = [
  { value: "pending",   label: "Pending",   color: "bg-yellow-100 text-yellow-700", icon: Clock },
  { value: "confirmed", label: "Confirmed", color: "bg-blue-100 text-blue-700",     icon: ShieldCheck },
  { value: "shipped",   label: "Shipped",   color: "bg-indigo-100 text-indigo-700", icon: Truck },
  { value: "delivered", label: "Delivered",  color: "bg-green-100 text-green-700",   icon: CheckCircle2 },
  { value: "cancelled", label: "Cancelled", color: "bg-red-100 text-red-700",       icon: XCircle },
];

const TIMELINE_STEPS = ["pending", "confirmed", "shipped", "delivered"];

// Map current status → next forward action
const NEXT_ACTION = {
  pending:   { next: "confirmed", label: "Accept",    icon: ShieldCheck, className: "bg-blue-600 hover:bg-blue-700 text-white" },
  confirmed: { next: "shipped",   label: "Shipped",   icon: Truck,       className: "bg-indigo-600 hover:bg-indigo-700 text-white" },
  shipped:   { next: "delivered", label: "Delivered",  icon: CheckCircle2, className: "bg-green-600 hover:bg-green-700 text-white" },
};

const PAGE_SIZE = 15;

export default function OrdersClient({ initialOrders, initialCount }) {
  const [orders, setOrders] = useState(initialOrders || []);
  const [totalCount, setTotalCount] = useState(initialCount || 0);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(null);

  const { isLoading, setLoading } = useLoader();
  const supabase = createClient();

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("orders")
        .select(
          `*, dealer:profiles!dealer_id(id, full_name, phone), organization:organizations!organization_id(id, name, city, state)`,
          { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1);

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      if (searchQuery.trim()) {
        query = query.ilike("order_number", `%${searchQuery}%`);
      }

      const { data, count, error } = await query;
      if (error) throw error;

      setOrders(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, filterStatus, searchQuery]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      setLoading(true);

      // Strict flow validation: only allow forward transitions or cancel
      const currentOrder = orders.find(o => o.id === orderId) || selectedOrder;
      const currentStatus = currentOrder?.status;
      if (currentStatus === "delivered" || currentStatus === "cancelled") {
        toast.error("Cannot change status of a completed or cancelled order");
        return;
      }
      if (newStatus !== "cancelled") {
        const currentIdx = TIMELINE_STEPS.indexOf(currentStatus);
        const newIdx = TIMELINE_STEPS.indexOf(newStatus);
        if (newIdx <= currentIdx) {
          toast.error("Cannot move order status backwards");
          return;
        }
        if (newIdx !== currentIdx + 1) {
          toast.error("Cannot skip status steps");
          return;
        }
      }

      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", orderId);

      if (error) throw error;

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => ({ ...prev, status: newStatus }));
      }
      setShowCancelConfirm(null);
      toast.success(`Order ${newStatus === 'cancelled' ? 'cancelled' : 'updated to ' + newStatus}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (order) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("orders")
        .select(
          `*, 
          dealer:profiles!dealer_id(id, full_name, phone),
          organization:organizations!organization_id(id, name, city, state, address),
          order_items(
            id, quantity, unit_price, total_price, product_name, variant_details,
            product:products(id, name, name_hi)
          )`
        )
        .eq("id", order.id)
        .single();

      if (error) throw error;
      setSelectedOrder(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load order details");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const csvRows = [
      ["Order ID", "Order Number", "Date", "Customer", "Phone", "Amount", "Status"].join(","),
      ...orders.map((o) =>
        [
          o.id,
          o.order_number,
          new Date(o.created_at).toLocaleDateString("en-IN"),
          o.dealer?.full_name || "—",
          o.dealer?.phone || "—",
          o.total,
          o.status,
        ].join(",")
      ),
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const getStatusConfig = (status) =>
    STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0];

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatCurrency = (amount) => {
    return `₹${(amount || 0).toLocaleString("en-IN")}`;
  };

  // Order Detail View
  if (selectedOrder) {
    const statusConfig = getStatusConfig(selectedOrder.status);
    const StatusIcon = statusConfig.icon;
    const isCancelled = selectedOrder.status === "cancelled";
    const isDelivered = selectedOrder.status === "delivered";
    const isTerminal = isCancelled || isDelivered;
    const nextAction = NEXT_ACTION[selectedOrder.status];
    const currentStepIndex = TIMELINE_STEPS.indexOf(selectedOrder.status);

    return (
      <div className="flex flex-col h-full overflow-hidden bg-gray-50">
        <PageHeader title="Orders">
          <button
            onClick={() => setSelectedOrder(null)}
            className="h-full flex items-center border-b-2 border-primary text-primary font-semibold"
          >
            Order Details
          </button>
        </PageHeader>

        <div className="p-6 flex-1 overflow-auto">
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Header Row */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setSelectedOrder(null)}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary transition-colors font-medium"
              >
                <ArrowLeft size={16} /> Back to Orders
              </button>
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold tracking-wider uppercase ${statusConfig.color}`}
                >
                  <StatusIcon size={14} />
                  {statusConfig.label}
                </span>
              </div>
            </div>

            {/* Order Timeline */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-6">
                Order Timeline
              </h3>
              {isCancelled ? (
                <div className="flex items-center justify-center gap-3 py-4">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                    <XCircle size={20} className="text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-red-700">Order Cancelled</p>
                    <p className="text-xs text-gray-400">This order has been cancelled.</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between relative">
                  {/* Background line */}
                  <div className="absolute top-5 left-[5%] right-[5%] h-0.5 bg-gray-200 z-0" />
                  {/* Progress line */}
                  {currentStepIndex > 0 && (
                    <div
                      className="absolute top-5 left-[5%] h-0.5 bg-primary z-0 transition-all duration-500"
                      style={{ width: `${(currentStepIndex / (TIMELINE_STEPS.length - 1)) * 90}%` }}
                    />
                  )}
                  {TIMELINE_STEPS.map((step, idx) => {
                    const stepConfig = getStatusConfig(step);
                    const StepIcon = stepConfig.icon;
                    const isCompleted = currentStepIndex >= idx;
                    const isCurrent = currentStepIndex === idx;
                    return (
                      <div key={step} className="flex flex-col items-center z-10 relative" style={{ width: `${100 / TIMELINE_STEPS.length}%` }}>
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                            isCompleted
                              ? isCurrent
                                ? "bg-primary border-primary text-white shadow-lg shadow-primary/30 scale-110"
                                : "bg-primary border-primary text-white"
                              : "bg-white border-gray-300 text-gray-400"
                          }`}
                        >
                          {isCompleted && !isCurrent ? (
                            <CheckCircle2 size={18} />
                          ) : (
                            <StepIcon size={18} />
                          )}
                        </div>
                        <span className={`mt-2 text-xs font-bold tracking-wider uppercase ${
                          isCompleted ? "text-primary" : "text-gray-400"
                        }`}>
                          {stepConfig.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Action Buttons */}
              {!isTerminal && (
                <div className="flex items-center justify-end gap-3 mt-6 pt-5 border-t border-gray-100">
                  <div className="relative">
                    {showCancelConfirm === selectedOrder.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 font-medium">Cancel this order?</span>
                        <Button
                          size="sm"
                          className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold tracking-wider"
                          onClick={() => handleStatusChange(selectedOrder.id, "cancelled")}
                        >
                          Yes, Cancel
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs font-bold tracking-wider border-gray-300"
                          onClick={() => setShowCancelConfirm(null)}
                        >
                          No
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 text-xs font-bold tracking-wider"
                        onClick={() => setShowCancelConfirm(selectedOrder.id)}
                      >
                        <Ban size={14} className="mr-1.5" />
                        Cancel Order
                      </Button>
                    )}
                  </div>
                  {nextAction && (
                    <Button
                      size="sm"
                      className={`text-xs font-bold tracking-wider ${nextAction.className}`}
                      onClick={() => handleStatusChange(selectedOrder.id, nextAction.next)}
                    >
                      <nextAction.icon size={14} className="mr-1.5" />
                      {nextAction.label}
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Order Info + Customer */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
                  Order Information
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Order Number</span>
                    <span className="text-sm font-bold text-gray-900">
                      {selectedOrder.order_number}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Date</span>
                    <span className="text-sm font-medium text-gray-900">
                      {formatDate(selectedOrder.created_at)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Total</span>
                    <span className="text-lg font-bold text-primary">
                      {formatCurrency(selectedOrder.total)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Status</span>
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold tracking-wider uppercase ${statusConfig.color}`}
                    >
                      <StatusIcon size={14} />
                      {statusConfig.label}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
                  Customer Details
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Name</span>
                    <span className="text-sm font-bold text-gray-900">
                      {selectedOrder.dealer?.full_name || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Business</span>
                    <span className="text-sm font-medium text-gray-900">
                      {selectedOrder.organization?.name || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Phone</span>
                    <span className="text-sm font-medium text-gray-900 flex items-center gap-1">
                      <Phone size={12} className="text-gray-400" />
                      {selectedOrder.dealer?.phone || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-gray-500">Location</span>
                    <span className="text-sm font-medium text-gray-900 text-right flex items-center gap-1">
                      <MapPin size={12} className="text-gray-400 flex-shrink-0" />
                      {[selectedOrder.organization?.city, selectedOrder.organization?.state]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Order Items */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-200">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
                  Order Items ({selectedOrder.order_items?.length || 0})
                </h3>
              </div>
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Variant / SKU</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(selectedOrder.order_items || []).map((item) => (
                    <TableRow key={item.id} className="hover:bg-gray-50/50">
                      <TableCell>
                        <p className="font-semibold text-gray-900">
                          {item.product?.name || "Unknown Product"}
                        </p>
                        {item.product?.name_hi && (
                          <p className="text-xs text-gray-500">
                            {item.product.name_hi}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-gray-700">
                          {item.variant_label || item.variant_details?.variant_label || (item.variant_details?.finish && item.variant_details?.size ? `${item.variant_details.finish} / ${item.variant_details.size}` : "—")}
                        </p>
                        <p className="text-xs text-gray-400">
                          {item.sku || item.variant_details?.sku || ""}
                        </p>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.unit_price)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary">
                        {formatCurrency(item.total_price)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!selectedOrder.order_items ||
                    selectedOrder.order_items.length === 0) && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-8 text-gray-400"
                      >
                        No items in this order
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {/* Total Footer */}
              <div className="p-5 border-t border-gray-200 bg-gray-50/50 flex justify-end">
                <div className="text-right">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Order Total
                  </span>
                  <p className="text-2xl font-bold text-primary mt-1">
                    {formatCurrency(selectedOrder.total)}
                  </p>
                </div>
              </div>
            </div>

            {selectedOrder.notes && (
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
                  Order Notes
                </h3>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {selectedOrder.notes}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Orders List View
  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50">
      <PageHeader title="Orders">
        {[
          { key: "all", label: "All Orders" },
          { key: "pending", label: "Pending" },
          { key: "confirmed", label: "Confirmed" },
          { key: "shipped", label: "Shipped" },
          { key: "delivered", label: "Delivered" },
          { key: "cancelled", label: "Cancelled" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setFilterStatus(tab.key); setCurrentPage(1); }}
            className={`h-full flex items-center border-b-2 transition-colors ${
              filterStatus === tab.key
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-gray-500 hover:text-primary hover:border-primary/30"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </PageHeader>

      <div className="p-6 flex-1 overflow-hidden flex flex-col">
        <div className="flex flex-col flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          {/* Top Actions Bar */}
          <div className="flex items-center gap-4 p-6 border-b border-gray-200 flex-shrink-0">
            <div className="flex-1 relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={16}
              />
              <Input
                type="text"
                placeholder="Search by order number or customer name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 bg-gray-50 border-gray-200 focus-visible:ring-primary"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={fetchOrders}
              className="border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              <RefreshCcw size={16} />
            </Button>
            <Button
              onClick={handleExport}
              className="bg-primary hover:bg-primary/90 text-white text-xs font-semibold tracking-wider"
            >
              <Download size={14} className="mr-2" /> EXPORT
            </Button>
          </div>

          {/* Orders Table */}
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const sc = getStatusConfig(order.status);
                  return (
                    <TableRow
                      key={order.id}
                      className="hover:bg-gray-50/50 cursor-pointer transition-colors"
                      onClick={() => handleViewDetails(order)}
                    >
                      <TableCell>
                        <span className="text-sm font-medium text-gray-500">
                          {order.order_number || order.id?.slice(0, 8) + "..."}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium text-gray-900">
                          {formatDate(order.created_at)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {order.dealer?.full_name || "—"}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {order.dealer?.phone || ""}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm font-bold text-gray-900">
                          {formatCurrency(order.total)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold tracking-wider uppercase ${sc.color}`}
                        >
                          {sc.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(order)}
                          className="text-gray-400 hover:text-primary text-[10px] font-bold tracking-wider"
                        >
                          <Eye size={14} className="mr-1" /> DETAILS
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {orders.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-16 text-gray-500"
                    >
                      <Package className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                      <p className="font-medium text-lg">No orders found</p>
                      <p className="text-sm text-gray-400 mt-1">
                        {searchQuery
                          ? "Try adjusting your search."
                          : "Orders will appear here when dealers place them."}
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Footer */}
          {totalCount > 0 && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50/50 flex-shrink-0">
              <span className="text-xs text-gray-500 font-medium">
                {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  <ChevronLeft size={14} />
                </Button>
                <span className="text-xs font-medium text-gray-700 px-2">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
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
