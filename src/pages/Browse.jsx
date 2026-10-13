import { db } from "@/lib/db";

import React, { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";

import ResourceCard from "@/components/ResourceCard";
import { Search, SlidersHorizontal, Plus, ArrowLeft, Wrench, AlertTriangle, Layers } from "lucide-react";

const TYPE_MAP = {
  manuals: { entity: "Manual", title: "Manuals", icon: Wrench },
  issues: { entity: "CommonIssue", title: "Common Issues", icon: AlertTriangle },
  diagrams: { entity: "ExplodedDiagram", title: "Exploded Diagrams", icon: Layers },
};

const CATEGORIES = ["Engine", "Transmission", "Electrical", "Brakes", "Suspension", "Body", "Interior", "General"];

export default function Browse() {
  const { type } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const meta = TYPE_MAP[type] || TYPE_MAP.manuals;
  const Entity = db.entities[meta.entity];

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [makes, setMakes] = useState([]);
  const [filters, setFilters] = useState({
    q: searchParams.get("q") || "",
    make: "",
    category: "",
  });

  useEffect(() => {
    Entity.list({ distinct: "make" })
      .then((res) => setMakes(res.items || []))
      .catch(() => {});
  }, [type]);

  useEffect(() => {
    setFilters((f) => ({ ...f, q: searchParams.get("q") || "" }));
  }, [searchParams, type]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      const query = {};
      if (filters.make) query.make = filters.make;
      if (filters.category) query.category = filters.category;
      if (filters.q.trim()) query.title = { $regex: filters.q.trim(), $options: "i" };
      try {
        const res = await Entity.filter(query, { sort: "-created_date", limit: 60 });
        if (active) setItems(res.items || []);
      } catch {
        if (active) setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [type, filters.q, filters.make, filters.category]);

  const updateQ = (v) => {
    setFilters((f) => ({ ...f, q: v }));
    const params = new URLSearchParams(searchParams);
    if (v) params.set("q", v); else params.delete("q");
    setSearchParams(params, { replace: true });
  };

  const Icon = meta.icon;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <Link to="/contribute" className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 hover:text-amber-800">
            <Plus className="w-4 h-4" /> Add
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Icon className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{meta.title}</h1>
            <p className="text-sm text-muted-foreground">Browse the community library</p>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={filters.q}
              onChange={(e) => updateQ(e.target.value)}
              placeholder="Search by title…"
              className="w-full h-11 pl-10 pr-3 rounded-lg border border-input bg-background text-sm outline-none focus:border-amber-500"
            />
          </div>
          <select
            value={filters.make}
            onChange={(e) => setFilters((f) => ({ ...f, make: e.target.value }))}
            className="h-11 rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="">All makes</option>
            {makes.map((m) => <option key={m}>{m}</option>)}
          </select>
          <select
            value={filters.category}
            onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
            className="h-11 rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>

        {/* Results */}
        <div className="mt-8">
          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="aspect-[16/10] bg-muted animate-pulse" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                    <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-border rounded-2xl">
              <SlidersHorizontal className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="mt-3 font-medium">No entries match your filters yet.</p>
              <p className="text-sm text-muted-foreground">Be the first to add one.</p>
              <Link to="/contribute" className="mt-5 inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
                <Plus className="w-4 h-4" /> Add an entry
              </Link>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-4">{items.length} result{items.length !== 1 ? "s" : ""}</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {items.map((it) => <ResourceCard key={it.id} item={it} type={type} />)}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}