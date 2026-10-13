import { db } from "@/lib/db";

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import ResourceCard from "@/components/ResourceCard";
import { Wrench, AlertTriangle, Layers, ArrowRight, Plus, Search, BookOpen } from "lucide-react";


const SECTIONS = [
  { type: "manuals", entity: "Manual", title: "Manuals", icon: Wrench, desc: "Factory & community service manuals with photos." },
  { type: "issues", entity: "CommonIssue", title: "Common Issues", icon: AlertTriangle, desc: "A growing, crowd-sourced database of known problems and fixes." },
  { type: "diagrams", entity: "ExplodedDiagram", title: "Exploded Diagrams", icon: Layers, desc: "Exploded views and part callouts for every system." },
];

export default function Home() {
  const [counts, setCounts] = useState({});
  const [recent, setRecent] = useState({ manuals: [], issues: [], diagrams: [] });
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [m, i, d] = await Promise.all([
          db.entities.Manual.count({}),
          db.entities.CommonIssue.count({}),
          db.entities.ExplodedDiagram.count({}),
        ]);
        setCounts({ manuals: m, issues: i, diagrams: d });
      } catch {}
      try {
        const [rm, ri, rd] = await Promise.all([
          db.entities.Manual.filter({}, { sort: "-created_date", limit: 3 }),
          db.entities.CommonIssue.filter({}, { sort: "-created_date", limit: 3 }),
          db.entities.ExplodedDiagram.filter({}, { sort: "-created_date", limit: 3 }),
        ]);
        setRecent({ manuals: rm.items, issues: ri.items, diagrams: rd.items });
      } catch {}
    })();
  }, []);

  const total = (counts.manuals || 0) + (counts.issues || 0) + (counts.diagrams || 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="w-full h-full bg-zinc-900 [background-image:radial-gradient(circle_at_20%_20%,rgba(245,158,11,0.25),transparent_45%),radial-gradient(circle_at_80%_60%,rgba(63,63,70,0.8),transparent_55%)]" />
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/90 via-zinc-950/70 to-zinc-950/30" />
        </div>
        <div className="relative max-w-6xl mx-auto px-6 pt-10 pb-20 sm:pt-16 sm:pb-28">
          <nav className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-white font-semibold tracking-tight">
              <span className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
                <Wrench className="w-4 h-4 text-zinc-900" />
              </span>
              Garagewiki
            </Link>
            <Link to="/contribute" className="inline-flex items-center gap-1.5 text-sm font-medium text-white/90 hover:text-white">
              <Plus className="w-4 h-4" /> Contribute
            </Link>
          </nav>

          <div className="mt-16 sm:mt-24 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-200 bg-amber-500/10 border border-amber-400/20 px-3 py-1 rounded-full">
              <BookOpen className="w-3.5 h-3.5" /> Community-built automotive knowledge
            </span>
            <h1 className="mt-5 text-4xl sm:text-6xl font-bold text-white leading-[1.05] tracking-tight">
              Every car manual,<br />issue & diagram,<br />in one place.
            </h1>
            <p className="mt-5 text-lg text-zinc-300 max-w-xl">
              A growing, crowd-sourced library of service manuals, common issues, and exploded-view diagrams — enriched with photos and added by people like you.
            </p>

            <form
              onSubmit={(e) => { e.preventDefault(); if (q.trim()) window.location.href = `/browse/manuals?q=${encodeURIComponent(q)}`; }}
              className="mt-8 flex items-center gap-2 bg-white rounded-xl p-1.5 shadow-2xl max-w-lg"
            >
              <Search className="w-5 h-5 text-zinc-400 ml-2" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search manuals, issues, diagrams…"
                className="flex-1 bg-transparent outline-none text-sm text-zinc-800 placeholder:text-zinc-400"
              />
              <button type="submit" className="bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium px-4 py-2 rounded-lg">
                Search
              </button>
            </form>

            <p className="mt-4 text-sm text-zinc-400">
              {total > 0 ? `${total} entries and counting` : "Be the first to add an entry"}
            </p>
          </div>
        </div>
      </header>

      {/* Sections */}
      <section className="max-w-6xl mx-auto px-6 -mt-10 relative z-10">
        <div className="grid sm:grid-cols-3 gap-4">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.type}
                to={`/browse/${s.type}`}
                className="group rounded-2xl border border-border bg-card p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 group-hover:text-amber-600 transition" />
                </div>
                <h3 className="mt-4 font-semibold text-lg">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
                <p className="mt-3 text-sm font-medium text-amber-700">{counts[s.type] ?? "—"} entries</p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Recent */}
      <section className="max-w-6xl mx-auto px-6 py-16 space-y-12">
        {SECTIONS.map((s) => {
          const items = recent[s.type];
          if (!items || !items.length) return null;
          return (
            <div key={s.type}>
              <div className="flex items-end justify-between mb-5">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Recent {s.title.toLowerCase()}</h2>
                  <p className="text-sm text-muted-foreground">Latest community contributions</p>
                </div>
                <Link to={`/browse/${s.type}`} className="text-sm font-medium text-amber-700 hover:text-amber-800 inline-flex items-center gap-1">
                  View all <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {items.map((it) => <ResourceCard key={it.id} item={it} type={s.type} />)}
              </div>
            </div>
          );
        })}
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="rounded-3xl bg-zinc-900 px-8 py-14 sm:px-14 sm:py-16 text-center overflow-hidden relative">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_30%_20%,#f59e0b,transparent_50%)]" />
          <div className="relative">
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Know a fix that isn't here?</h2>
            <p className="mt-3 text-zinc-300 max-w-xl mx-auto">
              Add a manual, document a common issue, or upload an exploded diagram. Every entry makes the library better for the next wrench-turner.
            </p>
            <Link to="/contribute" className="mt-7 inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold px-6 py-3 rounded-xl transition">
              <Plus className="w-5 h-5" /> Contribute an entry
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-8 text-sm text-muted-foreground flex items-center justify-between">
          <span>Garagewiki · Community automotive knowledge</span>
          <Link to="/contribute" className="hover:text-foreground">Add an entry</Link>
        </div>
      </footer>
    </div>
  );
}