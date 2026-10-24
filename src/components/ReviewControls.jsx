import React, { useState } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Approve / reject buttons for admins. `Entity` is db.entities.X, `item` the row, `onChange` gets the updated row.
export default function ReviewControls({ Entity, item, onChange, className = "" }) {
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const apply = async (status) => {
    setBusy(true);
    setError("");
    try {
      const updated = await Entity.review(item.id, status, status === "rejected" ? note : "");
      setRejecting(false);
      setNote("");
      onChange?.(updated);
    } catch {
      setError("Could not update this entry.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`rounded-xl border border-border bg-card p-3 space-y-3 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground mr-1">
          Admin · {item.status}
        </span>
        {item.status !== "approved" && (
          <Button size="sm" onClick={() => apply("approved")} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />} Approve
          </Button>
        )}
        {item.status !== "rejected" && !rejecting && (
          <Button size="sm" variant="outline" onClick={() => setRejecting(true)} disabled={busy} className="border-red-200 text-red-600 hover:bg-red-50">
            <XCircle className="w-4 h-4 mr-1" /> {item.status === "approved" ? "Unpublish" : "Reject"}
          </Button>
        )}
      </div>
      {rejecting && (
        <div className="space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Reason shown to the author (optional)"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => apply("rejected")} disabled={busy} className="bg-red-600 hover:bg-red-700 text-white">
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Confirm reject
            </Button>
            <Button size="sm" variant="outline" onClick={() => setRejecting(false)} disabled={busy}>Cancel</Button>
          </div>
        </div>
      )}
      {item.review_note && item.status === "rejected" && <p className="text-xs text-muted-foreground">Note: {item.review_note}</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
