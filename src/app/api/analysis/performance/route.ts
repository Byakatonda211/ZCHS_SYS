import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

type RoleUser = { id: string; role: string };

type GradeDescriptor = {
  grade: string;
  achievementLevel?: string;
  minMark: number;
  maxMark: number;
  order: number;
};

async function resolveClass(classId: string, className: string) {
  if (classId) {
    const byId = await prisma.class.findUnique({
      where: { id: classId },
      select: { id: true, name: true, level: true },
    });
    if (byId) return byId;
  }

  if (className) {
    const byName = await prisma.class.findFirst({
      where: { name: className },
      select: { id: true, name: true, level: true },
    });
    if (byName) return byName;
  }

  return null;
}

async function resolveAcademicYear(academicYearId: string, academicYearName: string) {
  if (academicYearId) {
    const byId = await prisma.academicYear.findUnique({
      where: { id: academicYearId },
      select: { id: true, name: true, isCurrent: true },
    });
    if (byId) return byId;
  }

  if (academicYearName) {
    const byName = await prisma.academicYear.findFirst({
      where: { name: academicYearName },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, isCurrent: true },
    });
    if (byName) return byName;
  }

  return await prisma.academicYear.findFirst({
    where: { isCurrent: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, isCurrent: true },
  });
}

async function resolveTerm(termId: string, termName: string, academicYearId?: string) {
  if (termId) {
    const byId = await prisma.term.findUnique({
      where: { id: termId },
      select: { id: true, name: true, academicYearId: true, isCurrent: true },
    });
    if (byId) return byId;
  }

  if (termName && academicYearId) {
    const byName = await prisma.term.findFirst({
      where: { name: termName, academicYearId },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, academicYearId: true, isCurrent: true },
    });
    if (byName) return byName;
  }

  return await prisma.term.findFirst({
    where: academicYearId ? { academicYearId, isCurrent: true } : { isCurrent: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, academicYearId: true, isCurrent: true },
  });
}

async function canViewMarks(user: RoleUser, classId: string, subjectId: string) {
  if (user.role === "ADMIN") return true;

  const assignments = await prisma.teachingAssignment.findMany({
    where: { userId: user.id, classId },
    select: { isClassTeacher: true, subjectId: true },
  });

  if (!assignments.length) return false;
  if (assignments.some((a) => a.isClassTeacher)) return true;
  return assignments.some((a) => a.subjectId === subjectId);
}

function round2(v: number) {
  return Math.round(v * 100) / 100;
}

const DEFAULT_AE_GRADE_DESCRIPTORS: GradeDescriptor[] = [
  { grade: "A", achievementLevel: "Exceptional", minMark: 85, maxMark: 100, order: 1 },
  { grade: "B", achievementLevel: "Outstanding", minMark: 70, maxMark: 84.99, order: 2 },
  { grade: "C", achievementLevel: "Satisfactory", minMark: 50, maxMark: 69.99, order: 3 },
  { grade: "D", achievementLevel: "Basic", minMark: 25, maxMark: 49.99, order: 4 },
  { grade: "E", achievementLevel: "Elementary", minMark: 0, maxMark: 24.99, order: 5 },
];

function normalizeGradeDescriptors(rows: any[], reportType: string): GradeDescriptor[] {
  const allowedGrades = new Set(["A", "B", "C", "D", "E"]);

  const cleaned = (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      grade: String(row.grade || "").trim().toUpperCase(),
      achievementLevel: String(row.achievementLevel || "").trim(),
      minMark: Number(row.minMark),
      maxMark: Number(row.maxMark),
      order: Number(row.order ?? 999),
    }))
    .filter(
      (row) =>
        row.grade &&
        allowedGrades.has(row.grade) &&
        Number.isFinite(row.minMark) &&
        Number.isFinite(row.maxMark)
    )
    .sort((a, b) => a.order - b.order || b.minMark - a.minMark);

  // Analysis should always use the A-E report-card scale. If the database still has
  // old O/F descriptor rows, they are intentionally ignored here.
  return cleaned.length ? cleaned : DEFAULT_AE_GRADE_DESCRIPTORS;
}

function gradeOrderFromDescriptors(descriptors: GradeDescriptor[]) {
  return descriptors.map((d) => d.grade);
}

function resolveGrade(scoreValue: number, descriptors: GradeDescriptor[]) {
  const n = Number(scoreValue);
  if (!Number.isFinite(n)) return "E";

  // Sort by minMark descending so boundary overlaps choose the higher grade.
  const byThreshold = [...descriptors].sort((a, b) => b.minMark - a.minMark);
  const epsilon = 0.01;

  const found = byThreshold.find(
    (d) => n + epsilon >= Number(d.minMark) && n - epsilon <= Number(d.maxMark)
  );

  if (found?.grade) return found.grade;

  const byOrder = [...descriptors].sort((a, b) => a.order - b.order);
  const lowest = byOrder[byOrder.length - 1];
  const highest = byOrder[0];

  if (highest && n > highest.maxMark) return highest.grade;
  if (lowest && n < lowest.minMark) return lowest.grade;

  return lowest?.grade || "E";
}

async function getSchemeDetails(reportType: string) {
  const scheme = await prisma.reportScheme.findUnique({
    where: { reportType: reportType as any },
    select: {
      id: true,
      components: {
        orderBy: [{ order: "asc" }, { id: "asc" }],
        select: {
          assessmentDefinitionId: true,
          weightOutOf: true,
          enterOutOf: true,
        },
      },
      gradeDescriptors: {
        orderBy: [{ order: "asc" }],
        select: {
          grade: true,
          achievementLevel: true,
          minMark: true,
          maxMark: true,
          order: true,
        },
      },
    },
  });

  const gradeDescriptors = normalizeGradeDescriptors(scheme?.gradeDescriptors || [], reportType);

  return {
    components: scheme?.components || [],
    gradeDescriptors,
    gradeOrder: gradeOrderFromDescriptors(gradeDescriptors),
  };
}

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);

    const academicYearId = (searchParams.get("academicYearId") || "").trim();
    const academicYearName = (searchParams.get("academicYearName") || "").trim();
    const termId = (searchParams.get("termId") || "").trim();
    const termName = (searchParams.get("termName") || "").trim();
    const classId = (searchParams.get("classId") || "").trim();
    const className = (searchParams.get("className") || "").trim();
    const subjectId = (searchParams.get("subjectId") || "").trim();
    const reportType = (searchParams.get("reportType") || "").trim();

    if ((!academicYearId && !academicYearName) || (!termId && !termName) || (!classId && !className) || !subjectId || !reportType) {
      return NextResponse.json({ error: "Missing required query params" }, { status: 400 });
    }

    const cls = await resolveClass(classId, className);
    const year = await resolveAcademicYear(academicYearId, academicYearName);
    const term = await resolveTerm(termId, termName, year?.id);

    if (!cls || !year || !term) {
      return NextResponse.json({ error: "Invalid selection" }, { status: 404 });
    }

    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
      select: { id: true, name: true },
    });

    if (!subject) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    const allowed = await canViewMarks(user, cls.id, subjectId);
    if (!allowed) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const { components: schemeComponents, gradeDescriptors, gradeOrder } = await getSchemeDetails(reportType);
    if (!schemeComponents.length) {
      return NextResponse.json({
        summary: Object.fromEntries(gradeOrder.map((grade) => [grade, 0])),
        rows: [],
        gradeOrder,
        meta: {
          className: cls.name,
          subjectName: subject.name,
          reportType,
          totalStudents: 0,
          totalOutOf: 0,
        },
      });
    }

    const schemeTotalOutOf = round2(
      schemeComponents.reduce(
        (sum: number, sc: any) => sum + (Number(sc.weightOutOf ?? 0) || 0),
        0
      )
    );

    const definitionIds = schemeComponents.map((c: any) => c.assessmentDefinitionId);

    const assessmentComponents = await prisma.assessmentComponent.findMany({
      where: { definitionId: { in: definitionIds } },
      select: { id: true, definitionId: true },
    });

    const definitionToComponentIds = new Map<string, string[]>();
    for (const c of assessmentComponents) {
      const arr = definitionToComponentIds.get(c.definitionId) ?? [];
      arr.push(c.id);
      definitionToComponentIds.set(c.definitionId, arr);
    }

    const enrollments = await prisma.enrollment.findMany({
      where: {
        academicYearId: year.id,
        classId: cls.id,
        isActive: true,
        subjects: {
          some: { subjectId },
        },
      },
      select: {
        id: true,
        studentId: true,
        student: {
          select: {
            admissionNo: true,
            firstName: true,
            lastName: true,
            otherNames: true,
          },
        },
      },
      orderBy: [
        { student: { lastName: "asc" } },
        { student: { firstName: "asc" } },
      ],
    });

    const enrollmentIds = enrollments.map((e) => e.id);

    const markEntries = await prisma.markEntry.findMany({
      where: {
        academicYearId: year.id,
        termId: term.id,
        enrollmentId: { in: enrollmentIds.length ? enrollmentIds : ["__none__"] },
        subjectId,
        componentId: {
          in: assessmentComponents.length ? assessmentComponents.map((c) => c.id) : ["__none__"],
        },
      },
      select: {
        enrollmentId: true,
        componentId: true,
        subjectPaperId: true,
        scoreRaw: true,
      },
    });

    const summary: Record<string, number> = Object.fromEntries(
      gradeOrder.map((grade) => [grade, 0])
    );

    const rows: {
      studentId: string;
      enrollmentId: string;
      studentNo: string;
      studentName: string;
      totalScore: number;
      grade: string;
    }[] = [];

    for (const enrollment of enrollments) {
      let total = 0;

      for (const sc of schemeComponents) {
        const componentIds = definitionToComponentIds.get(sc.assessmentDefinitionId) ?? [];
        if (!componentIds.length) continue;

        const entries = markEntries.filter(
          (m) => m.enrollmentId === enrollment.id && componentIds.includes(m.componentId)
        );

        if (!entries.length) continue;

        const weightOutOf = Number(sc.weightOutOf ?? 0) || 0;
        const enterOutOf = Number(sc.enterOutOf ?? 100) || 100;
        const hasPapers = entries.some((e) => !!e.subjectPaperId);

        if (hasPapers) {
          const byPaper = new Map<string, number[]>();

          for (const entry of entries) {
            const key = entry.subjectPaperId || "__single__";
            const arr = byPaper.get(key) ?? [];
            arr.push(Number(entry.scoreRaw || 0));
            byPaper.set(key, arr);
          }

          const paperPercentages: number[] = [];
          for (const [, arr] of byPaper) {
            if (!arr.length) continue;
            const avgRaw = arr.reduce((a, b) => a + b, 0) / arr.length;
            paperPercentages.push(avgRaw / enterOutOf);
          }

          const avgPct = paperPercentages.length
            ? paperPercentages.reduce((a, b) => a + b, 0) / paperPercentages.length
            : 0;

          total += avgPct * weightOutOf;
        } else {
          const avgRaw = entries.reduce((a, b) => a + Number(b.scoreRaw || 0), 0) / entries.length;
          total += (avgRaw / enterOutOf) * weightOutOf;
        }
      }

      const totalScore = round2(total);
      const grade = resolveGrade(totalScore, gradeDescriptors);

      summary[grade] = (summary[grade] ?? 0) + 1;

      const studentName = [
        enrollment.student.firstName,
        enrollment.student.otherNames,
        enrollment.student.lastName,
      ]
        .filter(Boolean)
        .join(" ");

      rows.push({
        studentId: enrollment.studentId,
        enrollmentId: enrollment.id,
        studentNo: enrollment.student.admissionNo || "",
        studentName,
        totalScore,
        grade,
      });
    }

    rows.sort((a, b) => b.totalScore - a.totalScore);

    return NextResponse.json({
      summary,
      rows,
      gradeOrder,
      meta: {
        className: cls.name,
        subjectName: subject.name,
        reportType,
        totalStudents: rows.length,
        totalOutOf: schemeTotalOutOf,
      },
    });
  } catch (e: any) {
    const msg = e?.message || "Error";
    const code =
      msg === "UNAUTHENTICATED" ? 401 :
      msg === "FORBIDDEN" ? 403 :
      500;

    return NextResponse.json({ error: msg }, { status: code });
  }
}