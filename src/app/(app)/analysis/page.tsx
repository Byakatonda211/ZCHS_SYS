"use client";

import React from "react";
import {
  getAcademicYears,
  getTerms,
  getClasses,
  getCurrentAcademicYear,
  getCurrentTerm,
  type ReportType,
} from "@/lib/store";
import { Card, CardHeader, Select, Badge, Button } from "@/components/ui";

type SubjectOption = {
  id: string;
  name: string;
  code?: string | null;
};

type SimpleOption = {
  id: string;
  name: string;
  level?: string | null;
  order?: number | null;
  academicYearId?: string | null;
  isCurrent?: boolean | null;
};

type AnalyticsResponse = {
  summary: Record<string, number>;
  rows: {
    studentId: string;
    enrollmentId: string;
    studentNo: string;
    studentName: string;
    totalScore: number;
    grade: string;
  }[];
  gradeOrder: string[];
  meta: {
    className: string;
    subjectName: string;
    reportType: string;
    totalStudents: number;
    totalOutOf?: number | null;
  };
};

const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: "O_MID", label: "O-Level Midterm" },
  { value: "O_EOT", label: "O-Level Endterm" },
  { value: "A_MID", label: "A-Level Midterm" },
  { value: "A_EOT", label: "A-Level Endterm" },
];

function gradeCardClass(grade: string) {
  switch (grade) {
    case "A":
      return "border-2 border-green-500 bg-white text-slate-900";
    case "B":
      return "border-2 border-emerald-500 bg-white text-slate-900";
    case "C":
      return "border-2 border-blue-500 bg-white text-slate-900";
    case "D":
      return "border-2 border-amber-500 bg-white text-slate-900";
    case "E":
      return "border-2 border-orange-500 bg-white text-slate-900";
    case "O":
      return "border-2 border-slate-500 bg-white text-slate-900";
    default:
      return "border-2 border-red-500 bg-white text-slate-900";
  }
}

function gradeTextClass(grade: string) {
  switch (grade) {
    case "A":
      return "text-green-700";
    case "B":
      return "text-emerald-700";
    case "C":
      return "text-blue-700";
    case "D":
      return "text-amber-700";
    case "E":
      return "text-orange-700";
    case "O":
      return "text-slate-700";
    default:
      return "text-red-700";
  }
}

async function readError(res: Response) {
  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const json = await res.json().catch(() => null);
    return json?.error || "Request failed";
  }

  const text = await res.text().catch(() => "");
  return text || "Request failed";
}

function classNumber(name: string) {
  const clean = String(name || "").trim();
  const match = clean.match(/S\s*\.?\s*([1-6])/i) || clean.match(/Senior\s*([1-6])/i);
  return match ? Number(match[1]) : 999;
}

function isSecondaryClass(cls: SimpleOption) {
  const level = String(cls.level || "").toUpperCase();
  if (level === "O_LEVEL" || level === "A_LEVEL") return true;
  const name = String(cls.name || "").trim();
  return /^S\s*\.?\s*[1-6](?:\s|$)/i.test(name) || /^Senior\s*[1-6](?:\s|$)/i.test(name);
}

function sortSecondaryClasses(list: SimpleOption[]) {
  return [...list]
    .filter(isSecondaryClass)
    .sort((a, b) => {
      const byNumber = classNumber(a.name) - classNumber(b.name);
      if (byNumber !== 0) return byNumber;
      const byOrder = Number(a.order ?? 999) - Number(b.order ?? 999);
      if (byOrder !== 0) return byOrder;
      return String(a.name || "").localeCompare(String(b.name || ""), undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
}

async function fetchClassesFallback(localClasses: SimpleOption[]) {
  try {
    const res = await fetch("/api/classes", { cache: "no-store" });
    if (!res.ok) return localClasses;
    const json = await res.json().catch(() => []);
    return Array.isArray(json) ? json : localClasses;
  } catch {
    return localClasses;
  }
}

export default function AnalysisPage() {
  const [mounted, setMounted] = React.useState(false);

  const [years, setYears] = React.useState<SimpleOption[]>([]);
  const [terms, setTerms] = React.useState<SimpleOption[]>([]);
  const [classes, setClasses] = React.useState<SimpleOption[]>([]);

  const [yearId, setYearId] = React.useState("");
  const [termId, setTermId] = React.useState("");
  const [classId, setClassId] = React.useState("");
  const [reportType, setReportType] = React.useState<ReportType>("O_EOT");

  const [subjectId, setSubjectId] = React.useState("");
  const [subjects, setSubjects] = React.useState<SubjectOption[]>([]);
  const [loadingSubjects, setLoadingSubjects] = React.useState(false);

  const [data, setData] = React.useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;

    async function boot() {
      const allYears = getAcademicYears() ?? [];
      const allTerms = getTerms() ?? [];
      const localClasses = getClasses() ?? [];
      const apiOrLocalClasses = await fetchClassesFallback(localClasses);
      const secondaryClasses = sortSecondaryClasses(apiOrLocalClasses);

      const currentYear = getCurrentAcademicYear();
      const currentTerm = getCurrentTerm();

      if (cancelled) return;

      setYears(allYears);
      setTerms(allTerms);
      setClasses(secondaryClasses);

      setYearId(currentYear?.id ?? allYears[0]?.id ?? "");
      setTermId(currentTerm?.id ?? allTerms[0]?.id ?? "");
      setClassId(secondaryClasses[0]?.id ?? "");
      setMounted(true);
    }

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedClass = React.useMemo(
    () => classes.find((c) => c.id === classId) ?? null,
    [classes, classId]
  );

  const selectedYear = React.useMemo(
    () => years.find((y) => y.id === yearId) ?? null,
    [years, yearId]
  );

  const filteredTerms = React.useMemo(() => {
    const list = terms || [];

    if (!yearId) return list;

    const termsWithYear = list.filter((t) => t.academicYearId);
    if (termsWithYear.length === 0) return list;

    return list.filter((t) => t.academicYearId === yearId);
  }, [terms, yearId]);

  const selectedTerm = React.useMemo(
    () => filteredTerms.find((t) => t.id === termId) ?? null,
    [filteredTerms, termId]
  );

  React.useEffect(() => {
    if (!mounted) return;

    setTermId((prev) => {
      if (prev && filteredTerms.some((t) => t.id === prev)) return prev;
      return filteredTerms.find((t) => t.isCurrent)?.id ?? filteredTerms[0]?.id ?? "";
    });
  }, [mounted, filteredTerms]);

  React.useEffect(() => {
    let ignore = false;

    async function loadSubjects() {
      if (!mounted) return;

      if (!classId) {
        setSubjects([]);
        setSubjectId("");
        return;
      }

      setLoadingSubjects(true);
      setError("");

      try {
        const qs = new URLSearchParams({ classId });
        if (selectedClass?.name) qs.set("className", selectedClass.name);

        const res = await fetch(`/api/subjects?${qs.toString()}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          const msg = await readError(res);
          if (!ignore) {
            setSubjects([]);
            setSubjectId("");
            setError(msg);
          }
          return;
        }

        const json = await res.json();
        if (ignore) return;

        const list = Array.isArray(json) ? json : [];
        setSubjects(list);

        setSubjectId((prev) => {
          if (prev && list.some((s: SubjectOption) => s.id === prev)) return prev;
          return list[0]?.id ?? "";
        });
      } catch {
        if (!ignore) {
          setSubjects([]);
          setSubjectId("");
          setError("Failed to load subjects");
        }
      } finally {
        if (!ignore) setLoadingSubjects(false);
      }
    }

    loadSubjects();

    return () => {
      ignore = true;
    };
  }, [mounted, classId, selectedClass?.name]);

  async function loadAnalytics() {
    if (!yearId || !termId || !classId || !subjectId || !reportType) {
      setData(null);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const qs = new URLSearchParams({
        academicYearId: yearId,
        termId,
        classId,
        subjectId,
        reportType,
      });

      if (selectedClass?.name) qs.set("className", selectedClass.name);
      if (selectedYear?.name) qs.set("academicYearName", selectedYear.name);
      if (selectedTerm?.name) qs.set("termName", selectedTerm.name);

      const res = await fetch(`/api/analysis/performance?${qs.toString()}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        const msg = await readError(res);
        setError(msg);
        setData(null);
        return;
      }

      const json = await res.json();
      setData(json);
    } catch {
      setError("Failed to load analytics");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (!mounted) return;

    if (subjectId && yearId && termId && classId) {
      loadAnalytics();
    } else {
      setData(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, yearId, termId, classId, subjectId, reportType]);

  const summarySheetHref =
    yearId && termId && classId && reportType
      ? `/api/analysis/summary-sheet?${new URLSearchParams({
          academicYearId: yearId,
          termId,
          classId,
          reportType,
          ...(selectedClass?.name ? { className: selectedClass.name } : {}),
          ...(selectedYear?.name ? { academicYearName: selectedYear.name } : {}),
          ...(selectedTerm?.name ? { termName: selectedTerm.name } : {}),
        }).toString()}`
      : "#";

  if (!mounted) {
    return (
      <div className="space-y-4">
        <Card className="p-6">
          <div className="text-sm text-slate-800">Loading analysis...</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Performance Analysis"
          subtitle="Grade summaries by class and subject"
        />
        <div className="p-4 grid grid-cols-1 md:grid-cols-7 gap-3">
          <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
            {classes.length === 0 ? (
              <option value="">No classes available</option>
            ) : (
              classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))
            )}
          </Select>

          <Select value={yearId} onChange={(e) => setYearId(e.target.value)}>
            {years.length === 0 ? (
              <option value="">No academic years</option>
            ) : (
              years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))
            )}
          </Select>

          <Select
            value={termId}
            onChange={(e) => setTermId(e.target.value)}
            disabled={!yearId || filteredTerms.length === 0}
          >
            {filteredTerms.length === 0 ? (
              <option value="">No terms available</option>
            ) : (
              filteredTerms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))
            )}
          </Select>

          <Select value={reportType} onChange={(e) => setReportType(e.target.value as ReportType)}>
            {REPORT_TYPES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>

          <Select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            disabled={!classId || loadingSubjects || subjects.length === 0}
          >
            {!classId ? (
              <option value="">Select class first</option>
            ) : subjects.length === 0 ? (
              <option value="">
                {loadingSubjects ? "Loading subjects..." : "No subjects available"}
              </option>
            ) : (
              subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code ? `${s.name} (${s.code})` : s.name}
                </option>
              ))
            )}
          </Select>

          <Button onClick={loadAnalytics} disabled={!subjectId || loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>

          <a
            href={summarySheetHref}
            className={!classId || !reportType || !yearId || !termId ? "pointer-events-none opacity-50" : ""}
          >
            <Button
              type="button"
              className="w-full"
              disabled={!classId || !reportType || !yearId || !termId}
            >
              Download Summary Sheet
            </Button>
          </a>
        </div>
      </Card>

      {error ? (
        <Card className="border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </Card>
      ) : null}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {(data?.gradeOrder ?? ["A", "B", "C", "D", "E"]).map((grade) => (
          <Card key={grade} className={`p-4 shadow-sm ${gradeCardClass(grade)}`}>
            <div className={`text-sm font-semibold ${gradeTextClass(grade)}`}>Grade {grade}</div>
            <div className="mt-2 text-3xl font-bold text-slate-900">{data?.summary?.[grade] ?? 0}</div>
            <div className="mt-2 text-sm font-medium text-slate-700">students</div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader
          title="Ranked Summary"
          subtitle={
            data
              ? `${data.meta.className} • ${data.meta.subjectName} • ${data.meta.reportType}${data.meta.totalOutOf ? ` • Out of ${data.meta.totalOutOf}` : ""}`
              : "No analysis loaded yet"
          }
          right={<Badge>{data?.meta?.totalStudents ?? 0}</Badge>}
        />
        <div className="p-4 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b bg-slate-100 text-slate-900">
                <th className="text-left p-3 font-bold">#</th>
                <th className="text-left p-3 font-bold">Student</th>
                <th className="text-left p-3 font-bold">Student No</th>
                <th className="text-left p-3 font-bold">Total{data?.meta?.totalOutOf ? ` / ${data.meta.totalOutOf}` : ""}</th>
                <th className="text-left p-3 font-bold">Grade</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="p-4 text-slate-800" colSpan={5}>
                    Loading analysis...
                  </td>
                </tr>
              ) : !data?.rows?.length ? (
                <tr>
                  <td className="p-4 text-slate-800" colSpan={5}>
                    No marks found for the selected filters.
                  </td>
                </tr>
              ) : (
                data.rows.map((row, index) => (
                  <tr key={row.enrollmentId} className="border-b text-slate-900">
                    <td className="p-3 font-medium">{index + 1}</td>
                    <td className="p-3 font-semibold">{row.studentName}</td>
                    <td className="p-3">{row.studentNo || "-"}</td>
                    <td className="p-3 font-medium">{row.totalScore}</td>
                    <td className={`p-3 font-bold ${gradeTextClass(row.grade)}`}>{row.grade}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}