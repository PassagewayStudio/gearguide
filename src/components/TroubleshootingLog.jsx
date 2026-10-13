import { db } from "@/lib/db";

import React, { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Wrench, CheckCircle2, XCircle, AlertCircle, HelpCircle, Plus, Loader2 } from "lucide-react";

const OUTCOMES = [
  { value: "Tried - no change", icon: XCircle, tone: "text-rose-600 bg-rose-50" },
  { value: "Tried - partial fix", icon: AlertCircle, tone: "text-amber-600 bg-amber-50" },
  { value: "Checked - OK", icon: CheckCircle2, tone: "text-emerald-600 bg-emerald-50" },
  { value: "Resolved the issue", icon: CheckCircle2, tone: "text-emerald-700 bg-emerald-100" },
  { value: "Other", icon: HelpCircle, tone: "text-zinc-600 bg-zinc-100" },
];

export default function TroubleshootingLog({ parentId }) {
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ step: "", outcome: "Tried - no change", notes: "" });
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await db.entities.TroubleshootingStep.filter(
        { parent_id: parentId },
        { sort: "created_date", limit: 200 }
      );
      setSteps(res.items || []);
    } catch {
      setSteps([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [parentId]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.step.trim()) { setError("Describe what you tried or checked."); return; }
    setAdding(true);
    setError("");
    try {
      await db.entities.TroubleshootingStep.create({
        parent_id: parentId,
        step: form.step.trim(),
        outcome: form.outcome,
        notes: form.notes.trim(),
      });
      setForm({ step: "", outcome: "Tried - no change", notes: "" });
      await load();
    } catch {
      setError("Could not save the step. Please try again.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="mt-10">
      <div className="flex items-center gap-2">
        <Wrench className="w-4 h-4 text-amber-600" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Troubleshooting log</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Track what's been tried and what happened — newest at the bottom.</p>

      {/* Timeline */}
      <div className="mt-5 space-y-3">
        {loading ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading steps…
          </div>
        ) : steps.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center">
            <p className="text-sm font-medium">No steps logged yet.</p>
            <p className="text-sm text-muted-foreground">Add the first thing you tried or checked below.</p>
          </div>
        ) : (
          steps.map((s, i) => {
            const o = OUTCOMES.find((x) => x.value === s.outcome) || OUTCOMES[4];
            const OIcon = o.icon;
            return (
              <div key={s.id} className="relative pl-10">
                <span className="absolute left-0 top-0 flex items-center justify-center w-7 h-7 rounded-full bg-background border border-border text-xs font-medium text-muted-foreground">
                  {i + 1}
                </span>
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-[15px] leading-snug">{s.step}</p>
                    <span className={`shrink-0 inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${o.tone}`}>
                      <OIcon className="w-3.5 h-3.5" /> {s.outcome}
                    </span>
                  </div>
                  {s.notes && <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{s.notes}</p>}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add step */}
      <form onSubmit={submit} className="mt-5 rounded-xl border border-border bg-muted/30 p-4 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-1.5"><Plus className="w-4 h-4" /> Add a step</h3>
        <Textarea
          value={form.step}
          onChange={(e) => setForm((f) => ({ ...f, step: e.target.value }))}
          placeholder="e.g. Replaced the mass airflow sensor"
          className="bg-background min-h-[70px]"
        />
        <div className="grid sm:grid-cols-2 gap-3">
          <select
            value={form.outcome}
            onChange={(e) => setForm((f) => ({ ...f, outcome: e.target.value }))}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
          >
            {OUTCOMES.map((o) => <option key={o.value}>{o.value}</option>)}
          </select>
          <Textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Optional notes (what you observed…)"
            className="bg-background min-h-[40px]"
          />
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <Button type="submit" disabled={adding} className="bg-amber-600 hover:bg-amber-700 text-white">
          {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {adding ? "Saving…" : "Add step"}
        </Button>
      </form>
    </div>
  );
}