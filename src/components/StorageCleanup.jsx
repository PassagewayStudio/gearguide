import React, { useState } from "react";
import { HardDrive, Loader2, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";

const formatBytes = (n) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

// Admin tool: find uploaded images/PDFs that no entry uses any more, then delete them.
export default function StorageCleanup() {
  const [files, setFiles] = useState(null); // null = not scanned yet
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const scan = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      setFiles(await db.admin.orphanedUploads());
    } catch {
      setError("Could not scan storage. Make sure the 004 migration has been run.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      const removed = await db.admin.deleteUploads(files.map((f) => f.path));
      setMessage(`Deleted ${removed} file${removed === 1 ? "" : "s"}.`);
      setFiles(null);
    } catch {
      setError("Deleting failed. Nothing further was removed.");
    } finally {
      setBusy(false);
    }
  };

  const total = (files || []).reduce((n, f) => n + Number(f.bytes || 0), 0);

  return (
    <section className="mt-14 rounded-xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><HardDrive className="w-4 h-4 text-amber-600" /> Storage clean-up</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Finds uploaded files that no entry uses any more, for example from deleted entries or replaced images.
        Files uploaded in the last 24 hours are never touched.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={scan} disabled={busy}>
          {busy && files === null ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          {files === null ? "Scan for unused files" : "Scan again"}
        </Button>
        {files && files.length > 0 && (
          <Button onClick={remove} disabled={busy} className="bg-red-600 hover:bg-red-700 text-white">
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
            Delete {files.length} file{files.length === 1 ? "" : "s"} ({formatBytes(total)})
          </Button>
        )}
      </div>
      {files && files.length === 0 && <p className="mt-3 text-sm text-emerald-700">No unused files found.</p>}
      {files && files.length > 0 && (
        <ul className="mt-3 max-h-40 overflow-auto text-xs text-muted-foreground font-mono space-y-0.5">
          {files.slice(0, 50).map((f) => <li key={f.path}>{f.path} · {formatBytes(Number(f.bytes || 0))}</li>)}
          {files.length > 50 && <li>…and {files.length - 50} more</li>}
        </ul>
      )}
      {message && <p className="mt-3 text-sm text-emerald-700">{message}</p>}
      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
    </section>
  );
}
