"use client";

import { useState, useRef } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { createClient } from "@/utils/supabase/client";
import { hasModulePermission } from "@/utils/permissions";
import { 
  BadgePercent, 
  Calendar, 
  Clock, 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  Boxes, 
  Layers, 
  AlertCircle,
  CheckCircle2,
  X,
  Image as ImageIcon,
  Upload
} from "lucide-react";
import { toast } from "react-hot-toast";
import { formatDate } from "@/lib/utils";
import { optimizeImage } from "@/utils/imageOptimizer";

// Convert ISO / Date object to DD/MM/YYYY HH:mm display format
function toDisplayDate(isoOrDate) {
  if (!isoOrDate) return "";
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${mins}`;
}

// Parse DD/MM/YYYY HH:mm or ISO string into a valid Date object
function parseDisplayDate(dateStr) {
  if (!dateStr) return null;
  if (typeof dateStr !== "string") return new Date(dateStr);
  const trimmed = dateStr.trim();
  // Check DD/MM/YYYY HH:mm or DD/MM/YYYY
  const match = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (match) {
    const [, dd, mm, yyyy, hh = "00", min = "00"] = match;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min));
    if (!isNaN(d.getTime())) return d;
  }
  const fallback = new Date(trimmed);
  return isNaN(fallback.getTime()) ? null : fallback;
}

// Convert DD/MM/YYYY HH:mm display string to YYYY-MM-DDTHH:mm for native datetime-local picker
function toNativeDatetimeValue(displayStr) {
  const d = parseDisplayDate(displayStr);
  if (!d) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

// Custom Date & Time input with DD/MM/YYYY HH:mm format and calendar picker popup
function DateTimeInput({ label, value, onChange, required = false }) {
  const hiddenPickerRef = useRef(null);

  const handleNativeChange = (e) => {
    if (e.target.value) {
      onChange(toDisplayDate(e.target.value));
    }
  };

  const handleOpenPicker = () => {
    if (hiddenPickerRef.current) {
      if (typeof hiddenPickerRef.current.showPicker === "function") {
        hiddenPickerRef.current.showPicker();
      } else {
        hiddenPickerRef.current.focus();
      }
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="font-semibold text-gray-700 text-sm">
          {label} {required && <span className="text-red-500">*</span>}
        </Label>
        <span className="text-[11px] text-gray-400 font-mono">DD/MM/YYYY HH:mm</span>
      </div>
      <div className="relative flex items-center">
        <Input
          type="text"
          placeholder="DD/MM/YYYY HH:mm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className="pr-10 font-mono text-sm bg-white"
        />
        <button
          type="button"
          onClick={handleOpenPicker}
          className="absolute right-2 p-1.5 text-gray-500 hover:text-primary hover:bg-gray-100 rounded-md transition-colors"
          title="Pick Date & Time"
        >
          <Calendar size={16} />
        </button>
        {/* Hidden native datetime-local for picker trigger */}
        <input
          ref={hiddenPickerRef}
          type="datetime-local"
          value={toNativeDatetimeValue(value)}
          onChange={handleNativeChange}
          className="sr-only pointer-events-none absolute w-0 h-0 opacity-0"
          tabIndex={-1}
        />
      </div>
      <p className="text-[11px] text-gray-400">
        Enter as <span className="font-semibold text-gray-600">DD/MM/YYYY HH:mm</span> or click the calendar icon
      </p>
    </div>
  );
}

function getInitialFormState() {
  const now = new Date();
  const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  return {
    title: "",
    description: "",
    target_role: "all",
    carousel_image_url: "",
    offer_type: "tiered_discount",
    value: 0,
    applicable_unit: "box",
    target_type: "all_products",
    target_ids: [],
    start_date: toDisplayDate(now),
    end_date: toDisplayDate(future),
    is_active: true,
    tiers: [
      { min_qty: 1, discount_percentage: 5, label: "Box Order 5% Off" },
      { min_qty: 10, discount_percentage: 11, label: "Bulk 10+ Box 11% Off" }
    ],
  };
};

export default function OffersClient({
  initialOffers = [],
  categories = [],
  products = [],
  profile,
  orgMember,
}) {
  const hasEditPermission = hasModulePermission(profile, orgMember, "offers", "edit");
  const [offers, setOffers] = useState(initialOffers);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [unitFilter, setUnitFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOfferId, setEditingOfferId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const [formData, setFormData] = useState(getInitialFormState);

  // Confirm dialog state
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: "",
    description: "",
    onConfirm: null,
    variant: "default",
  });

  const supabase = createClient();

  const handleOpenAddModal = () => {
    setEditingOfferId(null);
    setFormData(getInitialFormState());
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (offer) => {
    setEditingOfferId(offer.id);
    setFormData({
      title: offer.title || "",
      description: offer.description || "",
      target_role: offer.target_role || offer.target || "all",
      carousel_image_url: offer.carousel_image_url || offer.banner_url || "",
      offer_type: offer.offer_type || "tiered_discount",
      value: offer.value || 0,
      applicable_unit: offer.applicable_unit || "box",
      target_type: offer.target_type || "all_products",
      target_ids: offer.target_ids || [],
      start_date: toDisplayDate(offer.start_date || offer.starts_at),
      end_date: toDisplayDate(offer.end_date || offer.ends_at),
      is_active: offer.is_active ?? true,
      tiers: Array.isArray(offer.tiers) && offer.tiers.length > 0 ? offer.tiers : [
        { min_qty: 1, discount_percentage: 5, label: "Base Tier" }
      ],
    });
    setIsModalOpen(true);
  };

  // Tier row handlers
  const handleAddTier = () => {
    const lastTier = formData.tiers[formData.tiers.length - 1];
    const nextQty = lastTier ? Number(lastTier.min_qty) + 5 : 1;
    const nextDiscount = lastTier ? Number(lastTier.discount_percentage) + 2 : 5;
    const unitLabel = formData.applicable_unit === "box" ? "Box" : "Pcs";

    setFormData({
      ...formData,
      tiers: [
        ...formData.tiers,
        {
          min_qty: nextQty,
          discount_percentage: nextDiscount,
          label: `Tier ${formData.tiers.length + 1} (${nextQty}+ ${unitLabel})`
        }
      ]
    });
  };

  const handleRemoveTier = (index) => {
    if (formData.tiers.length <= 1) {
      toast.error("An offer must have at least one bracket tier.");
      return;
    }
    const updated = formData.tiers.filter((_, i) => i !== index);
    setFormData({ ...formData, tiers: updated });
  };

  // Upload carousel image to storage (folder: 'offers')
  const handleUploadCarouselImage = async (file) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file (PNG, JPG, WebP)");
      return;
    }

    setIsUploadingImage(true);
    const toastId = toast.loading("Optimizing and uploading banner to offers/ folder...");

    try {
      let optimizedFile;
      try {
        optimizedFile = await optimizeImage(file);
      } catch (optErr) {
        console.warn("Image optimization fallback to original:", optErr);
        optimizedFile = file;
      }

      const fileExt = optimizedFile.name?.split('.').pop() || 'webp';
      const cleanTitle = (formData.title || "offer")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
      const fileName = `offers/${cleanTitle || "banner"}_${Date.now()}.${fileExt}`;

      // Try uploading to 'offers' folder in 'products' bucket, or bucket 'offers'
      let targetBucket = "products";
      let uploadPath = fileName;

      let { error: uploadError } = await supabase.storage
        .from(targetBucket)
        .upload(uploadPath, optimizedFile, {
          upsert: true,
          contentType: optimizedFile.type || "image/webp",
        });

      // If 'products' bucket doesn't exist, try bucket 'offers'
      if (uploadError && (uploadError.message?.toLowerCase().includes("not found") || uploadError.statusCode === '404')) {
        targetBucket = "offers";
        uploadPath = `${cleanTitle || "banner"}_${Date.now()}.${fileExt}`;
        const fallbackRes = await supabase.storage
          .from(targetBucket)
          .upload(uploadPath, optimizedFile, {
            upsert: true,
            contentType: optimizedFile.type || "image/webp",
          });
        uploadError = fallbackRes.error;
      }

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from(targetBucket)
        .getPublicUrl(uploadPath);

      setFormData((prev) => ({
        ...prev,
        carousel_image_url: publicUrl,
      }));

      toast.success("Banner uploaded to offers folder!", { id: toastId });
    } catch (err) {
      console.error("Failed to upload image:", err);
      toast.error(err.message || "Failed to upload image to storage", { id: toastId });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleTierChange = (index, field, value) => {
    const updated = [...formData.tiers];
    updated[index] = {
      ...updated[index],
      [field]: field === "min_qty" || field === "discount_percentage" ? parseFloat(value) || 0 : value
    };
    setFormData({ ...formData, tiers: updated });
  };

  // Save / Update Offer
  const handleSaveOffer = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error("Please enter an offer title");
      return;
    }
    if (!formData.start_date || !formData.end_date) {
      toast.error("Please set start and end dates");
      return;
    }
    const startDateObj = parseDisplayDate(formData.start_date);
    const endDateObj = parseDisplayDate(formData.end_date);
    if (!startDateObj || !endDateObj) {
      toast.error("Please enter valid dates in DD/MM/YYYY HH:mm format");
      return;
    }
    if (endDateObj <= startDateObj) {
      toast.error("End date must be after the start date");
      return;
    }
    if (formData.tiers.length === 0) {
      toast.error("Please add at least one discount tier");
      return;
    }

    // Sort tiers ascending by min_qty
    const sortedTiers = [...formData.tiers].sort((a, b) => a.min_qty - b.min_qty);

    setIsSubmitting(true);
    try {
      const startDateIso = startDateObj.toISOString();
      const endDateIso = endDateObj.toISOString();

      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        target_role: formData.target_role || "all",
        target: formData.target_role || "all",
        carousel_image_url: (formData.carousel_image_url || "").trim() || null,
        banner_url: (formData.carousel_image_url || "").trim() || null,
        offer_type: formData.offer_type || "tiered_discount",
        value: sortedTiers[0]?.discount_percentage || 0,
        starts_at: startDateIso,
        ends_at: endDateIso,
        start_date: startDateIso,
        end_date: endDateIso,
        applicable_unit: formData.applicable_unit,
        target_type: formData.target_type,
        target_ids: formData.target_ids,
        is_active: formData.is_active,
        tiers: sortedTiers,
      };

      if (editingOfferId) {
        const { data, error } = await supabase
          .from("offers")
          .update(payload)
          .eq("id", editingOfferId)
          .select()
          .single();

        if (error) throw error;
        setOffers(offers.map(o => o.id === editingOfferId ? data : o));
        toast.success("Offer updated successfully!");
      } else {
        const { data, error } = await supabase
          .from("offers")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        setOffers([data, ...offers]);
        toast.success("New offer created successfully!");
      }

      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to save offer. Did you run the SQL migration in Supabase?");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle active/inactive
  const handleToggleActive = async (offer) => {
    try {
      const newStatus = !offer.is_active;
      const { error } = await supabase
        .from("offers")
        .update({ is_active: newStatus })
        .eq("id", offer.id);

      if (error) throw error;
      setOffers(offers.map(o => o.id === offer.id ? { ...o, is_active: newStatus } : o));
      toast.success(newStatus ? "Offer activated" : "Offer deactivated");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update status");
    }
  };

  // Delete offer
  const handleDeleteOffer = (offerId) => {
    setConfirmState({
      isOpen: true,
      title: "Delete Offer",
      description: "Are you sure you want to delete this offer? This cannot be undone.",
      variant: "danger",
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from("offers")
            .delete()
            .eq("id", offerId);

          if (error) throw error;
          setOffers(offers.filter(o => o.id !== offerId));
          toast.success("Offer deleted successfully");
        } catch (err) {
          console.error(err);
          toast.error("Failed to delete offer");
        }
      }
    });
  };

  // Helpers for filtering and status
  const now = new Date();
  const getOfferStatus = (offer) => {
    if (!offer.is_active) return { label: "Inactive", color: "bg-gray-100 text-gray-600 border-gray-200" };
    const start = new Date(offer.start_date || offer.starts_at);
    const end = new Date(offer.end_date || offer.ends_at);
    if (now < start) return { label: "Scheduled", color: "bg-blue-50 text-blue-700 border-blue-200" };
    if (now > end) return { label: "Expired", color: "bg-amber-50 text-amber-700 border-amber-200" };
    return { label: "Running", color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  };

  const filteredOffers = offers.filter(offer => {
    const matchesSearch = offer.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      offer.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesUnit = unitFilter === "all" || offer.applicable_unit === unitFilter;

    const offerRole = offer.target_role || offer.target || "all";
    const matchesRole = roleFilter === "all" || offerRole === roleFilter;

    let matchesStatus = true;
    const status = getOfferStatus(offer).label.toLowerCase();
    if (statusFilter !== "all") {
      matchesStatus = status === statusFilter;
    }

    return matchesSearch && matchesUnit && matchesRole && matchesStatus;
  });

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50/50">
      {/* Header */}
      <PageHeader
        title="Promotional Offers"
        subtitle="Manage periodic box & piece volume bracket discounts for dealers"
      >
        {hasEditPermission && (
          <Button
            onClick={handleOpenAddModal}
            className="bg-primary hover:bg-primary/90 text-white font-semibold flex items-center gap-2"
          >
            <Plus size={16} /> Create Offer
          </Button>
        )}
      </PageHeader>

      {/* Main Container */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Filter bar */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <Input
              placeholder="Search offers by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-gray-50 focus-visible:bg-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Audience / Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-10 px-3 border border-gray-200 rounded-md text-sm bg-gray-50 text-gray-700"
            >
              <option value="all">All Audiences</option>
              <option value="dealer">Dealers Only</option>
              <option value="carpenter">Carpenters Only</option>
            </select>

            {/* Unit Filter */}
            <select
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
              className="h-10 px-3 border border-gray-200 rounded-md text-sm bg-gray-50 text-gray-700"
            >
              <option value="all">All Units</option>
              <option value="box">Box Offers Only</option>
              <option value="piece">Piece Offers Only</option>
              <option value="any">Any Unit</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 px-3 border border-gray-200 rounded-md text-sm bg-gray-50 text-gray-700"
            >
              <option value="all">All Statuses</option>
              <option value="running">Running</option>
              <option value="scheduled">Scheduled</option>
              <option value="expired">Expired</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Offers List */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-gray-50/75">
              <TableRow>
                <TableHead className="font-bold text-gray-700">Offer / Title</TableHead>
                <TableHead className="font-bold text-gray-700">Audience</TableHead>
                <TableHead className="font-bold text-gray-700">Scope</TableHead>
                <TableHead className="font-bold text-gray-700">Unit</TableHead>
                <TableHead className="font-bold text-gray-700">Brackets / Discount</TableHead>
                <TableHead className="font-bold text-gray-700">Validity Period</TableHead>
                <TableHead className="font-bold text-gray-700 text-center">Status</TableHead>
                <TableHead className="font-bold text-gray-700 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOffers.length > 0 ? (
                filteredOffers.map((offer) => {
                  const status = getOfferStatus(offer);
                  const tiers = Array.isArray(offer.tiers) ? offer.tiers : [];
                  const bannerImg = offer.carousel_image_url || offer.banner_url;

                  return (
                    <TableRow key={offer.id} className="hover:bg-gray-50/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {bannerImg ? (
                            <img
                              src={bannerImg}
                              alt=""
                              className="w-14 h-8 object-cover rounded border border-gray-200 shadow-2xs flex-shrink-0"
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-14 h-8 rounded bg-gray-100 border border-dashed border-gray-300 flex items-center justify-center text-gray-400 flex-shrink-0" title="No Carousel Image">
                              <ImageIcon size={14} />
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-gray-900">{offer.title}</div>
                            {offer.description && (
                              <div className="text-xs text-gray-500 line-clamp-1 mt-0.5">{offer.description}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        {(offer.target_role === "dealer" || offer.target === "dealer") && (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-semibold">
                            👔 Dealer
                          </Badge>
                        )}
                        {(offer.target_role === "carpenter" || offer.target === "carpenter") && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs font-semibold">
                            🪚 Carpenter
                          </Badge>
                        )}
                        {(!offer.target_role || offer.target_role === "all" || (!offer.target_role && offer.target === "all")) && (
                          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200 text-xs">
                            🌐 All Users
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell>
                        {offer.target_type === "all_products" && (
                          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200 text-xs">
                            All Products
                          </Badge>
                        )}
                        {offer.target_type === "category" && (
                          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                            Category ({offer.target_ids?.length || 0})
                          </Badge>
                        )}
                        {offer.target_type === "product" && (
                          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs">
                            Selected Products ({offer.target_ids?.length || 0})
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700 capitalize">
                          {offer.applicable_unit === "box" ? <Boxes size={12} className="text-primary" /> : <Layers size={12} />}
                          {offer.applicable_unit}
                        </span>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-1">
                          {tiers.map((tier, idx) => (
                            <div key={idx} className="text-xs flex items-center gap-1.5 font-medium text-gray-700">
                              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                              <span>{tier.min_qty}+ {offer.applicable_unit === 'box' ? 'Boxes' : 'Pcs'}</span>
                              <span className="text-emerald-600 font-bold">→ {tier.discount_percentage}% off</span>
                            </div>
                          ))}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="text-xs text-gray-600 space-y-0.5">
                          <div className="flex items-center gap-1">
                            <Clock size={12} className="text-gray-400" />
                            <span>From: {formatDate(offer.start_date || offer.starts_at, true)}</span>
                          </div>
                          <div className="flex items-center gap-1 text-gray-500">
                            <span>To: {formatDate(offer.end_date || offer.ends_at, true)}</span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="text-center">
                        <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full border ${status.color}`}>
                          {status.label}
                        </span>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggleActive(offer)}
                            className={`text-xs px-2 py-1 rounded font-medium transition-colors ${
                              offer.is_active ? "bg-amber-50 text-amber-700 hover:bg-amber-100" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            }`}
                            title={offer.is_active ? "Deactivate" : "Activate"}
                          >
                            {offer.is_active ? "Deactivate" : "Activate"}
                          </button>

                          {hasEditPermission && (
                            <>
                              <button
                                onClick={() => handleOpenEditModal(offer)}
                                className="p-1.5 text-gray-500 hover:text-primary hover:bg-gray-100 rounded transition-colors"
                                title="Edit Offer"
                              >
                                <Edit3 size={15} />
                              </button>
                              <button
                                onClick={() => handleDeleteOffer(offer.id)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Delete Offer"
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-gray-400">
                    <BadgePercent size={36} className="mx-auto mb-2 text-gray-300" />
                    <p className="font-semibold text-gray-700">No promotional offers found</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {offers.length === 0
                        ? "Create your first box or piece bracket discount offer."
                        : "No offers match your search/filter criteria."}
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* CREATE / EDIT OFFER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden my-8 border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <BadgePercent className="text-primary" size={20} />
                <h3 className="font-bold text-gray-900 text-lg">
                  {editingOfferId ? "Edit Promotional Offer" : "Create New Promotional Offer"}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveOffer} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Title & Description */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="font-semibold text-gray-700 text-sm">
                    Offer Title <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="e.g. Diwali Box Bonanza (5% + 6% Bulk)"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="font-semibold text-gray-700 text-sm">Description (Optional)</Label>
                  <Textarea
                    placeholder="Brief details about terms, eligible dealer tiers, or highlights..."
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>

              {/* Target Audience & Unit Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="font-semibold text-gray-700 text-sm">Target Audience</Label>
                  <select
                    className="w-full h-10 px-3 border border-gray-200 rounded-md text-sm bg-gray-50 focus:bg-white"
                    value={formData.target_role}
                    onChange={(e) => setFormData({ ...formData, target_role: e.target.value })}
                  >
                    <option value="all">🌐 All Users (Dealers & Carpenters)</option>
                    <option value="dealer">👔 Dealers Only</option>
                    <option value="carpenter">🪚 Carpenters Only</option>
                  </select>
                  <p className="text-[11px] text-gray-500">Controls which mobile app role sees this offer in their carousel.</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="font-semibold text-gray-700 text-sm">Applicable Unit</Label>
                  <select
                    className="w-full h-10 px-3 border border-gray-200 rounded-md text-sm bg-gray-50 focus:bg-white"
                    value={formData.applicable_unit}
                    onChange={(e) => setFormData({ ...formData, applicable_unit: e.target.value })}
                  >
                    <option value="box">Box Orders Only (Packaging Promo)</option>
                    <option value="piece">Piece Orders (Loose/Pcs Promo)</option>
                    <option value="any">Any Unit (Box or Piece)</option>
                  </select>
                </div>
              </div>

              {/* Carousel Banner Image Upload */}
              <div className="space-y-3 p-4 bg-gray-50/80 rounded-xl border border-gray-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Label className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
                      <ImageIcon size={16} className="text-primary" /> Carousel Banner Image
                    </Label>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Saved in Supabase storage folder: <code className="font-mono text-primary font-bold">offers/</code>
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    Recommended: 800 × 340 px (2.35:1) • Max 1 MB
                  </span>
                </div>

                {formData.carousel_image_url ? (
                  <div className="space-y-2">
                    <div className="relative group rounded-xl border border-gray-200 overflow-hidden bg-gray-100 w-full max-w-md aspect-[2.35/1] shadow-xs">
                      <img
                        src={formData.carousel_image_url}
                        alt="Carousel Banner Preview"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <label className="cursor-pointer px-3 py-1.5 bg-white text-gray-900 text-xs font-semibold rounded-lg shadow hover:bg-gray-100 flex items-center gap-1.5">
                          <Upload size={13} />
                          Replace Banner
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={isUploadingImage}
                            onChange={(e) => {
                              if (e.target.files?.[0]) {
                                handleUploadCarouselImage(e.target.files[0]);
                                e.target.value = "";
                              }
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, carousel_image_url: "" })}
                          className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg shadow hover:bg-red-700 flex items-center gap-1"
                        >
                          <Trash2 size={13} />
                          Remove
                        </button>
                      </div>
                    </div>
                    <div className="text-[11px] text-gray-500 flex items-center gap-1 break-all">
                      <span className="text-gray-400 font-medium">Path:</span> {formData.carousel_image_url}
                    </div>
                  </div>
                ) : (
                  <label className="relative flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl bg-white hover:bg-gray-50/80 transition-colors cursor-pointer p-6 text-center w-full max-w-md aspect-[2.35/1] group">
                    {isUploadingImage ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-semibold text-gray-600">Uploading to storage offers/ folder...</span>
                      </div>
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                          <Upload size={20} />
                        </div>
                        <span className="text-xs font-bold text-gray-800">Click or drag banner image to upload</span>
                        <span className="text-[11px] text-gray-400 mt-1">Automatically compressed & saved to <code className="text-primary font-mono font-medium">offers/</code> folder</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={isUploadingImage}
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              handleUploadCarouselImage(e.target.files[0]);
                              e.target.value = "";
                            }
                          }}
                        />
                      </>
                    )}
                  </label>
                )}

                {/* Optional direct URL input */}
                <div className="flex items-center gap-2 pt-1 max-w-md">
                  <span className="text-[11px] text-gray-400 font-medium whitespace-nowrap">Or URL:</span>
                  <Input
                    placeholder="https://... direct image URL"
                    value={formData.carousel_image_url}
                    onChange={(e) => setFormData({ ...formData, carousel_image_url: e.target.value })}
                    className="h-8 text-xs bg-white"
                  />
                </div>
              </div>

              {/* Target Scope */}
              <div className="space-y-1.5">
                <Label className="font-semibold text-gray-700 text-sm">Target Scope</Label>
                <select
                  className="w-full h-10 px-3 border border-gray-200 rounded-md text-sm bg-gray-50 focus:bg-white"
                  value={formData.target_type}
                  onChange={(e) => setFormData({ ...formData, target_type: e.target.value, target_ids: [] })}
                >
                  <option value="all_products">All Products</option>
                  <option value="category">Specific Category</option>
                  <option value="product">Specific Products</option>
                </select>
              </div>

              {/* Target Selector based on scope */}
              {formData.target_type === "category" && (
                <div className="space-y-1.5">
                  <Label className="font-semibold text-gray-700 text-sm">Select Category</Label>
                  <select
                    className="w-full h-10 px-3 border border-gray-200 rounded-md text-sm bg-gray-50"
                    value={formData.target_ids[0] || ""}
                    onChange={(e) => setFormData({ ...formData, target_ids: e.target.value ? [e.target.value] : [] })}
                  >
                    <option value="">Select a category...</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {formData.target_type === "product" && (
                <div className="space-y-1.5">
                  <Label className="font-semibold text-gray-700 text-sm">Select Eligible Products</Label>
                  <div className="max-h-36 overflow-y-auto border border-gray-200 rounded-md p-2 space-y-1 bg-gray-50">
                    {products.map((p) => {
                      const isSelected = formData.target_ids.includes(p.id);
                      return (
                        <label key={p.id} className="flex items-center gap-2 p-1.5 hover:bg-white rounded cursor-pointer text-xs">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({ ...formData, target_ids: [...formData.target_ids, p.id] });
                              } else {
                                setFormData({ ...formData, target_ids: formData.target_ids.filter(id => id !== p.id) });
                              }
                            }}
                            className="rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <span className="font-medium text-gray-800">{p.name}</span>
                          {p.sku && <span className="text-gray-400">({p.sku})</span>}
                        </label>
                      );
                    })}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    Selected: {formData.target_ids.length} product(s)
                  </div>
                </div>
              )}

              {/* Validity Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DateTimeInput
                  label="Start Date & Time"
                  value={formData.start_date}
                  onChange={(val) => setFormData({ ...formData, start_date: val })}
                  required
                />
                <DateTimeInput
                  label="End Date & Time"
                  value={formData.end_date}
                  onChange={(val) => setFormData({ ...formData, end_date: val })}
                  required
                />
              </div>

              {/* All-Unit Bracket Tiers Editor */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                      Volume Bracket Tiers (All-Unit Discount)
                    </h4>
                    <p className="text-[11px] text-gray-500">
                      When ordered quantity reaches a tier, the discount applies to <strong>ALL units</strong> directly.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddTier}
                    className="text-xs h-7 border-primary/30 text-primary hover:bg-primary/5"
                  >
                    <Plus size={12} className="mr-1" /> Add Tier
                  </Button>
                </div>

                <div className="space-y-2">
                  {formData.tiers.map((tier, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-gray-200 shadow-sm">
                      <div className="w-24">
                        <Label className="text-[10px] font-bold text-gray-400 uppercase">Min Qty</Label>
                        <Input
                          type="number"
                          min="1"
                          value={tier.min_qty}
                          onChange={(e) => handleTierChange(idx, "min_qty", e.target.value)}
                          className="h-8 text-xs font-semibold"
                          placeholder="Qty"
                          required
                        />
                      </div>

                      <div className="w-28">
                        <Label className="text-[10px] font-bold text-gray-400 uppercase">Discount (%)</Label>
                        <div className="relative">
                          <Input
                            type="number"
                            min="0.1"
                            max="100"
                            step="0.1"
                            value={tier.discount_percentage}
                            onChange={(e) => handleTierChange(idx, "discount_percentage", e.target.value)}
                            className="h-8 text-xs font-bold text-emerald-600 pr-5"
                            placeholder="%"
                            required
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">%</span>
                        </div>
                      </div>

                      <div className="flex-1">
                        <Label className="text-[10px] font-bold text-gray-400 uppercase">Tier Label</Label>
                        <Input
                          type="text"
                          value={tier.label || ""}
                          onChange={(e) => handleTierChange(idx, "label", e.target.value)}
                          className="h-8 text-xs"
                          placeholder="e.g. Bulk 10+ Box 11% Off"
                        />
                      </div>

                      <div className="pt-4">
                        <button
                          type="button"
                          onClick={() => handleRemoveTier(idx)}
                          className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 transition-colors"
                          title="Remove tier"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Example Explainer Box */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-900 flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong>Bracket Calculation Preview:</strong> If a dealer orders 12 {formData.applicable_unit === 'box' ? 'boxes' : 'pcs'}, the system finds the highest matching tier and applies that discount to <strong>all 12 {formData.applicable_unit === 'box' ? 'boxes' : 'pcs'}</strong>!
                  </div>
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="offerActive"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 rounded text-primary focus:ring-primary border-gray-300"
                />
                <Label htmlFor="offerActive" className="text-sm font-semibold text-gray-700 cursor-pointer">
                  Activate this offer immediately upon save
                </Label>
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-primary hover:bg-primary/90 text-white font-semibold"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Saving..." : editingOfferId ? "Update Offer" : "Create Offer"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState({ ...confirmState, isOpen: false })}
        title={confirmState.title}
        description={confirmState.description}
        onConfirm={confirmState.onConfirm}
        variant={confirmState.variant}
      />
    </div>
  );
}
