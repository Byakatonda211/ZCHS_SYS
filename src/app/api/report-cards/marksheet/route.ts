import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

type RoleUser = { id: string; role: string };

async function canViewMarks(user: RoleUser, classId: string, subjectId: string) {
  if (user.role === "ADMIN") return true;

  const assignments = await prisma.teachingAssignment.findMany({
    where: { userId: user.id, classId },
    select: { isClassTeacher: true, subjectId: true },
  });

  if (assignments.length === 0) return false;
  if (assignments.some((a) => a.isClassTeacher)) return true;
  return assignments.some((a) => a.subjectId === subjectId);
}

function round2(v: number) {
  return Math.round(v * 100) / 100;
}

function csvSafe(v: unknown) {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function defaultGrade(score: number) {
  if (score >= 80) return "A";
  if (score >= 75) return "B";
  if (score >= 70) return "C";
  if (score >= 65) return "D";
  if (score >= 60) return "E";
  if (score >= 50) return "O";
  return "F";
}

async function resolveGrade(level: "O_LEVEL" | "A_LEVEL", score: number) {
  const rules = await prisma.remarkRule.findMany({
    where: {
      type: "TEACHER",
      level,
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
    if (score >= Number(rule.minScore) && score <= Number(rule.maxScore)) {
      return String(rule.grade || "").trim() || defaultGrade(score);
    }
  }

  return defaultGrade(score);
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
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      assessmentDefinitionId: true,
      weightOutOf: true,
      enterOutOf: true,
      order: true,
      assessment: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);

    const academicYearId = (searchParams.get("academicYearId") || "").trim();
    const termId = (searchParams.get("termId") || "").trim();
    const classId = (searchParams.get("classId") || "").trim();
    const subjectId = (searchParams.get("subjectId") || "").trim();
    const reportType = (searchParams.get("reportType") || "").trim();

    if (!academicYearId || !termId || !classId || !subjectId || !reportType) {
      return NextResponse.json({ error: "Missing required query params" }, { status: 400 });
    }

    const allowed = await canViewMarks(user, classId, subjectId);
    if (!allowed) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const cls = await prisma.class.findUnique({
      where: { id: classId },
      select: { id: true, name: true, level: true },
    });

    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
      select: { id: true, name: true },
    });

    const year = await prisma.academicYear.findUnique({
      where: { id: academicYearId },
      select: { name: true },
    });

    const term = await prisma.term.findUnique({
      where: { id: termId },
      select: { name: true },
    });

    if (!cls || !subject || !year || !term) {
      return NextResponse.json({ error: "Invalid selection" }, { status: 404 });
    }

    const schemeComponents = await getSchemeComponents(reportType);
    if (!schemeComponents.length) {
      return NextResponse.json({ error: "No report scheme components found" }, { status: 400 });
    }

    const definitionIds = schemeComponents.map((c: any) => c.assessmentDefinitionId);

    const assessmentComponents = await prisma.assessmentComponent.findMany({
      where: {
        definitionId: { in: definitionIds },
      },
      select: {
        id: true,
        definitionId: true,
      },
    });

    const definitionToComponentIds = new Map<string, string[]>();
    for (const c of assessmentComponents) {
      const arr = definitionToComponentIds.get(c.definitionId) ?? [];
      arr.push(c.id);
      definitionToComponentIds.set(c.definitionId, arr);
    }

    const enrollments = await prisma.enrollment.findMany({
      where: {
        academicYearId,
        classId,
        isActive: true,
        subjects: {
          some: {
            subjectId,
          },
        },
      },
      select: {
        id: true,
        studentId: true,
        student: {
          select: {
            firstName: true,
            lastName: true,
            otherNames: true,
            admissionNo: true,
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
        academicYearId,
        termId,
        enrollmentId: { in: enrollmentIds.length ? enrollmentIds : ["__none__"] },
        subjectId,
        componentId: {
          in: assessmentComponents.map((c) => c.id).length
            ? assessmentComponents.map((c) => c.id)
            : ["__none__"],
        },
      },
      select: {
        enrollmentId: true,
        componentId: true,
        subjectPaperId: true,
        scoreRaw: true,
      },
    });

    const header = [
      "Student No",
      "Student Name",
      ...schemeComponents.map((sc: any) => `${sc.assessment?.name || "Component"} (${Number(sc.weightOutOf || 0)})`),
      "Total",
      "Grade",
    ];

    const lines = [header.map(csvSafe).join(",")];

    for (const enrollment of enrollments) {
      const fullName = [
        enrollment.student.firstName,
        enrollment.student.lastName,
        enrollment.student.otherNames,
      ]
        .filter(Boolean)
        .join(" ");

      let total = 0;
      const parts: string[] = [];

      for (const sc of schemeComponents) {
        const componentIds = definitionToComponentIds.get(sc.assessmentDefinitionId) ?? [];
        const entries = markEntries.filter(
          (m) =>
            m.enrollmentId === enrollment.id &&
            componentIds.includes(m.componentId)
        );

        const enterOutOf = Number(sc.enterOutOf ?? 100) || 100;
        const weightOutOf = Number(sc.weightOutOf ?? 0) || 0;

        let weightedScore = 0;

        if (entries.length > 0) {
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

            weightedScore = avgPct * weightOutOf;
          } else {
            const avgRaw =
              entries.reduce((a, b) => a + Number(b.scoreRaw || 0), 0) / entries.length;
            weightedScore = (avgRaw / enterOutOf) * weightOutOf;
          }
        }

        weightedScore = round2(weightedScore);
        total += weightedScore;
        parts.push(String(weightedScore));
      }

      total = round2(total);
      const grade = await resolveGrade(cls.level as "O_LEVEL" | "A_LEVEL", total);

      lines.push(
        [
          csvSafe(enrollment.student.admissionNo || ""),
          csvSafe(fullName),
          ...parts.map(csvSafe),
          csvSafe(total),
          csvSafe(grade),
        ].join(",")
      );
    }

    const csv = lines.join("\n");
    const filename = `${cls.name}-${subject.name}-${reportType}-marksheet.csv`
      .replace(/\s+/g, "_")
      .replace(/[^\w.-]+/g, "");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e: any) {
    const msg = e?.message || "Error";
    const code = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}