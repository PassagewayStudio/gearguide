import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { useAuth } from "@/lib/AuthContext";
import ResourceCard from "@/components/ResourceCard";
import ReviewControls from "@/components/ReviewControls";
import StorageCleanup from "@/components/StorageCleanup";

const SECTIONS = [
  { type: "manuals", entity: "Manual", title: "Manuals" },
  { type: "issues", entity: "CommonIssue", title: "Common Issues" },
  { type: "diagrams", entity: "ExplodedDiagram", title: "Exploded Diagrams" },
];
const FILTERS = ["pending", "rejected"];

export default function Admin() {
  const { isAdmin, isLoadingAuth } = useAuth();
  const [status, setStatus] = useState("pending");
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const pairs = await Promise.all(
      SECTIONS.map(async (s) => {
        try {
          const { items } = await db.entities[s.entity].filter({ status }, { includeAll: true, sort: "created_date", limit: 200 });
          return [s.type, items];
        } catch {
          return [s.type, []];
        }
      })
    );
    setData(Object.fromEntries(pairs));
    setLoading(false);
  }, [status]);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  // After a review the entry leaves this list (its status no longer matches the filter).
  const handleChange = (type, updated) =>
    setData((d) => ({ ...d, [type]: (d[type] || []).filter((x) => x.id !== updated.id) }));

  const total = SECTIONS.reduce((n, s) => n + (data[s.type] || []).length, 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Review queue</h1>
        {isLoadingAuth ? null : !isAdmin ? (
          <p className="mt-6 font-medium">This page is for admins only.</p>
        ) : (
          <>
            <div className="mt-6 inline-flex p-1 bg-muted rounded-xl">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setStatus(f)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${status === f ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {f}
                </button>
              ))}
            </div>
            {loading ? (
              <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
            ) : total === 0 ? (
              <div className="mt-8 text-center py-16 border border-dashed border-border rounded-2xl">
                <p className="font-medium">Nothing {status} right now.</p>
              </div>
            ) : (
              SECTIONS.map((s) => {
                const items = data[s.type] || [];
                if (!items.length) return null;
                return (
                  <section key={s.type} className="mt-10">
                    <h2 className="text-lg font-semibold">{s.title} <span className="text-muted-foreground font-normal">({items.length})</span></h2>
                    <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {items.map((it) => (
                        <div key={it.id} className="space-y-2">
                          <ResourceCard item={it} type={s.type} />
                          <ReviewControls Entity={db.entities[s.entity]} item={it} onChange={(u) => handleChange(s.type, u)} />
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })
            )}
            <StorageCleanup />
          </>
        )}
      </div>
    </div>
  );
}
