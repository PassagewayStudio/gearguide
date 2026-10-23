import { db } from "@/lib/db";

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import ImageUpload from "@/components/ImageUpload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, FileText, UploadCloud, X } from "lucide-react";

const MAX_PDF_MB = 50;

const CATEGORIES = ["Engine", "Transmission", "Electrical", "Brakes", "Suspension", "Body", "Interior", "General"];

export default function ManualForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: "", make: "", model: "", year: "", category: "Engine", description: "", cover_image: null, manual_file_url: "", source: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfName, setPdfName] = useState("");

  const handlePdf = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf") { setError("Please choose a PDF file."); return; }
    if (file.size > MAX_PDF_MB * 1024 * 1024) { setError(`PDF must be under ${MAX_PDF_MB} MB.`); return; }
    setError("");
    setPdfUploading(true);
    try {
      const { file_url } = await db.integrations.Core.UploadPublicFile({ file });
      set("manual_file_url", file_url);
      setPdfName(file.name);
    } catch {
      setError("PDF upload failed. Please try again.");
    } finally {
      setPdfUploading(false);
    }
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.make || !form.model) {
      setError("Title, make and model are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const record = await db.entities.Manual.create({
        title: form.title,
        make: form.make,
        model: form.model,
        year: form.year ? Number(form.year) : undefined,
        category: form.category,
        description: form.description,
        cover_image: form.cover_image,
        manual_file: form.manual_file_url || undefined,
        source: form.source || undefined,
      });
      setDone(true);
      setTimeout(() => navigate(`/view/manuals/${record.id}`), 900);
    } catch (e) {
      setError("Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <CheckCircle2 className="w-12 h-12 text-emerald-500" />
        <p className="mt-3 font-medium">Manual added to the library.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5 max-w-2xl">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Title *</Label>
          <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. 2.0L TDI Service Manual" />
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <select value={form.category} onChange={(e) => set("category", e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Make *</Label>
          <Input value={form.make} onChange={(e) => set("make", e.target.value)} placeholder="e.g. Volkswagen" />
        </div>
        <div className="space-y-1.5">
          <Label>Model *</Label>
          <Input value={form.model} onChange={(e) => set("model", e.target.value)} placeholder="e.g. Golf GTI" />
        </div>
        <div className="space-y-1.5">
          <Label>Year</Label>
          <Input type="number" value={form.year} onChange={(e) => set("year", e.target.value)} placeholder="e.g. 2015" />
        </div>
        <div className="space-y-1.5">
          <Label>Source / credit</Label>
          <Input value={form.source} onChange={(e) => set("source", e.target.value)} placeholder="optional" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="What does this manual cover?" />
      </div>
      <ImageUpload label="Cover image" value={form.cover_image} onChange={(v) => set("cover_image", v)} help="A representative photo of the manual or vehicle." />
      <div className="space-y-1.5">
        <Label>Manual file (PDF)</Label>
        {pdfName ? (
          <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
            <FileText className="w-4 h-4 text-amber-600" />
            <span className="truncate flex-1">{pdfName}</span>
            <button type="button" onClick={() => { setPdfName(""); set("manual_file_url", ""); }} aria-label="Remove PDF">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <label className="flex items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground cursor-pointer hover:bg-muted/50">
            {pdfUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
            {pdfUploading ? "Uploading…" : `Upload a PDF (up to ${MAX_PDF_MB} MB)`}
            <input type="file" accept="application/pdf" className="hidden" onChange={handlePdf} disabled={pdfUploading} />
          </label>
        )}
        <p className="text-xs text-muted-foreground">Or paste a link to a manual hosted elsewhere:</p>
        <Input value={pdfName ? "" : form.manual_file_url} disabled={!!pdfName} onChange={(e) => set("manual_file_url", e.target.value)} placeholder="https://..." />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" disabled={saving || pdfUploading} className="bg-amber-600 hover:bg-amber-700 text-white">
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Publish manual
      </Button>
    </form>
  );
}