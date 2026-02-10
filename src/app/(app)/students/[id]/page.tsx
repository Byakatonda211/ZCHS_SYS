"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardHeader, Button, Badge } from "@/components/ui";

type ApiStudent = {
  id: string;
  admissionNo?: string | null;
  firstName: string;
  lastName: string;
  otherNames?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  guardianEmail?: string | null;

  // PLE particulars
  pleSittingYear?: number | string | null;
  plePrimarySchool?: string | null;
  pleIndexNumber?: string | null;
  pleAggregates?: number | string | null;
  pleDivision?: string | null;

  // Residence & emergency
  village?: string | null;
  parish?: string | null;
  districtOfResidence?: string | null;
  homeDistrict?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;

  // Health details
  medicalConditions?: string | null;
  recurrentMedication?: string | null;
  knownDisability?: string | null;

  createdAt?: string;

  // OPTIONAL: if your /api/students/[id] includes enrollments
  enrollments?: Enrollment[];
};

type OptionItem = { id: string; name: string };

// ✅ ADDED: Enrollment subject type (minimal, non-breaking)
type EnrollmentSubject = {
  subjectId: string;
  subject?: { id: string; name: string };
};

// ✅ UPDATED: Enrollment supports subjects (optional)
type Enrollment = {
  id: string;
  studentId: string;
  academicYearId: string;
  termId?: string | null;
  classId: string;
  streamId?: string | null;
  isActive: boolean;
  createdAt?: string;

  // ✅ ADDED
  subjects?: EnrollmentSubject[];
};

function Info({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm text-slate-900">{value}</div>
    </div>
  );
}

export default function StudentProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [mounted, setMounted] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [student, setStudent] = React.useState<ApiStudent | null>(null);

  const [years, setYears] = React.useState<OptionItem[]>([]);
  const [terms, setTerms] = React.useState<OptionItem[]>([]);
  const [classes, setClasses] = React.useState<OptionItem[]>([]);
  const [streams, setStreams] = React.useState<OptionItem[]>([]);

  const [currentEnrollment, setCurrentEnrollment] = React.useState<Enrollment | null>(null);
  const [enrollmentHistory, setEnrollmentHistory] = React.useState<Enrollment[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const yearName = (yearId?: string | null) => years.find((y) => y.id === yearId)?.name ?? "—";
  const termName = (termId?: string | null) => terms.find((t) => t.id === termId)?.name ?? "—";
  const className = (classId?: string | null) => classes.find((c) => c.id === classId)?.name ?? "—";
  const streamName = (streamId?: string | null) => streams.find((s) => s.id === streamId)?.name ?? "—";

  function setEnrollmentsFromArray(history: Enrollment[]) {
    const sorted = (history || []).slice().sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db - da;
    });
    const active = sorted.find((e) => e.isActive) ?? null;
    setCurrentEnrollment(active);
    setEnrollmentHistory(sorted);
  }

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!mounted) return;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [stuRes, yRes, tRes, cRes, sRes] = await Promise.all([
          fetch(`/api/students/${id}`, { cache: "no-store" }),
          fetch("/api/settings/academic-years", { cache: "no-store" }),
          fetch("/api/settings/terms", { cache: "no-store" }),
          fetch("/api/settings/classes", { cache: "no-store" }),
          fetch("/api/settings/streams", { cache: "no-store" }),
        ]);

        const rawStu = await stuRes.json().catch(() => null);
        const stuPayload =
          rawStu && (rawStu as any).student
            ? (rawStu as any).student
            : rawStu && (rawStu as any).data
            ? (rawStu as any).data
            : rawStu;

        if (!stuRes.ok) {
          setStudent(null);
          setError((rawStu as any)?.error || "This student record does not exist.");
          return;
        }

        const years = await yRes.json().catch(() => []);
        const terms = await tRes.json().catch(() => []);
        const classes = await cRes.json().catch(() => []);
        const streams = await sRes.json().catch(() => []);

        setYears(years || []);
        setTerms(terms || []);
        setClasses(classes || []);
        setStreams(streams || []);

        setStudent(stuPayload as ApiStudent);

        if ((stuPayload as any)?.enrollments?.length) {
          setEnrollmentsFromArray((stuPayload as any).enrollments);
        } else {
          setEnrollmentsFromArray([]);
        }
      } catch (e: any) {
        setStudent(null);
        setError(e?.message || "Failed to load student");
      } finally {
        setLoading(false);
      }
    })();
  }, [mounted, id]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <div className="p-5 text-sm text-slate-600">Loading student…</div>
        </Card>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="space-y-4">
        <Card>
          <div className="p-5">
            <div className="text-lg font-semibold text-slate-900">Student not found</div>
            <p className="mt-2 text-sm text-slate-600">{error || "This student record does not exist."}</p>
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" onClick={() => router.push("/students")}>
                Back to Students
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const fullName = [student.firstName, student.otherNames, student.lastName].filter(Boolean).join(" ");

  // ✅ ADDED: derive enrolled subjects from active (or latest) enrollment
  const activeOrLatestEnrollment =
    (student.enrollments || []).find((e) => e.isActive) || (student.enrollments || [])[0] || null;

  const enrolledSubjects =
    (activeOrLatestEnrollment?.subjects || [])
      .map((x) => x?.subject?.name || "")
      .filter(Boolean) || [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={fullName} subtitle={`Admission No: ${student.admissionNo || "—"}`} right={<Badge>Active</Badge>} />

        <div className="grid grid-cols-1 gap-3 p-5 pt-0 sm:grid-cols-2">
          <div className="text-sm text-slate-700">
            <span className="font-semibold">Gender:</span> {student.gender || "—"}
          </div>
          <div className="text-sm text-slate-700">
            <span className="font-semibold">Date of Birth:</span>{" "}
            {student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : "—"}
          </div>
          <div className="text-sm text-slate-700">
            <span className="font-semibold">Phone:</span> {student.phone || "—"}
          </div>
          <div className="text-sm text-slate-700">
            <span className="font-semibold">Email:</span> {student.email || "—"}
          </div>
          <div className="text-sm text-slate-700 sm:col-span-2">
            <span className="font-semibold">Address:</span> {student.address || "—"}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 px-5 pb-5">
          <Button variant="secondary" onClick={() => router.push("/students")}>
            Back
          </Button>
          <Button onClick={() => router.push(`/students/${id}/edit`)}>Edit</Button>
          <Button variant="secondary" onClick={() => router.push(`/students/${id}/move`)}>
            Move Student
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Guardian" subtitle="Parent/guardian contact" />
        <div className="grid grid-cols-1 gap-3 p-5 pt-0 sm:grid-cols-2">
          <div className="text-sm text-slate-700">
            <span className="font-semibold">Name:</span> {student.guardianName || "—"}
          </div>
          <div className="text-sm text-slate-700">
            <span className="font-semibold">Phone:</span> {student.guardianPhone || "—"}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="PLE Particulars" subtitle="Primary Leaving Examination details (if available)" />
        <div className="p-5 pt-0 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Info label="PLE Sitting Year" value={student.pleSittingYear ?? "—"} />
          <Info label="PLE Index Number" value={student.pleIndexNumber ?? "—"} />
          <div className="sm:col-span-2">
            <Info label="Primary School" value={student.plePrimarySchool ?? "—"} />
          </div>
          <Info label="Aggregates" value={student.pleAggregates ?? "—"} />
          <Info label="Division" value={student.pleDivision ?? "—"} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Residence & Emergency" subtitle="Optional" />
        <div className="p-5 pt-0 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Info label="Village" value={student.village ?? "—"} />
          <Info label="Parish" value={student.parish ?? "—"} />
          <Info label="District of Residence" value={student.districtOfResidence ?? "—"} />
          <Info label="Home District" value={student.homeDistrict ?? "—"} />
          <Info label="Emergency Contact Name" value={student.emergencyContactName ?? "—"} />
          <Info label="Emergency Contact Phone" value={student.emergencyContactPhone ?? "—"} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Health Details" subtitle="Optional" />
        <div className="p-5 pt-0 grid grid-cols-1 gap-3">
          <Info label="Known Medical Conditions" value={student.medicalConditions ?? "—"} />
          <Info label="Recurrent Medication" value={student.recurrentMedication ?? "—"} />
          <Info label="Known Disability" value={student.knownDisability ?? "—"} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Enrollment" subtitle="Current class/stream (and history if available)" />
        <div className="p-5 pt-0 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="text-sm text-slate-700">
            <span className="font-semibold">Academic Year:</span> {yearName(currentEnrollment?.academicYearId)}
          </div>
          <div className="text-sm text-slate-700">
            <span className="font-semibold">Term:</span> {termName(currentEnrollment?.termId)}
          </div>
          <div className="text-sm text-slate-700">
            <span className="font-semibold">Class:</span> {className(currentEnrollment?.classId)}
          </div>
          <div className="text-sm text-slate-700">
            <span className="font-semibold">Stream:</span> {streamName(currentEnrollment?.streamId)}
          </div>

          {/* ✅ ADDED: Subjects display (minimal, no layout changes elsewhere) */}
          <div className="sm:col-span-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Subjects</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {enrolledSubjects.length === 0 ? (
                <span className="text-sm text-slate-900">—</span>
              ) : (
                enrolledSubjects.map((name) => (
                  <Badge key={name}>{name}</Badge>
                ))
              )}
            </div>
          </div>
        </div>

        {enrollmentHistory.length > 0 ? (
          <div className="border-t border-slate-200 p-5">
            <div className="text-sm font-semibold text-slate-900">Enrollment History</div>
            <div className="mt-3 space-y-2">
              {enrollmentHistory.map((e) => (
                <div key={e.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                  <div className="font-semibold text-slate-900">
                    {yearName(e.academicYearId)} • {className(e.classId)}{" "}
                    {e.streamId ? `(${streamName(e.streamId)})` : ""}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {e.termId ? `Term: ${termName(e.termId)} • ` : ""}
                    Status: {e.isActive ? "Active" : "Inactive"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="border-t border-slate-200 p-5 text-sm text-slate-600">No enrollment history available.</div>
        )}
      </Card>
    </div>
  );
}
