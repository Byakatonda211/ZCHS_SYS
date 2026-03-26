"use client";

import React from "react";
import { Button, Card, CardHeader, Select, Input, Label, Badge } from "@/components/ui";

type ReportType = "O_MID" | "O_EOT" | "A_MID" | "A_EOT";

type AssessmentDef = {
  id: string;
  name: string;
  code: string;
  level: "O_LEVEL" | "A_LEVEL";
  isActive: boolean;
};

type SchemeComponent = {
  assessmentId: string;
  enterOutOf: number;
  weightOutOf: number;
  order?: number;
};

type GradeDescriptor = {
  id?: string;
  grade: string;
  achievementLevel: string;
  minMark: number;
  maxMark: number;
  descriptor: string;
  order?: number;
};

const REPORTS: { type: ReportType; label: string; level: "O_LEVEL" | "A_LEVEL" }[] = [
  { type: "O_MID", label: "O-Level Midterm", level: "O_LEVEL" },
  { type: "O_EOT", label: "O-Level Endterm", level: "O_LEVEL" },
  { type: "A_MID", label: "A-Level Midterm", level: "A_LEVEL" },
  { type: "A_EOT", label: "A-Level Endterm", level: "A_LEVEL" },
];

function defaultDescriptors(reportType: ReportType): GradeDescriptor[] {
  if (String(reportType).startsWith("A_")) {
    return [
      { grade: "A", achievementLevel: "Excellent", minMark: 80, maxMark: 100, descriptor: "Excellent performance with a very strong demonstration of knowledge and skill.", order: 1 },
      { grade: "B", achievementLevel: "Very Good", minMark: 75, maxMark: 79, descriptor: "Very good performance with clear understanding and sound application.", order: 2 },
      { grade: "C", achievementLevel: "Good", minMark: 70, maxMark: 74, descriptor: "Good performance showing adequate understanding and application.", order: 3 },
      { grade: "D", achievementLevel: "Credit", minMark: 65, maxMark: 69, descriptor: "Creditable performance with acceptable competence.", order: 4 },
      { grade: "E", achievementLevel: "Fair", minMark: 60, maxMark: 64, descriptor: "Fair performance with moderate competence.", order: 5 },
      { grade: "O", achievementLevel: "Pass", minMark: 50, maxMark: 59, descriptor: "Pass level performance with minimum acceptable competence.", order: 6 },
      { grade: "F", achievementLevel: "Fail", minMark: 0, maxMark: 49, descriptor: "Below the expected minimum standard.", order: 7 },
    ];
  }

  return [
    {
      grade: "A",
      achievementLevel: "Exceptional",
      minMark: 85,
      maxMark: 100,
      descriptor:
        "Demonstrates an extraordinary level of competency by applying innovatively and creatively the acquired knowledge and skills in real-life situations.",
      order: 1,
    },
    {
      grade: "B",
      achievementLevel: "Outstanding",
      minMark: 70,
      maxMark: 84,
      descriptor:
        "Demonstrates a high level of competency by applying the acquired knowledge and skills in real-life situations.",
      order: 2,
    },
    {
      grade: "C",
      achievementLevel: "Satisfactory",
      minMark: 50,
      maxMark: 69,
      descriptor:
        "Demonstrates an adequate level of competency by applying the acquired knowledge and skills in real-life situations.",
      order: 3,
    },
    {
      grade: "D",
      achievementLevel: "Basic",
      minMark: 25,
      maxMark: 49,
      descriptor:
        "Demonstrates a minimum level of competency in applying the acquired knowledge and skills in real-life situations.",
      order: 4,
    },
    {
      grade: "E",
      achievementLevel: "Elementary",
      minMark: 0,
      maxMark: 24,
      descriptor:
        "Demonstrates below the basic level of competency in applying the acquired knowledge and skills in real-life situations.",
      order: 5,
    },
  ];
}

function toNumberLike(value: string, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function apiGet<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
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
  const [gradeDescriptors, setGradeDescriptors] = React.useState<GradeDescriptor[]>(
    defaultDescriptors("O_MID")
  );

  const [saving, setSaving] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [pageError, setPageError] = React.useState("");
  const [justSaved, setJustSaved] = React.useState(false);

  const activeLevel = React.useMemo(
    () => REPORTS.find((r) => r.type === activeType)?.level || "O_LEVEL",
    [activeType]
  );

  const visibleAssessments = React.useMemo(
    () =>
      (assessments || [])
        .filter((a) => a.isActive && a.level === activeLevel)
        .sort((a, b) => a.code.localeCompare(b.code)),
    [assessments, activeLevel]
  );

  async function refreshAssessments() {
    const all = await apiGet<AssessmentDef[]>("/api/assessments?activeOnly=1");
    setAssessments(all || []);
  }

  async function loadScheme(type: ReportType) {
    setLoading(true);
    setPageError("");
    try {
      const s = await apiGet<any>(`/api/schemes?reportType=${encodeURIComponent(type)}`);

      if (!s) {
        setName("");
        setComponents([]);
        setGradeDescriptors(defaultDescriptors(type));
        return;
      }

      setName(s.name || "");
      setComponents(
        (s.components || []).map((c: any) => ({
          assessmentId: c.assessmentId,
          enterOutOf: Number(c.enterOutOf ?? 100),
          weightOutOf: Number(c.weightOutOf ?? 0),
          order: c.order,
        }))
      );
      setGradeDescriptors(
        Array.isArray(s.gradeDescriptors) && s.gradeDescriptors.length > 0
          ? s.gradeDescriptors
          : defaultDescriptors(type)
      );
    } catch (e: any) {
      setPageError(e?.message || "Failed to load scheme");
      setName("");
      setComponents([]);
      setGradeDescriptors(defaultDescriptors(type));
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    (async () => {
      try {
        await refreshAssessments();
        await loadScheme(activeType);
      } catch (e: any) {
        setPageError(e?.message || "Failed to load page");
      }
    })();
  }, []);

  async function onChangeType(next: ReportType) {
    setActiveType(next);
    setJustSaved(false);
    await loadScheme(next);
  }

  function addRow() {
    const first = visibleAssessments[0]?.id ?? "";
    setComponents((prev) => [
      ...prev,
      { assessmentId: first, enterOutOf: 100, weightOutOf: 0 },
    ]);
  }

  function updateRow(i: number, patch: Partial<SchemeComponent>) {
    setComponents((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  function removeRow(i: number) {
    setComponents((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addDescriptorRow() {
    setGradeDescriptors((prev) => [
      ...prev,
      {
        grade: "",
        achievementLevel: "",
        minMark: 0,
        maxMark: 0,
        descriptor: "",
        order: prev.length + 1,
      },
    ]);
  }

  function updateDescriptorRow(i: number, patch: Partial<GradeDescriptor>) {
    setGradeDescriptors((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  function removeDescriptorRow(i: number) {
    setGradeDescriptors((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function save() {
    if (!name.trim()) return;

    setSaving(true);
    setPageError("");
    setJustSaved(false);
    try {
      await apiSend("/api/schemes", "POST", {
        reportType: activeType,
        name: name.trim(),
        components: components.map((c) => ({
          assessmentId: c.assessmentId,
          enterOutOf: Math.max(0.01, Number(c.enterOutOf) || 100),
          weightOutOf: Math.max(0, Number(c.weightOutOf) || 0),
        })),
        gradeDescriptors: gradeDescriptors.map((d, idx) => ({
          grade: String(d.grade || "").trim().toUpperCase(),
          achievementLevel: String(d.achievementLevel || "").trim(),
          minMark: Math.max(0, Number(d.minMark) || 0),
          maxMark: Math.max(0, Number(d.maxMark) || 0),
          descriptor: String(d.descriptor || "").trim(),
          order: idx + 1,
        })),
      });

      await loadScheme(activeType);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1800);
    } catch (e: any) {
      setPageError(e?.message || "Failed to save scheme");
    } finally {
      setSaving(false);
    }
  }

  async function resetDefaults() {
    setSaving(true);
    setPageError("");
    setJustSaved(false);
    try {
      await apiSend("/api/assessments", "POST", { action: "resetDefaults" });
      const all = await apiGet<AssessmentDef[]>("/api/assessments?activeOnly=1");
      setAssessments(all || []);

      const active = (all || []).filter((a) => a.isActive);
      const oByCode = new Map(
        active.filter((a) => a.level === "O_LEVEL").map((a) => [a.code.toUpperCase(), a.id])
      );
      const aByCode = new Map(
        active.filter((a) => a.level === "A_LEVEL").map((a) => [a.code.toUpperCase(), a.id])
      );

      const defaults: Record<
        ReportType,
        { name: string; comps: SchemeComponent[]; descriptors: GradeDescriptor[] }
      > = {
        O_MID: {
          name: "O-Level Midterm",
          comps: [oByCode.get("CA1"), oByCode.get("CA2")]
            .filter(Boolean)
            .map((id) => ({
              assessmentId: id as string,
              enterOutOf: 100,
              weightOutOf: 50,
            })),
          descriptors: defaultDescriptors("O_MID"),
        },
        O_EOT: {
          name: "O-Level Endterm",
          comps: [
            { assessmentId: oByCode.get("CA1") || "", enterOutOf: 10, weightOutOf: 10 },
            { assessmentId: oByCode.get("CA2") || "", enterOutOf: 10, weightOutOf: 10 },
            { assessmentId: oByCode.get("EOT") || "", enterOutOf: 80, weightOutOf: 80 },
          ].filter((x) => x.assessmentId),
          descriptors: defaultDescriptors("O_EOT"),
        },
        A_MID: {
          name: "A-Level Midterm",
          comps: [{ assessmentId: aByCode.get("MID") || "", enterOutOf: 100, weightOutOf: 100 }].filter(
            (x) => x.assessmentId
          ),
          descriptors: defaultDescriptors("A_MID"),
        },
        A_EOT: {
          name: "A-Level Endterm",
          comps: [{ assessmentId: aByCode.get("EOT") || "", enterOutOf: 100, weightOutOf: 100 }].filter(
            (x) => x.assessmentId
          ),
          descriptors: defaultDescriptors("A_EOT"),
        },
      };

      for (const rt of Object.keys(defaults) as ReportType[]) {
        await apiSend("/api/schemes", "POST", {
          reportType: rt,
          name: defaults[rt].name,
          components: defaults[rt].comps,
          gradeDescriptors: defaults[rt].descriptors,
        });
      }

      await loadScheme(activeType);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1800);
    } catch (e: any) {
      setPageError(e?.message || "Failed to reset defaults");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          Report Schemes
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Attach assessments to each report type, define the entry mark and the
          weight shown on report cards, and set scheme-specific grade descriptors.
        </p>
      </div>

      {pageError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {pageError}
        </div>
      ) : null}

      <Card>
        <CardHeader
          title="Recommended Defaults"
          subtitle="Creates O_MID, O_EOT, A_MID and A_EOT with default descriptors"
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
            <div className="min-w-[220px]">
              <Select
                value={activeType}
                onChange={(e: any) => onChangeType(e.target.value as ReportType)}
                disabled={loading}
                options={REPORTS.map((r) => ({
                  value: r.type,
                  label: r.label,
                }))}
              />
            </div>
          }
        />

        <div className="p-5 pt-0 space-y-5">
          <div className="space-y-2">
            <Label>Scheme Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={loading} />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-extrabold text-slate-900">Components</div>
              <Button
                variant="secondary"
                onClick={addRow}
                disabled={loading || visibleAssessments.length === 0}
              >
                + Add component
              </Button>
            </div>

            {components.length === 0 ? (
              <div className="text-sm text-slate-600">
                {loading ? "Loading..." : "No components yet. Add one or click “Reset to Defaults”."}
              </div>
            ) : (
              <div className="space-y-3">
                {components.map((c, i) => (
                  <div key={i} className="rounded-2xl border border-slate-200 p-3">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                      <div className="md:col-span-5 space-y-2">
                        <Label>Assessment</Label>
                        <Select
                          value={c.assessmentId}
                          onChange={(e: any) => updateRow(i, { assessmentId: e.target.value })}
                          disabled={loading}
                          options={visibleAssessments.map((a) => ({
                            value: a.id,
                            label: `${a.code} — ${a.name}`,
                          }))}
                        />
                      </div>

                      <div className="md:col-span-3 space-y-2">
                        <Label>Enter Out Of</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={c.enterOutOf}
                          onChange={(e) =>
                            updateRow(i, { enterOutOf: toNumberLike(e.target.value, c.enterOutOf) })
                          }
                          disabled={loading}
                        />
                      </div>

                      <div className="md:col-span-3 space-y-2">
                        <Label>Weight Out Of</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={c.weightOutOf}
                          onChange={(e) =>
                            updateRow(i, { weightOutOf: toNumberLike(e.target.value, c.weightOutOf) })
                          }
                          disabled={loading}
                        />
                      </div>

                      <div className="md:col-span-1 flex items-end">
                        <Button
                          variant="danger"
                          className="w-full"
                          onClick={() => removeRow(i)}
                          disabled={loading}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="text-xs text-slate-500">
              “Enter Out Of” is what teachers enter. “Weight Out Of” is what appears on the report card.
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-extrabold text-slate-900">Grade Descriptors</div>
              <Button variant="secondary" onClick={addDescriptorRow} disabled={loading}>
                + Add grade row
              </Button>
            </div>

            <div className="space-y-3">
              {gradeDescriptors.map((d, i) => (
                <div key={i} className="rounded-2xl border border-slate-200 p-3">
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
                    <div className="lg:col-span-2 space-y-2">
                      <Label>Grade</Label>
                      <Input
                        value={d.grade}
                        onChange={(e) => updateDescriptorRow(i, { grade: e.target.value })}
                      />
                    </div>

                    <div className="lg:col-span-3 space-y-2">
                      <Label>Achievement</Label>
                      <Input
                        value={d.achievementLevel}
                        onChange={(e) =>
                          updateDescriptorRow(i, { achievementLevel: e.target.value })
                        }
                      />
                    </div>

                    <div className="lg:col-span-1 space-y-2">
                      <Label>Min</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={d.minMark}
                        onChange={(e) =>
                          updateDescriptorRow(i, { minMark: toNumberLike(e.target.value, d.minMark) })
                        }
                      />
                    </div>

                    <div className="lg:col-span-1 space-y-2">
                      <Label>Max</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={d.maxMark}
                        onChange={(e) =>
                          updateDescriptorRow(i, { maxMark: toNumberLike(e.target.value, d.maxMark) })
                        }
                      />
                    </div>

                    <div className="lg:col-span-4 space-y-2">
                      <Label>Description</Label>
                      <Input
                        value={d.descriptor}
                        onChange={(e) => updateDescriptorRow(i, { descriptor: e.target.value })}
                      />
                    </div>

                    <div className="lg:col-span-1 flex items-end">
                      <Button
                        variant="danger"
                        className="w-full"
                        onClick={() => removeDescriptorRow(i)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
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