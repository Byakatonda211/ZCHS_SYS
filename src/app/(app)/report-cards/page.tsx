"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, Button, Input, Select, Badge } from "@/components/ui";

type AcademicYearRow = {
  id: string;
  name: string;
  isCurrent?: boolean;
};

type TermRow = {
  id: string;
  name: string;
  type?: string;
  academicYearId: string;
  isCurrent?: boolean;
};

type ClassRow = {
  id: string;
  name: string;
  level?: string;
  order?: number;
  isActive?: boolean;
};

type StudentRow = {
  id: string;
  firstName: string;
  lastName: string;
  admissionNo?: string | null;
  studentNo?: string | null;
  classId?: string | null;
  streamId?: string | null;
  className?: string | null;
  streamName?: string | null;
};

type ReportType = "O_MID" | "O_EOT" | "A_MID" | "A_EOT";

const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: "O_MID", label: "O-Level Mid" },
  { value: "O_EOT", label: "O-Level End" },
  { value: "A_MID", label: "A-Level Mid" },
  { value: "A_EOT", label: "A-Level End" },
];

export default function ReportCardsPage() {
  const router = useRouter();

  const [mounted, setMounted] = React.useState(false);

  const [years, setYears] = React.useState<AcademicYearRow[]>([]);
  const [terms, setTerms] = React.useState<TermRow[]>([]);
  const [classes, setClasses] = React.useState<ClassRow[]>([]);
  const [students, setStudents] = React.useState<StudentRow[]>([]);

  const [yearId, setYearId] = React.useState("");
  const [termId, setTermId] = React.useState("");
  const [classId, setClassId] = React.useState("");
  const [reportType, setReportType] = React.useState<ReportType>("O_EOT");
  const [query, setQuery] = React.useState("");

  const [bootLoading, setBootLoading] = React.useState(true);
  const [studentsLoading, setStudentsLoading] = React.useState(false);
  const [bootError, setBootError] = React.useState("");
  const [studentsError, setStudentsError] = React.useState("");

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!mounted) return;

    let cancelled = false;

    async function loadInitialData() {
      try {
        setBootLoading(true);
        setBootError("");

        const [yearsRes, classesRes] = await Promise.all([
          fetch("/api/academic-years", { cache: "no-store", credentials: "include" }),
          fetch("/api/classes", { cache: "no-store", credentials: "include" }),
        ]);

        const yearsData = await yearsRes.json();
        const classesData = await classesRes.json();

        if (!yearsRes.ok) {
          throw new Error(yearsData?.error || "Failed to load academic years");
        }
        if (!classesRes.ok) {
          throw new Error(classesData?.error || "Failed to load classes");
        }

        const loadedYears: AcademicYearRow[] = Array.isArray(yearsData) ? yearsData : [];
        const loadedClasses: ClassRow[] = Array.isArray(classesData) ? classesData : [];

        const currentYear =
          loadedYears.find((y) => y.isCurrent) ?? loadedYears[0] ?? null;

        let loadedTerms: TermRow[] = [];
        if (currentYear?.id) {
          const termsRes = await fetch(
            `/api/terms?academicYearId=${encodeURIComponent(currentYear.id)}`,
            { cache: "no-store", credentials: "include" }
          );
          const termsData = await termsRes.json();

          if (!termsRes.ok) {
            throw new Error(termsData?.error || "Failed to load terms");
          }

          loadedTerms = Array.isArray(termsData) ? termsData : [];
        }

        const currentTerm =
          loadedTerms.find((t) => t.isCurrent) ?? loadedTerms[0] ?? null;

        if (cancelled) return;

        setYears(loadedYears);
        setClasses(loadedClasses);
        setTerms(loadedTerms);

        setYearId(currentYear?.id ?? "");
        setTermId(currentTerm?.id ?? "");
        setClassId(loadedClasses[0]?.id ?? "");
      } catch (err: any) {
        if (!cancelled) {
          setBootError(err?.message || "Failed to load page data");
        }
      } finally {
        if (!cancelled) {
          setBootLoading(false);
        }
      }
    }

    loadInitialData();

    return () => {
      cancelled = true;
    };
  }, [mounted]);

  React.useEffect(() => {
    if (!mounted || !yearId) {
      setTerms([]);
      setTermId("");
      return;
    }

    let cancelled = false;

    async function loadTerms() {
      try {
        const res = await fetch(
          `/api/terms?academicYearId=${encodeURIComponent(yearId)}`,
          { cache: "no-store", credentials: "include" }
        );
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load terms");
        }

        const loadedTerms: TermRow[] = Array.isArray(data) ? data : [];
        const nextTerm =
          loadedTerms.find((t) => t.isCurrent) ??
          loadedTerms.find((t) => t.id === termId) ??
          loadedTerms[0] ??
          null;

        if (!cancelled) {
          setTerms(loadedTerms);
          setTermId(nextTerm?.id ?? "");
        }
      } catch (err: any) {
        if (!cancelled) {
          setTerms([]);
          setTermId("");
        }
      }
    }

    loadTerms();

    return () => {
      cancelled = true;
    };
  }, [mounted, yearId]);

  React.useEffect(() => {
    if (!mounted || !classId) {
      setStudents([]);
      return;
    }

    let cancelled = false;

    async function loadStudents() {
      try {
        setStudentsLoading(true);
        setStudentsError("");

        const params = new URLSearchParams();
        params.set("classId", classId);
        if (query.trim()) params.set("q", query.trim());

        const res = await fetch(`/api/students?${params.toString()}`, {
          cache: "no-store",
          credentials: "include",
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load students");
        }

        if (!cancelled) {
          setStudents(Array.isArray(data) ? data : []);
        }
      } catch (err: any) {
        if (!cancelled) {
          setStudents([]);
          setStudentsError(err?.message || "Failed to load students");
        }
      } finally {
        if (!cancelled) {
          setStudentsLoading(false);
        }
      }
    }

    loadStudents();

    return () => {
      cancelled = true;
    };
  }, [mounted, classId, query]);

  if (!mounted || bootLoading) {
    return <div className="p-4 text-sm text-slate-500">Loading report cards...</div>;
  }

  if (bootError) {
    return (
      <div className="p-4">
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {bootError}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Report Cards"
          subtitle="Choose report settings and open a student's report card"
        />
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5">
          <div>
            <div className="mb-1 text-xs font-medium text-slate-500">
              Academic Year
            </div>
            <Select value={yearId} onChange={(e) => setYearId(e.target.value)}>
              <option value="">Select year</option>
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-slate-500">Term</div>
            <Select value={termId} onChange={(e) => setTermId(e.target.value)}>
              <option value="">Select term</option>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-slate-500">Class</div>
            <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">Select class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-slate-500">
              Report Type
            </div>
            <Select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
            >
              {REPORT_TYPES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-slate-500">Search</div>
            <Input
              placeholder="Name or admission no..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Students"
          subtitle={classId ? "Students in selected class" : "Select a class first"}
          right={
            <Badge>
              {studentsLoading ? "Loading..." : `${students.length} found`}
            </Badge>
          }
        />

        <div className="p-4">
          {studentsError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {studentsError}
            </div>
          ) : !classId ? (
            <div className="text-sm text-slate-500">Select a class to view students.</div>
          ) : studentsLoading ? (
            <div className="text-sm text-slate-500">Loading students...</div>
          ) : students.length === 0 ? (
            <div className="text-sm text-slate-500">
              No students found for the selected class.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {students.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-slate-900">
                      {s.firstName} {s.lastName}
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {s.admissionNo || s.studentNo || "No admission number"}
                      {s.className ? ` • ${s.className}` : ""}
                      {s.streamName ? ` • ${s.streamName}` : ""}
                    </div>
                  </div>

                  <Button
                    disabled={!yearId || !termId}
                    onClick={() =>
                      router.push(
                        `/report-cards/${s.id}?yearId=${encodeURIComponent(
                          yearId
                        )}&termId=${encodeURIComponent(
                          termId
                        )}&reportType=${encodeURIComponent(reportType)}`
                      )
                    }
                  >
                    Open
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}