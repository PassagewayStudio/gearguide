import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Wrench, AlertTriangle, Layers, ArrowLeft } from "lucide-react";
import ManualForm from "@/components/ManualForm";
import IssueForm from "@/components/IssueForm";
import DiagramForm from "@/components/DiagramForm";

const TABS = [
  { id: "manuals", label: "Manual", icon: Wrench, Form: ManualForm, blurb: "Add a service or owner's manual with a cover photo and file link." },
  { id: "issues", label: "Common Issue", icon: AlertTriangle, Form: IssueForm, blurb: "Document a known problem: symptoms, fix, and photos." },
  { id: "diagrams", label: "Exploded Diagram", icon: Layers, Form: DiagramForm, blurb: "Upload an exploded view with a parts list and callouts." },
];

export default function Contribute() {
  const [active, setActive] = useState("manuals");
  const tab = TABS.find((t) => t.id === active);
  const Form = tab.Form;
  const Icon = tab.icon;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Contribute to the library</h1>
        <p className="mt-2 text-muted-foreground max-w-xl">
          New entries are reviewed by an admin before they appear publicly. You can follow their status under My entries. Thanks for helping fellow mechanics.
        </p>

        {/* Tabs */}
        <div className="mt-8 inline-flex p-1 bg-muted rounded-xl">
          {TABS.map((t) => {
            const TabIcon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActive(t.id)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${active === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                <TabIcon className="w-4 h-4" /> {t.label}
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <span className="w-9 h-9 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4" />
          </span>
          <p className="text-sm text-amber-900/80">{tab.blurb}</p>
        </div>

        <div className="mt-8">
          <Form />
        </div>
      </div>
    </div>
  );
}