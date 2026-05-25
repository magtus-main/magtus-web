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
  FileText,
  X,
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
import QRCode from "qrcode";
import { jsPDF } from "jspdf";

const PAGE_SIZE = 20;

const STICKER_PRESETS = [
  { label: "Small (25×25 mm)", width: 25, height: 25 },
  { label: "Medium (38×38 mm)", width: 38, height: 38 },
  { label: "Large (50×50 mm)", width: 50, height: 50 },
  { label: "XL (65×65 mm)", width: 65, height: 65 },
];

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

  // PDF Export modal
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [stickerPreset, setStickerPreset] = useState(1); // default Medium
  const [customWidth, setCustomWidth] = useState("");
  const [customHeight, setCustomHeight] = useState("");
  const [useCustomSize, setUseCustomSize] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState("");
  const [exportFormat, setExportFormat] = useState("roll"); // "roll", "a4", "zip"
  const [includeTextLabel, setIncludeTextLabel] = useState(true);

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

  // ─── PDF EXPORT ──────────────────────────────────────────
  const handleExportPDF = async () => {
    try {
      setPdfExporting(true);
      setExportProgress("Fetching QRs...");

      // Determine sticker size in mm (for A4 and ZIP formats)
      const stickerW = useCustomSize ? parseFloat(customWidth) : STICKER_PRESETS[stickerPreset].width;
      const stickerH = useCustomSize ? parseFloat(customHeight) : STICKER_PRESETS[stickerPreset].height;

      if ((exportFormat === "a4" || exportFormat === "zip") && (!stickerW || !stickerH || stickerW < 15 || stickerH < 15)) {
        toast.error("Sticker size must be at least 15mm.");
        setPdfExporting(false);
        return;
      }

      // Fetch all available QR codes matching current filters
      let query = supabase
        .from("qr_codes")
        .select(`*, product:products(name, specifications)`)
        .eq("status", "available")
        .order("created_at", { ascending: false });

      if (searchQuery.trim()) {
        query = query.or(`code.ilike.%${searchQuery}%,batch_label.ilike.%${searchQuery}%`);
      }

      const { data: allQRCodes, error } = await query;
      if (error) throw error;

      if (!allQRCodes || allQRCodes.length === 0) {
        toast.error("No available QR codes found to export.");
        setPdfExporting(false);
        return;
      }

      // 1. ROLL FORMAT: 4-Across Roll PDF (100x25mm rows)
      if (exportFormat === "roll") {
        const doc = new jsPDF({
          orientation: "landscape",
          unit: "mm",
          format: [100, 25],
        });

        for (let i = 0; i < allQRCodes.length; i += 4) {
          setExportProgress(`Row ${Math.floor(i / 4) + 1}/${Math.ceil(allQRCodes.length / 4)}...`);

          if (i > 0) {
            doc.addPage([100, 25], "landscape");
          }

          for (let col = 0; col < 4; col++) {
            const qrIdx = i + col;
            if (qrIdx < allQRCodes.length) {
              const qr = allQRCodes[qrIdx];

              // Generate QR code as data URL
              const qrDataUrl = await QRCode.toDataURL(qr.code, {
                width: 400,
                margin: 1,
                errorCorrectionLevel: "M",
              });

              // Centering calculations:
              // Column width = 25mm. Centered QR Code bounding box.
              // If includeTextLabel is true: qrSize = 16x16mm, centered horizontally, shifted up to y = 3.0mm.
              // This leaves a 2.5mm horizontal margin (at col*25 + 4.5) and fits everything in the 20x20mm bounding box.
              const qrSize = includeTextLabel ? 16 : 20;
              const qrX = col * 25 + (25 - qrSize) / 2;
              const qrY = includeTextLabel ? 3.0 : 2.5;

              doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);

              if (includeTextLabel) {
                // Centered at x = col * 25 + 12.5, y = 21.8 (within 20x20mm print area limit)
                doc.setFont("helvetica", "bold");
                doc.setFontSize(4.2); // sharp, clear 4pt font
                doc.text(qr.code, col * 25 + 12.5, 21.8, { align: "center" });
              }
            }
          }
        }

        setExportProgress("Downloading PDF...");
        const pdfOutput = doc.output("blob");
        const url = URL.createObjectURL(pdfOutput);
        const a = document.createElement("a");
        a.href = url;
        a.download = `qr_roll_4across_${new Date().toISOString().slice(0, 10)}.pdf`;
        a.click();
        URL.revokeObjectURL(url);

        toast.success(`Exported ${allQRCodes.length} QR codes in 4-Across Roll PDF!`);
        setShowPdfModal(false);
      } 
      
      // 2. A4 GRID FORMAT: Lays out stickers in grid on A4 sheet
      else if (exportFormat === "a4") {
        const doc = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4",
        });

        const labelH = includeTextLabel ? (stickerW >= 38 ? 6 : 5) : 0;
        const cellW = stickerW;
        const cellH = stickerH + labelH;
        const gap = 2; // spacing between stickers

        // Margins and printable grid size
        const marginX = 10;
        const marginY = 10;
        const colsCount = Math.max(1, Math.floor((210 - 2 * marginX + gap) / (cellW + gap)));
        const rowsCount = Math.max(1, Math.floor((297 - 2 * marginY + gap) / (cellH + gap)));
        const perPage = colsCount * rowsCount;

        // Auto-center grid inside A4 page dimensions
        const totalGridW = colsCount * cellW + (colsCount - 1) * gap;
        const totalGridH = rowsCount * cellH + (rowsCount - 1) * gap;
        const startX = (210 - totalGridW) / 2;
        const startY = (297 - totalGridH) / 2;

        for (let i = 0; i < allQRCodes.length; i++) {
          setExportProgress(`Page ${Math.floor(i / perPage) + 1} (${i + 1}/${allQRCodes.length})...`);

          if (i > 0 && i % perPage === 0) {
            doc.addPage("a4", "portrait");
          }

          const pageIdx = i % perPage;
          const colIdx = pageIdx % colsCount;
          const rowIdx = Math.floor(pageIdx / colsCount);

          const xOffset = startX + colIdx * (cellW + gap);
          const yOffset = startY + rowIdx * (cellH + gap);

          const qr = allQRCodes[i];
          const qrDataUrl = await QRCode.toDataURL(qr.code, {
            width: 400,
            margin: 1,
            errorCorrectionLevel: "M",
          });

          if (includeTextLabel) {
            const qrImgSize = Math.min(stickerW, stickerH) - 4;
            const qrX = xOffset + (stickerW - qrImgSize) / 2;
            const qrY = yOffset + 1.5;
            doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrImgSize, qrImgSize);

            const idFontSize = stickerW >= 50 ? 8 : stickerW >= 38 ? 6 : 5;
            const textX = xOffset + stickerW / 2;
            const textY = yOffset + stickerH + (labelH / 2) + 0.5;

            doc.setFont("helvetica", "bold");
            doc.setFontSize(idFontSize);
            doc.text(qr.code, textX, textY, { align: "center" });
          } else {
            const qrImgSize = Math.min(stickerW, stickerH) - 2;
            const qrX = xOffset + (stickerW - qrImgSize) / 2;
            const qrY = yOffset + (stickerH - qrImgSize) / 2;
            doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrImgSize, qrImgSize);
          }
        }

        setExportProgress("Downloading PDF...");
        const pdfOutput = doc.output("blob");
        const url = URL.createObjectURL(pdfOutput);
        const a = document.createElement("a");
        a.href = url;
        a.download = `qr_a4_grid_${new Date().toISOString().slice(0, 10)}.pdf`;
        a.click();
        URL.revokeObjectURL(url);

        toast.success(`Exported ${allQRCodes.length} QR codes in A4 Grid PDF!`);
        setShowPdfModal(false);
      } 
      
      // 3. ZIP FORMAT: Original Zip archive of individual label PDFs
      else if (exportFormat === "zip") {
        const labelHeight = stickerW >= 38 ? 6 : 5;
        const totalStickerH = stickerH + labelHeight;

        // Import JSZip dynamically
        const JSZip = (await import("jszip")).default;
        const zip = new JSZip();
        const qrFolder = zip.folder("qr_stickers");

        for (let i = 0; i < allQRCodes.length; i++) {
          const qr = allQRCodes[i];
          setExportProgress(`ZIP ${i + 1}/${allQRCodes.length}...`);

          // Generate QR code as data URL
          const qrDataUrl = await QRCode.toDataURL(qr.code, {
            width: 400,
            margin: 1,
            errorCorrectionLevel: "M",
          });

          // Create individual PDF for this QR code matching sticker size exactly
          const doc = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: [stickerW, totalStickerH],
          });

          // Draw QR code image
          const qrImgSize = Math.min(stickerW, stickerH) - 2;
          const qrX = (stickerW - qrImgSize) / 2;
          const qrY = 1;
          doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrImgSize, qrImgSize);

          // Set font size based on sticker width for QR ID
          const idFontSize = stickerW >= 50 ? 8 : stickerW >= 38 ? 6 : 5;
          const textX = stickerW / 2;
          const textY = stickerH + (labelHeight / 2) + 0.5;

          // Draw only the QR ID so user can enter manually if they want
          doc.setFont("helvetica", "bold");
          doc.setFontSize(idFontSize);
          doc.text(qr.code, textX, textY, { align: "center" });

          // Output PDF to ArrayBuffer and add to zip folder
          const pdfOutput = doc.output("arraybuffer");
          const fileName = `${qr.code}.pdf`;
          qrFolder.file(fileName, pdfOutput);
        }

        setExportProgress("Archiving ZIP...");
        const content = await zip.generateAsync({ type: "blob" });

        const url = URL.createObjectURL(content);
        const a = document.createElement("a");
        a.href = url;
        a.download = `qr_stickers_${new Date().toISOString().slice(0, 10)}.zip`;
        a.click();
        URL.revokeObjectURL(url);

        toast.success(`Exported ${allQRCodes.length} QR PDFs in a ZIP archive!`);
        setShowPdfModal(false);
      }
    } catch (err) {
      console.error("PDF export failed:", err);
      toast.error("Failed to export: " + (err.message || "Unknown error"));
    } finally {
      setPdfExporting(false);
      setExportProgress("");
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
            <Button onClick={() => setShowPdfModal(true)} className="h-9 bg-primary hover:bg-primary/90 text-white font-semibold text-xs">
              <Printer size={14} className="mr-2" /> Export PDF
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

      {/* ─── PDF EXPORT MODAL ──────────────────────────────── */}
      {showPdfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-primary" />
                <h3 className="text-lg font-bold text-gray-900">Export QR Stickers</h3>
              </div>
              <button onClick={() => setShowPdfModal(false)} className="p-1 rounded-md hover:bg-gray-200 transition-colors">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5 text-left">
              <p className="text-xs text-gray-500 leading-normal">
                Choose the layout format below to generate print-ready QR codes. Only <strong>available</strong> (unscanned) QR codes will be exported.
              </p>

              {/* Format selection tabs */}
              <div className="space-y-2">
                <Label className="font-semibold text-gray-700 text-sm">Print Layout Format</Label>
                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg w-full border border-gray-200/50">
                  {[
                    { id: "roll", label: "4-Across Roll" },
                    { id: "a4", label: "A4 Sheet Grid" },
                    { id: "zip", label: "ZIP Archive" }
                  ].map((fmt) => (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => setExportFormat(fmt.id)}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                        exportFormat === fmt.id
                          ? "bg-white text-primary shadow-sm border border-gray-200/40"
                          : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/40"
                      }`}
                    >
                      {fmt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Format-specific configurations */}
              {exportFormat === "roll" && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="bg-primary/5 border border-primary/10 rounded-lg p-4 space-y-2">
                    <p className="text-xs text-primary font-bold flex items-center gap-1.5">
                      <Printer size={13} /> Custom for TSC TTP-244 Thermal Printer
                    </p>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      Generates a continuous landscape PDF matching a <strong>100mm wide roll</strong> (4 columns of 25x25mm stickers per row).
                    </p>
                    <ul className="text-[10px] text-gray-500 list-disc pl-4 space-y-1">
                      <li>Total roll/page width: 100mm. Row height: 25mm.</li>
                      <li>QR code centered perfectly inside each 25x25mm sticker.</li>
                      <li>Includes a 2.5mm safe margin around edges to avoid feed clipping.</li>
                    </ul>
                  </div>

                  {/* Label toggle checkbox */}
                  <label className="flex items-center gap-3 cursor-pointer bg-gray-50 hover:bg-gray-100/70 p-3 rounded-lg border border-gray-150 transition-colors">
                    <input
                      type="checkbox"
                      checked={includeTextLabel}
                      onChange={(e) => setIncludeTextLabel(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/20 accent-primary"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-semibold text-gray-700 block">Include code labels</span>
                      <span className="text-[10px] text-gray-400 block">Prints a tiny, sharp 4.2pt text code under the QR code</span>
                    </div>
                  </label>
                </div>
              )}

              {exportFormat === "a4" && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                  <p className="text-xs text-gray-500 leading-normal">
                    Lays out the QR codes in a standard grid on standard A4 paper (210×297mm). Perfect for sheet-fed desktop printers.
                  </p>

                  {/* Preset sizes */}
                  <div className="space-y-2">
                    <Label className="font-semibold text-gray-700 text-sm">Sticker Size</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {STICKER_PRESETS.map((preset, idx) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => { setStickerPreset(idx); setUseCustomSize(false); }}
                          className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                            !useCustomSize && stickerPreset === idx
                              ? "border-primary bg-primary/5 text-primary ring-2 ring-primary/20"
                              : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom size toggle */}
                  <div className="space-y-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useCustomSize}
                        onChange={(e) => setUseCustomSize(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/20 accent-primary"
                      />
                      <span className="text-xs font-semibold text-gray-700">Use custom sticker size</span>
                    </label>
                    {useCustomSize && (
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-gray-500 font-semibold">Width (mm)</Label>
                          <Input
                            type="number"
                            placeholder="e.g. 40"
                            value={customWidth}
                            onChange={(e) => setCustomWidth(e.target.value)}
                            className="h-8 bg-white text-xs focus-visible:ring-primary"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-gray-500 font-semibold">Height (mm)</Label>
                          <Input
                            type="number"
                            placeholder="e.g. 40"
                            value={customHeight}
                            onChange={(e) => setCustomHeight(e.target.value)}
                            className="h-8 bg-white text-xs focus-visible:ring-primary"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Label toggle checkbox */}
                  <label className="flex items-center gap-3 cursor-pointer bg-gray-50 hover:bg-gray-100/70 p-3 rounded-lg border border-gray-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={includeTextLabel}
                      onChange={(e) => setIncludeTextLabel(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/20 accent-primary"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-semibold text-gray-700 block">Include code labels</span>
                      <span className="text-[10px] text-gray-400 block">Prints a sharp text code under the QR code</span>
                    </div>
                  </label>

                  {/* Preview info */}
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <p className="text-[11px] text-gray-500">
                      <strong>Page format:</strong> A4 Sheet &nbsp;|&nbsp;
                      <strong>Sticker:</strong> {useCustomSize ? `${customWidth || "??"}×${customHeight || "??"}` : `${STICKER_PRESETS[stickerPreset].width}×${STICKER_PRESETS[stickerPreset].height}`}mm &nbsp;|&nbsp;
                      <strong>Per page:</strong> ~{(() => {
                        const w = useCustomSize ? parseFloat(customWidth) : STICKER_PRESETS[stickerPreset].width;
                        const h = useCustomSize ? parseFloat(customHeight) : STICKER_PRESETS[stickerPreset].height;
                        if (!w || !h || w < 15 || h < 15) return "?";
                        const cols = Math.floor((210 - 20 + 2) / (w + 2));
                        const labelH = includeTextLabel ? (w >= 38 ? 6 : 5) : 0;
                        const rows = Math.floor((297 - 20 + 2) / ((h + labelH) + 2));
                        return cols * rows;
                      })()} stickers
                    </p>
                  </div>
                </div>
              )}

              {exportFormat === "zip" && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                  <p className="text-xs text-gray-500 leading-normal">
                    Generates separate individual PDF files matching the exact sticker size, then packages them together in a single ZIP file. Useful for single label printing software.
                  </p>

                  {/* Preset sizes */}
                  <div className="space-y-2">
                    <Label className="font-semibold text-gray-700 text-sm">Sticker Size</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {STICKER_PRESETS.map((preset, idx) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => { setStickerPreset(idx); setUseCustomSize(false); }}
                          className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                            !useCustomSize && stickerPreset === idx
                              ? "border-primary bg-primary/5 text-primary ring-2 ring-primary/20"
                              : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom size toggle */}
                  <div className="space-y-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useCustomSize}
                        onChange={(e) => setUseCustomSize(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/20 accent-primary"
                      />
                      <span className="text-xs font-semibold text-gray-700">Use custom sticker size</span>
                    </label>
                    {useCustomSize && (
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-gray-500 font-semibold">Width (mm)</Label>
                          <Input
                            type="number"
                            placeholder="e.g. 40"
                            value={customWidth}
                            onChange={(e) => setCustomWidth(e.target.value)}
                            className="h-8 bg-white text-xs focus-visible:ring-primary"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-gray-500 font-semibold">Height (mm)</Label>
                          <Input
                            type="number"
                            placeholder="e.g. 40"
                            value={customHeight}
                            onChange={(e) => setCustomHeight(e.target.value)}
                            className="h-8 bg-white text-xs focus-visible:ring-primary"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              <Button variant="outline" onClick={() => setShowPdfModal(false)} className="h-9 text-sm font-semibold">
                Cancel
              </Button>
              <Button
                onClick={handleExportPDF}
                disabled={pdfExporting}
                className="h-9 bg-primary hover:bg-primary/90 text-white font-semibold text-sm"
              >
                {pdfExporting ? (
                  <>
                    <RefreshCcw size={14} className="mr-2 animate-spin" />
                    {exportProgress || "Generating..."}
                  </>
                ) : (
                  <>
                    <Printer size={14} className="mr-2" />
                    Generate PDF
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
