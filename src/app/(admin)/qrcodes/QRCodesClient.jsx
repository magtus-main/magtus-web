"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  QrCode,
  Download,
  Printer,
  Plus,
  Search,
  RefreshCcw,
  ChevronLeft,
  ChevronRight,
  Package,
  Eye,
  CheckCircle2,
  Clock,
  ScanLine,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useLoader } from "@/components/providers/LoaderProvider";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export default function QRCodesClient({ initialProducts, initialQRCodes, initialCount }) {
  const [products, setProducts] = useState(initialProducts || []);
  const [qrCodes, setQRCodes] = useState(initialQRCodes || []);
  const [totalCount, setTotalCount] = useState(initialCount || 0);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Generate form
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedVariant, setSelectedVariant] = useState("");
  const [quantity, setQuantity] = useState("");
  const [pointsPerScan, setPointsPerScan] = useState("");
  const [batchNotes, setBatchNotes] = useState("");

  const { isLoading, setLoading } = useLoader();
  const supabase = createClient();

  const selectedProductData = products.find((p) => p.id === selectedProduct);
  const variants = selectedProductData?.specifications?.priceMatrix?.map(m => ({
    sku: m.sku || `${m.finish}-${m.size}`,
    variant_label: `${m.finish} / ${m.size}`,
    points: m.reward_points || selectedProductData.reward_points
  })) || [];

  // Auto-fill points from product/variant
  useEffect(() => {
    if (selectedProductData && !pointsPerScan) {
      if (selectedVariant) {
        const v = variants.find(v => v.sku === selectedVariant);
        if (v && v.points) {
          setPointsPerScan(String(v.points));
          return;
        }
      }
      setPointsPerScan(String(selectedProductData.reward_points || ""));
    }
  }, [selectedProduct, selectedVariant]);

  const fetchQRCodes = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("qr_codes")
        .select(
          `*, product:products(id, name, specifications), scanned_by_profile:profiles!scanned_by(id, full_name, phone)`,
          { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1);

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      if (searchQuery.trim()) {
        query = query.or(`code.ilike.%${searchQuery}%,batch_label.ilike.%${searchQuery}%`);
      }

      const { data, count, error } = await query;
      if (error) throw error;
      setQRCodes(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error("Failed to fetch QR codes:", err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, filterStatus, searchQuery]);

  useEffect(() => {
    fetchQRCodes();
  }, [fetchQRCodes]);

  const handleGenerateBatch = async () => {
    if (!selectedProduct || !quantity || parseInt(quantity) <= 0) {
      toast.error("Please select a product and enter a valid quantity.");
      return;
    }

    try {
      setLoading(true);
      const batchId = `BATCH-${Date.now().toString(36).toUpperCase()}`;
      const qty = parseInt(quantity);
      const points = parseInt(pointsPerScan) || 0;

      const qrEntries = [];
      for (let i = 0; i < qty; i++) {
        const uniqueCode = `MAG-${Date.now().toString(36).toUpperCase()}-${i.toString(36).toUpperCase().padStart(4, "0")}`;
        qrEntries.push({
          code: uniqueCode,
          product_id: selectedProduct,
          sku: selectedVariant || null,
          reward_points: points,
          batch_label: batchId,
          status: "available",
        });
      }

      // Insert in chunks of 100
      for (let i = 0; i < qrEntries.length; i += 100) {
        const chunk = qrEntries.slice(i, i + 100);
        const { error } = await supabase.from("qr_codes").insert(chunk);
        if (error) throw error;
      }

      toast.success(`Successfully generated ${qty} QR codes!\nBatch ID: ${batchId}`);

      // Reset form
      setSelectedProduct("");
      setSelectedVariant("");
      setQuantity("");
      setPointsPerScan("");
      setBatchNotes("");
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to generate QR codes");
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("qr_codes")
        .select(`*, product:products(name), scanned_by_profile:profiles!scanned_by(full_name, phone)`);

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      if (searchQuery.trim()) {
        query = query.or(`code.ilike.%${searchQuery}%,batch_label.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        toast.error("No QR codes found to export.");
        return;
      }

      const csvRows = [
        ["QR Code", "Product Name", "SKU", "Batch ID", "Points", "Status", "Scanned By", "Scanned Date"].join(","),
        ...data.map((qr) =>
          [
            qr.code,
            `"${qr.product?.name || "Unknown"}"`,
            qr.sku || "—",
            qr.batch_label || "—",
            qr.reward_points || 0,
            qr.status,
            `"${qr.scanned_by_profile?.full_name || "—"}"`,
            qr.scanned_at ? new Date(qr.scanned_at).toLocaleDateString("en-IN") : "—",
          ].join(",")
        ),
      ];
      const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `qrcodes_export_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV Downloaded");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export CSV");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case "available": return { color: "bg-green-50 text-green-600", icon: CheckCircle2, label: "Available" };
      case "scanned": return { color: "bg-purple-50 text-purple-600", icon: ScanLine, label: "Scanned" };
      default: return { color: "bg-gray-50 text-gray-500", icon: Clock, label: status };
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50">
      <PageHeader title="QR Codes" />

      <div className="p-6 flex-1 overflow-hidden flex flex-col md:flex-row gap-6">
        {/* LEFT SIDE: GENERATE FORM */}
        <div className="w-full md:w-[400px] flex flex-col bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm h-full flex-shrink-0">
          <div className="p-6 border-b border-gray-200 bg-gray-50 flex-shrink-0">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><QrCode size={18} className="text-primary" /> Generate QR Batch</h2>
          </div>
          <div className="p-6 flex-1 overflow-y-auto space-y-5">
            <div className="space-y-1.5">
              <Label className="font-semibold text-gray-700 text-sm">Select Product <span className="text-red-500">*</span></Label>
              <select
                className="w-full h-9 px-3 border border-gray-200 rounded-md text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                value={selectedProduct}
                onChange={(e) => { setSelectedProduct(e.target.value); setSelectedVariant(""); }}
              >
                <option value="">Choose a product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold text-gray-700 text-sm">Variant (Optional)</Label>
              <select
                className="w-full h-9 px-3 border border-gray-200 rounded-md text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                value={selectedVariant}
                onChange={(e) => setSelectedVariant(e.target.value)}
                disabled={variants.length === 0}
              >
                <option value="">All Variants</option>
                {variants.map((v) => (
                  <option key={v.sku} value={v.sku}>{v.variant_label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="font-semibold text-gray-700 text-sm">Quantity <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  placeholder="e.g. 500"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="bg-gray-50 h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-semibold text-gray-700 text-sm">Points/Scan</Label>
                <Input
                  type="number"
                  placeholder="e.g. 10"
                  value={pointsPerScan}
                  onChange={(e) => setPointsPerScan(e.target.value)}
                  className="bg-gray-50 h-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold text-gray-700 text-sm">Internal Batch Notes</Label>
              <Textarea
                placeholder="Optional notes for this production batch..."
                rows={3}
                value={batchNotes}
                onChange={(e) => setBatchNotes(e.target.value)}
                className="bg-gray-50 resize-y text-sm"
              />
            </div>
          </div>
          <div className="p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            <Button
              onClick={handleGenerateBatch}
              className="w-full bg-primary hover:bg-primary/90 text-white font-semibold"
              disabled={isLoading}
            >
              {isLoading ? "GENERATING..." : "GENERATE BATCH"}
            </Button>
          </div>
        </div>

        {/* RIGHT SIDE: INVENTORY */}
        <div className="flex flex-col flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm h-full">
          {/* Filters */}
          <div className="flex items-center gap-4 p-5 border-b border-gray-200 flex-shrink-0 bg-gray-50/50">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <Input
                placeholder="Search QR or batch ID..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="pl-9 bg-white border-gray-200 h-9 focus-visible:ring-primary text-sm"
              />
            </div>
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-md">
              {["all", "available", "scanned"].map((s) => (
                <button
                  key={s}
                  onClick={() => { setFilterStatus(s); setCurrentPage(1); }}
                  className={`px-3 py-1 text-xs font-semibold rounded transition-colors capitalize ${filterStatus === s
                    ? "bg-white text-primary shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <Button variant="outline" size="icon" onClick={fetchQRCodes} className="h-9 w-9 border-gray-200 text-gray-600 bg-white">
              <RefreshCcw size={15} />
            </Button>
            <Button variant="outline" onClick={handleExportCSV} className="h-9 border-gray-200 text-gray-700 font-semibold text-xs bg-white">
              <Download size={14} className="mr-2" /> Export CSV
            </Button>
          </div>

          {/* QR Table */}
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                <TableRow>
                  <TableHead>QR Code</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Points</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scanned By</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {qrCodes.map((qr) => {
                  const sc = getStatusConfig(qr.status);
                  return (
                    <TableRow key={qr.id} className="hover:bg-gray-50/50">
                      <TableCell>
                        <span className="text-sm font-mono font-medium text-gray-700">{qr.code}</span>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-semibold text-gray-800">
                          {qr.product?.name || "Unknown Product"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {qr.sku ? `SKU: ${qr.sku}` : "No Variant"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-mono text-gray-500">{qr.batch_label || "—"}</span>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-700 border-0 font-bold">
                          +{qr.reward_points || 0}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] font-bold tracking-wider uppercase border-0 ${sc.color}`}>
                          {sc.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {qr.scanned_by_profile ? (
                          <div>
                            <p className="text-sm font-medium text-gray-900">{qr.scanned_by_profile.full_name}</p>
                            <p className="text-xs text-gray-400">{qr.scanned_by_profile.phone}</p>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-500">{formatDate(qr.created_at)}</span>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {qrCodes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-16 text-gray-500">
                      <QrCode className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                      <p className="font-medium text-lg">No QR codes found</p>
                      <p className="text-sm text-gray-400 mt-1">Generate a batch using the form on the left.</p>
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
