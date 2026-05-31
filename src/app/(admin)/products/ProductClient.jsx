"use client";

import PageHeader from "@/components/layout/PageHeader";
import { useLoader } from "@/components/providers/LoaderProvider";
import { ImageUpload } from "@/components/shared/ImageUpload";
import { optimizeImage, prepareImageForPreview } from "@/utils/imageOptimizer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/utils/supabase/client";
import { Edit2, Image as ImageIcon, Languages, Package, RefreshCcw, Search, Trash2, Save, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import ProductForm from "./ProductForm";
import { hasModulePermission } from "@/utils/permissions";

export default function ProductClient({ initialProducts, initialCategories, initialSubcategories, profile, orgMember }) {
  const hasEditPermission = hasModulePermission(profile, orgMember, "products", "edit");
  const [activeTab, setActiveTab] = useState("all-products");

  const [products, setProducts] = useState(initialProducts || []);
  const [categories, setCategories] = useState(initialCategories || []);
  const [subcategories, setSubcategories] = useState(initialSubcategories || []);

  const { isLoading, setLoading } = useLoader();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const supabase = createClient();
  const router = useRouter();

  // Confirm Dialog State
  const [confirmState, setConfirmState] = useState({ isOpen: false, title: "", description: "", onConfirm: null, variant: "default" });

  const confirmAction = (title, description, onConfirm, variant = "default") => {
    setConfirmState({ isOpen: true, title, description, onConfirm, variant });
  };

  // --- Product Form State ---
  const [editingProductId, setEditingProductId] = useState(null);
  const [productForm, setProductForm] = useState({
    name: "",
    name_hi: "",
    category_id: "",
    subcategory_id: "",
    mrp: "",
    dealer_price: "",
    reward_points: "",
    sku: "",
    unit: "piece",
    description: "",
    description_hi: "",
    is_active: true,
    is_featured: false,
    min_stock_level: "5",
  });

  const [productImages, setProductImages] = useState([]); // { file: File, url: string, isExisting: boolean, id?: string, is_primary?: boolean }

  // --- Custom Fields & Price Matrix (JSONB in products.specifications) ---
  const [customFields, setCustomFields] = useState({}); // e.g. { size: [...], finish: [...] }
  const [priceMatrix, setPriceMatrix] = useState([]); // e.g. [{ size: "3X1/2", finish: "SSF", mrp: "255", dealer_price: "200", reward_points: "10" }]
  const [finishImages, setFinishImages] = useState({}); // e.g. { "SSF": "image_url" }
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldValue, setNewFieldValue] = useState("");

  // --- Category Form State ---
  const [editingCatId, setEditingCatId] = useState(null);
  const [isEditingSubcat, setIsEditingSubcat] = useState(false);
  const [catForm, setCatForm] = useState({
    name: "",
    name_hi: "",
    parent_category_id: "",
    description: "",
    is_active: true,
  });
  const [catImageFile, setCatImageFile] = useState(null);
  const [existingCatImageUrl, setExistingCatImageUrl] = useState("");

  // Helpers
  const handleTranslate = async (text, setterFunc) => {
    if (!text) return;
    try {
      setLoading(true);
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|hi`);
      const data = await res.json();
      if (data && data.responseData && data.responseData.translatedText) {
        setterFunc(data.responseData.translatedText);
      }
    } catch (error) {
      console.error("Translation error", error);
    } finally {
      setLoading(false);
    }
  };

  // --- Product Actions ---
  const handleEditProduct = (product) => {
    setEditingProductId(product.id);
    setProductForm({
      name: product.name || "",
      name_hi: product.name_hi || "",
      category_id: product.category_id || "",
      subcategory_id: product.subcategory_id || "",
      mrp: product.mrp || "",
      dealer_price: product.dealer_price || "",
      reward_points: product.reward_points || "",
      sku: product.sku || "",
      unit: product.unit || "piece",
      description: product.description || "",
      description_hi: product.description_hi || "",
      is_active: product.is_active ?? true,
      is_featured: product.is_featured ?? false,
      min_stock_level: product.min_stock_level?.toString() || "5",
    });

    // Load existing images
    const existingImgs = (product.product_images || []).map(img => ({
      id: img.id,
      url: img.url,
      isExisting: true,
      is_primary: img.is_primary
    }));
    setProductImages(existingImgs.sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0)));


    // Load specifications JSONB
    const specs = product.specifications || {};
    setCustomFields(specs.customFields || {});
    setPriceMatrix(specs.priceMatrix || []);
    setFinishImages(specs.finishImages || {});

    setActiveTab("add-edit-product");
  };

  const resetProductFormState = () => {
    setEditingProductId(null);
    setProductForm({
      name: "", name_hi: "", category_id: "", subcategory_id: "", mrp: "", dealer_price: "",
      reward_points: "", sku: "", unit: "piece", description: "",
      description_hi: "", is_active: true, is_featured: false, min_stock_level: "5"
    });
    setProductImages([]);
    setCustomFields({});
    setPriceMatrix([]);
    setFinishImages({});
    setNewFieldName("");
    setNewFieldValue("");
  };

  const handleAddNewProduct = () => {
    resetProductFormState();
    setActiveTab("add-edit-product");
  };

  const handleCancelEdit = () => {
    resetProductFormState();
    setActiveTab("all-products");
  };

  const handleAddProductImage = (file) => {
    if (file) {
      const imgObj = prepareImageForPreview(file, productImages.length === 0);
      setProductImages(prev => [...prev, imgObj]);
    }
  };

  const handleRemoveProductImage = (index) => {
    const updated = [...productImages];
    const removed = updated.splice(index, 1)[0];
    if (removed.is_primary && updated.length > 0) {
      updated[0].is_primary = true;
    }
    setProductImages(updated);
  };

  const handleSetPrimaryImage = (index) => {
    const updated = productImages.map((img, i) => ({ ...img, is_primary: i === index }));
    setProductImages(updated);
  };



  const handleSaveProduct = async () => {
    try {
      setLoading(true);
      if (!productForm.name || !productForm.category_id) {
        toast.error("Please fill required fields (Name, Category)");
        setLoading(false);
        return;
      }

      const slug = productForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Date.now().toString().slice(-4);
      let productId = editingProductId;

      const baseSku = productForm.sku || ('SKU-' + productForm.name.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 4) + '-' + Math.random().toString(36).substr(2, 4).toUpperCase());

      const payload = {
        name: productForm.name,
        name_hi: productForm.name_hi,
        category_id: productForm.category_id,
        subcategory_id: productForm.subcategory_id || null,
        mrp: parseFloat(productForm.mrp) || 0,
        dealer_price: parseFloat(productForm.dealer_price) || 0,
        reward_points: parseInt(productForm.reward_points) || 0,
        sku: baseSku,
        unit: productForm.unit || 'piece',
        description: productForm.description,
        description_hi: productForm.description_hi,
        is_active: productForm.is_active,
        is_featured: productForm.is_featured,
        min_stock_level: parseInt(productForm.min_stock_level) || 5,
        specifications: {
          customFields: customFields,
          finishImages: finishImages,
          priceMatrix: priceMatrix.map(m => ({
            ...m,
            sku: `${baseSku}-${m.finish.replace(/\s+/g, '').toUpperCase()}-${m.size.replace(/\s+/g, '').toUpperCase()}`
          })),
        },
      };

      if (!productId) {
        payload.slug = slug;
        const { data, error } = await supabase.from('products').insert([payload]).select().single();
        if (error) throw error;
        productId = data.id;
      } else {
        const { error } = await supabase.from('products').update(payload).eq('id', productId);
        if (error) throw error;
      }

      // Handle Images
      const currentExistingImageIds = productImages.filter(img => img.isExisting && img.id).map(img => img.id);
      const originalExistingImageIds = editingProductId ? products.find(p => p.id === editingProductId)?.product_images?.map(img => img.id).filter(Boolean) || [] : [];
      const imagesToDelete = originalExistingImageIds.filter(id => !currentExistingImageIds.includes(id) && id);

      if (imagesToDelete.length > 0) {
        await supabase.from('product_images').delete().in('id', imagesToDelete);
      }

      const urlMapping = {};
      for (let i = 0; i < productImages.length; i++) {
        const img = productImages[i];
        if (!img.isExisting && img.file) {
          // Optimize image before upload (WhatsApp-style compression, <2MB)
          let optimizedFile;
          try {
            optimizedFile = await optimizeImage(img.file);
          } catch (optErr) {
            console.warn('Image optimization failed, using original:', optErr);
            optimizedFile = img.file;
          }

          const fileExt = optimizedFile.name.split('.').pop();
          const cleanName = productForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
          const fileName = `${productId}/${cleanName}_${i}.${fileExt}`;
          const { error: uploadError } = await supabase.storage.from('products').upload(fileName, optimizedFile, {
            upsert: true,
            contentType: optimizedFile.type,
          });
          if (uploadError) {
            console.error('Image upload failed:', uploadError);
            toast.error(`Image upload failed: ${uploadError.message}`);
            continue;
          }
          const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(fileName);
          urlMapping[img.url] = publicUrl;
          const { error: insertError } = await supabase.from('product_images').insert([{ product_id: productId, url: publicUrl, alt_text: productForm.name, is_primary: img.is_primary, sort_order: i }]);
          if (insertError) {
            console.error('Image record insert failed:', insertError);
          }
        } else if (img.isExisting) {
          await supabase.from('product_images').update({ is_primary: img.is_primary, sort_order: i }).eq('id', img.id);
        }
      }

      // Update finishImages: replace blob URLs with uploaded URLs, strip any remaining blobs
      const finalFinishImages = { ...payload.specifications.finishImages };
      for (const [finish, url] of Object.entries(finalFinishImages)) {
        if (urlMapping[url]) {
          // Replace blob URL with the uploaded public URL
          finalFinishImages[finish] = urlMapping[url];
        } else if (typeof url === 'string' && url.startsWith('blob:')) {
          // Safety: remove any blob URLs that weren't uploaded (failed uploads, etc.)
          delete finalFinishImages[finish];
        }
      }
      // Always update specifications with sanitized finishImages
      await supabase.from('products').update({
        specifications: { ...payload.specifications, finishImages: finalFinishImages }
      }).eq('id', productId);



      toast.success("Product saved successfully!");
      await fetchAllData();
      setActiveTab("all-products");

    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to save product");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = (id) => {
    confirmAction(
      "Delete Product",
      "Are you sure you want to delete this product? This action cannot be undone.",
      async () => {
        try {
          setLoading(true);
          await supabase.from('products').delete().eq('id', id);
          setProducts(products.filter(p => p.id !== id));
          toast.success("Product deleted successfully");
        } catch (err) {
          console.error(err);
          toast.error("Failed to delete product");
        } finally {
          setLoading(false);
        }
      },
      "destructive"
    );
  };

  // --- Category Actions ---
  const handleSaveCategory = async () => {
    try {
      setLoading(true);
      if (!catForm.name) {
        toast.error("Name is required"); return;
      }

      const slug = catForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Date.now().toString().slice(-4);
      let finalImageUrl = existingCatImageUrl;

      if (catImageFile) {
        let optimizedCatImage;
        try {
          optimizedCatImage = await optimizeImage(catImageFile);
        } catch {
          optimizedCatImage = catImageFile;
        }
        const fileExt = optimizedCatImage.name.split('.').pop();
        const fileName = `cat_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('category').upload(fileName, optimizedCatImage, {
          contentType: optimizedCatImage.type,
        });
        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from('category').getPublicUrl(fileName);
          finalImageUrl = publicUrl;
        }
      }

      const payload = {
        name: catForm.name,
        name_hi: catForm.name_hi,
        description: catForm.description,
        image_url: finalImageUrl,
        is_active: catForm.is_active,
        slug
      };

      if (catForm.parent_category_id) {
        // Subcategory
        payload.category_id = catForm.parent_category_id;
        if (editingCatId && isEditingSubcat) {
          await supabase.from('subcategories').update(payload).eq('id', editingCatId);
        } else {
          await supabase.from('subcategories').insert([payload]);
        }
      } else {
        // Category
        if (editingCatId && !isEditingSubcat) {
          await supabase.from('categories').update(payload).eq('id', editingCatId);
        } else {
          await supabase.from('categories').insert([payload]);
        }
      }

      setCatForm({ name: "", name_hi: "", parent_category_id: "", description: "", is_active: true });
      setCatImageFile(null);
      setExistingCatImageUrl("");
      setEditingCatId(null);
      setIsEditingSubcat(false);

      await fetchAllData();
      toast.success("Saved successfully!");

    } catch (error) {
      console.error(error);
      toast.error(error.message || "Failed to save category");
    } finally {
      setLoading(false);
    }
  };

  const handleEditCategory = (item, isSub) => {
    setEditingCatId(item.id);
    setIsEditingSubcat(isSub);
    setCatForm({
      name: item.name || "",
      name_hi: item.name_hi || "",
      parent_category_id: isSub ? item.category_id : "",
      description: item.description || "",
      is_active: item.is_active ?? true,
    });
    setExistingCatImageUrl(item.image_url || "");
    setCatImageFile(null);
  };

  const handleDeleteCategory = (id, isSub) => {
    confirmAction(
      `Delete ${isSub ? 'Subcategory' : 'Category'}`,
      `Are you sure you want to delete this ${isSub ? 'subcategory' : 'category'}?`,
      async () => {
        try {
          setLoading(true);
          const table = isSub ? 'subcategories' : 'categories';
          await supabase.from(table).delete().eq('id', id);
          if (isSub) {
            setSubcategories(subcategories.filter(s => s.id !== id));
          } else {
            setCategories(categories.filter(c => c.id !== id));
          }
          toast.success(`${isSub ? 'Subcategory' : 'Category'} deleted`);
        } catch (err) {
          console.error(err);
          toast.error(`Failed to delete ${isSub ? 'subcategory' : 'category'}`);
        } finally {
          setLoading(false);
        }
      },
      "destructive"
    );
  };

  const fetchAllData = async () => {
    const [prodRes, catRes, subcatRes] = await Promise.all([
      supabase.from('products').select(`*, categories (id, name), product_images (id, url, is_primary), specifications`).order('created_at', { ascending: false }),
      supabase.from('categories').select('*').order('name'),
      supabase.from('subcategories').select('*, categories (id, name)').order('name')
    ]);
    if (prodRes.data) setProducts(prodRes.data);
    if (catRes.data) setCategories(catRes.data);
    if (subcatRes.data) setSubcategories(subcatRes.data);
    router.refresh();
  };

  const filteredProducts = products
    .filter(p => {
      const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.categories?.name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCategory = !filterCategory || p.category_id === filterCategory;
      const matchStatus = !filterStatus || (filterStatus === 'active' ? p.is_active : !p.is_active);
      return matchSearch && matchCategory && matchStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at) - new Date(a.created_at);
      if (sortBy === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
      if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
      if (sortBy === 'name-desc') return b.name.localeCompare(a.name);
      if (sortBy === 'price-asc') return (a.mrp || 0) - (b.mrp || 0);
      if (sortBy === 'price-desc') return (b.mrp || 0) - (a.mrp || 0);
      return 0;
    });

  const flattenedVariants = [];
  filteredProducts.forEach(product => {
    const pm = product.specifications?.priceMatrix || [];
    if (pm.length === 0) {
      flattenedVariants.push({ ...product, isVariant: false, variant: null });
    } else {
      pm.forEach((matrixRow, index) => {
        flattenedVariants.push({ ...product, isVariant: true, variant: matrixRow, matrixIndex: index });
      });
    }
  });

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      <ConfirmDialog
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
        title={confirmState.title}
        description={confirmState.description}
        onConfirm={confirmState.onConfirm}
        variant={confirmState.variant}
      />
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
        <PageHeader title="Product Management">
          <button
            onClick={() => setActiveTab("all-products")}
            className={`h-full flex items-center border-b-2 transition-colors ${activeTab === "all-products"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-gray-500 hover:text-primary hover:border-primary/30"
              }`}
          >
            All Products
          </button>
          {hasEditPermission && (
            <button
              onClick={handleAddNewProduct}
              className={`h-full flex items-center border-b-2 transition-colors ${activeTab === "add-edit-product"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-gray-500 hover:text-primary hover:border-primary/30"
                }`}
            >
              {editingProductId ? 'Edit Product Details' : 'Add New Product'}
            </button>
          )}
          <button
            onClick={() => setActiveTab("categories")}
            className={`h-full flex items-center border-b-2 transition-colors ${activeTab === "categories"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-gray-500 hover:text-primary hover:border-primary/30"
              }`}
          >
            Categories / Sub Categories
          </button>
        </PageHeader>

        <div className="p-6 flex-1 overflow-hidden">

          {/* TAB 1: ALL PRODUCTS */}
          <TabsContent value="all-products" className="flex-1 mt-0 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col h-full">
            <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 flex-shrink-0">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <Input
                  placeholder="Search products by name or category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-gray-50 border-gray-200 focus-visible:ring-primary"
                />
              </div>
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
                className="h-10 px-3 border border-gray-200 rounded-md text-sm bg-gray-50 text-gray-700 min-w-[140px]">
                <option value="">All Categories</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                className="h-10 px-3 border border-gray-200 rounded-md text-sm bg-gray-50 text-gray-700 min-w-[120px]">
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
              </select>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                className="h-10 px-3 border border-gray-200 rounded-md text-sm bg-gray-50 text-gray-700 min-w-[130px]">
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="name-asc">Name A-Z</option>
                <option value="name-desc">Name Z-A</option>
                <option value="price-asc">Price Low-High</option>
                <option value="price-desc">Price High-Low</option>
              </select>
              <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => fetchAllData()} title="Refresh">
                <RefreshCcw size={15} className={isLoading ? 'animate-spin' : ''} />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <Table>
                <TableHeader className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                  <TableRow>
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead className="w-[80px]">Image</TableHead>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Pricing</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {flattenedVariants.map((item, idx) => {
                    const { isVariant, variant } = item;

                    // Determine image: matrix image > primary image > first image
                    let displayImage = item.product_images?.find(img => img.is_primary)?.url || item.product_images?.[0]?.url;
                    if (isVariant && item.specifications?.finishImages?.[variant.finish]) {
                      displayImage = item.specifications.finishImages[variant.finish];
                    }

                    // Determine name
                    let displayName = item.name;
                    if (isVariant) {
                      displayName = `${item.name} - ${variant.finish} - ${variant.size}`;
                    }

                    // Determine Category
                    const categoryName = subcategories.find(s => s.id === item.subcategory_id)?.name || item.categories?.name || "Uncategorized";

                    // Determine Pricing
                    const mrp = isVariant ? (variant.mrp || item.mrp) : item.mrp;
                    const dealerPrice = isVariant ? (variant.dealer_price || item.dealer_price) : item.dealer_price;

                    // Row ID
                    const rowKey = isVariant ? `${item.id}-${variant.finish}-${variant.size}` : item.id;

                    return (
                      <TableRow key={rowKey} className={hasEditPermission ? "hover:bg-gray-50/50 cursor-pointer" : "hover:bg-gray-50/50"} onClick={hasEditPermission ? () => handleEditProduct(item) : undefined}>
                        <TableCell className="font-medium text-gray-500">{idx + 1}</TableCell>
                        <TableCell>
                          <div className="w-12 h-12 bg-gray-100 rounded border border-gray-200 flex items-center justify-center overflow-hidden">
                            {displayImage ? (
                              <img src={displayImage} alt={displayName} className="w-full h-full object-cover" />
                            ) : (
                              <Package className="text-gray-400" size={20} />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="font-semibold text-gray-900">{displayName}</p>
                          {item.name_hi && !isVariant && <p className="text-xs text-gray-500 font-medium">{item.name_hi}</p>}
                          {isVariant && <Badge variant="outline" className="mt-1 text-[10px] bg-gray-50">{variant.sku}</Badge>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-medium bg-gray-100 text-gray-700">
                            {categoryName}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <p className="font-semibold text-primary">₹{dealerPrice || 0}</p>
                          <p className="text-xs text-gray-500 line-through">₹{mrp || 0}</p>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium text-gray-600 capitalize">{item.unit || "Piece"}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          {hasEditPermission ? (
                            <div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" onClick={() => handleEditProduct(item)}>
                                <Edit2 size={16} className="text-gray-600" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDeleteProduct(item.id); }}>
                                <Trash2 size={16} className="text-red-500" />
                              </Button>
                            </div>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-400 text-[10px] font-bold border-0 select-none"><Lock size={10} className="inline mr-0.5" /> View Only</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredProducts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-16 text-gray-500">
                        <Package className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                        <p className="font-medium text-lg">No products found</p>
                        <p className="text-sm text-gray-400">Add a new product to see it listed here.</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* TAB 2: ADD/EDIT PRODUCT */}
          <TabsContent value="add-edit-product" className="flex-1 mt-0 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col h-full">
            <ProductForm
              editingProductId={editingProductId}
              productForm={productForm}
              setProductForm={setProductForm}
              productImages={productImages}
              onAddImage={handleAddProductImage}
              onRemoveImage={handleRemoveProductImage}
              onSetPrimary={handleSetPrimaryImage}
              categories={categories}
              subcategories={subcategories}
              customFields={customFields}
              setCustomFields={setCustomFields}
              finishImages={finishImages}
              setFinishImages={setFinishImages}
              priceMatrix={priceMatrix}
              setPriceMatrix={setPriceMatrix}
              onSave={handleSaveProduct}
              onCancel={handleCancelEdit}
              isLoading={isLoading}
              handleTranslate={handleTranslate}
            />
          </TabsContent>

          {/* TAB 3: CATEGORIES / SUB CATEGORIES */}
          <TabsContent value="categories" className="flex-1 mt-0 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col md:flex-row h-full">
            {/* Left Side Form */}
            {hasEditPermission && (
              <div className="w-full md:w-[400px] border-r border-gray-200 bg-gray-50 flex flex-col h-full flex-shrink-0">
              <div className="p-6 border-b border-gray-200 bg-white flex-shrink-0">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">Add / Edit Category</h2>
              </div>
              <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                <div className="space-y-2">
                  <Label className="font-semibold text-gray-700">Category Name <span className="text-red-500">*</span></Label>
                  <Input placeholder="e.g. Hardware" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} className="bg-white shadow-sm" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="font-semibold text-gray-700">Name (Hindi)</Label>
                    <Button variant="ghost" size="sm" className="h-6 text-xs text-primary px-2 hover:bg-primary/10" onClick={() => handleTranslate(catForm.name, (val) => setCatForm({ ...catForm, name_hi: val }))}>
                      <Languages size={12} className="mr-1" /> Translate
                    </Button>
                  </div>
                  <Input placeholder="श्रेणी का नाम" value={catForm.name_hi} onChange={(e) => setCatForm({ ...catForm, name_hi: e.target.value })} className="bg-white shadow-sm" />
                </div>
                <div className="space-y-2">
                  <Label className="font-semibold text-gray-700">Parent Category</Label>
                  <select className="w-full h-10 px-3 border border-gray-200 rounded-md text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors" value={catForm.parent_category_id} onChange={(e) => setCatForm({ ...catForm, parent_category_id: e.target.value })} disabled={editingCatId && !isEditingSubcat}>
                    <option value="">None (Create as Parent Category)</option>
                    {categories.filter(c => c.id !== editingCatId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="font-semibold text-gray-700">Description</Label>
                  <Textarea placeholder="Brief description..." rows={3} value={catForm.description} onChange={(e) => setCatForm({ ...catForm, description: e.target.value })} className="bg-white shadow-sm resize-y" />
                </div>
                <div className="space-y-2">
                  <Label className="font-semibold text-gray-700">Category Thumbnail</Label>
                  <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
                    <ImageUpload value={catImageFile || existingCatImageUrl} onChange={setCatImageFile} className="w-full h-34" />
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-white px-4 py-3 rounded-lg border border-gray-200 shadow-sm cursor-pointer hover:border-gray-300 transition-colors" onClick={() => setCatForm({ ...catForm, is_active: !catForm.is_active })}>
                  <input type="checkbox" id="cat_is_active" checked={catForm.is_active} onChange={(e) => setCatForm({ ...catForm, is_active: e.target.checked })} className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer" onClick={e => e.stopPropagation()} />
                  <Label htmlFor="cat_is_active" className="cursor-pointer font-medium text-gray-700">Category is Active</Label>
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 bg-white flex gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)] z-10">
                {(editingCatId || catForm.name) && (
                  <Button variant="outline" className="flex-1 bg-gray-50 hover:bg-gray-100" onClick={() => {
                    setCatForm({ name: "", name_hi: "", parent_category_id: "", description: "", is_active: true });
                    setEditingCatId(null); setIsEditingSubcat(false); setCatImageFile(null); setExistingCatImageUrl("");
                  }}>Reset Form</Button>
                )}
                <Button className="flex-1 bg-primary hover:bg-primary/90 text-white shadow-sm" onClick={handleSaveCategory} disabled={isLoading}>
                  {isLoading ? "Saving..." : (editingCatId ? "Update Category" : "Save Category")}
                </Button>
              </div>
            </div>
            )}

            {/* Right Side List */}
            <div className="flex-1 overflow-y-auto bg-white p-6 md:p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6 border-b border-gray-100 pb-3">Category Structure</h3>
              <div className="space-y-6 max-w-4xl">
                {categories.map(category => (
                  <div key={category.id} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
                    <div className="bg-gray-50/80 p-5 border-b border-gray-200 flex justify-between items-center group transition-colors hover:bg-gray-50">
                      <div className="flex items-center gap-5">
                        {category.image_url ? (
                          <div className="w-12 h-12 rounded-lg bg-white border border-gray-200 shadow-sm overflow-hidden flex-shrink-0"><img src={category.image_url} alt="" className="w-full h-full object-cover" /></div>
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-white border border-gray-200 shadow-sm flex items-center justify-center flex-shrink-0"><ImageIcon className="text-gray-400" size={20} /></div>
                        )}
                        <div>
                          <h4 className="font-bold text-gray-900 text-lg flex items-center gap-3">
                            {category.name}
                            {!category.is_active && <Badge variant="outline" className="text-[10px] uppercase tracking-wider bg-white">Draft</Badge>}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            {category.name_hi && <span className="text-xs text-gray-500 font-medium bg-white px-2 py-0.5 rounded border border-gray-100">{category.name_hi}</span>}
                            <span className="text-xs text-gray-400">{subcategories.filter(s => s.category_id === category.id).length} subcategories</span>
                          </div>
                        </div>
                      </div>
                      {hasEditPermission && (
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="outline" size="sm" className="h-9 bg-white shadow-sm" onClick={() => handleEditCategory(category, false)}><Edit2 size={14} className="mr-2" /> Edit</Button>
                          <Button variant="outline" size="icon" className="h-9 w-9 text-red-500 hover:text-red-600 hover:bg-red-50 bg-white border-gray-200 shadow-sm" onClick={() => handleDeleteCategory(category.id, false)}><Trash2 size={16} /></Button>
                        </div>
                      )}
                    </div>
                    <div className="p-0 bg-white">
                      {subcategories.filter(s => s.category_id === category.id).length > 0 ? (
                        <Table>
                          <TableBody>
                            {subcategories.filter(s => s.category_id === category.id).map(sub => (
                              <TableRow key={sub.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 group transition-colors">
                                <TableCell className="w-[70px] py-3 pl-6">
                                  {sub.image_url ? (
                                    <div className="w-9 h-9 rounded-md bg-white overflow-hidden border border-gray-200 shadow-sm"><img src={sub.image_url} alt="" className="w-full h-full object-cover" /></div>
                                  ) : (
                                    <div className="w-9 h-9 rounded-md bg-gray-50 flex items-center justify-center border border-gray-200 shadow-sm"><ImageIcon className="text-gray-400" size={14} /></div>
                                  )}
                                </TableCell>
                                <TableCell className="py-3">
                                  <div className="flex items-center gap-3">
                                    <p className="font-semibold text-gray-800">{sub.name}</p>
                                    {!sub.is_active && <Badge variant="outline" className="text-[10px] bg-gray-50 text-gray-500 border-gray-200">Draft</Badge>}
                                  </div>
                                  {sub.name_hi && <p className="text-xs text-gray-500 font-medium mt-0.5">{sub.name_hi}</p>}
                                </TableCell>
                                <TableCell className="py-3 text-right pr-6">
                                  {hasEditPermission ? (
                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-gray-900 hover:bg-gray-100" onClick={() => handleEditCategory(sub, true)}><Edit2 size={15} /></Button>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteCategory(sub.id, true)}><Trash2 size={15} /></Button>
                                    </div>
                                  ) : (
                                    <Badge className="bg-gray-50 text-gray-400 font-medium text-[10px] border-0"><Lock size={10} className="inline mr-0.5" /> Locked</Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <div className="px-6 py-5 text-sm text-gray-500 flex items-center justify-center gap-2 bg-gray-50/30">
                          No subcategories yet. Select this category as a parent to create one.
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {categories.length === 0 && (
                  <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                    <Package className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                    <p className="font-bold text-gray-900 text-lg">No Categories Found</p>
                    <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">Create your first category from the left panel to start organizing your products.</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
