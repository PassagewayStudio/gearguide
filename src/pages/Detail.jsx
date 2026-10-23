import { db } from "@/lib/db";

import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";

import { Image } from "@/components/ui/image";
import { ArrowLeft, Plus, ThumbsUp, Wrench, AlertTriangle, Layers, FileText, Calendar, Tag, Pencil, Trash2, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import TroubleshootingLog from "@/components/TroubleshootingLog";

const TYPE_MAP = {
  manuals: { entity: "Manual", icon: Wrench, label: "Manual", browse: "manuals" },
  issues: { entity: "CommonIssue", icon: AlertTriangle, label: "Common Issue", browse: "issues" },
  diagrams: { entity: "ExplodedDiagram", icon: Layers, label: "Exploded Diagram", browse: "diagrams" },
};

export default function Detail() {
  const { type, id } = useParams();
  const meta = TYPE_MAP[type] || TYPE_MAP.manuals;
  const Entity = db.entities[meta.entity];
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const rec = await Entity.get(id);
        if (active) setItem(rec);
      } catch {
        if (active) setItem(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [type, id]);

  const remove = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      await Entity.delete(id);
      navigate(`/browse/${meta.browse}`);
    } catch {
      setDeleteError("Could not delete this entry. Please try again.");
      setDeleting(false);
    }
  };

  const vote = async () => {
    if (voting || !item) return;
    setVoting(true);
    try {
      const updated = await Entity.vote(id);
      setItem(updated);
    } catch {} finally {
      setVoting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-20">
        <div className="h-6 bg-muted rounded animate-pulse w-1/3 mb-4" />
        <div className="h-10 bg-muted rounded animate-pulse w-2/3 mb-8" />
        <div className="aspect-[16/10] bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-24 text-center">
        <p className="text-lg font-medium">This entry could not be found.</p>
        <Link to={`/browse/${meta.browse}`} className="mt-4 inline-flex items-center gap-1.5 text-amber-700 hover:text-amber-800">
          <ArrowLeft className="w-4 h-4" /> Back to {meta.label.toLowerCase()}s
        </Link>
      </div>
    );
  }

  const images = type === "issues" ? item.images || [] : [item.cover_image, item.diagram_image].filter(Boolean);
  const mainImage = images[activeImage] || images[0];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to={`/browse/${meta.browse}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> {meta.label}s
          </Link>
          <Link to="/contribute" className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 hover:text-amber-800">
            <Plus className="w-4 h-4" /> Add
          </Link>
        </div>
      </header>

      <article className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {[item.make, item.model, item.year && String(item.year)].filter(Boolean).map((t, i) => (
            <span key={i} className="inline-flex items-center gap-1">
              {i > 0 && <span className="text-border">·</span>}
              {t}
            </span>
          ))}
          {item.category && (
            <span className="ml-1 inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full text-xs font-medium">
              <Tag className="w-3 h-3" /> {item.category}
            </span>
          )}
        </div>

        <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">{item.title}</h1>

        {user && item.created_by === user.id && (
          <div className="mt-4 flex items-center gap-3">
            <Link to={`/edit/${type}/${id}`} className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-muted">
              <Pencil className="w-4 h-4" /> Edit
            </Link>
            <button onClick={() => setConfirmOpen(true)} className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          </div>
        )}

        <Dialog open={confirmOpen} onOpenChange={(o) => !deleting && setConfirmOpen(o)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete this {meta.label.toLowerCase()}?</DialogTitle>
              <DialogDescription>
                "{item.title}" will be removed for everyone{type === "issues" ? ", along with its troubleshooting steps" : ""}. This can't be undone.
              </DialogDescription>
            </DialogHeader>
            {deleteError && <p className="text-sm text-red-500">{deleteError}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={deleting}>Cancel</Button>
              <Button onClick={remove} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {mainImage && (
          <div className="mt-6 grid lg:grid-cols-[1fr_88px] gap-4">
            <div className="rounded-2xl overflow-hidden border border-border bg-muted aspect-[16/10]">
              <Image src={mainImage} className="w-full h-full object-cover" />
            </div>
            {images.length > 1 && (
              <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(i)}
                    className={`shrink-0 w-20 h-16 rounded-lg overflow-hidden border-2 ${i === activeImage ? "border-amber-500" : "border-border"}`}
                  >
                    <Image src={img} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-8 grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {type === "issues" && (
              <>
                <Section title="Symptoms" body={item.symptoms} />
                <Section title="Solution / fix" body={item.solution} />
                <TroubleshootingLog parentId={item.id} />
              </>
            )}
            {type === "diagrams" && (
              <>
                <Section title="Description" body={item.description} />
                <Section title="Parts & callouts" body={item.parts} mono />
              </>
            )}
            {type === "manuals" && (
              <Section title="Description" body={item.description} />
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5 space-y-3 text-sm">
              <DetailRow icon={Calendar} label="Year" value={item.year ? String(item.year) : "—"} />
              <DetailRow icon={Tag} label="Category" value={item.category || "—"} />
              {type === "diagrams" && item.system && <DetailRow icon={Layers} label="System" value={item.system} />}
              {type === "manuals" && item.source && <DetailRow icon={FileText} label="Source" value={item.source} />}
            </div>

            {type === "issues" && (
              <button
                onClick={vote}
                disabled={voting}
                className="w-full rounded-xl border border-border bg-card p-4 flex items-center justify-between hover:border-amber-400 transition disabled:opacity-60"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <ThumbsUp className="w-4 h-4 text-amber-600" /> Helpful
                </span>
                <span className="text-sm text-muted-foreground">{item.helpful_votes || 0}</span>
              </button>
            )}

            {type === "manuals" && item.manual_file && (
              <a
                href={item.manual_file}
                target="_blank"
                rel="noreferrer"
                className="w-full rounded-xl bg-amber-600 hover:bg-amber-700 text-white p-4 flex items-center justify-center gap-2 text-sm font-medium transition"
              >
                <FileText className="w-4 h-4" /> Open manual file
              </a>
            )}
          </aside>
        </div>
      </article>
    </div>
  );
}

function Section({ title, body, mono }) {
  if (!body) return null;
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      <p className={`mt-2 text-[15px] leading-relaxed text-foreground/90 whitespace-pre-wrap ${mono ? "font-mono text-sm" : ""}`}>{body}</p>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-muted-foreground"><Icon className="w-4 h-4" /> {label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}