import "server-only";

import { prisma } from "@/lib/prisma";

export type ReportType = "O_MID" | "O_EOT" | "A_MID" | "A_EOT";

export type GradeDescriptorRow = {
  id?: string;
  grade: string;
  achievementLevel: string;
  minMark: number;
  maxMark: number;
  descriptor: string;
  order?: number;
};

export type SchemeComponent = {
  assessmentId: string;
  label: string;
  enterOutOf: number;
  weightOutOf: number;
  order?: number;
  componentId?: string | null;
};

export type SchemeApiRow = {
  id: string;
  reportType: string;
  name: string;
  components: SchemeComponent[];
  gradeDescriptors: GradeDescriptorRow[];
};

export type ComponentScoreRow = {
  assessmentId: string;
  label: string;
  shortLabel: string;
  enterOutOf: number;
  weightOutOf: number;
  rawScore: number | null;
  weightedScore: number | null;
};

export type PaperReportRow = {
  paperId: string;
  paperName: string;
  paperCode?: string | null;
  componentScores: ComponentScoreRow[];
  total: number | null;
};

export type SubjectReportRow = {
  subjectId: string;
  subjectName: string;
  componentScores: ComponentScoreRow[];
  total: number | null;
  grade: string;
  teacherInitials: string;
  teacherComment: string;
  papers?: PaperReportRow[];
  isPaperBased?: boolean;
};

export type StudentReportPayload = {
  student: {
    id: string;
    firstName: string;
    otherNames?: string | null;
    lastName: string;
    admissionNo?: string | null;
    studentNo?: string | null;
  };
  scheme: SchemeApiRow;
  rows: SubjectReportRow[];
  gradeDescriptors: GradeDescriptorRow[];
  activeEnrollment: {
    id: string;
    classId: string;
    streamId?: string | null;
    class?: { id: string; name: string; level?: string | null } | null;
    stream?: { id: string; name: string } | null;
  };
  academicYearName: string;
  termName: string;
  headTeacherComment: string;
  reportType: ReportType;
  overallAverage: number | null;
  overallGrade: string;
  totalPoints: number | null;
  bestRow: SubjectReportRow | null;
  lowestRow: SubjectReportRow | null;
};

export const DEFAULT_O_LEVEL_DESCRIPTORS: GradeDescriptorRow[] = [
  { grade: "A", achievementLevel: "Exceptional", minMark: 85, maxMark: 100, descriptor: "Demonstrates an extraordinary level of competency by applying innovatively and creatively the acquired knowledge and skills in real-life situations.", order: 1 },
  { grade: "B", achievementLevel: "Outstanding", minMark: 70, maxMark: 84.99, descriptor: "Demonstrates a high level of competency by applying the acquired knowledge and skills in real-life situations.", order: 2 },
  { grade: "C", achievementLevel: "Satisfactory", minMark: 50, maxMark: 69.99, descriptor: "Demonstrates an adequate level of competency by applying the acquired knowledge and skills in real-life situations.", order: 3 },
  { grade: "D", achievementLevel: "Basic", minMark: 25, maxMark: 49.99, descriptor: "Demonstrates a minimum level of competency in applying the acquired knowledge and skills in real-life situations.", order: 4 },
  { grade: "E", achievementLevel: "Elementary", minMark: 0, maxMark: 24.99, descriptor: "Demonstrates below the basic level of competency in applying the acquired knowledge and skills in real-life situations.", order: 5 },
];

export const DEFAULT_A_LEVEL_DESCRIPTORS: GradeDescriptorRow[] = [
  // A-Level reports use the same broad A-E scale as O-Level reports.
  // Points are handled separately: principal subjects A=5 ... E=1,
  // while GP/Subsidiary Math/Subsidiary ICT can contribute a maximum of 1 point.
  { grade: "A", achievementLevel: "Exceptional", minMark: 85, maxMark: 100, descriptor: "Demonstrates an exceptional level of understanding and application across the subject requirements.", order: 1 },
  { grade: "B", achievementLevel: "Outstanding", minMark: 70, maxMark: 84.99, descriptor: "Demonstrates a strong level of understanding with confident application of knowledge and skills.", order: 2 },
  { grade: "C", achievementLevel: "Satisfactory", minMark: 50, maxMark: 69.99, descriptor: "Demonstrates adequate understanding and acceptable application of the required knowledge and skills.", order: 3 },
  { grade: "D", achievementLevel: "Basic", minMark: 25, maxMark: 49.99, descriptor: "Demonstrates basic understanding and requires further support to improve application and consistency.", order: 4 },
  { grade: "E", achievementLevel: "Elementary", minMark: 0, maxMark: 24.99, descriptor: "Demonstrates elementary achievement and needs significant improvement in knowledge and skill application.", order: 5 },
];

export function getEffectiveGradeDescriptors(reportType: ReportType | string, schemeDescriptors?: GradeDescriptorRow[]) {
  if (reportType === "A_MID" || reportType === "A_EOT") return DEFAULT_A_LEVEL_DESCRIPTORS;
  return Array.isArray(schemeDescriptors) && schemeDescriptors.length > 0 ? schemeDescriptors : DEFAULT_O_LEVEL_DESCRIPTORS;
}

export function round2(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

export function roundHalfUpToWhole(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n + 1e-6);
}

export function formatMark(value: number | null) {
  if (value === null || Number.isNaN(Number(value))) return "—";
  const s = Number(value).toFixed(2);
  return s.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

export function formatPdfMark(value: number | null, reportType: ReportType | string) {
  if (value === null || Number.isNaN(Number(value))) return "—";
  if (reportType === "O_EOT" || reportType === "A_EOT") {
    const rounded = roundHalfUpToWhole(value);
    return rounded === null ? "—" : String(rounded);
  }
  return formatMark(value);
}

export function gradeScore(score: number | null, descriptors: GradeDescriptorRow[]) {
  if (score === null) return "—";
  const n = Number(score);
  if (!Number.isFinite(n)) return "—";

  const sorted = [...(descriptors || [])].sort((a, b) => Number(a.minMark) - Number(b.minMark));
  const epsilon = 0.000001;
  const matches = sorted.filter((d) => n + epsilon >= Number(d.minMark) && n - epsilon <= Number(d.maxMark));
  const found = matches.sort((a, b) => Number(b.minMark) - Number(a.minMark))[0];
  if (found?.grade) return found.grade;

  if (sorted.length > 0) {
    if (n < Number(sorted[0].minMark)) return sorted[0].grade || "—";
    if (n > Number(sorted[sorted.length - 1].maxMark)) return sorted[sorted.length - 1].grade || "—";
  }
  return "—";
}


export function schemeMaximum(scheme: Pick<SchemeApiRow, "components"> | null | undefined) {
  const components = scheme?.components || [];
  return components.reduce((sum, c) => sum + (Number(c.weightOutOf ?? 0) || 0), 0);
}

function normalizeSubjectName(name: string) {
  return String(name || "").trim().toUpperCase().replace(/\s+/g, " ");
}

export function isTemporarySubsidiarySubject(subjectName: string) {
  const n = normalizeSubjectName(subjectName);
  return n === "GENERAL PAPER" || n === "GP" || n === "SUBSIDIARY MATHEMATICS" || n === "SUBSIDIARY MATH" || n === "SUB MATH" || n === "SUB MATHS" || n === "INFORMATION AND COMMUNICATION TECHNOLOGY" || n === "ICT";
}

export function gradeSubjectScore(subjectName: string, score: number | null, descriptors: GradeDescriptorRow[]) {
  // Subsidiary subjects use the same displayed A-E grade scale on the report,
  // but their contribution to the total points is capped separately in getALevelPoints().
  return gradeScore(score, descriptors);
}

export function getALevelPoints(subjectName: string, grade: string) {
  const g = String(grade || "").trim().toUpperCase();

  if (isTemporarySubsidiarySubject(subjectName)) {
    return ["A", "B", "C", "D", "E"].includes(g) ? 1 : 0;
  }

  switch (g) {
    case "A": return 5;
    case "B": return 4;
    case "C": return 3;
    case "D": return 2;
    case "E": return 1;
    default: return 0;
  }
}

export function averageRawNumbers(values: Array<number | null | undefined>) {
  const nums = values.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  if (nums.length === 0) return null;
  return nums.reduce((sum, v) => sum + v, 0) / nums.length;
}

export function sumNumbers(values: Array<number | null | undefined>) {
  const nums = values.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  if (nums.length === 0) return null;
  return round2(nums.reduce((sum, v) => sum + v, 0));
}

export function extractTermNumber(termName: string, fallback = "1") {
  const match = String(termName || "").match(/(\d+)/);
  return match?.[1] || fallback;
}

export function getReportHeading(reportType: string, termName: string, academicYearName: string) {
  const termNo = extractTermNumber(termName, "1");
  const year = String(academicYearName || "").trim() || "—";
  if (reportType === "O_MID" || reportType === "A_MID") return `MIDTERM ${termNo} ACADEMIC REPORT CARD ${year}`;
  if (reportType === "O_EOT" || reportType === "A_EOT") return `END OF TERM ${termNo} ACADEMIC REPORT CARD ${year}`;
  return `ACADEMIC REPORT CARD ${year}`;
}

export function toShortAssessmentLabel(label: string, index: number, reportType?: ReportType) {
  if (reportType === "A_EOT") {
    if (index === 0) return "MOT";
    if (index === 1) return "EOT";
    if (index === 2) return "EXAM";
  }
  if (reportType === "O_EOT") {
    if (index === 0) return "CA 1";
    if (index === 1) return "CA 2";
    if (index === 2) return "EXAM";
  }
  const clean = String(label || "").trim().toUpperCase();
  const caMatch = clean.match(/CA\s*([0-9]+)/i);
  if (caMatch) return `CA ${caMatch[1]}`;
  const contMatch = clean.match(/CONTINUOUS\s*ASSESSMENT\s*([0-9]+)/i);
  if (contMatch) return `CA ${contMatch[1]}`;
  if (clean.includes("EXAM") || clean.includes("EOT") || clean.includes("FINAL")) return "EXAM";
  return `CA ${index + 1}`;
}

function paperDisplayName(paper: { name?: string | null; code?: string | null }) {
  const code = String(paper.code || "").trim();
  const name = String(paper.name || "").trim();
  return code || name || "Paper";
}

function modelFlags() {
  const p: any = prisma as any;
  return {
    hasGradeDescriptor: !!p.reportSchemeGradeDescriptor,
  };
}

async function loadScheme(reportType: ReportType): Promise<SchemeApiRow> {
  const p: any = prisma as any;
  const { hasGradeDescriptor } = modelFlags();

  const scheme = await p.reportScheme.findUnique({
    where: { reportType },
    select: {
      id: true,
      reportType: true,
      name: true,
      components: {
        orderBy: [{ order: "asc" }],
        select: {
          assessmentDefinitionId: true,
          enterOutOf: true,
          weightOutOf: true,
          order: true,
          assessment: { select: { id: true, name: true } },
        },
      },
      ...(hasGradeDescriptor ? {
        gradeDescriptors: {
          orderBy: [{ order: "asc" }],
          select: { id: true, grade: true, achievementLevel: true, minMark: true, maxMark: true, descriptor: true, order: true },
        },
      } : {}),
    },
  });

  if (!scheme) throw new Error("No report scheme found for this report type.");

  const components: SchemeComponent[] = await Promise.all((scheme.components || []).map(async (c: any, idx: number) => {
    const component = await prisma.assessmentComponent.findFirst({
      where: { definitionId: c.assessmentDefinitionId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    return {
      assessmentId: c.assessmentDefinitionId,
      label: c?.assessment?.name?.trim() || `Assessment ${idx + 1}`,
      enterOutOf: Number(c.enterOutOf ?? 100),
      weightOutOf: Number(c.weightOutOf ?? 0),
      order: c.order ?? idx + 1,
      componentId: component?.id ?? null,
    };
  }));

  if (components.length === 0) throw new Error("No report scheme components found for this report type.");

  const rawDescriptors = Array.isArray((scheme as any).gradeDescriptors) ? (scheme as any).gradeDescriptors : [];
  const descriptors = getEffectiveGradeDescriptors(reportType, rawDescriptors.map((d: any, idx: number) => ({
    id: d.id,
    grade: String(d.grade || "").trim().toUpperCase(),
    achievementLevel: String(d.achievementLevel || "").trim(),
    minMark: Number(d.minMark),
    maxMark: Number(d.maxMark),
    descriptor: String(d.descriptor || "").trim(),
    order: Number(d.order ?? idx + 1),
  })));

  return { id: scheme.id, reportType: scheme.reportType, name: scheme.name, components, gradeDescriptors: descriptors };
}

function normalizeRemarkGrade(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

function inRemarkRange(score: number, minScore: unknown, maxScore: unknown) {
  const min = Number(minScore);
  const max = Number(maxScore);
  if (!Number.isFinite(score) || !Number.isFinite(min) || !Number.isFinite(max)) return false;
  const epsilon = 0.000001;
  return score + epsilon >= min && score - epsilon <= max;
}

async function pickRemarkFromDb(params: {
  target: "TEACHER" | "HEADTEACHER";
  reportType: ReportType;
  grade: string;
  score: number | null;
  schemeMax?: number;
}) {
  const level = params.reportType.startsWith("A_") ? "A_LEVEL" : "O_LEVEL";
  const cleanGrade = normalizeRemarkGrade(params.grade);
  const rawScore = Number(params.score);
  const hasScore = params.score !== null && Number.isFinite(rawScore);
  const schemeMax = Number(params.schemeMax ?? 0);

  const scoreCandidates: number[] = [];
  if (hasScore) {
    scoreCandidates.push(rawScore, Math.floor(rawScore), Math.round(rawScore));

    // Some schools keep remark bands on a 0–100 scale even when the active
    // report scheme total is smaller, for example midterm out of 3. Try both
    // the scheme-scaled score and its percentage equivalent.
    if (Number.isFinite(schemeMax) && schemeMax > 0 && Math.abs(schemeMax - 100) > 0.000001) {
      const pct = (rawScore / schemeMax) * 100;
      if (Number.isFinite(pct)) {
        scoreCandidates.push(pct, Math.floor(pct), Math.round(pct));
      }
    }
  }

  const uniqueScores = Array.from(
    new Set(scoreCandidates.filter((x) => Number.isFinite(x)).map((x) => Number(x.toFixed(6))))
  );

  const rules = await prisma.remarkRule.findMany({
    where: {
      type: params.target as any,
      level: level as any,
      isActive: true,
    },
    orderBy: [{ grade: "desc" }, { minScore: "desc" }, { createdAt: "desc" }],
    select: {
      grade: true,
      minScore: true,
      maxScore: true,
      text: true,
    },
  });

  const activeRules = rules
    .map((rule) => ({
      ...rule,
      cleanGrade: normalizeRemarkGrade(rule.grade),
      cleanText: String(rule.text || "").trim(),
    }))
    .filter((rule) => rule.cleanText);

  if (!activeRules.length) return "—";

  // First prefer a grade-specific remark, which matches how the web report
  // picks remarks from the store using the computed grade.
  if (cleanGrade && cleanGrade !== "—") {
    const gradeRules = activeRules.filter((rule) => rule.cleanGrade === cleanGrade);

    const gradeAndScoreRule = gradeRules.find((rule) =>
      uniqueScores.some((score) => inRemarkRange(score, rule.minScore, rule.maxScore))
    );
    if (gradeAndScoreRule?.cleanText) return gradeAndScoreRule.cleanText;

    if (gradeRules[0]?.cleanText) return gradeRules[0].cleanText;
  }

  // Then fall back to score-band remarks where no grade was attached.
  const scoreRule = activeRules.find((rule) =>
    !rule.cleanGrade && uniqueScores.some((score) => inRemarkRange(score, rule.minScore, rule.maxScore))
  );
  if (scoreRule?.cleanText) return scoreRule.cleanText;

  return "—";
}

export async function canGenerateClassReports(user: { id: string; role: string }, classId: string) {
  if (user.role === "ADMIN") return true;
  const assignment = await prisma.teachingAssignment.findFirst({
    where: { userId: user.id, classId },
    select: { id: true },
  });
  return !!assignment;
}

export async function listClassStudentIds(params: { classId: string; academicYearId: string; q?: string }) {
  const q = String(params.q || "").trim();
  const students = await prisma.student.findMany({
    where: {
      isActive: true,
      ...(q ? {
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { otherNames: { contains: q, mode: "insensitive" } },
          { admissionNo: { contains: q, mode: "insensitive" } },
        ],
      } : {}),
      enrollments: {
        some: { academicYearId: params.academicYearId, classId: params.classId, isActive: true },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true },
    take: 500,
  });
  return students.map((s) => s.id);
}

export async function buildStudentReportPayload(params: {
  studentId: string;
  academicYearId: string;
  termId: string;
  reportType: ReportType;
}): Promise<StudentReportPayload> {
  const { studentId, academicYearId, termId, reportType } = params;
  const isALevelReport = reportType === "A_MID" || reportType === "A_EOT";
  const scheme = await loadScheme(reportType);
  const schemeMax = scheme.components.reduce(
    (sum, component) => sum + (Number(component.weightOutOf ?? 0) || 0),
    0,
  );

  const [student, academicYear, term] = await Promise.all([
    prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        firstName: true,
        otherNames: true,
        lastName: true,
        admissionNo: true,
        enrollments: {
          where: { academicYearId, isActive: true },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            classId: true,
            streamId: true,
            class: { select: { id: true, name: true, level: true } },
            stream: { select: { id: true, name: true } },
            subjects: {
              where: { subject: { isActive: true } },
              select: { subjectId: true, subject: { select: { id: true, name: true, level: true } } },
            },
          },
        },
      },
    }),
    prisma.academicYear.findUnique({ where: { id: academicYearId }, select: { name: true } }),
    prisma.term.findUnique({ where: { id: termId }, select: { name: true } }),
  ]);

  if (!student) throw new Error("Student not found.");
  const activeEnrollment = student.enrollments?.[0] || null;
  if (!activeEnrollment) throw new Error("Student has no active enrollment.");

  const enrolledSubjects = (activeEnrollment.subjects || [])
    .map((s) => ({ subjectId: s.subjectId, subjectName: s.subject?.name || "Unnamed Subject" }))
    .filter((s, idx, arr) => s.subjectId && arr.findIndex((x) => x.subjectId === s.subjectId) === idx);

  const assignments = await prisma.teachingAssignment.findMany({
    where: { classId: activeEnrollment.classId, ...(activeEnrollment.streamId ? { streamId: activeEnrollment.streamId } : {}) },
    select: { subjectId: true, isClassTeacher: true, user: { select: { initials: true } } },
  });
  const teacherMap = assignments.filter((a) => !a.isClassTeacher && a.subjectId).reduce((acc: Record<string, string>, a) => {
    if (a.subjectId && !acc[a.subjectId]) acc[a.subjectId] = a.user?.initials || "—";
    return acc;
  }, {});

  async function fetchComponentScore(subjectId: string, component: SchemeComponent, index: number, subjectPaperId?: string | null): Promise<ComponentScoreRow> {
    const mark = component.componentId
      ? await prisma.markEntry.findFirst({
          where: {
            academicYearId,
            termId,
            enrollmentId: activeEnrollment.id,
            studentId,
            subjectId,
            subjectPaperId: subjectPaperId || null,
            componentId: component.componentId,
          },
          select: { scoreRaw: true },
        })
      : null;

    const rawScore = round2(mark?.scoreRaw);
    const weightedScore = rawScore === null ? null : round2((rawScore * component.weightOutOf) / Math.max(component.enterOutOf, 0.01));
    return {
      assessmentId: component.assessmentId,
      label: component.label,
      shortLabel: toShortAssessmentLabel(component.label, index, reportType),
      enterOutOf: component.enterOutOf,
      weightOutOf: component.weightOutOf,
      rawScore,
      weightedScore,
    };
  }

  const provisionalRows: Omit<SubjectReportRow, "teacherComment">[] = [];

  for (const subject of enrolledSubjects) {
    if (isALevelReport) {
      const subjectPapers = await prisma.subjectPaper.findMany({
        where: { subjectId: subject.subjectId, isActive: true },
        orderBy: [{ order: "asc" }, { name: "asc" }],
        select: { id: true, subjectId: true, name: true, code: true, order: true },
      });

      if (subjectPapers.length > 0) {
        const paperRows: PaperReportRow[] = await Promise.all(subjectPapers.map(async (paper) => {
          const componentScores = await Promise.all(scheme.components.map((component, i) => fetchComponentScore(subject.subjectId, component, i, paper.id)));
          const total = sumNumbers(componentScores.map((c) => c.weightedScore));
          return { paperId: paper.id, paperName: paperDisplayName(paper), paperCode: paper.code || null, componentScores, total };
        }));

        // Use every active paper in the subject average. If a paper has no marks,
        // the report still displays dashes for that paper, but the paper contributes 0
        // to the subject average instead of being skipped.
        const paperTotalsForAverage = paperRows.map((p) => {
          if (reportType === "A_EOT") return roundHalfUpToWhole(p.total) ?? 0;
          return typeof p.total === "number" && Number.isFinite(p.total) ? p.total : 0;
        });
        const subjectTotalRaw = paperTotalsForAverage.length
          ? paperTotalsForAverage.reduce((sum, value) => sum + value, 0) / paperTotalsForAverage.length
          : null;
        const subjectTotal = reportType === "A_EOT" ? roundHalfUpToWhole(subjectTotalRaw) : subjectTotalRaw === null ? null : round2(subjectTotalRaw);
        const subjectGrade = gradeSubjectScore(subject.subjectName, subjectTotal, scheme.gradeDescriptors);

        provisionalRows.push({
          subjectId: subject.subjectId,
          subjectName: subject.subjectName,
          componentScores: [],
          papers: paperRows,
          isPaperBased: true,
          total: subjectTotal,
          grade: subjectGrade,
          teacherInitials: teacherMap[subject.subjectId] || "—",
        });
        continue;
      }
    }

    const componentScores = await Promise.all(scheme.components.map((component, i) => fetchComponentScore(subject.subjectId, component, i)));
    const totalRaw = sumNumbers(componentScores.map((c) => c.weightedScore));
    const total = reportType === "A_EOT" && totalRaw !== null ? roundHalfUpToWhole(totalRaw) : totalRaw;
    provisionalRows.push({
      subjectId: subject.subjectId,
      subjectName: subject.subjectName,
      componentScores,
      total,
      grade: gradeSubjectScore(subject.subjectName, total, scheme.gradeDescriptors),
      teacherInitials: teacherMap[subject.subjectId] || "—",
      papers: [],
      isPaperBased: false,
    });
  }

  // Overall average is based on all enrolled subjects. Missing subject totals are
  // displayed as dashes in the table, but count as 0 in the final average.
  const subjectTotalsForAverage = provisionalRows.map((r) =>
    typeof r.total === "number" && Number.isFinite(r.total) ? r.total : 0,
  );
  const overallAverage = subjectTotalsForAverage.length > 0
    ? round2(subjectTotalsForAverage.reduce((sum, v) => sum + v, 0) / subjectTotalsForAverage.length)
    : null;
  const overallGrade = gradeScore(overallAverage, scheme.gradeDescriptors);

  const rows: SubjectReportRow[] = [];
  for (const row of provisionalRows) {
    const comment = await pickRemarkFromDb({
      target: "TEACHER",
      reportType,
      grade: row.grade,
      score: row.total,
      schemeMax,
    });
    rows.push({ ...row, teacherComment: comment });
  }

  const headTeacherComment = await pickRemarkFromDb({
    target: "HEADTEACHER",
    reportType,
    grade: overallGrade,
    score: overallAverage,
    schemeMax,
  });
  const totalPoints = isALevelReport ? rows.reduce((sum, row) => sum + getALevelPoints(row.subjectName, row.grade), 0) : null;
  const bestRow = [...rows].sort((a, b) => ((b.total ?? 0) as number) - ((a.total ?? 0) as number))[0] || null;
  const lowestRow = [...rows].sort((a, b) => ((a.total ?? 0) as number) - ((b.total ?? 0) as number))[0] || null;

  return {
    student: {
      id: student.id,
      firstName: student.firstName,
      otherNames: student.otherNames,
      lastName: student.lastName,
      admissionNo: student.admissionNo,
      studentNo: student.admissionNo,
    },
    scheme,
    rows,
    gradeDescriptors: scheme.gradeDescriptors,
    activeEnrollment,
    academicYearName: academicYear?.name || academicYearId,
    termName: term?.name || termId,
    headTeacherComment,
    reportType,
    overallAverage,
    overallGrade,
    totalPoints,
    bestRow,
    lowestRow,
  };
}
