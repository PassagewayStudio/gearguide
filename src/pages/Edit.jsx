import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { useAuth } from "@/lib/AuthContext";
import ManualForm from "@/components/ManualForm";
import IssueForm from "@/components/IssueForm";
import DiagramForm from "@/components/DiagramForm";

const TYPES = {
  manuals: { entity: "Manual", Form: ManualForm, label: "manual" },
  issues: { entity: "CommonIssue", Form: IssueForm, label: "issue" },
  diagrams: { entity: "ExplodedDiagram", Form: DiagramForm, label: "diagram" },
};

export default function Edit() {
  const { type, id } = useParams();
  const { user } = useAuth();
  const meta = TYPES[type];
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!meta) { setLoading(false); return; }
    let active = true;
    db.entities[meta.entity].get(id)
      .then((r) => active && setRecord(r))
      .catch(() => active && setRecord(null))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [type, id]);

  const back = `/view/${type}/${id}`;
  const canEdit = record && user && record.created_by === user.id;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <Link to={meta ? back : "/"} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Cancel
          </Link>
        </div>
      </header>
      <div className="max-w-5xl mx-auto px-6 py-12">
        {loading ? (
          <div className="h-8 w-1/3 bg-muted rounded animate-pulse" />
        ) : !canEdit ? (
          <p className="text-lg font-medium">
            {record ? "You can only edit entries you created." : "This entry could not be found."}
          </p>
        ) : (
          <>
            <h1 className="text-3xl font-bold tracking-tight">Edit {meta.label}</h1>
            <div className="mt-8">
              <meta.Form record={record} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
