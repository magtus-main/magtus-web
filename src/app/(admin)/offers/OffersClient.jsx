"use client";

import { useState, useRef, useMemo } from "react";
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
  Upload,
  Eye,
  ShieldAlert,
  Coins,
  Sparkles,
  Gift,
  Tag,
  Sliders,
  FileText,
  UserCheck,
  TrendingUp,
  Percent,
  Check,
  ArrowRight
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
        <Label className="font-semibold text-gray-700 text-xs">
          {label} {required && <span className="text-red-500">*</span>}
        </Label>
        <span className="text-[10px] text-gray-400 font-mono">DD/MM/YYYY HH:mm</span>
      </div>
      <div className="relative flex items-center">
        <Input
          type="text"
          placeholder="DD/MM/YYYY HH:mm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className="pr-10 font-mono text-xs bg-white h-9"
        />
        <button
          type="button"
          onClick={handleOpenPicker}
          className="absolute right-2 p-1 text-gray-400 hover:text-primary hover:bg-gray-100 rounded transition-colors"
          title="Pick Date & Time"
        >
          <Calendar size={14} />
        </button>
        <input
          ref={hiddenPickerRef}
          type="datetime-local"
          value={toNativeDatetimeValue(value)}
          onChange={handleNativeChange}
          className="sr-only pointer-events-none absolute w-0 h-0 opacity-0"
          tabIndex={-1}
        />
      </div>
    </div>
  );
}

function getInitialFormState() {
  const now = new Date();
  const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  return {
    title: "",
    title_hi: "",
    description: "",
    target_role: "all",
    carousel_image_url: "",
    offer_type: "tiered_discount",
    target_scope: "product",
    applicable_unit: "boxes",
    value: 0,
    min_purchase: 0,
    category_id: "",
    subcategory_id: "",
    product_id: "",
    target_ids: [],
    tiers: [
      { min_qty: 1, discount_percentage: 5, label: "Box Order 5% Off" },
      { min_qty: 10, discount_percentage: 11, label: "Bulk 10+ Box 11% Off" }
    ],
    is_stackable: false,
    max_discount_amount: "",
    max_bonus_points: "",
    per_user_limit: "",
    usage_limit: "",
    priority: 0,
    terms_and_conditions: "",
    start_date: toDisplayDate(now),
    end_date: toDisplayDate(future),
    is_active: true,
  };
}

export default function OffersClient({
  initialOffers = [],
  categories = [],
  subcategories = [],
  products = [],
  profile,
  orgMember,
}) {
  const hasEditPermission = hasModulePermission(profile, orgMember, "offers", "edit");
  const [offers, setOffers] = useState(initialOffers);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [unitFilter, setUnitFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOfferId, setEditingOfferId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState("general"); // general | rules | limits | terms

  // Detail view state
  const [detailOffer, setDetailOffer] = useState(null);

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

  // Helper maps for quick relation lookup
  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories]);
  const subcategoryMap = useMemo(() => new Map(subcategories.map(s => [s.id, s])), [subcategories]);
  const productMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);

  // Open Add Modal
  const handleOpenAddModal = () => {
    setEditingOfferId(null);
    setFormData(getInitialFormState());
    setActiveFormTab("general");
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (offer) => {
    setEditingOfferId(offer.id);
    
    // Normalize target_scope from legacy target_type if needed
    let scope = offer.target_scope;
    if (!scope) {
      if (offer.target_type === "all_products") scope = "product";
      else if (offer.target_type === "category") scope = "category";
      else if (offer.target_type === "product") scope = "product";
      else scope = "product";
    }

    // Normalize applicable_unit
    let unit = offer.applicable_unit || "boxes";
    if (unit === "box") unit = "boxes";
    if (unit === "piece") unit = "pcs";

    setFormData({
      title: offer.title || "",
      title_hi: offer.title_hi || "",
      description: offer.description || "",
      target_role: offer.target_role || offer.target || "all",
      carousel_image_url: offer.carousel_image_url || offer.banner_url || "",
      offer_type: offer.offer_type || "tiered_discount",
      target_scope: scope,
      applicable_unit: unit,
      value: offer.value ?? 0,
      min_purchase: offer.min_purchase ?? 0,
      category_id: offer.category_id || (offer.target_type === "category" ? offer.target_ids?.[0] : "") || "",
      subcategory_id: offer.subcategory_id || "",
      product_id: offer.product_id || (offer.target_type === "product" ? offer.target_ids?.[0] : "") || "",
      target_ids: offer.target_ids || [],
      tiers: Array.isArray(offer.tiers) && offer.tiers.length > 0 ? offer.tiers : [
        { min_qty: 1, discount_percentage: 5, label: "Base Tier" }
      ],
      is_stackable: Boolean(offer.is_stackable),
      max_discount_amount: offer.max_discount_amount != null ? offer.max_discount_amount : "",
      max_bonus_points: offer.max_bonus_points != null ? offer.max_bonus_points : "",
      per_user_limit: offer.per_user_limit != null ? offer.per_user_limit : "",
      usage_limit: offer.usage_limit != null ? offer.usage_limit : "",
      priority: offer.priority ?? 0,
      terms_and_conditions: offer.terms_and_conditions || "",
      start_date: toDisplayDate(offer.start_date || offer.starts_at),
      end_date: toDisplayDate(offer.end_date || offer.ends_at),
      is_active: offer.is_active ?? true,
    });
    setActiveFormTab("general");
    setIsModalOpen(true);
  };

  // Tier row handlers
  const handleAddTier = () => {
    const lastTier = formData.tiers[formData.tiers.length - 1];
    const nextQty = lastTier ? Number(lastTier.min_qty) + 5 : 1;
    const nextDiscount = lastTier ? Number(lastTier.discount_percentage) + 2 : 5;
    const unitLabel = formData.applicable_unit === "boxes" ? "Boxes" : "Pcs";

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

  const handleTierChange = (index, field, value) => {
    const updated = [...formData.tiers];
    updated[index] = {
      ...updated[index],
      [field]: field === "min_qty" || field === "discount_percentage" ? parseFloat(value) || 0 : value
    };
    setFormData({ ...formData, tiers: updated });
  };

  // Upload carousel image to storage
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
        console.warn("Image optimization fallback:", optErr);
        optimizedFile = file;
      }

      const fileExt = optimizedFile.name?.split('.').pop() || 'webp';
      const cleanTitle = (formData.title || "offer")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
      const fileName = `offers/${cleanTitle || "banner"}_${Date.now()}.${fileExt}`;

      let targetBucket = "products";
      let uploadPath = fileName;

      let { error: uploadError } = await supabase.storage
        .from(targetBucket)
        .upload(uploadPath, optimizedFile, {
          upsert: true,
          contentType: optimizedFile.type || "image/webp",
        });

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

      if (uploadError) throw uploadError;

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
      toast.error(err.message || "Failed to upload image", { id: toastId });
    } finally {
      setIsUploadingImage(false);
    }
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

    if (formData.offer_type === "tiered_discount" && formData.tiers.length === 0) {
      toast.error("Please add at least one discount tier for tiered discounts");
      return;
    }

    if (formData.target_scope === "subcategory" && !formData.subcategory_id) {
      toast.error("Please select a target subcategory");
      return;
    }
    if (formData.target_scope === "category" && !formData.category_id) {
      toast.error("Please select a target category");
      return;
    }
    if (formData.target_scope === "product" && !formData.product_id && (!formData.target_ids || formData.target_ids.length === 0)) {
      toast.error("Please select at least one eligible product");
      return;
    }

    // Sort tiers ascending by min_qty
    const sortedTiers = [...formData.tiers].sort((a, b) => a.min_qty - b.min_qty);

    setIsSubmitting(true);
    try {
      const startDateIso = startDateObj.toISOString();
      const endDateIso = endDateObj.toISOString();

      // Primary value determination
      let primaryValue = parseFloat(formData.value) || 0;
      if (formData.offer_type === "tiered_discount" && sortedTiers.length > 0) {
        primaryValue = sortedTiers[0].discount_percentage || 0;
      }

      // Map product targeting IDs
      const targetIds = formData.target_scope === "product" 
        ? (formData.target_ids.length > 0 ? formData.target_ids : (formData.product_id ? [formData.product_id] : []))
        : formData.target_scope === "category"
        ? (formData.category_id ? [formData.category_id] : [])
        : formData.target_scope === "subcategory"
        ? (formData.subcategory_id ? [formData.subcategory_id] : [])
        : [];

      const payload = {
        title: formData.title.trim(),
        title_hi: formData.title_hi?.trim() || null,
        description: formData.description.trim() || null,
        target_role: formData.target_role || "all",
        target: formData.target_role || "all",
        carousel_image_url: (formData.carousel_image_url || "").trim() || null,
        banner_url: (formData.carousel_image_url || "").trim() || null,
        offer_type: formData.offer_type,
        target_scope: formData.target_scope,
        target_type: formData.target_scope === "category" ? "category" : formData.target_scope === "product" ? "product" : "all_products",
        applicable_unit: formData.applicable_unit,
        value: primaryValue,
        min_purchase: parseFloat(formData.min_purchase) || 0,
        category_id: formData.target_scope === "category" ? formData.category_id || null : null,
        subcategory_id: formData.target_scope === "subcategory" ? formData.subcategory_id || null : null,
        product_id: formData.target_scope === "product" ? (formData.product_id || targetIds[0] || null) : null,
        target_ids: targetIds,
        tiers: formData.offer_type === "tiered_discount" ? sortedTiers : [],
        is_stackable: Boolean(formData.is_stackable),
        max_discount_amount: formData.max_discount_amount !== "" ? parseFloat(formData.max_discount_amount) : null,
        max_bonus_points: formData.max_bonus_points !== "" ? parseInt(formData.max_bonus_points) : null,
        per_user_limit: formData.per_user_limit !== "" ? parseInt(formData.per_user_limit) : null,
        usage_limit: formData.usage_limit !== "" ? parseInt(formData.usage_limit) : null,
        priority: parseInt(formData.priority) || 0,
        terms_and_conditions: formData.terms_and_conditions?.trim() || null,
        starts_at: startDateIso,
        ends_at: endDateIso,
        start_date: startDateIso,
        end_date: endDateIso,
        is_active: formData.is_active,
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
      toast.error(err.message || "Failed to save offer. Please verify database columns are up to date.");
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
      description: "Are you sure you want to delete this offer? This action cannot be undone.",
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

  const getScopeBadge = (offer) => {
    const scope = offer.target_scope || (offer.target_type === "category" ? "category" : offer.target_type === "product" ? "product" : "product");
    switch (scope) {
      case "subcategory": {
        const subName = subcategoryMap.get(offer.subcategory_id)?.name || "Subcategory";
        return (
          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-[11px] font-medium">
            🗂️ Subcat: {subName}
          </Badge>
        );
      }
      case "category": {
        const catName = categoryMap.get(offer.category_id) || "Category";
        return (
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[11px] font-medium">
            📁 Cat: {catName}
          </Badge>
        );
      }
      case "product": {
        const count = offer.target_ids?.length || (offer.product_id ? 1 : 0);
        const prodName = offer.product_id ? productMap.get(offer.product_id)?.name : null;
        return (
          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[11px] font-medium">
            📦 {prodName ? prodName.slice(0, 18) + (prodName.length > 18 ? "..." : "") : `Products (${count || "All"})`}
          </Badge>
        );
      }
      case "cart_subtotal":
        return (
          <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 text-[11px] font-medium">
            🛒 Cart Subtotal
          </Badge>
        );
      case "carpenter_scan":
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[11px] font-medium">
            🔍 Scan Threshold
          </Badge>
        );
      case "carpenter_milestone":
        return (
          <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[11px] font-medium">
            🏆 Monthly Milestone
          </Badge>
        );
      case "carpenter_redemption":
        return (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] font-medium">
            🎁 Redemption Bonus
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200 text-[11px]">
            {scope}
          </Badge>
        );
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case "tiered_discount": return "Tiered Brackets";
      case "flat_discount": return "Flat Discount";
      case "bonus_points": return "Bonus Points";
      case "multiplier": return "Points Multiplier";
      case "free_gift": return "Free Gift";
      case "milestone_points": return "Milestone Points";
      default: return type || "Discount";
    }
  };

  // Filtered offers list
  const filteredOffers = useMemo(() => {
    return offers.filter((offer) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = 
        !searchQuery ||
        offer.title?.toLowerCase().includes(q) ||
        offer.title_hi?.toLowerCase().includes(q) ||
        offer.description?.toLowerCase().includes(q);

      const offerRole = offer.target_role || offer.target || "all";
      const matchesRole = roleFilter === "all" || offerRole === roleFilter;

      const scope = offer.target_scope || (offer.target_type === "category" ? "category" : offer.target_type === "product" ? "product" : "product");
      const matchesScope = scopeFilter === "all" || scope === scopeFilter;

      const matchesType = typeFilter === "all" || offer.offer_type === typeFilter;

      let unit = offer.applicable_unit || "boxes";
      if (unit === "box") unit = "boxes";
      if (unit === "piece") unit = "pcs";
      const matchesUnit = unitFilter === "all" || unit === unitFilter;

      let matchesStatus = true;
      if (statusFilter !== "all") {
        matchesStatus = getOfferStatus(offer).label.toLowerCase() === statusFilter;
      }

      return matchesSearch && matchesRole && matchesScope && matchesType && matchesUnit && matchesStatus;
    });
  }, [offers, searchQuery, roleFilter, scopeFilter, typeFilter, unitFilter, statusFilter]);

  // Overall Statistics
  const stats = useMemo(() => {
    const total = offers.length;
    const running = offers.filter(o => getOfferStatus(o).label === "Running").length;
    const dealer = offers.filter(o => (o.target_role || o.target) === "dealer").length;
    const carpenter = offers.filter(o => (o.target_role || o.target) === "carpenter").length;
    return { total, running, dealer, carpenter };
  }, [offers]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50/50">
      {/* Header */}
      <PageHeader
        title="Promotional & Loyalty Offers"
        subtitle="Manage advanced dealer bracket discounts, subcategory promos, and carpenter scan/milestone rewards"
      >
        {hasEditPermission && (
          <Button
            onClick={handleOpenAddModal}
            className="bg-primary hover:bg-primary/90 text-white font-semibold flex items-center gap-2 shadow-xs"
          >
            <Plus size={16} /> Create Offer
          </Button>
        )}
      </PageHeader>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* KPI / Stats Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-2xs flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
              <BadgePercent size={20} />
            </div>
            <div>
              <div className="text-xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-xs text-gray-500 font-medium">Total Offers</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-2xs flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="text-xl font-bold text-emerald-600">{stats.running}</div>
              <div className="text-xs text-gray-500 font-medium">Live & Running</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-2xs flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Boxes size={20} />
            </div>
            <div>
              <div className="text-xl font-bold text-blue-600">{stats.dealer}</div>
              <div className="text-xs text-gray-500 font-medium">Dealer Offers</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-2xs flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Coins size={20} />
            </div>
            <div>
              <div className="text-xl font-bold text-amber-600">{stats.carpenter}</div>
              <div className="text-xs text-gray-500 font-medium">Carpenter Rewards</div>
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs space-y-3">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <Input
                placeholder="Search offers by title, Hindi title, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-gray-50/70 focus-visible:bg-white text-xs h-9"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Audience */}
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="h-9 px-2.5 border border-gray-200 rounded-lg text-xs bg-gray-50 text-gray-700 font-medium"
              >
                <option value="all">All Audiences</option>
                <option value="dealer">👔 Dealers Only</option>
                <option value="carpenter">🪚 Carpenters Only</option>
              </select>

              {/* Target Scope */}
              <select
                value={scopeFilter}
                onChange={(e) => setScopeFilter(e.target.value)}
                className="h-9 px-2.5 border border-gray-200 rounded-lg text-xs bg-gray-50 text-gray-700 font-medium"
              >
                <option value="all">All Scopes</option>
                <option value="subcategory">🗂️ Subcategory</option>
                <option value="product">📦 Product</option>
                <option value="category">📁 Category</option>
                <option value="cart_subtotal">🛒 Cart Subtotal</option>
                <option value="carpenter_scan">🔍 Carpenter Scan</option>
                <option value="carpenter_milestone">🏆 Monthly Milestone</option>
                <option value="carpenter_redemption">🎁 Redemption Bonus</option>
              </select>

              {/* Offer Type */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-9 px-2.5 border border-gray-200 rounded-lg text-xs bg-gray-50 text-gray-700 font-medium"
              >
                <option value="all">All Offer Types</option>
                <option value="tiered_discount">Tiered Brackets</option>
                <option value="flat_discount">Flat Discount</option>
                <option value="bonus_points">Bonus Points</option>
                <option value="multiplier">Points Multiplier</option>
                <option value="milestone_points">Milestone Points</option>
                <option value="free_gift">Free Gift</option>
              </select>

              {/* Unit */}
              <select
                value={unitFilter}
                onChange={(e) => setUnitFilter(e.target.value)}
                className="h-9 px-2.5 border border-gray-200 rounded-lg text-xs bg-gray-50 text-gray-700 font-medium"
              >
                <option value="all">All Units</option>
                <option value="boxes">Boxes</option>
                <option value="pcs">Pcs (Loose)</option>
                <option value="points">Points</option>
                <option value="amount">Amount (₹)</option>
              </select>

              {/* Status */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 px-2.5 border border-gray-200 rounded-lg text-xs bg-gray-50 text-gray-700 font-medium"
              >
                <option value="all">All Statuses</option>
                <option value="running">Live / Running</option>
                <option value="scheduled">Scheduled</option>
                <option value="expired">Expired</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {/* Offers Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
          <Table>
            <TableHeader className="bg-gray-50/80">
              <TableRow>
                <TableHead className="font-bold text-gray-700 text-xs">Offer / Title</TableHead>
                <TableHead className="font-bold text-gray-700 text-xs">Audience & Scope</TableHead>
                <TableHead className="font-bold text-gray-700 text-xs">Type & Unit</TableHead>
                <TableHead className="font-bold text-gray-700 text-xs">Reward / Brackets</TableHead>
                <TableHead className="font-bold text-gray-700 text-xs">Margin Caps & Safeguards</TableHead>
                <TableHead className="font-bold text-gray-700 text-xs">Validity</TableHead>
                <TableHead className="font-bold text-gray-700 text-xs text-center">Status</TableHead>
                <TableHead className="font-bold text-gray-700 text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOffers.length > 0 ? (
                filteredOffers.map((offer) => {
                  const status = getOfferStatus(offer);
                  const tiers = Array.isArray(offer.tiers) ? offer.tiers : [];
                  const bannerImg = offer.carousel_image_url || offer.banner_url;
                  const role = offer.target_role || offer.target || "all";

                  return (
                    <TableRow key={offer.id} className="hover:bg-gray-50/60 transition-colors">
                      {/* Offer Info */}
                      <TableCell className="max-w-[240px]">
                        <div className="flex items-center gap-2.5">
                          {bannerImg ? (
                            <img
                              src={bannerImg}
                              alt=""
                              className="w-12 h-9 object-cover rounded-md border border-gray-200 shadow-2xs flex-shrink-0 cursor-pointer hover:opacity-85 transition-opacity"
                              onClick={() => setDetailOffer(offer)}
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          ) : (
                            <div 
                              onClick={() => setDetailOffer(offer)}
                              className="w-12 h-9 rounded-md bg-gray-100 border border-dashed border-gray-300 flex items-center justify-center text-gray-400 flex-shrink-0 cursor-pointer hover:bg-gray-200/60"
                            >
                              <ImageIcon size={13} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div 
                              onClick={() => setDetailOffer(offer)}
                              className="font-semibold text-gray-900 text-xs truncate hover:text-primary cursor-pointer"
                              title={offer.title}
                            >
                              {offer.title}
                            </div>
                            {offer.title_hi && (
                              <div className="text-[11px] text-gray-500 truncate font-medium">
                                {offer.title_hi}
                              </div>
                            )}
                            {offer.description && (
                              <div className="text-[10px] text-gray-400 truncate mt-0.5">
                                {offer.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Audience & Scope */}
                      <TableCell>
                        <div className="space-y-1">
                          <div>
                            {role === "dealer" && (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-semibold py-0">
                                👔 Dealer
                              </Badge>
                            )}
                            {role === "carpenter" && (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-semibold py-0">
                                🪚 Carpenter
                              </Badge>
                            )}
                            {role === "all" && (
                              <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-200 text-[10px] font-medium py-0">
                                🌐 All Users
                              </Badge>
                            )}
                          </div>
                          <div>{getScopeBadge(offer)}</div>
                        </div>
                      </TableCell>

                      {/* Type & Unit */}
                      <TableCell>
                        <div className="space-y-1">
                          <span className="inline-block text-xs font-semibold text-gray-800">
                            {getTypeLabel(offer.offer_type)}
                          </span>
                          <div className="flex items-center gap-1 text-[11px] text-gray-500">
                            <span className="capitalize px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-mono text-[10px]">
                              {offer.applicable_unit || "boxes"}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Reward / Brackets */}
                      <TableCell>
                        {offer.offer_type === "tiered_discount" || tiers.length > 0 ? (
                          <div className="space-y-0.5 max-w-[180px]">
                            {tiers.slice(0, 3).map((tier, idx) => (
                              <div key={idx} className="text-[11px] flex items-center justify-between text-gray-700">
                                <span className="font-mono text-gray-600">{tier.min_qty}+ {offer.applicable_unit === "pcs" ? "pcs" : "box"}</span>
                                <span className="text-emerald-600 font-bold ml-2">→ {tier.discount_percentage}% off</span>
                              </div>
                            ))}
                            {tiers.length > 3 && (
                              <div className="text-[10px] text-primary font-semibold">
                                +{tiers.length - 3} more tiers...
                              </div>
                            )}
                          </div>
                        ) : offer.offer_type === "multiplier" ? (
                          <div className="text-xs font-bold text-amber-600 flex items-center gap-1">
                            <TrendingUp size={13} /> {offer.value}x Multiplier
                          </div>
                        ) : offer.offer_type === "bonus_points" ? (
                          <div className="text-xs font-bold text-amber-600 flex items-center gap-1">
                            <Coins size={13} /> +{offer.value} Bonus Points
                          </div>
                        ) : (
                          <div className="text-xs font-bold text-emerald-600">
                            {offer.value}% Discount
                          </div>
                        )}
                      </TableCell>

                      {/* Margin Caps & Safeguards */}
                      <TableCell>
                        <div className="text-[11px] space-y-0.5 text-gray-600">
                          {offer.max_discount_amount ? (
                            <div className="text-emerald-700 font-medium">
                              Max Cap: <span className="font-bold">₹{Number(offer.max_discount_amount).toLocaleString()}</span>
                            </div>
                          ) : null}
                          {offer.max_bonus_points ? (
                            <div className="text-amber-700 font-medium">
                              Max Bonus: <span className="font-bold">{offer.max_bonus_points} pts</span>
                            </div>
                          ) : null}
                          <div className="flex items-center gap-2">
                            {offer.is_stackable ? (
                              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1 rounded border border-emerald-200">
                                Stackable
                              </span>
                            ) : (
                              <span className="text-[10px] text-gray-400">Non-stackable</span>
                            )}
                            {offer.per_user_limit ? (
                              <span className="text-[10px] text-gray-500 font-medium">
                                Limit: {offer.per_user_limit}/user
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>

                      {/* Validity */}
                      <TableCell>
                        <div className="text-[11px] text-gray-600 space-y-0.5">
                          <div className="flex items-center gap-1">
                            <Clock size={11} className="text-gray-400" />
                            <span>{formatDate(offer.start_date || offer.starts_at, true)}</span>
                          </div>
                          <div className="text-gray-400 text-[10px] pl-3.5">
                            to {formatDate(offer.end_date || offer.ends_at, true)}
                          </div>
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="text-center">
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${status.color}`}>
                          {status.label}
                        </span>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setDetailOffer(offer)}
                            className="p-1 text-gray-400 hover:text-primary hover:bg-primary/5 rounded transition-colors"
                            title="View Details"
                          >
                            <Eye size={15} />
                          </button>

                          <button
                            onClick={() => handleToggleActive(offer)}
                            className={`text-[10px] px-1.5 py-0.5 rounded font-semibold transition-colors ${
                              offer.is_active ? "bg-amber-50 text-amber-700 hover:bg-amber-100" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            }`}
                            title={offer.is_active ? "Deactivate Offer" : "Activate Offer"}
                          >
                            {offer.is_active ? "Pause" : "Live"}
                          </button>

                          {hasEditPermission && (
                            <>
                              <button
                                onClick={() => handleOpenEditModal(offer)}
                                className="p-1 text-gray-400 hover:text-primary hover:bg-gray-100 rounded transition-colors"
                                title="Edit Offer"
                              >
                                <Edit3 size={15} />
                              </button>
                              <button
                                onClick={() => handleDeleteOffer(offer.id)}
                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
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
                  <TableCell colSpan={8} className="text-center py-12 text-gray-400">
                    <BadgePercent size={36} className="mx-auto mb-2 text-gray-300" />
                    <p className="font-semibold text-gray-700">No promotional offers found</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {offers.length === 0
                        ? "Create your first dealer bracket discount or carpenter loyalty offer."
                        : "No offers match your search and filter criteria."}
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden my-6 border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-3.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/80">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <BadgePercent size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">
                    {editingOfferId ? "Edit Promotional Offer" : "Create New Promotional Offer"}
                  </h3>
                  <p className="text-[11px] text-gray-500">Configure targeting, brackets, loyalty multipliers, and margin limits</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center border-b border-gray-200 px-6 bg-white gap-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveFormTab("general")}
                className={`py-3 border-b-2 transition-colors ${
                  activeFormTab === "general"
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                1. Basic Info & Banner
              </button>
              <button
                type="button"
                onClick={() => setActiveFormTab("rules")}
                className={`py-3 border-b-2 transition-colors ${
                  activeFormTab === "rules"
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                2. Target & Rewards Rules
              </button>
              <button
                type="button"
                onClick={() => setActiveFormTab("limits")}
                className={`py-3 border-b-2 transition-colors ${
                  activeFormTab === "limits"
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                3. Margin Caps & Limits
              </button>
              <button
                type="button"
                onClick={() => setActiveFormTab("terms")}
                className={`py-3 border-b-2 transition-colors ${
                  activeFormTab === "terms"
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                4. Validity & Terms
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveOffer} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* TAB 1: GENERAL INFO & BANNER */}
              {activeFormTab === "general" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="font-semibold text-gray-700 text-xs">
                        Offer Title (English) <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        placeholder="e.g. Diwali Super Hinges Bonanza"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        required
                        className="text-xs h-9"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="font-semibold text-gray-700 text-xs">
                        Offer Title in Hindi (Optional)
                      </Label>
                      <Input
                        placeholder="उदा. दिवाली हिंजेज़ बंपर धमाका"
                        value={formData.title_hi}
                        onChange={(e) => setFormData({ ...formData, title_hi: e.target.value })}
                        className="text-xs h-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-semibold text-gray-700 text-xs">Description (Optional)</Label>
                    <Textarea
                      placeholder="Brief highlight explaining the offer benefits for dealers or carpenters..."
                      rows={2}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="text-xs"
                    />
                  </div>

                  {/* Carousel Banner Image Upload */}
                  <div className="space-y-3 p-4 bg-gray-50/80 rounded-xl border border-gray-200">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <Label className="font-semibold text-gray-900 text-xs flex items-center gap-1.5">
                          <ImageIcon size={14} className="text-primary" /> Carousel Banner Image
                        </Label>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          Shown on mobile home carousels. Compressed & uploaded to <code className="font-mono text-primary font-bold">offers/</code>
                        </p>
                      </div>
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Recommended: 800 × 340 px (2.35:1)
                      </span>
                    </div>

                    {formData.carousel_image_url ? (
                      <div className="space-y-2">
                        <div className="relative group rounded-xl border border-gray-200 overflow-hidden bg-gray-100 w-full max-w-md aspect-[2.35/1] shadow-2xs">
                          <img
                            src={formData.carousel_image_url}
                            alt="Banner Preview"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <label className="cursor-pointer px-2.5 py-1 bg-white text-gray-900 text-xs font-semibold rounded shadow hover:bg-gray-100 flex items-center gap-1">
                              <Upload size={12} /> Replace
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
                              className="px-2.5 py-1 bg-red-600 text-white text-xs font-semibold rounded shadow hover:bg-red-700 flex items-center gap-1"
                            >
                              <Trash2 size={12} /> Remove
                            </button>
                          </div>
                        </div>
                        <div className="text-[10px] text-gray-400 break-all">
                          URL: {formData.carousel_image_url}
                        </div>
                      </div>
                    ) : (
                      <label className="relative flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl bg-white hover:bg-gray-50/80 transition-colors cursor-pointer p-5 text-center w-full max-w-md aspect-[2.35/1] group">
                        {isUploadingImage ? (
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            <span className="text-xs font-semibold text-gray-600">Uploading banner image...</span>
                          </div>
                        ) : (
                          <>
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-1 group-hover:scale-105 transition-transform">
                              <Upload size={16} />
                            </div>
                            <span className="text-xs font-bold text-gray-800">Upload banner image</span>
                            <span className="text-[10px] text-gray-400">Click to browse or drop image</span>
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

                    <div className="flex items-center gap-2 pt-1 max-w-md">
                      <span className="text-[11px] text-gray-400 font-medium whitespace-nowrap">Or Direct URL:</span>
                      <Input
                        placeholder="https://... image link"
                        value={formData.carousel_image_url}
                        onChange={(e) => setFormData({ ...formData, carousel_image_url: e.target.value })}
                        className="h-8 text-xs bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: TARGET & REWARD RULES */}
              {activeFormTab === "rules" && (
                <div className="space-y-4">
                  {/* Audience, Offer Type & Scope grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="font-semibold text-gray-700 text-xs">Target Audience</Label>
                      <select
                        className="w-full h-9 px-2.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:bg-white font-medium"
                        value={formData.target_role}
                        onChange={(e) => setFormData({ ...formData, target_role: e.target.value })}
                      >
                        <option value="all">🌐 All Users</option>
                        <option value="dealer">👔 Dealers Only</option>
                        <option value="carpenter">🪚 Carpenters Only</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="font-semibold text-gray-700 text-xs">Offer Type</Label>
                      <select
                        className="w-full h-9 px-2.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:bg-white font-medium"
                        value={formData.offer_type}
                        onChange={(e) => setFormData({ ...formData, offer_type: e.target.value })}
                      >
                        <option value="tiered_discount">Tiered Brackets (% by Volume)</option>
                        <option value="flat_discount">Flat Discount (%)</option>
                        <option value="bonus_points">Bonus Reward Points</option>
                        <option value="multiplier">Points Multiplier (e.g. 2x)</option>
                        <option value="milestone_points">Milestone Points</option>
                        <option value="free_gift">Free Gift</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="font-semibold text-gray-700 text-xs">Target Scope</Label>
                      <select
                        className="w-full h-9 px-2.5 border border-gray-200 rounded-lg text-xs bg-gray-50 focus:bg-white font-medium"
                        value={formData.target_scope}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          target_scope: e.target.value,
                          subcategory_id: "",
                          category_id: "",
                          product_id: "",
                          target_ids: []
                        })}
                      >
                        <option value="subcategory">🗂️ Subcategory (e.g. Hinges)</option>
                        <option value="product">📦 Specific Product(s)</option>
                        <option value="category">📁 Main Category</option>
                        <option value="cart_subtotal">🛒 Cart Subtotal (Dealer)</option>
                        <option value="carpenter_scan">🔍 Carpenter Scan Threshold</option>
                        <option value="carpenter_milestone">🏆 Monthly Milestone Bonus</option>
                        <option value="carpenter_redemption">🎁 Carpenter Redemption Bonus</option>
                      </select>
                    </div>
                  </div>

                  {/* Applicable Unit & Base Threshold */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="space-y-1.5">
                      <Label className="font-semibold text-gray-700 text-xs">Applicable Unit</Label>
                      <select
                        className="w-full h-9 px-2.5 border border-gray-200 rounded-lg text-xs bg-white font-medium"
                        value={formData.applicable_unit}
                        onChange={(e) => setFormData({ ...formData, applicable_unit: e.target.value })}
                      >
                        <option value="boxes">Boxes (Full Packaging Orders)</option>
                        <option value="pcs">Pieces / Loose (Pcs)</option>
                        <option value="points">Points (Carpenter Scans)</option>
                        <option value="amount">Amount / Currency (₹)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="font-semibold text-gray-700 text-xs">
                        {formData.target_scope === "carpenter_milestone" || formData.target_scope === "carpenter_scan"
                          ? "Scan Points Threshold"
                          : "Minimum Order / Purchase Amount (₹)"}
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0 (no minimum threshold)"
                        value={formData.min_purchase}
                        onChange={(e) => setFormData({ ...formData, min_purchase: e.target.value })}
                        className="text-xs h-9 bg-white"
                      />
                      <span className="text-[10px] text-gray-400">
                        {formData.target_scope === "carpenter_milestone"
                          ? "e.g. 5000 (accumulate 5000 scan points in a month to trigger bonus)"
                          : "Minimum cart total or scan points required to qualify."}
                      </span>
                    </div>
                  </div>

                  {/* DYNAMIC SCOPE SELECTORS */}
                  {formData.target_scope === "subcategory" && (
                    <div className="space-y-1.5 p-3.5 bg-orange-50/50 rounded-xl border border-orange-200">
                      <Label className="font-bold text-orange-900 text-xs flex items-center gap-1.5">
                        <Tag size={13} className="text-orange-600" /> Select Target Subcategory *
                      </Label>
                      <select
                        className="w-full h-9 px-2.5 border border-orange-200 rounded-lg text-xs bg-white font-medium"
                        value={formData.subcategory_id}
                        onChange={(e) => setFormData({ ...formData, subcategory_id: e.target.value })}
                        required
                      >
                        <option value="">Choose a subcategory (e.g. Hinges, Telescopic Slides)...</option>
                        {subcategories.map((sub) => {
                          const parentName = categoryMap.get(sub.category_id) || "Category";
                          return (
                            <option key={sub.id} value={sub.id}>
                              {parentName} → {sub.name}
                            </option>
                          );
                        })}
                      </select>
                      <p className="text-[11px] text-orange-800">
                        Any product belonging to this subcategory will automatically qualify for this offer!
                      </p>
                    </div>
                  )}

                  {formData.target_scope === "category" && (
                    <div className="space-y-1.5 p-3.5 bg-purple-50/50 rounded-xl border border-purple-200">
                      <Label className="font-bold text-purple-900 text-xs">Select Target Category *</Label>
                      <select
                        className="w-full h-9 px-2.5 border border-purple-200 rounded-lg text-xs bg-white font-medium"
                        value={formData.category_id}
                        onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                        required
                      >
                        <option value="">Select a category...</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {formData.target_scope === "product" && (
                    <div className="space-y-2 p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-200">
                      <div className="flex items-center justify-between">
                        <Label className="font-bold text-indigo-900 text-xs">Select Eligible Products *</Label>
                        <span className="text-[10px] text-indigo-700 font-semibold">
                          Selected: {formData.target_ids.length} item(s)
                        </span>
                      </div>
                      <div className="max-h-40 overflow-y-auto border border-indigo-100 rounded-lg p-2 space-y-1 bg-white">
                        {products.map((p) => {
                          const isSelected = formData.target_ids.includes(p.id);
                          return (
                            <label key={p.id} className="flex items-center gap-2 p-1.5 hover:bg-indigo-50/50 rounded cursor-pointer text-xs">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setFormData({ ...formData, target_ids: [...formData.target_ids, p.id], product_id: p.id });
                                  } else {
                                    const next = formData.target_ids.filter(id => id !== p.id);
                                    setFormData({ ...formData, target_ids: next, product_id: next[0] || "" });
                                  }
                                }}
                                className="rounded border-gray-300 text-primary focus:ring-primary"
                              />
                              <span className="font-medium text-gray-800">{p.name}</span>
                              {p.sku && <span className="text-gray-400 font-mono">({p.sku})</span>}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* VALUE OR TIERED BRACKET EDITOR */}
                  {formData.offer_type === "tiered_discount" ? (
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                            Volume Bracket Tiers (All-Unit Discount)
                          </h4>
                          <p className="text-[10px] text-gray-500">
                            When order reaches a tier, that discount is applied to <strong>all units</strong> in that line item.
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleAddTier}
                          className="text-xs h-7 border-primary/30 text-primary hover:bg-primary/5 font-semibold"
                        >
                          <Plus size={12} className="mr-1" /> Add Tier
                        </Button>
                      </div>

                      <div className="space-y-2">
                        {formData.tiers.map((tier, idx) => (
                          <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-200 shadow-2xs">
                            <div className="w-24">
                              <Label className="text-[9px] font-bold text-gray-400 uppercase">Min Qty</Label>
                              <Input
                                type="number"
                                min="1"
                                value={tier.min_qty}
                                onChange={(e) => handleTierChange(idx, "min_qty", e.target.value)}
                                className="h-8 text-xs font-semibold"
                                required
                              />
                            </div>

                            <div className="w-28">
                              <Label className="text-[9px] font-bold text-gray-400 uppercase">Discount (%)</Label>
                              <div className="relative">
                                <Input
                                  type="number"
                                  min="0.1"
                                  max="100"
                                  step="0.1"
                                  value={tier.discount_percentage}
                                  onChange={(e) => handleTierChange(idx, "discount_percentage", e.target.value)}
                                  className="h-8 text-xs font-bold text-emerald-600 pr-5"
                                  required
                                />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">%</span>
                              </div>
                            </div>

                            <div className="flex-1">
                              <Label className="text-[9px] font-bold text-gray-400 uppercase">Tier Label</Label>
                              <Input
                                type="text"
                                value={tier.label || ""}
                                onChange={(e) => handleTierChange(idx, "label", e.target.value)}
                                className="h-8 text-xs"
                                placeholder="e.g. 10+ Box 11% Off"
                              />
                            </div>

                            <div className="pt-3">
                              <button
                                type="button"
                                onClick={() => handleRemoveTier(idx)}
                                className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                      <Label className="font-semibold text-gray-700 text-xs">
                        {formData.offer_type === "multiplier" ? "Points Multiplier Value (e.g. 1.5, 2.0)" :
                         formData.offer_type === "bonus_points" || formData.offer_type === "milestone_points" ? "Bonus Points to Award (e.g. 50, 100)" :
                         "Discount Value (%)"}
                      </Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        value={formData.value}
                        onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                        className="text-xs h-9 bg-white max-w-xs font-bold"
                        required
                      />
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: MARGIN CAPS & LIMITS */}
              {activeFormTab === "limits" && (
                <div className="space-y-4">
                  <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 flex items-start gap-2.5">
                    <ShieldAlert size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-900">Margin Protection & Safeguards</h4>
                      <p className="text-[11px] text-amber-700 mt-0.5">
                        Caps prevent excessive discounts from eroding margins during high-volume wholesale orders or viral scans.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="font-semibold text-gray-700 text-xs">
                        Maximum Discount Cap (₹)
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="e.g. 5000 (no cap if blank)"
                        value={formData.max_discount_amount}
                        onChange={(e) => setFormData({ ...formData, max_discount_amount: e.target.value })}
                        className="text-xs h-9"
                      />
                      <span className="text-[10px] text-gray-400">Protects maximum rupee discount per order.</span>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="font-semibold text-gray-700 text-xs">
                        Maximum Bonus Points Cap
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="e.g. 200 (no cap if blank)"
                        value={formData.max_bonus_points}
                        onChange={(e) => setFormData({ ...formData, max_bonus_points: e.target.value })}
                        className="text-xs h-9"
                      />
                      <span className="text-[10px] text-gray-400">Limits maximum loyalty bonus points per scan.</span>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="font-semibold text-gray-700 text-xs">
                        Per-User Claim Limit
                      </Label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="e.g. 1 (unlimited if blank)"
                        value={formData.per_user_limit}
                        onChange={(e) => setFormData({ ...formData, per_user_limit: e.target.value })}
                        className="text-xs h-9"
                      />
                      <span className="text-[10px] text-gray-400">Max times an individual user can claim this offer.</span>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="font-semibold text-gray-700 text-xs">
                        Global Usage Limit
                      </Label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="e.g. 500 (unlimited if blank)"
                        value={formData.usage_limit}
                        onChange={(e) => setFormData({ ...formData, usage_limit: e.target.value })}
                        className="text-xs h-9"
                      />
                      <span className="text-[10px] text-gray-400">Total global redemption budget across all users.</span>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="font-semibold text-gray-700 text-xs">
                        Priority Order
                      </Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                        className="text-xs h-9"
                      />
                      <span className="text-[10px] text-gray-400">Higher priority offers evaluate first.</span>
                    </div>

                    <div className="flex items-center space-x-2 pt-6">
                      <input
                        type="checkbox"
                        id="isStackable"
                        checked={formData.is_stackable}
                        onChange={(e) => setFormData({ ...formData, is_stackable: e.target.checked })}
                        className="rounded border-gray-300 text-primary focus:ring-primary w-4 h-4"
                      />
                      <Label htmlFor="isStackable" className="font-semibold text-gray-700 text-xs cursor-pointer">
                        Stackable with other offers & coupons
                      </Label>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: VALIDITY & TERMS */}
              {activeFormTab === "terms" && (
                <div className="space-y-4">
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

                  <div className="space-y-1.5">
                    <Label className="font-semibold text-gray-700 text-xs">Terms & Conditions</Label>
                    <Textarea
                      placeholder="Enter legal terms, qualifying criteria, or restrictions for mobile display..."
                      rows={5}
                      value={formData.terms_and_conditions}
                      onChange={(e) => setFormData({ ...formData, terms_and_conditions: e.target.value })}
                      className="text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <input
                      type="checkbox"
                      id="offerActive"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="w-4 h-4 rounded text-primary focus:ring-primary border-gray-300"
                    />
                    <Label htmlFor="offerActive" className="text-xs font-semibold text-gray-700 cursor-pointer">
                      Offer is Active immediately upon saving
                    </Label>
                  </div>
                </div>
              )}

              {/* Navigation / Submit bar */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  {activeFormTab !== "general" && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const tabs = ["general", "rules", "limits", "terms"];
                        const currIdx = tabs.indexOf(activeFormTab);
                        if (currIdx > 0) setActiveFormTab(tabs[currIdx - 1]);
                      }}
                      className="text-xs h-8"
                    >
                      Back
                    </Button>
                  )}
                  {activeFormTab !== "terms" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const tabs = ["general", "rules", "limits", "terms"];
                        const currIdx = tabs.indexOf(activeFormTab);
                        if (currIdx < tabs.length - 1) setActiveFormTab(tabs[currIdx + 1]);
                      }}
                      className="text-xs h-8"
                    >
                      Next Step <ArrowRight size={12} className="ml-1" />
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsModalOpen(false)}
                    disabled={isSubmitting}
                    className="text-xs h-8"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-white font-semibold text-xs h-8 shadow-xs"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Saving..." : editingOfferId ? "Update Offer" : "Create Offer"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL VIEW MODAL */}
      {detailOffer && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            {/* Banner preview in detail */}
            {(detailOffer.carousel_image_url || detailOffer.banner_url) && (
              <div className="relative w-full aspect-[2.8/1] bg-gray-900 overflow-hidden">
                <img
                  src={detailOffer.carousel_image_url || detailOffer.banner_url}
                  alt={detailOffer.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <button
                  onClick={() => setDetailOffer(null)}
                  className="absolute top-3 right-3 text-white bg-black/40 hover:bg-black/60 p-1.5 rounded-full transition-colors"
                >
                  <X size={16} />
                </button>
                <div className="absolute bottom-3 left-4 right-4 text-white">
                  <h3 className="font-bold text-base">{detailOffer.title}</h3>
                  {detailOffer.title_hi && <p className="text-xs text-gray-200">{detailOffer.title_hi}</p>}
                </div>
              </div>
            )}

            {!detailOffer.carousel_image_url && !detailOffer.banner_url && (
              <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <div>
                  <h3 className="font-bold text-gray-900 text-base">{detailOffer.title}</h3>
                  {detailOffer.title_hi && <p className="text-xs text-gray-500">{detailOffer.title_hi}</p>}
                </div>
                <button
                  onClick={() => setDetailOffer(null)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            )}

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Badges Ribbon */}
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${getOfferStatus(detailOffer).color}`}>
                  {getOfferStatus(detailOffer).label}
                </span>
                {detailOffer.target_role === "dealer" && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                    👔 Dealers Only
                  </Badge>
                )}
                {detailOffer.target_role === "carpenter" && (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                    🪚 Carpenters Only
                  </Badge>
                )}
                {getScopeBadge(detailOffer)}
                <Badge variant="outline" className="bg-gray-100 text-gray-700 text-xs">
                  Unit: {detailOffer.applicable_unit || "boxes"}
                </Badge>
                {detailOffer.is_stackable && (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                    Stackable
                  </Badge>
                )}
              </div>

              {detailOffer.description && (
                <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-200">
                  {detailOffer.description}
                </div>
              )}

              {/* Tiers or Value display */}
              {Array.isArray(detailOffer.tiers) && detailOffer.tiers.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-gray-700 uppercase">Volume Bracket Tiers</h4>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200">
                        <tr>
                          <th className="py-2 px-3 text-left">Min Quantity</th>
                          <th className="py-2 px-3 text-left">Discount (%)</th>
                          <th className="py-2 px-3 text-left">Tier Label</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {detailOffer.tiers.map((t, i) => (
                          <tr key={i} className="hover:bg-gray-50/50">
                            <td className="py-2 px-3 font-mono font-medium">{t.min_qty}+ {detailOffer.applicable_unit || "boxes"}</td>
                            <td className="py-2 px-3 font-bold text-emerald-600">{t.discount_percentage}% Off</td>
                            <td className="py-2 px-3 text-gray-600">{t.label || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-between text-xs">
                  <span className="font-semibold text-gray-700">Offer Value / Reward:</span>
                  <span className="font-bold text-primary text-sm">
                    {detailOffer.offer_type === "multiplier" ? `${detailOffer.value}x Multiplier` :
                     detailOffer.offer_type === "bonus_points" ? `+${detailOffer.value} Bonus Points` :
                     `${detailOffer.value}% Discount`}
                  </span>
                </div>
              )}

              {/* Safeguards & Limits Breakdown */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="text-gray-400 block text-[10px] font-semibold uppercase">Max Cap in ₹</span>
                  <span className="font-bold text-gray-800">
                    {detailOffer.max_discount_amount ? `₹${Number(detailOffer.max_discount_amount).toLocaleString()}` : "None (No cap)"}
                  </span>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="text-gray-400 block text-[10px] font-semibold uppercase">Max Bonus Points</span>
                  <span className="font-bold text-gray-800">
                    {detailOffer.max_bonus_points ? `${detailOffer.max_bonus_points} pts` : "None"}
                  </span>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="text-gray-400 block text-[10px] font-semibold uppercase">Per-User Limit</span>
                  <span className="font-bold text-gray-800">
                    {detailOffer.per_user_limit ? `${detailOffer.per_user_limit} times/user` : "Unlimited"}
                  </span>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <span className="text-gray-400 block text-[10px] font-semibold uppercase">Usage Count / Limit</span>
                  <span className="font-bold text-gray-800">
                    {detailOffer.used_count || 0} / {detailOffer.usage_limit || "∞"} used
                  </span>
                </div>
              </div>

              {/* Dates */}
              <div className="text-xs text-gray-600 space-y-1 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div>
                  <span className="font-semibold text-gray-700">Starts At: </span>
                  {formatDate(detailOffer.start_date || detailOffer.starts_at, true)}
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Ends At: </span>
                  {formatDate(detailOffer.end_date || detailOffer.ends_at, true)}
                </div>
              </div>

              {/* Terms and Conditions */}
              {detailOffer.terms_and_conditions && (
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-gray-700 uppercase">Terms & Conditions</h4>
                  <p className="text-xs text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-200 whitespace-pre-wrap">
                    {detailOffer.terms_and_conditions}
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDetailOffer(null)}
                className="text-xs"
              >
                Close
              </Button>
              {hasEditPermission && (
                <Button
                  size="sm"
                  onClick={() => {
                    const toEdit = detailOffer;
                    setDetailOffer(null);
                    handleOpenEditModal(toEdit);
                  }}
                  className="bg-primary hover:bg-primary/90 text-white font-semibold text-xs flex items-center gap-1.5"
                >
                  <Edit3 size={13} /> Edit Offer
                </Button>
              )}
            </div>
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
