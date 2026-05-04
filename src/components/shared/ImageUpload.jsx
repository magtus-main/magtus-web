"use client";

import React, { useState, useEffect } from "react";
import { ImagePlus, X } from "lucide-react";

export function ImageUpload({ value, onChange, className = "h-40 w-40" }) {
  const [preview, setPreview] = useState(null);

  // Sync preview with incoming value (could be a string URL or File object)
  useEffect(() => {
    if (!value) {
      setPreview(null);
      return;
    }

    if (typeof value === "string") {
      setPreview(value);
    } else if (value instanceof File) {
      const objectUrl = URL.createObjectURL(value);
      setPreview(objectUrl);
      
      // Cleanup
      return () => URL.revokeObjectURL(objectUrl);
    }
  }, [value]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onChange(file);
    }
  };

  const handleRemove = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(null);
  };

  return (
    <div className={`relative flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors overflow-hidden group ${className}`}>
      {preview ? (
        <>
          <img src={preview} alt="Preview" className="w-full h-full object-cover" />
          <button
            onClick={handleRemove}
            className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100 shadow-md"
            title="Remove Image"
          >
            <X size={16} />
          </button>
        </>
      ) : (
        <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer p-4 text-center">
          <ImagePlus className="w-8 h-8 text-gray-400 mb-2" />
          <span className="text-xs font-medium text-gray-500">Upload Image</span>
          <input type="file" className="hidden" accept="image/jpeg, image/png, image/webp" onChange={handleFileChange} />
        </label>
      )}
    </div>
  );
}
