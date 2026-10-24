import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { useAuth } from "@/lib/AuthContext";
import ResourceCard from "@/components/ResourceCard";

const SECTIONS = [
  { type: "manuals", entity: "Manual", title: "Manuals" },
  { type: "issues", entity: "CommonIssue", title: "Common Issues" },
  { type: "diagrams", entity: "ExplodedDiagram", title: "Exploded Diagrams" },
];

export default function MyEntries() {
  const { user } = useAuth();
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all(
      SECTIONS.map(async (s) => {
        try {
          const { items } = await db.entities[s.entity].filter({ created_by: user.id }, { includeAll: true, limit: 200 });
          return [s.type, items];
        } catch {
          return [s.type, []];
        }
      })
    ).then((pairs) => { if (active) { setData(Object.fromEntries(pairs)); setLoading(false); } });
    return () => { active = false; };
  }, [user]);

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
        <h1 className="text-3xl font-bold tracking-tight">My entries</h1>
        <p className="mt-2 text-muted-foreground">Everything you've submitted, and whether it's been approved.</p>
        {loading ? (
          <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
        ) : total === 0 ? (
          <div className="mt-8 text-center py-16 border border-dashed border-border rounded-2xl">
            <p className="font-medium">You haven't added anything yet.</p>
            <Link to="/contribute" className="mt-4 inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
              <Plus className="w-4 h-4" /> Contribute an entry
            </Link>
          </div>
        ) : (
          SECTIONS.map((s) => {
            const items = data[s.type] || [];
            if (!items.length) return null;
            return (
              <section key={s.type} className="mt-10">
                <h2 className="text-lg font-semibold">{s.title}</h2>
                <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {items.map((it) => <ResourceCard key={it.id} item={it} type={s.type} />)}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
