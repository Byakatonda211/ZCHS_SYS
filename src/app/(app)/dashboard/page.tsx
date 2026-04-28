"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { Card, CardHeader, Select, Badge } from "@/components/ui";

type Me = {
  id: string;
  fullName: string;
  username: string;
  role: string;
};

type Option = {
  id: string;
  name: string;
  level?: string;
  type?: string;
};

type DashboardView = "marks" | "students" | "subjects" | "classes";

type GradeCounts = {
  A: number;
  B: number;
  C: number;
  D: number;
  E: number;
  O?: number;
  F?: number;
};

type StudentRank = {
  studentId: string;
  name: string;
  admissionNo: string | null;
  average: number;
  subjectsCounted: number;
  position: number;
};

type DashboardStats = {
  me: Me;
  filters: {
    academicYears: Option[];
    terms: Option[];
    classes: Option[];
    assessments: Option[];
    selectedAcademicYearId: string;
    selectedTermId: string;
    selectedClassId: string;
    selectedAssessmentDefinitionId: string;
    selectedReportType: string;
  };
  summary: {
    studentsCount: number;
    teachersCount: number;
    activeClassName: string;
    activeTermName: string;
    activeAssessmentName: string;
    overallMarksCompletion: number;
  };
  marksStatus: {
    subjectId: string;
    subjectName: string;
    subjectCode: string | null;
    enrolledStudents: number;
    expectedEntries: number;
    enteredEntries: number;
    partialEntries?: number;
    completion: number;
    missingEntries: number;
    status: "Complete" | "In Progress" | "Not Started";
  }[];
  bestStudents: StudentRank[];
  bottomStudents: StudentRank[];
  bestSubjects: {
    subjectId: string;
    subjectName: string;
    subjectCode: string | null;
    average: number;
    studentsCounted: number;
    gradeHint: string;
    gradeCounts: GradeCounts;
  }[];
  classEnrollment: {
    classId: string;
    className: string;
    students: number;
  }[];
  gradeDistribution: {
    grade: string;
    count: number;
  }[];
};

async function apiGetMe(): Promise<Me | null> {
  try {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as Me;
  } catch {
    return null;
  }
}

function Icon({
  name,
  className = "h-5 w-5",
}: {
  name:
    | "student"
    | "users"
    | "marks"
    | "report"
    | "chart"
    | "award"
    | "book"
    | "school"
    | "teacher"
    | "refresh"
    | "spark";
  className?: string;
}) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (name === "student") {
    return (
      <svg viewBox="0 0 24 24" className={className} {...common}>
        <path d="M22 10L12 5 2 10l10 5 10-5Z" />
        <path d="M6 12v5c3.5 2 8.5 2 12 0v-5" />
        <path d="M22 10v6" />
      </svg>
    );
  }

  if (name === "users") {
    return (
      <svg viewBox="0 0 24 24" className={className} {...common}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }

  if (name === "marks") {
    return (
      <svg viewBox="0 0 24 24" className={className} {...common}>
        <path d="M4 19.5V5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-1.5Z" />
        <path d="M8 7h6" />
        <path d="M8 11h8" />
        <path d="M8 15h5" />
      </svg>
    );
  }

  if (name === "report") {
    return (
      <svg viewBox="0 0 24 24" className={className} {...common}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6" />
        <path d="M8 13h8" />
        <path d="M8 17h5" />
      </svg>
    );
  }

  if (name === "chart") {
    return (
      <svg viewBox="0 0 24 24" className={className} {...common}>
        <path d="M3 3v18h18" />
        <path d="M7 15l4-4 3 3 5-7" />
        <path d="M18 7h1v1" />
      </svg>
    );
  }

  if (name === "award") {
    return (
      <svg viewBox="0 0 24 24" className={className} {...common}>
        <circle cx="12" cy="8" r="5" />
        <path d="M8.5 12.5 7 22l5-3 5 3-1.5-9.5" />
      </svg>
    );
  }

  if (name === "book") {
    return (
      <svg viewBox="0 0 24 24" className={className} {...common}>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15Z" />
      </svg>
    );
  }

  if (name === "school") {
    return (
      <svg viewBox="0 0 24 24" className={className} {...common}>
        <path d="M3 22V10l9-6 9 6v12" />
        <path d="M9 22v-7h6v7" />
        <path d="M9 10h6" />
      </svg>
    );
  }

  if (name === "teacher") {
    return (
      <svg viewBox="0 0 24 24" className={className} {...common}>
        <circle cx="9" cy="7" r="4" />
        <path d="M2 21v-2a5 5 0 0 1 5-5h4" />
        <path d="M16 11h6" />
        <path d="M19 8v6" />
        <path d="M15 19l2 2 5-5" />
      </svg>
    );
  }

  if (name === "refresh") {
    return (
      <svg viewBox="0 0 24 24" className={className} {...common}>
        <path d="M21 12a9 9 0 0 1-15.5 6.2" />
        <path d="M3 12A9 9 0 0 1 18.5 5.8" />
        <path d="M18 2v4h4" />
        <path d="M6 22v-4H2" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className={className} {...common}>
      <path d="M12 2l1.7 5.2L19 9l-5.3 1.8L12 16l-1.7-5.2L5 9l5.3-1.8L12 2Z" />
      <path d="M19 14l.9 2.6L22 18l-2.1.7L19 21l-.9-2.3L16 18l2.1-1.4L19 14Z" />
    </svg>
  );
}

const quickAdmin = [
  {
    title: "Add Student",
    desc: "Register learner",
    href: "/students/new",
    icon: "student" as const,
    box: "bg-blue-50 text-blue-700 border-blue-100",
  },
  {
    title: "Students",
    desc: "Manage records",
    href: "/students",
    icon: "users" as const,
    box: "bg-violet-50 text-violet-700 border-violet-100",
  },
  {
    title: "Enter Marks",
    desc: "Capture scores",
    href: "/marks",
    icon: "marks" as const,
    box: "bg-emerald-50 text-emerald-700 border-emerald-100",
  },
  {
    title: "Report Cards",
    desc: "Generate reports",
    href: "/report-cards",
    icon: "report" as const,
    box: "bg-amber-50 text-amber-700 border-amber-100",
  },
];

const quickTeacher = [
  {
    title: "Students",
    desc: "View learners",
    href: "/students",
    icon: "users" as const,
    box: "bg-violet-50 text-violet-700 border-violet-100",
  },
  {
    title: "Enter Marks",
    desc: "Capture scores",
    href: "/marks",
    icon: "marks" as const,
    box: "bg-emerald-50 text-emerald-700 border-emerald-100",
  },
  {
    title: "Analysis",
    desc: "Performance view",
    href: "/analysis",
    icon: "chart" as const,
    box: "bg-blue-50 text-blue-700 border-blue-100",
  },
];

const viewTabs: {
  key: DashboardView;
  label: string;
  subtitle: string;
  icon: "chart" | "award" | "book" | "school";
  active: string;
  iconBox: string;
}[] = [
  {
    key: "marks",
    label: "Marks Entry",
    subtitle: "Subject completion",
    icon: "chart",
    active: "bg-blue-600 border-blue-600 text-white",
    iconBox: "bg-blue-50 text-blue-700",
  },
  {
    key: "students",
    label: "Students",
    subtitle: "Best and support list",
    icon: "award",
    active: "bg-violet-600 border-violet-600 text-white",
    iconBox: "bg-violet-50 text-violet-700",
  },
  {
    key: "subjects",
    label: "Subjects",
    subtitle: "Ranking and grades",
    icon: "book",
    active: "bg-emerald-600 border-emerald-600 text-white",
    iconBox: "bg-emerald-50 text-emerald-700",
  },
  {
    key: "classes",
    label: "Classes",
    subtitle: "Enrollment overview",
    icon: "school",
    active: "bg-amber-500 border-amber-500 text-white",
    iconBox: "bg-amber-50 text-amber-700",
  },
];

const pieColors = ["#2563eb", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#64748b", "#0ea5e9"];

function pct(v: number) {
  if (!Number.isFinite(v)) return "0%";
  return `${Math.round(v)}%`;
}

function clampPct(v: number) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function statusPill(status: string) {
  if (status === "Complete") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "In Progress") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-rose-50 text-rose-700 border-rose-200";
}

function completionBar(status: string) {
  if (status === "Complete") return "bg-emerald-500";
  if (status === "In Progress") return "bg-amber-500";
  return "bg-rose-500";
}

function ProgressRing({ value }: { value: number }) {
  const safe = clampPct(value);
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safe / 100) * circumference;

  return (
    <div className="relative flex h-24 w-24 items-center justify-center">
      <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke="rgba(255,255,255,0.25)"
          strokeWidth="10"
          fill="none"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke="white"
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-xl font-black text-white">{pct(safe)}</div>
        <div className="text-[10px] font-bold uppercase tracking-wide text-blue-100">Done</div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  hint,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  hint: string;
  icon: "student" | "teacher" | "chart" | "school";
  color: "blue" | "violet" | "emerald" | "amber";
}) {
  const styles = {
    blue: { top: "bg-blue-500", icon: "bg-blue-50 text-blue-700" },
    violet: { top: "bg-violet-500", icon: "bg-violet-50 text-violet-700" },
    emerald: { top: "bg-emerald-500", icon: "bg-emerald-50 text-emerald-700" },
    amber: { top: "bg-amber-500", icon: "bg-amber-50 text-amber-700" },
  }[color];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className={`absolute inset-x-0 top-0 h-1 ${styles.top}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
            {title}
          </div>
          <div className="mt-3 truncate text-2xl font-black text-slate-950">{value}</div>
          <div className="mt-1 text-xs leading-5 text-slate-500">{hint}</div>
        </div>

        <div className={`shrink-0 rounded-xl p-2.5 ${styles.icon}`}>
          <Icon name={icon} className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-700">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm">
        <Icon name="spark" className="h-5 w-5" />
      </div>
      <div className="mt-3 text-sm font-semibold text-slate-600">{message}</div>
    </div>
  );
}

function StudentRow({ student, kind }: { student: StudentRank; kind: "top" | "support" }) {
  const isSupport = kind === "support";

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={
            isSupport
              ? "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-sm font-black text-rose-700"
              : "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-sm font-black text-white"
          }
        >
          {initials(student.name)}
          <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-950 text-[10px] font-black text-white">
            {student.position}
          </div>
        </div>

        <div className="min-w-0">
          <div className="truncate text-sm font-black text-slate-950">{student.name}</div>
          <div className="text-xs text-slate-500">{student.subjectsCounted} subjects counted</div>
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div className={isSupport ? "text-lg font-black text-rose-700" : "text-lg font-black text-slate-950"}>
          {student.average}
        </div>
        <div className="text-[11px] text-slate-500">Average</div>
      </div>
    </div>
  );
}

function GradeMiniPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black ${color}`}>
      {label}: {value}
    </span>
  );
}

export default function DashboardPage() {
  const router = useRouter();

  const [role, setRole] = React.useState<string>("");
  const [view, setView] = React.useState<DashboardView>("marks");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const [stats, setStats] = React.useState<DashboardStats | null>(null);

  const [academicYearId, setAcademicYearId] = React.useState("");
  const [termId, setTermId] = React.useState("");
  const [classId, setClassId] = React.useState("");
  const [assessmentDefinitionId, setAssessmentDefinitionId] = React.useState("");

  const isAdmin = role === "ADMIN";
  const quick = isAdmin ? quickAdmin : quickTeacher;

  async function loadDashboard(params?: {
    academicYearId?: string;
    termId?: string;
    classId?: string;
    assessmentDefinitionId?: string;
  }) {
    setLoading(true);
    setError("");

    try {
      const query = new URLSearchParams();

      const y = params?.academicYearId ?? academicYearId;
      const t = params?.termId ?? termId;
      const c = params?.classId ?? classId;
      const a = params?.assessmentDefinitionId ?? assessmentDefinitionId;

      if (y) query.set("academicYearId", y);
      if (t) query.set("termId", t);
      if (c) query.set("classId", c);
      if (a) query.set("assessmentDefinitionId", a);

      const res = await fetch(`/api/dashboard/stats?${query.toString()}`, {
        cache: "no-store",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load dashboard statistics");
      }

      setStats(data);
      setRole(data.me?.role || "");
      setAcademicYearId(data.filters.selectedAcademicYearId || "");
      setTermId(data.filters.selectedTermId || "");
      setClassId(data.filters.selectedClassId || "");
      setAssessmentDefinitionId(data.filters.selectedAssessmentDefinitionId || "");
    } catch (e: any) {
      setError(e?.message || "Failed to load dashboard statistics");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      const me = await apiGetMe();

      if (cancelled) return;

      if (!me) {
        router.replace("/login");
        return;
      }

      setRole(me.role);
      await loadDashboard();
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const classData =
    stats?.classEnrollment.map((c) => ({
      name: c.className,
      students: c.students,
    })) ?? [];

  const completedSubjects = stats?.marksStatus.filter((s) => s.status === "Complete").length ?? 0;
  const pendingSubjects = stats?.marksStatus.filter((s) => s.status === "Not Started").length ?? 0;
  const inProgressSubjects = stats?.marksStatus.filter((s) => s.status === "In Progress").length ?? 0;

  return (
    <div className="space-y-5 bg-slate-50/40 text-slate-900">
      <div className="relative overflow-hidden rounded-2xl border border-blue-700 bg-blue-700 p-5 text-white shadow-md sm:p-6">
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.5fr_0.8fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white">
              <Icon name="spark" className="h-4 w-4 text-white" />
              {isAdmin ? "Administrator Dashboard" : "Teacher Dashboard"}
            </div>

            <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-4xl">
              Welcome back{stats?.me?.fullName ? `, ${stats.me.fullName.split(" ")[0]}` : ""}
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-blue-50">
              View marks entry progress, learner ranking, subject performance, and class-level
              activity from one clean dashboard.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {quick.map((q) => (
                <button
                  key={q.title}
                  onClick={() => router.push(q.href)}
                  className="group rounded-xl border border-white/20 bg-white p-3 text-left text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className={`mb-3 inline-flex rounded-xl border p-2 ${q.box}`}>
                    <Icon name={q.icon} className="h-4 w-4" />
                  </div>
                  <div className="text-sm font-black text-slate-950">{q.title}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{q.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/20 bg-white/10 p-4 text-white">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-blue-100">
                  Marks Completion
                </div>
                <div className="mt-2 text-2xl font-black text-white">
                  {loading ? "..." : pct(stats?.summary.overallMarksCompletion ?? 0)}
                </div>
                <div className="mt-1 text-xs text-blue-100">
                  {stats?.summary.activeAssessmentName || "Selected assessment"}
                </div>
              </div>

              <ProgressRing value={stats?.summary.overallMarksCompletion ?? 0} />
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-white/15 p-3">
                <div className="text-xl font-black text-white">{completedSubjects}</div>
                <div className="text-[11px] text-blue-100">Complete</div>
              </div>
              <div className="rounded-xl bg-white/15 p-3">
                <div className="text-xl font-black text-white">{inProgressSubjects}</div>
                <div className="text-[11px] text-blue-100">Progress</div>
              </div>
              <div className="rounded-xl bg-white/15 p-3">
                <div className="text-xl font-black text-white">{pendingSubjects}</div>
                <div className="text-[11px] text-blue-100">Pending</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Students"
          value={loading ? "..." : stats?.summary.studentsCount ?? 0}
          hint="Active learners in the system"
          icon="student"
          color="blue"
        />

        <StatCard
          title="Teachers"
          value={loading ? "..." : stats?.summary.teachersCount ?? 0}
          hint="Active teaching staff"
          icon="teacher"
          color="violet"
        />

        <StatCard
          title="Active Class"
          value={loading ? "..." : stats?.summary.activeClassName || "-"}
          hint={`Term: ${stats?.summary.activeTermName || "-"}`}
          icon="school"
          color="emerald"
        />

        <StatCard
          title="Completion"
          value={loading ? "..." : pct(stats?.summary.overallMarksCompletion ?? 0)}
          hint={`Assessment: ${stats?.summary.activeAssessmentName || "-"}`}
          icon="chart"
          color="amber"
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-sm font-black text-slate-950">Dashboard Filters</div>
            <div className="mt-1 text-xs text-slate-500">
              Select the academic scope for the statistics below.
            </div>
          </div>

          <button
            onClick={() => loadDashboard()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-950 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800"
          >
            <Icon name="refresh" className="h-4 w-4" />
            Refresh
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <Select
            value={academicYearId}
            onChange={(e) => {
              const value = e.target.value;
              setAcademicYearId(value);
              loadDashboard({ academicYearId: value });
            }}
            className="h-11 rounded-xl border-slate-200 bg-slate-50 text-slate-900"
          >
            {stats?.filters.academicYears.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </Select>

          <Select
            value={termId}
            onChange={(e) => {
              const value = e.target.value;
              setTermId(value);
              loadDashboard({ termId: value });
            }}
            className="h-11 rounded-xl border-slate-200 bg-slate-50 text-slate-900"
          >
            {stats?.filters.terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>

          <Select
            value={classId}
            onChange={(e) => {
              const value = e.target.value;
              setClassId(value);
              loadDashboard({ classId: value });
            }}
            className="h-11 rounded-xl border-slate-200 bg-slate-50 text-slate-900"
          >
            {stats?.filters.classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>

          <Select
            value={assessmentDefinitionId}
            onChange={(e) => {
              const value = e.target.value;
              setAssessmentDefinitionId(value);
              loadDashboard({ assessmentDefinitionId: value });
            }}
            className="h-11 rounded-xl border-slate-200 bg-slate-50 text-slate-900"
          >
            {stats?.filters.assessments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {viewTabs.map((tab) => {
          const active = view === tab.key;

          return (
            <button
              key={tab.key}
              onClick={() => setView(tab.key)}
              className={[
                "rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
                active ? tab.active : "border-slate-200 bg-white text-slate-950",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div
                  className={[
                    "rounded-xl p-2.5",
                    active ? "bg-white/20 text-white" : tab.iconBox,
                  ].join(" ")}
                >
                  <Icon name={tab.icon} className="h-5 w-5" />
                </div>

                {active ? (
                  <span className="rounded-full bg-white/20 px-2 py-1 text-[10px] font-bold text-white">
                    Active
                  </span>
                ) : null}
              </div>

              <div className={active ? "mt-4 text-sm font-black text-white" : "mt-4 text-sm font-black text-slate-950"}>
                {tab.label}
              </div>
              <div className={active ? "mt-1 text-xs text-white/85" : "mt-1 text-xs text-slate-500"}>
                {tab.subtitle}
              </div>
            </button>
          );
        })}
      </div>

      {view === "marks" ? (
        <Card className="overflow-hidden rounded-2xl border-slate-200 bg-white text-slate-900 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-blue-50 p-2 text-blue-700">
                <Icon name="chart" className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-950">Marks Entry Status</h2>
                <p className="text-xs text-slate-500">
                  Each subject shows how many learner-subject entries are fully captured.
                </p>
              </div>
            </div>

            <Badge className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-700">
              {pct(stats?.summary.overallMarksCompletion ?? 0)}
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
            {stats?.marksStatus.length ? (
              stats.marksStatus.map((s) => (
                <div
                  key={s.subjectId}
                  className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-slate-950">{s.subjectName}</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {s.enteredEntries}/{s.expectedEntries} complete
                        {typeof s.partialEntries === "number" && s.partialEntries > 0
                          ? ` • ${s.partialEntries} partial`
                          : ""}
                      </div>
                    </div>

                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusPill(s.status)}`}
                    >
                      {s.status}
                    </span>
                  </div>

                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full rounded-full ${completionBar(s.status)}`}
                      style={{ width: `${clampPct(s.completion)}%` }}
                    />
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px] font-medium text-slate-500">
                    <span>{s.enrolledStudents} students</span>
                    <span>{pct(s.completion)}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="md:col-span-2 xl:col-span-3">
                <EmptyState message="No marks-entry data found for the selected filters." />
              </div>
            )}
          </div>
        </Card>
      ) : null}

      {view === "students" ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card className="overflow-hidden rounded-2xl border-slate-200 bg-white text-slate-900 shadow-sm">
            <CardHeader title="Best 10 Students" subtitle="Top learners by computed average." />

            <div className="space-y-3 p-5 pt-0">
              {stats?.bestStudents.length ? (
                stats.bestStudents.slice(0, 10).map((s) => (
                  <StudentRow key={s.studentId} student={s} kind="top" />
                ))
              ) : (
                <EmptyState message="No student ranking data found." />
              )}
            </div>
          </Card>

          <Card className="overflow-hidden rounded-2xl border-slate-200 bg-white text-slate-900 shadow-sm">
            <CardHeader title="Last 10 Students" subtitle="Learners who may need academic support." />

            <div className="space-y-3 p-5 pt-0">
              {stats?.bottomStudents.length ? (
                stats.bottomStudents.slice(0, 10).map((s) => (
                  <StudentRow key={s.studentId} student={s} kind="support" />
                ))
              ) : (
                <EmptyState message="No academic support list found." />
              )}
            </div>
          </Card>
        </div>
      ) : null}

      {view === "subjects" ? (
        <Card className="overflow-hidden rounded-2xl border-slate-200 bg-white text-slate-900 shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
                <Icon name="book" className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-950">Subject Ranking</h2>
                <p className="text-xs text-slate-500">
                  Subjects ranked by average score. A and B counts are shown on each subject.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
            {stats?.bestSubjects.length ? (
              stats.bestSubjects.map((s, idx) => (
                <div
                  key={s.subjectId}
                  className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-sm font-black text-emerald-700">
                        {idx + 1}
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-slate-950">{s.subjectName}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {s.studentsCounted} students counted
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-lg font-black text-slate-950">{s.average}</div>
                      <div className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-700">
                        {s.gradeHint}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <GradeMiniPill label="A" value={s.gradeCounts?.A ?? 0} color="bg-emerald-50 text-emerald-700" />
                    <GradeMiniPill label="B" value={s.gradeCounts?.B ?? 0} color="bg-blue-50 text-blue-700" />
                    <GradeMiniPill label="C" value={s.gradeCounts?.C ?? 0} color="bg-slate-100 text-slate-700" />
                    <GradeMiniPill label="D" value={s.gradeCounts?.D ?? 0} color="bg-amber-50 text-amber-700" />
                    <GradeMiniPill label="E" value={s.gradeCounts?.E ?? 0} color="bg-rose-50 text-rose-700" />
                    {typeof s.gradeCounts?.O === "number" ? (
                      <GradeMiniPill label="O" value={s.gradeCounts.O} color="bg-orange-50 text-orange-700" />
                    ) : null}
                    {typeof s.gradeCounts?.F === "number" ? (
                      <GradeMiniPill label="F" value={s.gradeCounts.F} color="bg-red-50 text-red-700" />
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <div className="md:col-span-2 xl:col-span-3">
                <EmptyState message="No subject ranking data found." />
              </div>
            )}
          </div>
        </Card>
      ) : null}

      {view === "classes" ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <Card className="overflow-hidden rounded-2xl border-slate-200 bg-white text-slate-900 shadow-sm xl:col-span-3">
            <div className="border-b border-slate-100 p-5">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-amber-50 p-2 text-amber-700">
                  <Icon name="school" className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-950">Enrollment by Class</h2>
                  <p className="text-xs text-slate-500">Active learners distributed across classes.</p>
                </div>
              </div>
            </div>

            <div className="h-80 p-5">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#64748b" }} />
                  <Tooltip cursor={{ fill: "#f8fafc" }} />
                  <Bar dataKey="students" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="overflow-hidden rounded-2xl border-slate-200 bg-white text-slate-900 shadow-sm xl:col-span-2">
            <CardHeader title="Grade Distribution" subtitle="Based on computed student averages." />

            <div className="h-72 p-5 pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats?.gradeDistribution ?? []}
                    dataKey="count"
                    nameKey="grade"
                    outerRadius={78}
                    innerRadius={44}
                    paddingAngle={4}
                    label
                  >
                    {(stats?.gradeDistribution ?? []).map((entry, index) => (
                      <Cell key={entry.grade} fill={pieColors[index % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
