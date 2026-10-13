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
const SEVERITIES = ["Low", "Medium", "High"];

export default function IssueForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: "", make: "", model: "", year: "", category: "Engine", symptoms: "", solution: "", severity: "Medium", images: [] });
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
      const record = await db.entities.CommonIssue.create({
        title: form.title,
        make: form.make,
        model: form.model,
        year: form.year ? Number(form.year) : undefined,
        category: form.category,
        symptoms: form.symptoms,
        solution: form.solution,
        severity: form.severity,
        images: form.images,
        helpful_votes: 0,
      });
      setDone(true);
      setTimeout(() => navigate(`/view/issues/${record.id}`), 900);
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
        <p className="mt-3 font-medium">Issue added to the database.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5 max-w-2xl">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Issue title *</Label>
          <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Rough idle when cold" />
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <select value={form.category} onChange={(e) => set("category", e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Make *</Label>
          <Input value={form.make} onChange={(e) => set("make", e.target.value)} placeholder="e.g. Honda" />
        </div>
        <div className="space-y-1.5">
          <Label>Model *</Label>
          <Input value={form.model} onChange={(e) => set("model", e.target.value)} placeholder="e.g. Civic" />
        </div>
        <div className="space-y-1.5">
          <Label>Year</Label>
          <Input type="number" value={form.year} onChange={(e) => set("year", e.target.value)} placeholder="e.g. 2012" />
        </div>
        <div className="space-y-1.5">
          <Label>Severity</Label>
          <select value={form.severity} onChange={(e) => set("severity", e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
            {SEVERITIES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Symptoms</Label>
        <Textarea rows={3} value={form.symptoms} onChange={(e) => set("symptoms", e.target.value)} placeholder="What signs indicate this issue?" />
      </div>
      <div className="space-y-1.5">
        <Label>Solution / fix</Label>
        <Textarea rows={4} value={form.solution} onChange={(e) => set("solution", e.target.value)} placeholder="How is it diagnosed and repaired?" />
      </div>
      <ImageUpload label="Photos" multiple value={form.images} onChange={(v) => set("images", v)} help="Symptom photos, diagnostic shots, or part references." />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" disabled={saving} className="bg-amber-600 hover:bg-amber-700 text-white">
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Add to database
      </Button>
    </form>
  );
}