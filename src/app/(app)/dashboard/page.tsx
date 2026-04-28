"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
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
import { Card, CardHeader, Button, Select, Badge } from "@/components/ui";

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
    completion: number;
    missingEntries: number;
    status: "Complete" | "In Progress" | "Not Started";
  }[];
  bestStudents: {
    studentId: string;
    name: string;
    admissionNo: string | null;
    average: number;
    subjectsCounted: number;
    position: number;
  }[];
  bestSubjects: {
    subjectId: string;
    subjectName: string;
    subjectCode: string | null;
    average: number;
    studentsCounted: number;
    gradeHint: string;
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
    desc: "Register new learner",
    href: "/students/new",
    icon: "student" as const,
    accent: "from-blue-500 to-cyan-400",
    bg: "bg-blue-50",
    text: "text-blue-700",
  },
  {
    title: "Students",
    desc: "View and manage",
    href: "/students",
    icon: "users" as const,
    accent: "from-violet-500 to-fuchsia-400",
    bg: "bg-violet-50",
    text: "text-violet-700",
  },
  {
    title: "Enter Marks",
    desc: "Capture scores",
    href: "/marks",
    icon: "marks" as const,
    accent: "from-emerald-500 to-teal-400",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
  },
  {
    title: "Report Cards",
    desc: "Generate reports",
    href: "/report-cards",
    icon: "report" as const,
    accent: "from-amber-500 to-orange-400",
    bg: "bg-amber-50",
    text: "text-amber-700",
  },
];

const quickTeacher = [
  {
    title: "Students",
    desc: "View learners",
    href: "/students",
    icon: "users" as const,
    accent: "from-violet-500 to-fuchsia-400",
    bg: "bg-violet-50",
    text: "text-violet-700",
  },
  {
    title: "Enter Marks",
    desc: "Capture scores",
    href: "/marks",
    icon: "marks" as const,
    accent: "from-emerald-500 to-teal-400",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
  },
  {
    title: "Analysis",
    desc: "Performance view",
    href: "/analysis",
    icon: "chart" as const,
    accent: "from-blue-500 to-cyan-400",
    bg: "bg-blue-50",
    text: "text-blue-700",
  },
];

const viewTabs: {
  key: DashboardView;
  label: string;
  subtitle: string;
  icon: "chart" | "award" | "book" | "school";
  accent: string;
}[] = [
  {
    key: "marks",
    label: "Marks Entry",
    subtitle: "Subject completion",
    icon: "chart",
    accent: "from-blue-600 to-cyan-500",
  },
  {
    key: "students",
    label: "Best Students",
    subtitle: "Top learners",
    icon: "award",
    accent: "from-violet-600 to-fuchsia-500",
  },
  {
    key: "subjects",
    label: "Best Subjects",
    subtitle: "Subject ranking",
    icon: "book",
    accent: "from-emerald-600 to-teal-500",
  },
  {
    key: "classes",
    label: "Class Overview",
    subtitle: "Enrollment spread",
    icon: "school",
    accent: "from-amber-500 to-orange-500",
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

function shortName(name: string) {
  if (!name) return "";
  if (name.length <= 12) return name;
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 6);
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
  if (status === "Complete") return "bg-gradient-to-r from-emerald-500 to-teal-400";
  if (status === "In Progress") return "bg-gradient-to-r from-amber-500 to-orange-400";
  return "bg-gradient-to-r from-rose-500 to-red-400";
}

function PremiumStatCard({
  title,
  value,
  hint,
  icon,
  accent,
  bg,
  text,
}: {
  title: string;
  value: string | number;
  hint: string;
  icon: "student" | "teacher" | "chart" | "school";
  accent: string;
  bg: string;
  text: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${accent}`} />
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-slate-100 opacity-70 transition group-hover:scale-110" />

      <div className="relative flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
            {title}
          </div>
          <div className="mt-3 text-2xl font-black tracking-tight text-slate-950">
            {value}
          </div>
          <div className="mt-1 text-xs leading-5 text-slate-500">{hint}</div>
        </div>

        <div className={`rounded-2xl ${bg} p-3 ${text}`}>
          <Icon name={icon} className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function CompletionRing({ value }: { value: number }) {
  const safe = clampPct(value);

  return (
    <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-slate-100">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(#22c55e ${safe * 3.6}deg, #e2e8f0 0deg)`,
        }}
      />
      <div className="relative flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white shadow-inner">
        <div className="text-2xl font-black text-slate-950">{pct(safe)}</div>
        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
          Done
        </div>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
        <Icon name="spark" className="h-5 w-5" />
      </div>
      <div className="mt-3 text-sm font-semibold text-slate-600">{message}</div>
    </div>
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

  const completionData =
    stats?.marksStatus.map((s) => ({
      name: shortName(s.subjectCode || s.subjectName),
      subject: s.subjectName,
      completion: s.completion,
      entered: s.enteredEntries,
      expected: s.expectedEntries,
    })) ?? [];

  const bestStudentsData =
    stats?.bestStudents.slice(0, 10).map((s) => ({
      name: s.name.split(" ")[0],
      fullName: s.name,
      average: s.average,
    })) ?? [];

  const bestSubjectsData =
    stats?.bestSubjects.slice(0, 10).map((s) => ({
      name: shortName(s.subjectCode || s.subjectName),
      subject: s.subjectName,
      average: s.average,
    })) ?? [];

  const classData =
    stats?.classEnrollment.map((c) => ({
      name: c.className,
      students: c.students,
    })) ?? [];

  const completedSubjects = stats?.marksStatus.filter((s) => s.status === "Complete").length ?? 0;
  const pendingSubjects = stats?.marksStatus.filter((s) => s.status === "Not Started").length ?? 0;
  const inProgressSubjects =
    stats?.marksStatus.filter((s) => s.status === "In Progress").length ?? 0;

  return (
    <div className="min-h-screen space-y-5 bg-slate-50/40">
      <div className="relative overflow-hidden rounded-[2rem] border border-white/30 bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 p-5 text-white shadow-xl sm:p-6">
        <div className="absolute -left-16 -top-16 h-56 w-56 rounded-full bg-blue-500/25 blur-3xl" />
        <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="absolute bottom-0 right-40 h-48 w-48 rounded-full bg-fuchsia-500/10 blur-3xl" />

        <div className="relative grid grid-cols-1 gap-6 xl:grid-cols-[1.5fr_1fr]">
          <div className="flex flex-col justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-100 backdrop-blur">
                <Icon name="spark" className="h-4 w-4 text-cyan-300" />
                {isAdmin ? "Administrator Control Centre" : "Teacher Dashboard"}
              </div>

              <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-tight sm:text-4xl">
                Welcome back{stats?.me?.fullName ? `, ${stats.me.fullName.split(" ")[0]}` : ""}
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                A live overview of marks entry, class performance, subject strength,
                top learners, and academic activity across the school.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {quick.map((q) => (
                <button
                  key={q.title}
                  onClick={() => router.push(q.href)}
                  className="group rounded-2xl border border-white/10 bg-white/10 p-3 text-left backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/15"
                >
                  <div className={`mb-3 inline-flex rounded-xl ${q.bg} p-2 ${q.text}`}>
                    <Icon name={q.icon} className="h-4 w-4" />
                  </div>
                  <div className="text-sm font-black text-white">{q.title}</div>
                  <div className="mt-0.5 text-xs text-slate-300">{q.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-white/10 p-4 backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-300">
                  Marks Completion
                </div>
                <div className="mt-2 text-3xl font-black">
                  {loading ? "..." : pct(stats?.summary.overallMarksCompletion ?? 0)}
                </div>
                <div className="mt-1 text-xs text-slate-300">
                  {stats?.summary.activeAssessmentName || "Selected assessment"}
                </div>
              </div>

              <CompletionRing value={stats?.summary.overallMarksCompletion ?? 0} />
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-white/10 p-3">
                <div className="text-xl font-black">{completedSubjects}</div>
                <div className="text-[11px] text-slate-300">Complete</div>
              </div>
              <div className="rounded-2xl bg-white/10 p-3">
                <div className="text-xl font-black">{inProgressSubjects}</div>
                <div className="text-[11px] text-slate-300">Progress</div>
              </div>
              <div className="rounded-2xl bg-white/10 p-3">
                <div className="text-xl font-black">{pendingSubjects}</div>
                <div className="text-[11px] text-slate-300">Pending</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PremiumStatCard
          title="Students"
          value={loading ? "..." : stats?.summary.studentsCount ?? 0}
          hint="Active learners in the system"
          icon="student"
          accent="from-blue-500 to-cyan-400"
          bg="bg-blue-50"
          text="text-blue-700"
        />

        <PremiumStatCard
          title="Teachers"
          value={loading ? "..." : stats?.summary.teachersCount ?? 0}
          hint="Active teaching staff"
          icon="teacher"
          accent="from-violet-500 to-fuchsia-400"
          bg="bg-violet-50"
          text="text-violet-700"
        />

        <PremiumStatCard
          title="Active Class"
          value={loading ? "..." : stats?.summary.activeClassName || "-"}
          hint={`Term: ${stats?.summary.activeTermName || "-"}`}
          icon="school"
          accent="from-emerald-500 to-teal-400"
          bg="bg-emerald-50"
          text="text-emerald-700"
        />

        <PremiumStatCard
          title="Completion"
          value={loading ? "..." : pct(stats?.summary.overallMarksCompletion ?? 0)}
          hint={`Assessment: ${stats?.summary.activeAssessmentName || "-"}`}
          icon="chart"
          accent="from-amber-500 to-orange-400"
          bg="bg-amber-50"
          text="text-amber-700"
        />
      </div>

      <div className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-sm font-black text-slate-950">Dashboard Filters</div>
            <div className="mt-1 text-xs text-slate-500">
              Select the academic scope for the statistics and visuals.
            </div>
          </div>

          <button
            onClick={() => loadDashboard()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-950 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800"
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
            className="h-11 rounded-2xl border-slate-200 bg-slate-50"
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
            className="h-11 rounded-2xl border-slate-200 bg-slate-50"
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
            className="h-11 rounded-2xl border-slate-200 bg-slate-50"
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
            className="h-11 rounded-2xl border-slate-200 bg-slate-50"
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
                "group relative overflow-hidden rounded-3xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
                active
                  ? "border-transparent bg-slate-950 text-white"
                  : "border-slate-200 bg-white text-slate-950",
              ].join(" ")}
            >
              {active ? (
                <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${tab.accent}`} />
              ) : null}

              <div className="flex items-start justify-between gap-3">
                <div
                  className={[
                    "rounded-2xl p-2.5",
                    active ? "bg-white/10 text-white" : "bg-slate-100 text-slate-700",
                  ].join(" ")}
                >
                  <Icon name={tab.icon} className="h-5 w-5" />
                </div>

                {active ? (
                  <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold text-white">
                    Active
                  </span>
                ) : null}
              </div>

              <div className="mt-4 text-sm font-black">{tab.label}</div>
              <div className={active ? "mt-1 text-xs text-slate-300" : "mt-1 text-xs text-slate-500"}>
                {tab.subtitle}
              </div>
            </button>
          );
        })}
      </div>

      {view === "marks" ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <Card className="overflow-hidden rounded-[1.75rem] border-slate-200 bg-white shadow-sm xl:col-span-3">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="rounded-2xl bg-blue-50 p-2 text-blue-700">
                    <Icon name="chart" className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-950">
                      Marks Entry Progress
                    </h2>
                    <p className="text-xs text-slate-500">
                      Subject-by-subject completion for the selected assessment.
                    </p>
                  </div>
                </div>
              </div>

              <Badge className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-700">
                {pct(stats?.summary.overallMarksCompletion ?? 0)}
              </Badge>
            </div>

            <div className="h-80 p-5">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={completionData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#64748b" }} />
                  <Tooltip
                    cursor={{ fill: "#f8fafc" }}
                    formatter={(value: any, _name: any, item: any) => [
                      `${value}%`,
                      item?.payload?.subject || "Completion",
                    ]}
                  />
                  <Bar dataKey="completion" fill="#2563eb" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="overflow-hidden rounded-[1.75rem] border-slate-200 bg-white shadow-sm xl:col-span-2">
            <CardHeader
              title="Subject Status"
              subtitle="Complete, partial, or pending mark entry."
            />

            <div className="max-h-[22rem] space-y-3 overflow-auto p-5 pt-0">
              {stats?.marksStatus.length ? (
                stats.marksStatus.map((s) => (
                  <div
                    key={s.subjectId}
                    className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-black text-slate-950">{s.subjectName}</div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {s.enteredEntries}/{s.expectedEntries} entries captured
                        </div>
                      </div>

                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusPill(
                          s.status
                        )}`}
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
                <EmptyState message="No marks-entry data found for the selected filters." />
              )}
            </div>
          </Card>
        </div>
      ) : null}

      {view === "students" ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <Card className="overflow-hidden rounded-[1.75rem] border-slate-200 bg-white shadow-sm xl:col-span-3">
            <div className="border-b border-slate-100 p-5">
              <div className="flex items-center gap-2">
                <div className="rounded-2xl bg-violet-50 p-2 text-violet-700">
                  <Icon name="award" className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-950">Top Students</h2>
                  <p className="text-xs text-slate-500">
                    Best-performing learners in the selected class.
                  </p>
                </div>
              </div>
            </div>

            <div className="h-80 p-5">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={bestStudentsData}>
                  <defs>
                    <linearGradient id="studentsFillPremium" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.42} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#64748b" }} />
                  <Tooltip
                    cursor={{ stroke: "#8b5cf6", strokeWidth: 1 }}
                    formatter={(value: any, _name: any, item: any) => [
                      value,
                      item?.payload?.fullName || "Average",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="average"
                    stroke="#8b5cf6"
                    fill="url(#studentsFillPremium)"
                    strokeWidth={3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="overflow-hidden rounded-[1.75rem] border-slate-200 bg-white shadow-sm xl:col-span-2">
            <CardHeader title="Leaderboard" subtitle="Top 10 students by average." />

            <div className="space-y-3 p-5 pt-0">
              {stats?.bestStudents.length ? (
                stats.bestStudents.slice(0, 10).map((s) => (
                  <div
                    key={s.studentId}
                    className="flex items-center justify-between rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-violet-50/40 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-600 text-sm font-black text-white shadow-sm">
                          {initials(s.name)}
                        </div>
                        <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-950 text-[10px] font-black text-white">
                          {s.position}
                        </div>
                      </div>

                      <div>
                        <div className="text-sm font-black text-slate-950">{s.name}</div>
                        <div className="text-xs text-slate-500">
                          {s.subjectsCounted} subjects counted
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-lg font-black text-slate-950">{s.average}</div>
                      <div className="text-[11px] text-slate-500">Average</div>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState message="No student ranking data found." />
              )}
            </div>
          </Card>
        </div>
      ) : null}

      {view === "subjects" ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <Card className="overflow-hidden rounded-[1.75rem] border-slate-200 bg-white shadow-sm xl:col-span-3">
            <div className="border-b border-slate-100 p-5">
              <div className="flex items-center gap-2">
                <div className="rounded-2xl bg-emerald-50 p-2 text-emerald-700">
                  <Icon name="book" className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-950">Best Subjects</h2>
                  <p className="text-xs text-slate-500">
                    Subject ranking based on computed average score.
                  </p>
                </div>
              </div>
            </div>

            <div className="h-80 p-5">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bestSubjectsData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#64748b" }} />
                  <Tooltip
                    cursor={{ fill: "#f8fafc" }}
                    formatter={(value: any, _name: any, item: any) => [
                      value,
                      item?.payload?.subject || "Average",
                    ]}
                  />
                  <Bar dataKey="average" fill="#10b981" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="overflow-hidden rounded-[1.75rem] border-slate-200 bg-white shadow-sm xl:col-span-2">
            <CardHeader title="Subject Ranking" subtitle="Average score and grade hint." />

            <div className="space-y-3 p-5 pt-0">
              {stats?.bestSubjects.length ? (
                stats.bestSubjects.slice(0, 10).map((s, idx) => (
                  <div
                    key={s.subjectId}
                    className="flex items-center justify-between rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-emerald-50/40 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-sm font-black text-emerald-700">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-950">{s.subjectName}</div>
                        <div className="text-xs text-slate-500">
                          {s.studentsCounted} students counted
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-base font-black text-slate-950">{s.average}</div>
                      <div className="mt-1 inline-flex rounded-full bg-white px-2 py-1 text-[11px] font-black text-emerald-700 shadow-sm">
                        {s.gradeHint}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState message="No subject ranking data found." />
              )}
            </div>
          </Card>
        </div>
      ) : null}

      {view === "classes" ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <Card className="overflow-hidden rounded-[1.75rem] border-slate-200 bg-white shadow-sm xl:col-span-3">
            <div className="border-b border-slate-100 p-5">
              <div className="flex items-center gap-2">
                <div className="rounded-2xl bg-amber-50 p-2 text-amber-700">
                  <Icon name="school" className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-950">Enrollment by Class</h2>
                  <p className="text-xs text-slate-500">
                    Active learners distributed across classes.
                  </p>
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
                  <Bar dataKey="students" fill="#f59e0b" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="overflow-hidden rounded-[1.75rem] border-slate-200 bg-white shadow-sm xl:col-span-2">
            <CardHeader title="Grade Distribution" subtitle="Based on computed student averages." />

            <div className="h-80 p-5 pt-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats?.gradeDistribution ?? []}
                    dataKey="count"
                    nameKey="grade"
                    outerRadius={96}
                    innerRadius={52}
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