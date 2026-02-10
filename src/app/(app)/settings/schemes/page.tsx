"use client";

import React from "react";
import { Button, Card, CardHeader, Input, Label, Select, Badge } from "@/components/ui";

type ReportType = "O_MID" | "O_EOT" | "A_MID" | "A_EOT";

type SchemeComponent = {
  assessmentId: string;
  weightOutOf: number;
};

type AssessmentDef = {
  id: string;
  name: string; // label
  code: string; // CA1, CA2, ...
  isActive: boolean;
};

const REPORTS: { type: ReportType; label: string }[] = [
  { type: "O_MID", label: "O-Level Midterm" },
  { type: "O_EOT", label: "O-Level Endterm" },
  { type: "A_MID", label: "A-Level Midterm" },
  { type: "A_EOT", label: "A-Level Endterm" },
];

async function apiGet<T>(url: string): Promise<T> {
  const r = await fetch(url);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as any)?.error || "Failed");
  return data as T;
}

async function apiSend<T>(url: string, method: string, body?: any): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as any)?.error || "Failed");
  return data as T;
}

export default function SchemesPage() {
  const [assessments, setAssessments] = React.useState<AssessmentDef[]>([]);
  const [activeType, setActiveType] = React.useState<ReportType>("O_MID");

  const [name, setName] = React.useState("");
  const [components, setComponents] = React.useState<SchemeComponent[]>([]);

  const [saving, setSaving] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [justSaved, setJustSaved] = React.useState(false);

  async function refreshAssessments() {
    const all = await apiGet<AssessmentDef[]>("/api/assessments?activeOnly=1");
    setAssessments((all || []).filter((a) => a.isActive).sort((a, b) => (a.code > b.code ? 1 : -1)));
  }

  async function loadScheme(type: ReportType) {
    setLoading(true);
    try {
      const s = await apiGet<any>(`/api/schemes?reportType=${encodeURIComponent(type)}`);

      if (!s) {
        setName("");
        setComponents([]);
        return;
      }

      setName(s.name || "");
      setComponents((s.components || []) as SchemeComponent[]);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    (async () => {
      await refreshAssessments();
      await loadScheme(activeType);
    })().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onChangeType(next: ReportType) {
    setActiveType(next);
    setJustSaved(false);
    await loadScheme(next);
  }

  function addRow() {
    const first = assessments[0]?.id ?? "";
    setComponents((prev) => [...prev, { assessmentId: first, weightOutOf: 0 }]);
  }

  function updateRow(i: number, patch: Partial<SchemeComponent>) {
    setComponents((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  function removeRow(i: number) {
    setComponents((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function save() {
    if (!name.trim()) return;

    setSaving(true);
    setJustSaved(false);
    try {
      await apiSend("/api/schemes", "POST", {
        reportType: activeType,
        name: name.trim(),
        components: components.map((c) => ({
          assessmentId: c.assessmentId,
          weightOutOf: Math.max(0, Number(c.weightOutOf) || 0),
        })),
      });

      // ✅ IMPORTANT: reload from DB so you can SEE what was saved
      await loadScheme(activeType);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1800);
    } finally {
      setSaving(false);
    }
  }

  async function resetDefaults() {
    setSaving(true);
    setJustSaved(false);
    try {
      // 1) Make sure default assessments exist (DB)
      await apiSend("/api/assessments", "POST", { action: "resetDefaults" });

      // 2) Refresh the list from DB
      const all = await apiGet<AssessmentDef[]>("/api/assessments?activeOnly=1");
      const active = (all || []).filter((a) => a.isActive);
      setAssessments(active.sort((a, b) => (a.code > b.code ? 1 : -1)));

      // 3) Map codes -> ids
      const byCode = new Map(active.map((a) => [a.code.toUpperCase(), a.id]));
      const CA1 = byCode.get("CA1") || "";
      const CA2 = byCode.get("CA2") || "";
      const MID = byCode.get("MID") || "";
      const EOT = byCode.get("EOT") || "";

      // 4) Create starter schemes with actual components (like your old behavior)
      // NOTE: weights are editable later; these are just a reasonable starting point
      const defaults: Record<ReportType, { name: string; comps: SchemeComponent[] }> = {
        O_MID: {
          name: "O-Level Midterm",
          comps: [CA1, CA2].filter(Boolean).map((id) => ({ assessmentId: id, weightOutOf: 50 })),
        },
        O_EOT: {
          name: "O-Level Endterm",
          comps: [CA1, CA2, EOT]
            .filter(Boolean)
            .map((id) => ({ assessmentId: id, weightOutOf: id === EOT ? 80 : 10 })),
        },
        A_MID: {
          name: "A-Level Midterm",
          comps: [MID].filter(Boolean).map((id) => ({ assessmentId: id, weightOutOf: 100 })),
        },
        A_EOT: {
          name: "A-Level Endterm",
          comps: [EOT].filter(Boolean).map((id) => ({ assessmentId: id, weightOutOf: 100 })),
        },
      };

      for (const rt of Object.keys(defaults) as ReportType[]) {
        await apiSend("/api/schemes", "POST", {
          reportType: rt,
          name: defaults[rt].name,
          components: defaults[rt].comps,
        });
      }

      // 5) Reload the currently selected scheme so you SEE the restored data
      await loadScheme(activeType);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1800);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Report Schemes</h1>
        <p className="mt-1 text-sm text-slate-600">
          Attach your assessments (CA1, CA2, EOT_1...) to each report type.
        </p>
      </div>

      <Card>
        <CardHeader
          title="Recommended Defaults"
          subtitle="Creates O_MID, O_EOT, A_MID, A_EOT with CA1/CA2/MID/EOT"
          right={
            <Button variant="secondary" onClick={resetDefaults} disabled={saving}>
              {saving ? "Working..." : "Reset to Defaults"}
            </Button>
          }
        />
        <div className="p-5 pt-0 text-sm text-slate-600">
          If schemes are empty, click “Reset to Defaults” once.
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Edit Scheme"
          subtitle="Pick a report type then attach assessments"
          right={
            <Select value={activeType} onChange={(e) => onChangeType(e.target.value as ReportType)} disabled={loading}>
              {REPORTS.map((r) => (
                <option key={r.type} value={r.type}>
                  {r.label}
                </option>
              ))}
            </Select>
          }
        />

        <div className="p-5 pt-0 space-y-3">
          <div className="space-y-2">
            <Label>Scheme Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={loading} />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-extrabold text-slate-900">Components</div>
              <Button variant="secondary" onClick={addRow} disabled={loading || assessments.length === 0}>
                + Add component
              </Button>
            </div>

            {components.length === 0 ? (
              <div className="text-sm text-slate-600">
                {loading ? "Loading..." : "No components yet. Add one or click “Reset to Defaults”."}
              </div>
            ) : (
              <div className="space-y-2">
                {components.map((c, i) => (
                  <div key={i} className="grid grid-cols-1 gap-2 rounded-2xl border border-slate-200 p-3 sm:grid-cols-12">
                    <div className="sm:col-span-7">
                      <Label>Assessment</Label>
                      <Select
                        value={c.assessmentId}
                        onChange={(e) => updateRow(i, { assessmentId: e.target.value })}
                        disabled={loading}
                      >
                        {assessments.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} — {a.name}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="sm:col-span-3">
                      <Label>Weight Out Of</Label>
                      <Input
                        type="number"
                        min={0}
                        value={c.weightOutOf}
                        onChange={(e) => updateRow(i, { weightOutOf: Number(e.target.value) || 0 })}
                        disabled={loading}
                      />
                    </div>

                    <div className="sm:col-span-2 flex items-end">
                      <Button variant="danger" className="w-full" onClick={() => removeRow(i)} disabled={loading}>
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 text-xs text-slate-500">
              Tip: You can attach any 2–3 assessments depending on your school policy.
            </div>
          </div>

          <div className="flex justify-end gap-2 items-center">
            <Badge>Report: {activeType}</Badge>
            {justSaved ? <Badge>Saved</Badge> : null}
            <Button onClick={save} disabled={saving || loading}>
              {saving ? "Saving..." : "Save Scheme"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
