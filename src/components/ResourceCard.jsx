import React from "react";
import { Link } from "react-router-dom";
import { Image } from "@/components/ui/image";
import { Wrench, AlertTriangle, Layers } from "lucide-react";

const TYPE_META = {
  manuals: { entity: "Manual", icon: Wrench, label: "Manual", to: "manuals" },
  issues: { entity: "CommonIssue", icon: AlertTriangle, label: "Common Issue", to: "issues" },
  diagrams: { entity: "ExplodedDiagram", icon: Layers, label: "Exploded Diagram", to: "diagrams" },
};

const CATEGORY_COLORS = {
  Engine: "bg-amber-100 text-amber-800",
  Transmission: "bg-blue-100 text-blue-800",
  Electrical: "bg-violet-100 text-violet-800",
  Brakes: "bg-red-100 text-red-800",
  Suspension: "bg-emerald-100 text-emerald-800",
  Body: "bg-slate-100 text-slate-700",
  Interior: "bg-rose-100 text-rose-800",
  General: "bg-zinc-100 text-zinc-700",
};

export default function ResourceCard({ item, type }) {
  const meta = TYPE_META[type];
  const Icon = meta.icon;
  const image = item.cover_image || (item.images && item.images[0]) || item.diagram_image;

  return (
    <Link
      to={`/view/${meta.to}/${item.id}`}
      className="group block rounded-xl border border-border bg-card overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
    >
      <div className="aspect-[16/10] bg-muted relative overflow-hidden">
        {image ? (
          <Image src={image} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-200">
            <Icon className="w-8 h-8 text-zinc-400" />
          </div>
        )}
        <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 bg-white/90 backdrop-blur px-2.5 py-1 rounded-full text-[11px] font-medium text-zinc-700">
          <Icon className="w-3 h-3" />
          {meta.label}
        </span>
        {item.status && item.status !== "approved" && (
          <span className={`absolute bottom-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-semibold ${item.status === "rejected" ? "bg-red-600 text-white" : "bg-amber-500 text-zinc-900"}`}>
            {item.status === "rejected" ? "Rejected" : "Pending review"}
          </span>
        )}
        {item.category && (
          <span className={`absolute top-3 right-3 px-2 py-0.5 rounded-full text-[11px] font-medium ${CATEGORY_COLORS[item.category] || "bg-zinc-100 text-zinc-700"}`}>
            {item.category}
          </span>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-amber-700 transition-colors">
          {item.title}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {[item.make, item.model, item.year].filter(Boolean).join(" · ")}
        </p>
        {item.description && (
          <p className="mt-2 text-sm text-muted-foreground/80 line-clamp-2">{item.description}</p>
        )}
        {type === "issues" && item.severity && (
          <span className={`mt-3 inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${item.severity === "High" ? "bg-red-100 text-red-700" : item.severity === "Medium" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
            {item.severity} severity
          </span>
        )}
      </div>
    </Link>
  );
}