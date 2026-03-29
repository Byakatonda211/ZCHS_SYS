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
    setMounted(true);

    const allYears = getAcademicYears() ?? [];
    const allTerms = getTerms() ?? [];
    const allClasses = getClasses() ?? [];

    const currentYear = getCurrentAcademicYear();
    const currentTerm = getCurrentTerm();

    setYears(allYears);
    setTerms(allTerms);
    setClasses(allClasses);

    setYearId(currentYear?.id ?? allYears[0]?.id ?? "");
    setTermId(currentTerm?.id ?? allTerms[0]?.id ?? "");
    setClassId(allClasses[0]?.id ?? "");
  }, []);

  const selectedClass = React.useMemo(
    () => classes.find((c) => c.id === classId) ?? null,
    [classes, classId]
  );

  const selectedYear = React.useMemo(
    () => years.find((y) => y.id === yearId) ?? null,
    [years, yearId]
  );

  const selectedTerm = React.useMemo(
    () => terms.find((t) => t.id === termId) ?? null,
    [terms, termId]
  );

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
        <div className="p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
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

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {(data?.gradeOrder ?? ["A", "B", "C", "D", "E", "O", "F"]).map((grade) => (
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
              ? `${data.meta.className} • ${data.meta.subjectName} • ${data.meta.reportType}`
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
                <th className="text-left p-3 font-bold">Total</th>
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