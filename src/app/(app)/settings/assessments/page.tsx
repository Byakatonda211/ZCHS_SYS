"use client";

import React from "react";
import { Button, Card, CardHeader, Input, Label, Badge, Select } from "@/components/ui";

type AssessmentDef = {
  id: string;
  name: string;
  code: string;
  level: "O_LEVEL" | "A_LEVEL";
  type?: string;
  isActive: boolean;
};

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

export default function AssessmentsPage() {
  const [items, setItems] = React.useState<AssessmentDef[]>([]);
  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [level, setLevel] = React.useState<"O_LEVEL" | "A_LEVEL">("O_LEVEL");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function refresh() {
    const all = await apiGet<AssessmentDef[]>("/api/assessments?activeOnly=0");
    setItems(
      (all || []).sort((a, b) => {
        if (a.level !== b.level) return a.level.localeCompare(b.level);
        return a.code.localeCompare(b.code);
      })
    );
  }

  React.useEffect(() => {
    refresh().catch(() => {});
  }, []);

  function resetForm() {
    setName("");
    setCode("");
    setLevel("O_LEVEL");
    setEditingId(null);
  }

  async function submit() {
    const n = name.trim();
    const c = code.trim().toUpperCase();
    if (!n || !c) return;

    setSaving(true);
    try {
      if (editingId) {
        await apiSend("/api/assessments", "PUT", { id: editingId, name: n, code: c, level });
      } else {
        await apiSend("/api/assessments", "POST", { name: n, code: c, level });
      }

      resetForm();
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Assessments</h1>
        <p className="mt-1 text-sm text-slate-600">
          Define the assessments teachers will enter marks for and set whether they belong to O-Level or A-Level.
        </p>
      </div>

      <Card>
        <CardHeader
          title="Recommended Defaults"
          subtitle="Creates O-Level and A-Level assessment types"
          right={
            <Button
              variant="secondary"
              onClick={async () => {
                setSaving(true);
                try {
                  await apiSend("/api/assessments", "POST", { action: "resetDefaults" });
                  await refresh();
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving}
            >
              {saving ? "Working..." : "Reset to Defaults"}
            </Button>
          }
        />
        <div className="p-5 pt-0 text-sm text-slate-600">
          Use this once on a fresh install. It safely restores the recommended assessment definitions.
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={editingId ? "Edit Assessment" : "Add Assessment"} subtitle="Name, code and level" />
          <div className="p-5 pt-0 space-y-3">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Code *</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Level *</Label>
              <Select value={level} onChange={(e: any) => setLevel(e.target.value as "O_LEVEL" | "A_LEVEL")}>
                <option value="O_LEVEL">O-Level</option>
                <option value="A_LEVEL">A-Level</option>
              </Select>
            </div>

            <div className="flex justify-end gap-2">
              {editingId ? (
                <Button variant="secondary" onClick={resetForm}>
                  Cancel
                </Button>
              ) : null}
              <Button onClick={submit} disabled={saving}>
                {saving ? "Saving..." : editingId ? "Save" : "Add"}
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Assessments List" subtitle="Enable, disable, edit or delete" />
          <div className="p-5 pt-0 space-y-2">
            {items.map((a) => (
              <div
                key={a.id}
                className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-extrabold text-slate-900">{a.name}</div>
                  <Badge>{a.code}</Badge>
                  <Badge>{a.level === "A_LEVEL" ? "A-Level" : "O-Level"}</Badge>
                  {a.isActive ? <Badge>Active</Badge> : <Badge>Inactive</Badge>}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEditingId(a.id);
                      setName(a.name);
                      setCode(a.code);
                      setLevel(a.level || "O_LEVEL");
                    }}
                  >
                    Edit
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={async () => {
                      await apiSend("/api/assessments", "PATCH", { id: a.id, isActive: !a.isActive });
                      await refresh();
                    }}
                  >
                    {a.isActive ? "Disable" : "Enable"}
                  </Button>

                  <Button
                    variant="danger"
                    onClick={async () => {
                      await apiSend(`/api/assessments?id=${encodeURIComponent(a.id)}`, "DELETE");
                      await refresh();
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}