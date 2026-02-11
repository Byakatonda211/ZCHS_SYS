"use client";

import React from "react";
import {
  type ClassDef,
  type Term,
  type AcademicYear,
  type AssessmentDef,
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

type SavedMarkRow = { studentId: string; scoreRaw: number };

// ✅ IMPORTANT: include assessmentId in key so drafts don't leak across assessments
function keyFor(studentId: string, assessmentId: string, subjectId: string, paperId?: string) {
  return `${studentId}|${assessmentId}|${subjectId}|${paperId ?? ""}`;
}

async function apiGetJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return res.json();
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

// ✅ Sort A–Z by FIRST NAME (then last, other, admission as tie-breakers)
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

export default function MarksPage() {
  const [classes, setClasses] = React.useState<ClassDef[]>([]);
  const [years, setYears] = React.useState<AcademicYear[]>([]);
  const [terms, setTerms] = React.useState<Term[]>([]);
  const [assessments, setAssessments] = React.useState<AssessmentDef[]>([]);

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

  // saved marks loaded from DB
  const [savedMap, setSavedMap] = React.useState<Record<string, number>>({});
  const [savedVersion, setSavedVersion] = React.useState(0);

  const currentYear = React.useMemo(
    () => years.find((y: any) => y.isCurrent) ?? years[0] ?? null,
    [years]
  );

  const selectedClass = React.useMemo(
    () => classes.find((c) => c.id === classId) ?? null,
    [classes, classId]
  );

  const aLevel = selectedClass ? isALevelClass((selectedClass as any).name) : false;

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [cls, yrs, t, as] = await Promise.all([
          apiGetJSON<any[]>("/api/classes"),
          apiGetJSON<any[]>("/api/academic-years"),
          apiGetJSON<any[]>("/api/terms"),
          // ✅ only active assessments for teachers
          apiGetJSON<any[]>("/api/assessments?activeOnly=1"),
        ]);

        if (cancelled) return;

        const clsSorted = (cls || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        const asActive = (as || []).filter((x) => x.isActive !== false);

        setClasses(clsSorted);
        setYears(yrs || []);
        setTerms(t || []);
        setAssessments(asActive);

        setClassId(clsSorted[0]?.id ?? "");
        const ct = (t || []).find((x: any) => x.isCurrent) ?? (t || [])[0];
        setTermId(ct?.id ?? "");
        setAssessmentId(asActive[0]?.id ?? "");
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
    if (!classId) return;

    let cancelled = false;

    (async () => {
      try {
        const [stu, subs] = await Promise.all([
          apiGetJSON<StudentRow[]>(`/api/students?classId=${encodeURIComponent(classId)}`),
          apiGetJSON<Subject[]>(`/api/subjects?classId=${encodeURIComponent(classId)}`),
        ]);

        if (cancelled) return;

        setStudents(stu || []);
        setSubjects(subs || []);

        const map: Record<string, SubjectPaper[]> = {};
        for (const s of subs || []) {
          try {
            const papers = await apiGetJSON<SubjectPaper[]>(
              `/api/subjects/${encodeURIComponent(s.id)}/papers`
            );
            map[s.id] = papers || [];
          } catch {
            map[s.id] = [];
          }
        }

        if (cancelled) return;
        setPapersBySubject(map);

        const firstSub = (subs || [])[0]?.id ?? "";
        setSubjectId(firstSub);

        const firstPaper = firstSub ? (map[firstSub]?.[0]?.id ?? "") : "";
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
    const first = subjectId ? (papersBySubject[subjectId]?.[0]?.id ?? "") : "";
    setPaperId(first);
  }, [aLevel, subjectId, papersBySubject]);

  
  // ✅ Re-fetch students filtered by selected subject (only enrolled students should appear)
  // NOTE: No UI changes — just data filtering via existing /api/students?subjectId=
  React.useEffect(() => {
    if (!classId) return;

    let cancelled = false;

    (async () => {
      try {
        const url =
          subjectId && subjectId.trim()
            ? `/api/students?classId=${encodeURIComponent(classId)}&subjectId=${encodeURIComponent(subjectId)}`
            : `/api/students?classId=${encodeURIComponent(classId)}`;

        const stu = await apiGetJSON<StudentRow[]>(url);
        if (cancelled) return;
        setStudents(stu || []);
      } catch {
        if (cancelled) return;
        // keep behavior safe: show none if fetch fails
        setStudents([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [classId, subjectId]);

// ✅ Filter + sort by FIRST NAME A–Z
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
    const i = Math.trunc(n);
    if (i < 0) return { ok: false, msg: "Too low" };
    if (i > 100) return { ok: false, msg: "Too high" };
    return { ok: true, val: i };
  }

  const draftCountForCurrentSelection = React.useMemo(() => {
    if (!assessmentId || !subjectId) return 0;
    const paper = aLevel ? paperId : "";
    const suffix = `|${assessmentId}|${subjectId}|${paper ?? ""}`;
    return Object.keys(drafts).filter((k) => k.endsWith(suffix) && drafts[k].trim() !== "").length;
  }, [drafts, assessmentId, subjectId, paperId, aLevel]);

  // Load saved marks for current selection
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
        for (const r of rows || []) map[r.studentId] = r.scoreRaw;
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

      entries.push({ studentId: s.id, scoreRaw: chk.val ?? 0 });
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

      // clear drafts for current selection only
      setDrafts((d) => {
        const copy = { ...d };
        for (const e of entries) {
          const k = keyFor(e.studentId, assessmentId, subjectId, paper || undefined);
          delete copy[k];
        }
        return copy;
      });

      // refresh saved marks so they appear immediately
      setSavedVersion((v) => v + 1);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Enter Marks" subtitle="Select class, term, assessment & subject then enter marks" />
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
              options={assessments.map((a: any) => ({
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
                const firstPaper = newSub ? (papersBySubject[newSub]?.[0]?.id ?? "") : "";
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
                ? String(savedMap[s.id])
                : "";

            return (
              <div key={s.id} className="flex items-center gap-3 border rounded p-2">
                <div className="flex-1">
                  <div className="font-semibold text-slate-900">
                    {/* ✅ Hide admission number on small screens, show on md+ */}
                    {s.admissionNo ? <span className="hidden md:inline">{s.admissionNo} — </span> : null}
                    {s.firstName} {s.lastName} {s.otherNames ?? ""}
                  </div>
                </div>

                <div className="w-32">
                  <Input
                    value={display}
                    onChange={(e: any) => {
                      setDraft(k, e.target.value);
                      const chk = validateScore(e.target.value);
                      if (!chk.ok) setErr(k, chk.msg || "Invalid");
                      else clearErr(k);
                    }}
                    placeholder=""
                  />
                  {errors[k] ? <div className="text-xs text-red-600 mt-1">{errors[k]}</div> : null}
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
