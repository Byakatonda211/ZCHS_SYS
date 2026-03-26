"use client";

import React from "react";
import {
  type ClassDef,
  type Term,
  type AcademicYear,
  type Subject,
  type SubjectPaper,
} from "@/lib/store";
import { Card, CardHeader, Select, Input, Label, Badge, Button } from "@/components/ui";

function normalizeClassName(name: string) {
  return name.replace(/\s+/g, "").replace(/\./g, "").toUpperCase();
}
function isALevelClass(name: string) {
  const n = normalizeClassName(name);
  return n === "S5" || n === "S6";
}

type StudentRow = {
  id: string;
  admissionNo: string | null;
  firstName: string;
  lastName: string;
  otherNames: string | null;
  classId: string | null;
  streamId: string | null;
};

type SavedMarkRow = { studentId: string; scoreRaw: number | null };

type AssessmentApi = {
  id: string;
  code: string;
  name: string;
  level?: "O_LEVEL" | "A_LEVEL";
  type?: "MIDTERM" | "ENDTERM";
  isActive?: boolean;
};

type StudentsResponse =
  | StudentRow[]
  | {
      items?: StudentRow[];
      total?: number;
      page?: number;
      totalPages?: number;
    };

type SchemeComponent = {
  assessmentId: string;
  enterOutOf: number;
  weightOutOf: number;
};

type SchemeApi = {
  id: string;
  reportType: string;
  name: string;
  components: SchemeComponent[];
};

function keyFor(studentId: string, assessmentId: string, subjectId: string, paperId?: string) {
  return `${studentId}|${assessmentId}|${subjectId}|${paperId ?? ""}`;
}

async function apiGetJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: "GET", cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || `GET ${url} failed: ${res.status}`);
  return data;
}

async function apiPostJSON<T>(url: string, body: any): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `POST ${url} failed: ${res.status}`);
  return data;
}

function compareStudentsByFirstName(a: StudentRow, b: StudentRow) {
  const aFirst = (a.firstName || "").trim().toLowerCase();
  const bFirst = (b.firstName || "").trim().toLowerCase();
  if (aFirst !== bFirst) return aFirst.localeCompare(bFirst);

  const aLast = (a.lastName || "").trim().toLowerCase();
  const bLast = (b.lastName || "").trim().toLowerCase();
  if (aLast !== bLast) return aLast.localeCompare(bLast);

  const aOther = (a.otherNames || "").trim().toLowerCase();
  const bOther = (b.otherNames || "").trim().toLowerCase();
  if (aOther !== bOther) return aOther.localeCompare(bOther);

  const aAdm = (a.admissionNo || "").trim().toLowerCase();
  const bAdm = (b.admissionNo || "").trim().toLowerCase();
  return aAdm.localeCompare(bAdm);
}

function studentsFromResponse(data: StudentsResponse): StudentRow[] {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.items) ? data.items : [];
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function formatDecimalInput(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  const s = value.toFixed(2);
  return s.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function hasAtMostTwoDecimals(v: number) {
  return Math.abs(v - round2(v)) < 1e-9;
}

export default function MarksPage() {
  const [classes, setClasses] = React.useState<ClassDef[]>([]);
  const [years, setYears] = React.useState<AcademicYear[]>([]);
  const [terms, setTerms] = React.useState<Term[]>([]);
  const [assessments, setAssessments] = React.useState<AssessmentApi[]>([]);

  const [classId, setClassId] = React.useState<string>("");
  const [termId, setTermId] = React.useState<string>("");
  const [assessmentId, setAssessmentId] = React.useState<string>("");

  const [students, setStudents] = React.useState<StudentRow[]>([]);
  const [subjects, setSubjects] = React.useState<Subject[]>([]);
  const [papersBySubject, setPapersBySubject] = React.useState<Record<string, SubjectPaper[]>>({});

  const [subjectId, setSubjectId] = React.useState<string>("");
  const [paperId, setPaperId] = React.useState<string>("");
  const [studentQuery, setStudentQuery] = React.useState<string>("");

  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  const [savedMap, setSavedMap] = React.useState<Record<string, number>>({});
  const [savedVersion, setSavedVersion] = React.useState(0);
  const [enterOutOf, setEnterOutOf] = React.useState(100);

  const currentYear = React.useMemo(
    () => years.find((y: any) => y.isCurrent) ?? years[0] ?? null,
    [years]
  );

  const selectedClass = React.useMemo(
    () => classes.find((c) => c.id === classId) ?? null,
    [classes, classId]
  );

  const aLevel = selectedClass ? isALevelClass((selectedClass as any).name) : false;
  const selectedLevel = aLevel ? "A_LEVEL" : "O_LEVEL";

  const visibleAssessments = React.useMemo(() => {
    const filtered = (assessments || []).filter((a) => {
      if (!a.isActive && a.isActive !== undefined) return false;
      if (!a.level) return true;
      return a.level === selectedLevel;
    });

    return filtered.sort((a, b) => (a.code || "").localeCompare(b.code || ""));
  }, [assessments, selectedLevel]);

  const selectedAssessment = React.useMemo(
    () => visibleAssessments.find((a) => a.id === assessmentId) ?? null,
    [visibleAssessments, assessmentId]
  );

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [cls, yrs, t, as] = await Promise.all([
          apiGetJSON<any[]>("/api/classes"),
          apiGetJSON<any[]>("/api/academic-years"),
          apiGetJSON<any[]>("/api/terms"),
          apiGetJSON<AssessmentApi[]>("/api/assessments?activeOnly=1"),
        ]);

        if (cancelled) return;

        const clsSorted = (cls || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        setClasses(clsSorted);
        setYears(yrs || []);
        setTerms(t || []);
        setAssessments(as || []);

        const firstClass = clsSorted[0]?.id ?? "";
        setClassId(firstClass);

        const ct = (t || []).find((x: any) => x.isCurrent) ?? (t || [])[0];
        setTermId(ct?.id ?? "");
      } catch {
        if (cancelled) return;
        setClasses([]);
        setYears([]);
        setTerms([]);
        setAssessments([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    const first = visibleAssessments[0]?.id ?? "";
    if (!visibleAssessments.some((a) => a.id === assessmentId)) {
      setAssessmentId(first);
    }
  }, [visibleAssessments, assessmentId]);

  React.useEffect(() => {
    if (!classId) return;

    let cancelled = false;

    (async () => {
      try {
        const [stuResp, subs] = await Promise.all([
          apiGetJSON<StudentsResponse>(
            `/api/students?classId=${encodeURIComponent(classId)}&page=1&pageSize=100`
          ),
          apiGetJSON<Subject[]>(`/api/subjects?classId=${encodeURIComponent(classId)}`),
        ]);

        if (cancelled) return;

        const stu = studentsFromResponse(stuResp);

        setStudents(stu || []);
        setSubjects(subs || []);

        const papersResults: Array<[string, SubjectPaper[]]> = await Promise.all(
          (subs || []).map(async (s): Promise<[string, SubjectPaper[]]> => {
            try {
              const papers = await apiGetJSON<SubjectPaper[]>(
                `/api/subjects/${encodeURIComponent(s.id)}/papers`
              );
              return [s.id, papers ?? []];
            } catch {
              return [s.id, []];
            }
          })
        );

        if (cancelled) return;

        const map: Record<string, SubjectPaper[]> = {};
        for (const [subjectKey, papers] of papersResults) {
          map[subjectKey] = papers;
        }
        setPapersBySubject(map);

        const firstSub = (subs || [])[0]?.id ?? "";
        setSubjectId(firstSub);

        const firstPaper = firstSub ? map[firstSub]?.[0]?.id ?? "" : "";
        setPaperId(firstPaper);

        setDrafts({});
        setErrors({});
        setStudentQuery("");
      } catch {
        if (cancelled) return;
        setStudents([]);
        setSubjects([]);
        setPapersBySubject({});
        setSubjectId("");
        setPaperId("");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [classId]);

  React.useEffect(() => {
    if (!aLevel) return;
    const first = subjectId ? papersBySubject[subjectId]?.[0]?.id ?? "" : "";
    setPaperId(first);
  }, [aLevel, subjectId, papersBySubject]);

  React.useEffect(() => {
    if (!classId) return;

    let cancelled = false;

    (async () => {
      try {
        const url =
          subjectId && subjectId.trim()
            ? `/api/students?classId=${encodeURIComponent(classId)}&subjectId=${encodeURIComponent(subjectId)}&page=1&pageSize=100`
            : `/api/students?classId=${encodeURIComponent(classId)}&page=1&pageSize=100`;

        const stuResp = await apiGetJSON<StudentsResponse>(url);
        if (cancelled) return;
        setStudents(studentsFromResponse(stuResp) || []);
      } catch {
        if (cancelled) return;
        setStudents([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [classId, subjectId]);

  React.useEffect(() => {
    if (!selectedAssessment) {
      setEnterOutOf(100);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const reportType =
          selectedLevel === "A_LEVEL"
            ? selectedAssessment.type === "ENDTERM"
              ? "A_EOT"
              : "A_MID"
            : selectedAssessment.type === "ENDTERM"
            ? "O_EOT"
            : "O_MID";

        const scheme = await apiGetJSON<SchemeApi | null>(
          `/api/schemes?reportType=${encodeURIComponent(reportType)}`
        );

        if (cancelled) return;

        const schemeComponent = scheme?.components?.find(
          (c) => c.assessmentId === selectedAssessment.id
        );
        setEnterOutOf(Number(schemeComponent?.enterOutOf ?? 100));
      } catch {
        if (cancelled) return;
        setEnterOutOf(100);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedAssessment, selectedLevel]);

  const filteredStudents = React.useMemo(() => {
    const q = studentQuery.trim().toLowerCase();

    const base = !q
      ? students
      : students.filter((s) => {
          const name = `${s.firstName ?? ""} ${s.lastName ?? ""} ${s.otherNames ?? ""}`.toLowerCase();
          const adm = `${s.admissionNo ?? ""}`.toLowerCase();
          return name.includes(q) || adm.includes(q);
        });

    return base.slice().sort(compareStudentsByFirstName);
  }, [students, studentQuery]);

  function setDraft(k: string, v: string) {
    setDrafts((d) => ({ ...d, [k]: v }));
  }
  function setErr(k: string, msg: string) {
    setErrors((e) => ({ ...e, [k]: msg }));
  }
  function clearErr(k: string) {
    setErrors((e) => {
      const copy = { ...e };
      delete copy[k];
      return copy;
    });
  }

  function validateScore(v: string) {
    if (!v.trim()) return { ok: true, val: null as number | null };
    const n = Number(v);
    if (!Number.isFinite(n)) return { ok: false, msg: "Invalid number" };
    if (!hasAtMostTwoDecimals(n)) return { ok: false, msg: "Use at most 2 decimal places" };
    if (n < 0) return { ok: false, msg: "Too low" };
    if (n > enterOutOf) return { ok: false, msg: `Must be 0-${formatDecimalInput(enterOutOf)}` };
    return { ok: true, val: round2(n) };
  }

  const draftCountForCurrentSelection = React.useMemo(() => {
    if (!assessmentId || !subjectId) return 0;
    const paper = aLevel ? paperId : "";
    const suffix = `|${assessmentId}|${subjectId}|${paper ?? ""}`;
    return Object.keys(drafts).filter(
      (k) => k.endsWith(suffix) && drafts[k].trim() !== ""
    ).length;
  }, [drafts, assessmentId, subjectId, paperId, aLevel]);

  React.useEffect(() => {
    const y = currentYear?.id ?? "";
    if (!y || !termId || !assessmentId || !classId || !subjectId) {
      setSavedMap({});
      return;
    }

    const paper = aLevel ? paperId : "";
    const subjectPaperId = paper ? paper : "";

    let cancelled = false;

    (async () => {
      try {
        const rows = await apiGetJSON<SavedMarkRow[]>(
          `/api/marks?academicYearId=${encodeURIComponent(y)}&termId=${encodeURIComponent(
            termId
          )}&assessmentDefinitionId=${encodeURIComponent(
            assessmentId
          )}&classId=${encodeURIComponent(classId)}&subjectId=${encodeURIComponent(
            subjectId
          )}&subjectPaperId=${encodeURIComponent(subjectPaperId)}`
        );

        if (cancelled) return;

        const map: Record<string, number> = {};
        for (const r of rows || []) {
          if (typeof r.scoreRaw === "number") map[r.studentId] = r.scoreRaw;
        }
        setSavedMap(map);
      } catch {
        if (cancelled) return;
        setSavedMap({});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentYear?.id, termId, assessmentId, classId, subjectId, paperId, aLevel, savedVersion]);

  async function saveAll() {
    const y = currentYear?.id ?? "";
    if (!y || !termId || !assessmentId || !classId || !subjectId) return;

    const paper = aLevel ? paperId : "";
    const subjectPaperId = paper ? paper : null;

    const entries: { studentId: string; scoreRaw: number }[] = [];
    const newErrors: Record<string, string> = {};

    for (const s of students) {
      const k = keyFor(s.id, assessmentId, subjectId, paper || undefined);
      const raw = drafts[k];
      if (raw === undefined || raw.trim() === "") continue;

      const chk = validateScore(raw);
      if (!chk.ok) {
        newErrors[k] = chk.msg || "Invalid";
        continue;
      }
      if (chk.val === null || chk.val === undefined) continue;

      entries.push({ studentId: s.id, scoreRaw: chk.val });
    }

    setErrors((prev) => ({ ...prev, ...newErrors }));
    if (entries.length === 0) return;

    setSaving(true);
    try {
      await apiPostJSON("/api/marks/bulk", {
        academicYearId: y,
        termId,
        assessmentDefinitionId: assessmentId,
        classId,
        subjectId,
        subjectPaperId,
        entries,
      });

      setDrafts((d) => {
        const copy = { ...d };
        for (const e of entries) {
          const k = keyFor(e.studentId, assessmentId, subjectId, paper || undefined);
          delete copy[k];
        }
        return copy;
      });

      setSavedVersion((v) => v + 1);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Enter Marks"
          subtitle="Select class, term, assessment and subject, then enter marks"
        />
        <div className="p-4 grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="space-y-1 md:col-span-2">
            <Label>Class</Label>
            <Select
              value={classId}
              onChange={(e: any) => setClassId(e.target.value)}
              options={classes.map((c: any) => ({ value: c.id, label: c.name }))}
            />
          </div>

          <div className="space-y-1 md:col-span-1">
            <Label>Term</Label>
            <Select
              value={termId}
              onChange={(e: any) => setTermId(e.target.value)}
              options={terms.map((t: any) => ({ value: t.id, label: t.name }))}
            />
          </div>

          <div className="space-y-1 md:col-span-1">
            <Label>Assessment Type</Label>
            <Select
              value={assessmentId}
              onChange={(e: any) => setAssessmentId(e.target.value)}
              options={visibleAssessments.map((a: any) => ({
                value: a.id,
                label: a.code ? `${a.code} — ${a.name}` : a.name,
              }))}
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <Label>Subject</Label>
            <Select
              value={subjectId}
              onChange={(e: any) => {
                const newSub = e.target.value;
                setSubjectId(newSub);
                const firstPaper = newSub ? papersBySubject[newSub]?.[0]?.id ?? "" : "";
                setPaperId(firstPaper);
              }}
              options={subjects.map((s: any) => ({ value: s.id, label: s.name }))}
            />
          </div>

          {aLevel ? (
            <div className="space-y-1 md:col-span-2">
              <Label>Paper</Label>
              <Select
                value={paperId}
                onChange={(e: any) => setPaperId(e.target.value)}
                options={(papersBySubject[subjectId] ?? []).map((p: any) => ({
                  value: p.id,
                  label: p.name,
                }))}
              />
            </div>
          ) : null}

          <div className="space-y-1 md:col-span-2">
            <Label>Search Student</Label>
            <Input
              value={studentQuery}
              onChange={(e: any) => setStudentQuery(e.target.value)}
              placeholder="Type name or admission no..."
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <Label>Allowed Entry</Label>
            <div className="h-10 flex items-center">
              <Badge>Enter out of {formatDecimalInput(enterOutOf)}</Badge>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Students"
          subtitle={
            <div className="flex items-center gap-2">
              <Badge>{filteredStudents.length} students</Badge>
              {draftCountForCurrentSelection > 0 ? (
                <Badge>{draftCountForCurrentSelection} entered</Badge>
              ) : null}
              <Badge>
                {selectedLevel === "A_LEVEL" ? "A-Level assessments" : "O-Level assessments"}
              </Badge>
            </div>
          }
        />
        <div className="p-4 space-y-2">
          {filteredStudents.map((s) => {
            const paper = aLevel ? paperId : "";
            const k = keyFor(s.id, assessmentId, subjectId, paper || undefined);

            const display =
              drafts[k] !== undefined
                ? drafts[k]
                : savedMap[s.id] !== undefined
                ? formatDecimalInput(savedMap[s.id])
                : "";

            return (
              <div key={s.id} className="flex items-center gap-3 border rounded p-2">
                <div className="flex-1">
                  <div className="font-semibold text-slate-900">
                    {s.admissionNo ? (
                      <span className="hidden md:inline">{s.admissionNo} — </span>
                    ) : null}
                    {s.firstName} {s.lastName} {s.otherNames ?? ""}
                  </div>
                </div>

                <div className="w-36">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={display}
                    onChange={(e: any) => {
                      setDraft(k, e.target.value);
                      const chk = validateScore(e.target.value);
                      if (!chk.ok) setErr(k, chk.msg || "Invalid");
                      else clearErr(k);
                    }}
                    placeholder={`0-${formatDecimalInput(enterOutOf)}`}
                  />
                  {errors[k] ? (
                    <div className="text-xs text-red-600 mt-1">{errors[k]}</div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 pt-0 flex justify-end">
          <Button
            onClick={saveAll}
            disabled={saving || draftCountForCurrentSelection === 0 || !assessmentId}
          >
            {saving ? "Saving..." : "Save All"}
          </Button>
        </div>
      </Card>
    </div>
  );
}