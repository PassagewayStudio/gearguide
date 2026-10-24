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

export default function DiagramForm({ record }) {
  const navigate = useNavigate();
  const [form, setForm] = useState(record ? {
    title: record.title || "", make: record.make || "", model: record.model || "", year: record.year ? String(record.year) : "",
    category: record.category || "Engine", system: record.system || "", description: record.description || "",
    diagram_image: record.diagram_image || null, parts: record.parts || "",
  } : { title: "", make: "", model: "", year: "", category: "Engine", system: "", description: "", diagram_image: null, parts: "" });
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
      const fields = {
        title: form.title,
        make: form.make,
        model: form.model,
        year: form.year ? Number(form.year) : null,
        category: form.category,
        system: form.system || null,
        description: form.description,
        diagram_image: form.diagram_image,
        parts: form.parts,
      };
      const saved = record
        ? await db.entities.ExplodedDiagram.update(record.id, fields)
        : await db.entities.ExplodedDiagram.create(fields);
      setDone(saved.status === "approved" ? "approved" : "pending");
      setTimeout(() => navigate(`/view/diagrams/${saved.id}`), 1800);
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
        <p className="mt-3 font-medium">{done === "pending" ? "Submitted for review. It will appear publicly once an admin approves it." : record ? "Changes saved." : "Diagram added to the library."}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5 max-w-2xl">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Diagram title *</Label>
          <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Brake caliper assembly" />
        </div>
        <div className="space-y-1.5">
          <Label>System</Label>
          <Input value={form.system} onChange={(e) => set("system", e.target.value)} placeholder="e.g. Front brakes" />
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <select value={form.category} onChange={(e) => set("category", e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Year</Label>
          <Input type="number" value={form.year} onChange={(e) => set("year", e.target.value)} placeholder="e.g. 2018" />
        </div>
        <div className="space-y-1.5">
          <Label>Make *</Label>
          <Input value={form.make} onChange={(e) => set("make", e.target.value)} placeholder="e.g. Toyota" />
        </div>
        <div className="space-y-1.5">
          <Label>Model *</Label>
          <Input value={form.model} onChange={(e) => set("model", e.target.value)} placeholder="e.g. Corolla" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="What does this exploded view show?" />
      </div>
      <ImageUpload label="Exploded view image" value={form.diagram_image} onChange={(v) => set("diagram_image", v)} help="Upload the exploded-view diagram picture." />
      <div className="space-y-1.5">
        <Label>Parts list / callouts</Label>
        <Textarea rows={4} value={form.parts} onChange={(e) => set("parts", e.target.value)} placeholder="Numbered part list or notes, one per line." />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" disabled={saving} className="bg-amber-600 hover:bg-amber-700 text-white">
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        {record ? "Save changes" : "Publish diagram"}
      </Button>
    </form>
  );
}