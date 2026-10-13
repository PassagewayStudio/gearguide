import { db } from "@/lib/db";

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import ImageUpload from "@/components/ImageUpload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2 } from "lucide-react";

const CATEGORIES = ["Engine", "Transmission", "Electrical", "Brakes", "Suspension", "Body", "Interior", "General"];

export default function ManualForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: "", make: "", model: "", year: "", category: "Engine", description: "", cover_image: null, manual_file_url: "", source: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

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
        <Label>Manual file link (PDF / URL)</Label>
        <Input value={form.manual_file_url} onChange={(e) => set("manual_file_url", e.target.value)} placeholder="https://..." />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" disabled={saving} className="bg-amber-600 hover:bg-amber-700 text-white">
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Publish manual
      </Button>
    </form>
  );
}