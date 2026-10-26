import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Search as SearchIcon, Wrench, AlertTriangle, Layers } from "lucide-react";
import { db } from "@/lib/db";
import ResourceCard from "@/components/ResourceCard";
import posthog from "posthog-js";

const SECTIONS = [
  { type: "manuals", entity: "Manual", title: "Manuals", icon: Wrench },
  { type: "issues", entity: "CommonIssue", title: "Common Issues", icon: AlertTriangle },
  { type: "diagrams", entity: "ExplodedDiagram", title: "Exploded Diagrams", icon: Layers },
];
const PREVIEW = 6;

export default function Search() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const [text, setText] = useState(q);
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => setText(q), [q]);

  useEffect(() => {
    if (!q.trim()) { setResults({}); return; }
    let active = true;
    setLoading(true);
    Promise.all(
      SECTIONS.map(async (s) => {
        try {
          const { items } = await db.entities[s.entity].filter({ $search: q.trim() }, { sort: "-created_date", limit: PREVIEW + 1 });
          return [s.type, items];
        } catch {
          return [s.type, []];
        }
      })
    ).then((pairs) => {
  if (active) {
    setResults(Object.fromEntries(pairs));
    setLoading(false);
    const counts = Object.fromEntries(
      pairs.map(([type, items]) => [type, Math.min(items.length, PREVIEW)])
    );
    const resultCount = Object.values(counts).reduce((a, b) => a + b, 0);
    posthog.capture("search_performed", {
      query: q.trim().toLowerCase(),
      result_count: resultCount,
      zero_results: resultCount === 0,
      manuals_count: counts.manuals,
      issues_count: counts.issues,
      diagrams_count: counts.diagrams,
    });
  }
});
    return () => { active = false; };
  }, [q]);

  const submit = (e) => {
    e.preventDefault();
    setParams(text.trim() ? { q: text.trim() } : {});
  };

  const total = SECTIONS.reduce((n, s) => n + Math.min((results[s.type] || []).length, PREVIEW), 0);

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
        <h1 className="text-3xl font-bold tracking-tight">Search</h1>
        <form onSubmit={submit} className="mt-6 relative max-w-2xl">
          <SearchIcon className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Try “honda civic 2012” or “rough idle”"
            className="w-full h-12 pl-10 pr-3 rounded-lg border border-input bg-background text-sm outline-none focus:border-amber-500"
          />
        </form>
        <p className="mt-2 text-xs text-muted-foreground">Every word has to match something: make, model, year, title, category or details.</p>

        {!q.trim() ? null : loading ? (
          <p className="mt-10 text-sm text-muted-foreground">Searching…</p>
        ) : total === 0 ? (
          <div className="mt-10 text-center py-16 border border-dashed border-border rounded-2xl">
            <p className="font-medium">Nothing matches “{q}”.</p>
            <p className="text-sm text-muted-foreground mt-1">Try fewer words, or add it yourself.</p>
            <Link to="/contribute" className="mt-4 inline-block text-amber-700 hover:text-amber-800 text-sm font-medium">Contribute an entry</Link>
          </div>
        ) : (
          SECTIONS.map((s) => {
            const items = results[s.type] || [];
            if (!items.length) return null;
            const Icon = s.icon;
            return (
              <section key={s.type} className="mt-10">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-lg font-semibold"><Icon className="w-4 h-4 text-amber-600" /> {s.title}</h2>
                  <Link to={`/browse/${s.type}?q=${encodeURIComponent(q.trim())}`} className="inline-flex items-center gap-1 text-sm text-amber-700 hover:text-amber-800">
                    {items.length > PREVIEW ? "See all" : "Open in browse"} <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {items.slice(0, PREVIEW).map((it) => <ResourceCard key={it.id} item={it} type={s.type} />)}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
