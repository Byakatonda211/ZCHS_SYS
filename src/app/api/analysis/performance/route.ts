import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

type RoleUser = { id: string; role: string };

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

function defaultGrade(scorePercent: number) {
  if (scorePercent >= 80) return "A";
  if (scorePercent >= 75) return "B";
  if (scorePercent >= 70) return "C";
  if (scorePercent >= 65) return "D";
  if (scorePercent >= 60) return "E";
  if (scorePercent >= 50) return "O";
  return "F";
}

async function resolveGrade(level: string, scorePercent: number) {
  const rules = await prisma.remarkRule.findMany({
    where: {
      level: level as any,
      isActive: true,
      grade: { not: null },
    },
    orderBy: [{ minScore: "desc" }],
    select: {
      minScore: true,
      maxScore: true,
      grade: true,
    },
  });

  for (const rule of rules) {
    const min = Number(rule.minScore);
    const max = Number(rule.maxScore);
    if (scorePercent >= min && scorePercent <= max) {
      return String(rule.grade || "").trim() || defaultGrade(scorePercent);
    }
  }

  return defaultGrade(scorePercent);
}

async function getSchemeComponents(reportType: string) {
  const p: any = prisma as any;

  const scheme = await prisma.reportScheme.findUnique({
    where: { reportType: reportType as any },
    select: { id: true },
  });

  if (!scheme) return [];

  return await p.reportSchemeComponent.findMany({
    where: { schemeId: scheme.id },
    orderBy: [{ order: "asc" }, { id: "asc" }],
    select: {
      assessmentDefinitionId: true,
      weightOutOf: true,
      enterOutOf: true,
    },
  });
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

    const schemeComponents = await getSchemeComponents(reportType);
    if (!schemeComponents.length) {
      return NextResponse.json({
        summary: { A: 0, B: 0, C: 0, D: 0, E: 0, O: 0, F: 0 },
        rows: [],
        gradeOrder: ["A", "B", "C", "D", "E", "O", "F"],
        meta: {
          className: cls.name,
          subjectName: subject.name,
          reportType,
          totalStudents: 0,
        },
      });
    }

    const schemeMax = schemeComponents.reduce(
      (sum: number, sc: any) => sum + (Number(sc.weightOutOf ?? 0) || 0),
      0
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

    const summary: Record<string, number> = {
      A: 0,
      B: 0,
      C: 0,
      D: 0,
      E: 0,
      O: 0,
      F: 0,
    };

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
      const scorePercent = schemeMax > 0 ? round2((totalScore / schemeMax) * 100) : totalScore;
      const grade = await resolveGrade(String(cls.level), scorePercent);

      summary[grade] = (summary[grade] ?? 0) + 1;

      const studentName = [
        enrollment.student.firstName,
        enrollment.student.lastName,
        enrollment.student.otherNames,
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
      gradeOrder: ["A", "B", "C", "D", "E", "O", "F"],
      meta: {
        className: cls.name,
        subjectName: subject.name,
        reportType,
        totalStudents: rows.length,
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