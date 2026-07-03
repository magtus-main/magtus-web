"use client";

import React, { useState } from "react";
import { Plus, Trash2, Languages, Image as ImageIcon, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import BottomBar from "@/components/layout/BottomBar";

export default function ProductForm({
  editingProductId,
  productForm, setProductForm,
  productImages, onAddImage, onRemoveImage, onSetPrimary,
  categories, subcategories,
  customFields, setCustomFields,
  finishImages, setFinishImages,
  priceMatrix, setPriceMatrix,
  onSave, onCancel, isLoading,
  handleTranslate,
}) {
  const [activeSection, setActiveSection] = useState("details");
  const [activeFieldTab, setActiveFieldTab] = useState("size");
  const FIXED_FIELDS = ["size", "finish", "thickness"];

  // --- Custom field helpers (fixed fields: size, finish, thickness) ---
  const addValueToField = (key, val) => {
    if (!val.trim() || customFields[key]?.includes(val.trim())) return;
    setCustomFields({ ...customFields, [key]: [...(customFields[key] || []), val.trim()] });
  };

  const removeValueFromField = (key, val) => {
    setCustomFields({ ...customFields, [key]: (customFields[key] || []).filter(v => v !== val) });
  };

  // --- Matrix helpers (always size=columns, finish=rows) ---
  const colKey = "size";
  const rowKey = "finish";
  const colValues = customFields.size || [];
  const rowValues = customFields.finish || [];

  const getMatrixCell = (row, col) => {
    return priceMatrix.find(m => m[rowKey] === row && m[colKey] === col) || {};
  };

  const updateMatrixCell = (row, col, field, value) => {
    const idx = priceMatrix.findIndex(m => m[rowKey] === row && m[colKey] === col);
    if (idx >= 0) {
      const updated = [...priceMatrix];
      updated[idx] = { ...updated[idx], [field]: value };
      setPriceMatrix(updated);
    } else {
      setPriceMatrix([...priceMatrix, { [rowKey]: row, [colKey]: col, [field]: value }]);
    }
  };

  const generateEmptyMatrix = () => {
    if (colValues.length === 0 || rowValues.length === 0) return;
    const existing = [...priceMatrix];
    const newMatrix = [];
    for (const row of rowValues) {
      for (const col of colValues) {
        const found = existing.find(m => m.finish === row && m.size === col);
        newMatrix.push(found || { finish: row, size: col, mrp: "", dealer_price: "", reward_points: "", stock: "", min_stock: "" });
      }
    }
    setPriceMatrix(newMatrix);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* ===== SECTION 1: PRODUCT DETAILS ===== */}
        {activeSection === "details" && (
          <div className="space-y-6">
            {/* Row 1: Images + Core Info */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Images */}
              <div className="lg:col-span-4">
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm h-full">
                  <Label className="mb-3 block font-bold text-gray-900">Product Images</Label>

                  <div className="grid grid-cols-4 gap-2">
                    {productImages.map((img, idx) => (
                      <div key={idx} className={`relative aspect-square rounded border ${img.is_primary ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200'} overflow-hidden group`}>
                        <img src={img.url} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-0.5">
                          <button onClick={() => onRemoveImage(idx)} className="self-end p-0.5 bg-red-500 text-white rounded-sm"><X size={10} /></button>
                          {!img.is_primary && <button onClick={() => onSetPrimary(idx)} className="text-[9px] font-bold text-white bg-primary py-0.5 rounded-sm w-full">Main</button>}
                        </div>
                      </div>
                    ))}
                    <Label className="aspect-square flex flex-col items-center justify-center bg-gray-50 border-2 border-dashed border-gray-300 rounded cursor-pointer hover:bg-gray-100 text-gray-400">
                      <Plus size={16} />
                      <span className="text-[9px] mt-0.5">Add</span>
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => { if (e.target.files?.[0]) onAddImage(e.target.files[0]); e.target.value = ''; }} />
                    </Label>
                  </div>
                </div>
              </div>

              {/* Core Information */}
              <div className="lg:col-span-8">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-full space-y-5">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Core Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <Label className="font-semibold text-gray-700 text-sm">Product Name <span className="text-red-500">*</span></Label>
                      <Input placeholder="e.g. Premium Brass Hinge" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} className="bg-gray-50 focus-visible:bg-white" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <Label className="font-semibold text-gray-700 text-sm">Name (Hindi)</Label>
                        <button className="text-[10px] flex items-center gap-1 text-primary font-semibold hover:underline" onClick={() => handleTranslate(productForm.name, (v) => setProductForm({ ...productForm, name_hi: v }))}><Languages size={12} className="mr-1" /> Translate</button>
                      </div>
                      <Input placeholder="हिंदी नाम" value={productForm.name_hi} onChange={(e) => setProductForm({ ...productForm, name_hi: e.target.value })} className="bg-gray-50 focus-visible:bg-white" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="font-semibold text-gray-700 text-sm">Subcategory</Label>
                      <select className="w-full h-10 px-3 border border-gray-200 rounded-md text-sm bg-gray-50" value={productForm.subcategory_id} onChange={(e) => {
                        const subId = e.target.value;
                        const selectedSub = subcategories.find(s => s.id === subId);
                        setProductForm({ ...productForm, subcategory_id: subId, category_id: selectedSub ? selectedSub.category_id : '' });
                      }}>
                        <option value="">Optional</option>
                        {subcategories.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="font-semibold text-gray-700 text-sm">Category <span className="text-red-500">*</span></Label>
                      <div className="w-full h-10 px-3 border border-gray-200 rounded-md text-sm bg-gray-100 flex items-center text-gray-700">
                        {categories.find(c => c.id === productForm.category_id)?.name || <span className="text-gray-400">Auto-selected from subcategory</span>}
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>

            {/* Row 2: Pricing + Description */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pricing & Toggles */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-5">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Pricing & Points</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold text-gray-700">MRP (₹)</Label>
                    <Input type="number" placeholder="0" value={productForm.mrp} onChange={(e) => setProductForm({ ...productForm, mrp: e.target.value })} className="bg-gray-50" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold text-gray-700">Dealer Price (₹)</Label>
                    <Input type="number" placeholder="0" value={productForm.dealer_price} onChange={(e) => setProductForm({ ...productForm, dealer_price: e.target.value })} className="bg-gray-50" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold text-gray-700">Reward Points</Label>
                    <Input type="number" placeholder="0" value={productForm.reward_points} onChange={(e) => setProductForm({ ...productForm, reward_points: e.target.value })} className="bg-gray-50" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold text-gray-700">Unit</Label>
                    <select
                      className="w-full h-9 px-3 border border-gray-200 rounded-md text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                      value={productForm.unit || 'piece'}
                      onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                    >
                      <option value="piece">Piece (pc)</option>
                      <option value="pair">Pair (pr)</option>
                      <option value="box">Box</option>
                      <option value="packet">Packet (pkt)</option>
                      <option value="set">Set</option>
                      <option value="meter">Meter (m)</option>
                      <option value="sq_ft">Sq. Ft.</option>
                      <option value="kg">Kilogram (kg)</option>
                      <option value="liter">Liter (L)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold text-gray-700">Default Min Stock</Label>
                    <Input type="number" placeholder="5" value={productForm.min_stock_level || ""} onChange={(e) => setProductForm({ ...productForm, min_stock_level: e.target.value })} className="bg-gray-50" />
                  </div>
                </div>
                {/* Toggle switches */}
                <div className="flex flex-wrap gap-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setProductForm({ ...productForm, is_active: !productForm.is_active })}>
                    <div className={`w-9 h-5 rounded-full relative transition-colors ${productForm.is_active ? 'bg-primary' : 'bg-gray-300'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${productForm.is_active ? 'left-[18px]' : 'left-0.5'}`} />
                    </div>
                    <span className="text-sm font-medium text-gray-700">Active</span>
                  </div>
                  <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setProductForm({ ...productForm, is_featured: !productForm.is_featured })}>
                    <div className={`w-9 h-5 rounded-full relative transition-colors ${productForm.is_featured ? 'bg-primary' : 'bg-gray-300'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${productForm.is_featured ? 'left-[18px]' : 'left-0.5'}`} />
                    </div>
                    <span className="text-sm font-medium text-gray-700">Featured</span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Description</h3>
                <Textarea placeholder="Product details, material, usage..." rows={3} value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} className="bg-gray-50 resize-y" />
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-semibold text-gray-500">Hindi</Label>
                  <button className="text-[10px] flex items-center gap-1 text-primary font-semibold hover:underline" onClick={() => handleTranslate(productForm.description, (v) => setProductForm({ ...productForm, description_hi: v }))}><Languages size={12} className="mr-1" /> Translate</button>
                </div>
                <Textarea placeholder="हिंदी विवरण" rows={3} value={productForm.description_hi} onChange={(e) => setProductForm({ ...productForm, description_hi: e.target.value })} className="bg-gray-50 resize-y" />
              </div>
            </div>
          </div>
        )}

        {/* ===== SECTION 2: VARIANTS & MATRIX ===== */}
        {activeSection === "variants" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
            {/* LEFT: Custom field tabs + values */}
            <div className="lg:col-span-4">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-full flex flex-col">
                {/* Fixed field tabs: Size, Finish, Thickness */}
                <div className="flex items-center border-b border-gray-200 bg-gray-50 flex-shrink-0">
                  {FIXED_FIELDS.map(key => (
                    <button key={key} onClick={() => setActiveFieldTab(key)}
                      className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors capitalize ${activeFieldTab === key ? 'border-primary text-primary bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                      {key}
                    </button>
                  ))}
                </div>

                {/* Values list for active field */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {(customFields[activeFieldTab] || []).map((val, idx) => (
                    <div key={idx} className="flex flex-col gap-2 bg-gray-50 rounded-lg p-3 border border-gray-200 group">
                      <div className="flex items-center gap-2">
                        <span className="flex-1 text-sm font-medium text-gray-800">{val}</span>
                        <button onClick={() => removeValueFromField(activeFieldTab, val)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      {activeFieldTab === "finish" && productImages.length > 0 && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Image:</span>
                          <div className="flex gap-1.5 flex-wrap">
                            {productImages.map((img, i) => (
                              <img
                                key={i}
                                src={img.url}
                                alt={`Option ${i}`}
                                onClick={() => setFinishImages({ ...finishImages, [val]: img.url })}
                                className={`w-8 h-8 object-cover rounded cursor-pointer border-2 transition-all ${finishImages[val] === img.url ? 'border-primary ring-2 ring-primary/30 shadow-sm' : 'border-transparent opacity-50 hover:opacity-100 hover:border-gray-300'}`}
                                title={`Select Image ${i + 1}`}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <AddValueInput onAdd={(val) => addValueToField(activeFieldTab, val)} placeholder={`Add ${activeFieldTab} value...`} />
                </div>
              </div>
            </div>

            {/* RIGHT: Matrix grid */}
            <div className="lg:col-span-8">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-full flex flex-col">
                <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50 flex-shrink-0">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Price Matrix</h3>
                    <p className="text-[11px] text-gray-500">Finish (rows) × Size (columns)</p>
                  </div>
                  {colValues.length > 0 && rowValues.length > 0 && (
                    <Button size="sm" onClick={generateEmptyMatrix} className="bg-primary text-white text-xs h-8">
                      Generate Matrix
                    </Button>
                  )}
                </div>

                <div className="flex-1 overflow-auto p-4">
                  {(colValues.length === 0 || rowValues.length === 0) ? (
                    <div className="text-center py-12 text-gray-400">
                      <p className="text-sm font-medium">Add Size & Finish values</p>
                      <p className="text-xs mt-1">Use the tabs on the left to add values, then generate the matrix.</p>
                    </div>
                  ) : priceMatrix.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <p className="text-sm font-medium">Click &quot;Generate Matrix&quot; to create the grid</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr>
                            <th className="p-2 text-left text-xs font-bold text-gray-500 uppercase border-b border-gray-200 sticky left-0 bg-white z-10 min-w-[80px]">
                              Finish / Size
                            </th>
                            <th className="p-2 border-b border-gray-200 sticky left-[80px] bg-white z-10 w-[36px]"></th>
                            {colValues.map(col => (
                              <th key={col} className="p-2 text-center text-[10px] font-bold text-gray-700 uppercase border-b border-gray-200 min-w-[90px]">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rowValues.map((row, ri) => {
                            const subRows = [
                              { key: "mrp", label: "MRP", type: "number" },
                              { key: "dealer_price", label: "DP", type: "number" },
                              { key: "reward_points", label: "Pts", type: "number" },
                              { key: "stock", label: "Stk", type: "number" },
                              { key: "min_stock", label: "Min Stk", type: "number" },
                            ];
                            return subRows.map((sub, si) => (
                              <tr key={`${row}-${sub.key}`} className={`${si === subRows.length - 1 ? 'border-b-2 border-gray-200' : 'border-b border-gray-100'}`}>
                                {si === 0 && (
                                  <td rowSpan={subRows.length} className="p-2 text-xs font-bold text-gray-800 sticky left-0 bg-white z-10 align-middle border-r border-gray-100">
                                    {row}
                                  </td>
                                )}
                                <td className="px-1.5 py-0.5 text-[9px] font-bold text-gray-400 sticky left-[80px] bg-white z-10 whitespace-nowrap border-r border-gray-100">
                                  {sub.label}
                                </td>
                                {colValues.map(col => {
                                  const cell = getMatrixCell(row, col);
                                  return (
                                    <td key={col} className="px-1 py-0.5 min-w-[100px]">
                                      <input type="number" placeholder="0" value={cell[sub.key] || ""}
                                        onChange={(e) => updateMatrixCell(row, col, sub.key, e.target.value)}
                                        className="w-full h-6 px-1.5 text-xs border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-primary/30" />
                                    </td>
                                  );
                                })}
                              </tr>
                            ));
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM BAR */}
      <BottomBar>
        <div className="flex items-center gap-3">
          <Button onClick={onSave} className="bg-primary hover:bg-primary/90 text-white" disabled={isLoading}>
            <Save size={14} className="mr-2" /> {isLoading ? "Saving..." : "Save Product"}
          </Button>
          <Button variant="outline" onClick={onCancel} className="text-gray-600">Cancel</Button>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-md">
          <button onClick={() => setActiveSection("details")}
            className={`px-4 py-1.5 text-xs font-semibold rounded transition-colors ${activeSection === "details" ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            Product Details
          </button>
          <button onClick={() => setActiveSection("variants")}
            className={`px-4 py-1.5 text-xs font-semibold rounded transition-colors ${activeSection === "variants" ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            Variant & Matrix
          </button>
        </div>
      </BottomBar>
    </div>
  );
}

// --- Small helper components ---

function AddValueInput({ onAdd, placeholder }) {
  const [val, setVal] = useState("");
  return (
    <div className="flex items-center gap-2">
      <Input value={val} onChange={(e) => setVal(e.target.value)} placeholder={placeholder}
        className="h-9 text-sm bg-white flex-1" onKeyDown={(e) => { if (e.key === 'Enter' && val.trim()) { onAdd(val); setVal(""); } }} />
      <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={() => { if (val.trim()) { onAdd(val); setVal(""); } }}>
        <Plus size={14} />
      </Button>
    </div>
  );
}
