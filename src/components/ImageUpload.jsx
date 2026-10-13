import { db } from "@/lib/db";

import React, { useState } from "react";

import { Image } from "@/components/ui/image";
import { Loader2, UploadCloud, X } from "lucide-react";

export default function ImageUpload({ value, onChange, label = "Image", multiple = false, help }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const values = multiple ? value || [] : value ? [value] : [];

  const handleFiles = async (files) => {
    const list = Array.from(files);
    if (!list.length) return;
    setUploading(true);
    setError("");
    try {
      const urls = [];
      for (const file of list) {
        const { file_url } = await db.integrations.Core.UploadPublicFile({ file });
        urls.push(file_url);
      }
      if (multiple) onChange([...values, ...urls]);
      else onChange(urls[0]);
    } catch (e) {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const remove = (idx) => {
    if (multiple) onChange(values.filter((_, i) => i !== idx));
    else onChange(null);
  };

  return (
    <div>
      <label className="text-sm font-medium text-foreground/80">{label}</label>
      <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {values.map((url, idx) => (
          <div key={idx} className="relative group aspect-[4/3] rounded-lg overflow-hidden border border-border bg-muted">
            <Image src={url} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => remove(idx)}
              className="absolute top-1.5 right-1.5 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <label className={`aspect-[4/3] rounded-lg border-2 border-dashed border-border hover:border-amber-500/60 hover:bg-amber-50/40 transition flex flex-col items-center justify-center gap-2 cursor-pointer text-muted-foreground ${uploading ? "pointer-events-none" : ""}`}>
          {uploading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <UploadCloud className="w-5 h-5" />
              <span className="text-xs">{multiple ? "Add images" : "Upload"}</span>
            </>
          )}
          <input
            type="file"
            accept="image/*"
            multiple={multiple}
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>
      </div>
      {help && <p className="text-xs text-muted-foreground mt-1.5">{help}</p>}
      {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
    </div>
  );
}