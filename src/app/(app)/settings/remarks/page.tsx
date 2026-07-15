"use client";

import React from "react";
import {
  getRemarkRules,
  seedRemarkRulesIfEmpty,
  type RemarkTarget,
  type RemarkMatchType,
  type ReportType,
} from "@/lib/store";
import { Card, CardHeader, Button, Input, Label, Select, Badge } from "@/components/ui";

const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: "O_MID", label: "O-Level Midterm" },
  { value: "O_EOT", label: "O-Level Endterm" },
  { value: "A_MID", label: "A-Level Midterm" },
  { value: "A_EOT", label: "A-Level Endterm" },
];

type DbRemarkRule = {
  id: string;
  target: RemarkTarget;
  reportType: ReportType;
  matchType: RemarkMatchType;
  grade?: string;
  min?: number;
  max?: number;
  text: string;
  isActive: boolean;
  createdAt?: string;
};

async function readError(res: Response) {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const json = await res.json().catch(() => null);
    return json?.error || "Request failed";
  }
  const text = await res.text().catch(() => "");
  return text || "Request failed";
}

async function postRemarkAction(payload: Record<string, unknown>) {
  const res = await fetch("/api/settings/remarks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    cache: "no-store",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await readError(res));
  }

  return await res.json().catch(() => null);
}

export default function RemarksSettingsPage() {
  const [rules, setRules] = React.useState<DbRemarkRule[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [initialized, setInitialized] = React.useState(false);

  const [reportType, setReportType] = React.useState<ReportType>("O_EOT");
  const [target, setTarget] = React.useState<RemarkTarget>("teacher");
  const [matchType, setMatchType] = React.useState<RemarkMatchType>("grade");

  const [grade, setGrade] = React.useState("A");
  const [min, setMin] = React.useState("0");
  const [max, setMax] = React.useState("100");
  const [text, setText] = React.useState("");

  const loadRules = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ reportType, target });
      const res = await fetch(`/api/settings/remarks?${qs.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await readError(res));
      }

      const json = await res.json();
      setRules(Array.isArray(json) ? json : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load remarks");
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, [reportType, target]);

  React.useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);
      setError("");

      try {
        // Keep old browser/localStorage remarks from the earlier implementation.
        // They are migrated once into the database because server-side PDF generation
        // cannot read browser localStorage.
        seedRemarkRulesIfEmpty();

        const allRes = await fetch("/api/settings/remarks?all=1", {
          cache: "no-store",
          credentials: "include",
        });

        if (!allRes.ok) {
          throw new Error(await readError(allRes));
        }

        const allJson = await allRes.json();
        const dbCount = Number(allJson?.total ?? 0);

        if (dbCount === 0) {
          const legacyRules = getRemarkRules();
          if (legacyRules.length) {
            await postRemarkAction({
              action: "importLegacy",
              replace: true,
              rules: legacyRules,
            });
          }
        }

        if (!cancelled) setInitialized(true);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Failed to initialize remarks");
          setInitialized(true);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!initialized) return;
    loadRules();
  }, [initialized, loadRules]);

  async function addRule() {
    if (!text.trim()) return;

    setSaving(true);
    setError("");

    try {
      if (matchType === "grade") {
        await postRemarkAction({
          action: "add",
          reportType,
          target,
          matchType,
          grade: grade.trim().toUpperCase(),
          text,
        });
      } else {
        const mn = Number(min);
        const mx = Number(max);
        if (!Number.isFinite(mn) || !Number.isFinite(mx)) {
          throw new Error("Enter valid minimum and maximum scores.");
        }
        await postRemarkAction({
          action: "add",
          reportType,
          target,
          matchType,
          min: mn,
          max: mx,
          text,
        });
      }

      setText("");
      await loadRules();
    } catch (e: any) {
      setError(e?.message || "Failed to save remark");
    } finally {
      setSaving(false);
    }
  }

  async function editRule(rule: DbRemarkRule) {
    const next = prompt("Edit text:", rule.text);
    if (next === null) return;

    setSaving(true);
    setError("");

    try {
      await postRemarkAction({
        action: "update",
        id: rule.id,
        reportType,
        target,
        matchType: rule.matchType,
        grade: rule.grade,
        min: rule.min,
        max: rule.max,
        text: next,
        isActive: rule.isActive,
      });
      await loadRules();
    } catch (e: any) {
      setError(e?.message || "Failed to update remark");
    } finally {
      setSaving(false);
    }
  }

  async function toggleRule(rule: DbRemarkRule) {
    setSaving(true);
    setError("");

    try {
      await postRemarkAction({
        action: "toggle",
        id: rule.id,
        isActive: !rule.isActive,
      });
      await loadRules();
    } catch (e: any) {
      setError(e?.message || "Failed to update remark");
    } finally {
      setSaving(false);
    }
  }

  async function removeRule(rule: DbRemarkRule) {
    if (!confirm("Delete this rule?")) return;

    setSaving(true);
    setError("");

    try {
      await postRemarkAction({ action: "delete", id: rule.id });
      await loadRules();
    } catch (e: any) {
      setError(e?.message || "Failed to delete remark");
    } finally {
      setSaving(false);
    }
  }

  async function resetDefaults() {
    if (!confirm("Reset all server remarks to defaults? This overwrites current rules used by final PDF reports.")) return;

    setSaving(true);
    setError("");

    try {
      await postRemarkAction({ action: "resetDefaults" });
      await loadRules();
    } catch (e: any) {
      setError(e?.message || "Failed to reset remarks");
    } finally {
      setSaving(false);
    }
  }

  async function importBrowserRemarks() {
    if (!confirm("Copy the remarks currently stored in this browser into the database used by final PDF reports?")) return;

    setSaving(true);
    setError("");

    try {
      seedRemarkRulesIfEmpty();
      await postRemarkAction({
        action: "importLegacy",
        replace: true,
        rules: getRemarkRules(),
      });
      await loadRules();
    } catch (e: any) {
      setError(e?.message || "Failed to copy browser remarks");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Remarks & Comments"
          subtitle="Server-saved remarks used by web report previews and final PDF reports"
          right={<Badge>{loading ? "..." : rules.length}</Badge>}
        />

        <div className="p-5 pt-0 space-y-3">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-900">
            Final PDF reports are generated on the server, so remarks must be saved in the database. Browser-only remarks from the older page can be copied using the button below.
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          ) : null}
        </div>

        <div className="p-5 pt-0 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Report Type</Label>
            <Select value={reportType} onChange={(e) => setReportType(e.target.value as ReportType)}>
              {REPORT_TYPES.map((rt) => (
                <option key={rt.value} value={rt.value}>{rt.label}</option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Target</Label>
            <Select value={target} onChange={(e) => setTarget(e.target.value as RemarkTarget)}>
              <option value="teacher">Teacher Remark</option>
              <option value="headTeacher">Head Teacher Comment</option>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Match Type</Label>
            <Select value={matchType} onChange={(e) => setMatchType(e.target.value as RemarkMatchType)}>
              <option value="grade">By Grade</option>
              <option value="range">By Marks Range</option>
            </Select>
          </div>
        </div>

        <div className="p-5 pt-0 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {matchType === "grade" ? (
            <div className="space-y-2">
              <Label>Grade</Label>
              <Input value={grade} onChange={(e) => setGrade(e.target.value.toUpperCase())} placeholder="A, B, C..." />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Min</Label>
                <Input value={min} onChange={(e) => setMin(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Max</Label>
                <Input value={max} onChange={(e) => setMax(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>&nbsp;</Label>
                <div className="text-xs text-slate-500">Inclusive range, e.g. 0–24, 25–49.</div>
              </div>
            </>
          )}

          <div className="sm:col-span-3 space-y-2">
            <Label>Remark Text</Label>
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type remark..." />
          </div>

          <div className="sm:col-span-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={importBrowserRemarks} disabled={saving || loading}>
              Copy Browser Remarks to PDF System
            </Button>
            <Button variant="secondary" onClick={resetDefaults} disabled={saving || loading}>
              Reset Server Defaults
            </Button>
            <Button onClick={addRule} disabled={saving || loading || !text.trim()}>
              {saving ? "Saving..." : "Add Rule"}
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Rules" subtitle="These are the rules the final PDF route can read" />
        <div className="p-5 pt-0 space-y-2">
          {loading ? (
            <div className="text-sm text-slate-600">Loading rules...</div>
          ) : rules.length === 0 ? (
            <div className="text-sm text-slate-600">No rules yet for this selection.</div>
          ) : (
            rules.map((r) => (
              <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {r.matchType === "grade" ? `Grade ${r.grade}` : `Range ${r.min}–${r.max}`}
                    <span className="ml-2 text-xs text-slate-500">({r.isActive ? "active" : "inactive"})</span>
                  </div>
                  <div className="text-xs text-slate-600">{r.text}</div>
                </div>

                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => editRule(r)} disabled={saving}>Edit</Button>
                  <Button variant="secondary" onClick={() => toggleRule(r)} disabled={saving}>
                    {r.isActive ? "Disable" : "Enable"}
                  </Button>
                  <Button variant="secondary" onClick={() => removeRule(r)} disabled={saving}>Delete</Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
