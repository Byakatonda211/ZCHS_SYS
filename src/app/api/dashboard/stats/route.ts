import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

type Role = "ADMIN" | "CLASS_TEACHER" | "SUBJECT_TEACHER";

type Me = {
  id: string;
  fullName: string;
  username: string;
  role: Role | string;
};

type GradeCounts = {
  A: number;
  B: number;
  C: number;
  D: number;
  E: number;
  O?: number;
  F?: number;
};

function round2(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function reportTypeFor(level: string, assessmentType: string) {
  if (level === "A_LEVEL") {
    return assessmentType === "ENDTERM" ? "A_EOT" : "A_MID";
  }

  return assessmentType === "ENDTERM" ? "O_EOT" : "O_MID";
}

function gradeHint(mark: number, level: string) {
  const n = Number(mark);

  if (!Number.isFinite(n)) return "-";

  if (level === "A_LEVEL") {
    if (n >= 80) return "A";
    if (n >= 70) return "B";
    if (n >= 60) return "C";
    if (n >= 50) return "D";
    if (n >= 40) return "E";
    if (n >= 35) return "O";
    return "F";
  }

  if (n >= 80) return "A";
  if (n >= 70) return "B";
  if (n >= 60) return "C";
  if (n >= 50) return "D";
  return "E";
}

function emptyGradeCounts(level: string): GradeCounts {
  if (level === "A_LEVEL") {
    return { A: 0, B: 0, C: 0, D: 0, E: 0, O: 0, F: 0 };
  }

  return { A: 0, B: 0, C: 0, D: 0, E: 0 };
}

async function getAllowedClassIds(user: Me) {
  if (user.role === "ADMIN") {
    const classes = await prisma.class.findMany({
      where: { isActive: true },
      select: { id: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    });

    return classes.map((c) => c.id);
  }

  const assignments = await prisma.teachingAssignment.findMany({
    where: { userId: user.id },
    select: { classId: true },
  });

  return Array.from(new Set(assignments.map((a) => a.classId)));
}

async function getSelectedBasics(req: Request, user: Me) {
  const { searchParams } = new URL(req.url);

  const requestedAcademicYearId = (searchParams.get("academicYearId") || "").trim();
  const requestedTermId = (searchParams.get("termId") || "").trim();
  const requestedClassId = (searchParams.get("classId") || "").trim();
  const requestedAssessmentDefinitionId = (
    searchParams.get("assessmentDefinitionId") || ""
  ).trim();

  const allowedClassIds = await getAllowedClassIds(user);

  const academicYears = await prisma.academicYear.findMany({
    orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
    select: { id: true, name: true, isCurrent: true },
  });

  const selectedAcademicYear =
    academicYears.find((y) => y.id === requestedAcademicYearId) ||
    academicYears.find((y) => y.isCurrent) ||
    academicYears[0] ||
    null;

  const classes = await prisma.class.findMany({
    where: {
      isActive: true,
      ...(user.role === "ADMIN" ? {} : { id: { in: allowedClassIds } }),
    },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: { id: true, name: true, level: true },
  });

  const selectedClass = classes.find((c) => c.id === requestedClassId) || classes[0] || null;

  const terms = selectedAcademicYear
    ? await prisma.term.findMany({
        where: { academicYearId: selectedAcademicYear.id },
        orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
        select: { id: true, name: true, type: true, isCurrent: true },
      })
    : [];

  const selectedTerm =
    terms.find((t) => t.id === requestedTermId) ||
    terms.find((t) => t.isCurrent) ||
    terms[0] ||
    null;

  const assessments = selectedClass
    ? await prisma.assessmentDefinition.findMany({
        where: {
          isActive: true,
          level: selectedClass.level,
        },
        orderBy: [{ type: "asc" }, { name: "asc" }],
        select: { id: true, name: true, type: true, level: true },
      })
    : [];

  const selectedAssessment =
    assessments.find((a) => a.id === requestedAssessmentDefinitionId) || assessments[0] || null;

  const selectedReportType =
    selectedClass && selectedAssessment
      ? reportTypeFor(selectedClass.level, selectedAssessment.type)
      : "O_EOT";

  return {
    allowedClassIds,
    academicYears,
    selectedAcademicYear,
    classes,
    selectedClass,
    terms,
    selectedTerm,
    assessments,
    selectedAssessment,
    selectedReportType,
  };
}

async function getMarksStatus(params: {
  academicYearId: string;
  termId: string;
  classId: string;
  assessmentDefinitionId: string;
}) {
  /**
   * Keep this aligned with the marks entry API.
   * The current marks entry route reads/writes marks against ONLY the first
   * AssessmentComponent under the selected AssessmentDefinition.
   *
   * If the dashboard checks all components for an EOT assessment, it can show
   * empty/incomplete status even when marks were already entered. Therefore,
   * the dashboard status uses the same first component as marks entry.
   */
  const component = await prisma.assessmentComponent.findFirst({
    where: { definitionId: params.assessmentDefinitionId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });

  if (!component) {
    return {
      marksStatus: [],
      overallMarksCompletion: 0,
    };
  }

  const enrollments = await prisma.enrollment.findMany({
    where: {
      academicYearId: params.academicYearId,
      classId: params.classId,
      isActive: true,
    },
    select: {
      id: true,
      subjects: {
        select: {
          subject: {
            select: {
              id: true,
              name: true,
              code: true,
              level: true,
              isActive: true,
              papers: {
                where: { isActive: true },
                select: { id: true },
              },
            },
          },
        },
      },
    },
  });

  const subjectMap = new Map<
    string,
    {
      subjectId: string;
      subjectName: string;
      subjectCode: string | null;
      level: string;
      enrolledStudents: number;
      papersCount: number;
    }
  >();

  for (const enrollment of enrollments) {
    for (const row of enrollment.subjects) {
      const subject = row.subject;
      if (!subject?.isActive) continue;

      const existing = subjectMap.get(subject.id);

      if (existing) {
        existing.enrolledStudents += 1;
      } else {
        subjectMap.set(subject.id, {
          subjectId: subject.id,
          subjectName: subject.name,
          subjectCode: subject.code,
          level: subject.level,
          enrolledStudents: 1,
          papersCount: Math.max(1, subject.papers?.length || 0),
        });
      }
    }
  }

  const entries = await prisma.markEntry.findMany({
    where: {
      academicYearId: params.academicYearId,
      termId: params.termId,
      componentId: component.id,
      enrollment: {
        academicYearId: params.academicYearId,
        classId: params.classId,
        isActive: true,
      },
    },
    select: {
      enrollmentId: true,
      subjectId: true,
      subjectPaperId: true,
      componentId: true,
    },
  });

  /**
   * Count one completed dashboard entry per learner + subject + paper.
   * This avoids the wrong denominator of students × assessment components.
   *
   * O-Level expected entries: enrolled learners in the subject.
   * A-Level expected entries: enrolled learners in the subject × active papers.
   */
  const enteredSlots = new Map<string, Set<string>>();

  for (const entry of entries) {
    if (!enteredSlots.has(entry.subjectId)) {
      enteredSlots.set(entry.subjectId, new Set());
    }

    enteredSlots
      .get(entry.subjectId)!
      .add([entry.enrollmentId, entry.subjectId, entry.subjectPaperId || "NO_PAPER"].join(":"));
  }

  const marksStatus = Array.from(subjectMap.values())
    .map((subject) => {
      const expectedEntries =
        subject.enrolledStudents * (subject.level === "A_LEVEL" ? subject.papersCount : 1);

      const enteredEntries = enteredSlots.get(subject.subjectId)?.size || 0;
      const completion = expectedEntries > 0 ? round2((enteredEntries / expectedEntries) * 100) : 0;

      const status =
        completion >= 100 ? "Complete" : completion > 0 ? "In Progress" : "Not Started";

      return {
        subjectId: subject.subjectId,
        subjectName: subject.subjectName,
        subjectCode: subject.subjectCode,
        enrolledStudents: subject.enrolledStudents,
        expectedEntries,
        enteredEntries,
        partialEntries: 0,
        completion,
        missingEntries: Math.max(0, expectedEntries - enteredEntries),
        status,
      };
    })
    .sort((a, b) => b.completion - a.completion || a.subjectName.localeCompare(b.subjectName));

  const totalExpected = marksStatus.reduce((sum, s) => sum + s.expectedEntries, 0);
  const totalEntered = marksStatus.reduce((sum, s) => sum + s.enteredEntries, 0);

  return {
    marksStatus,
    overallMarksCompletion: totalExpected > 0 ? round2((totalEntered / totalExpected) * 100) : 0,
  };
}

type SchemeComponentConfig = {
  assessmentDefinitionId: string;
  componentId: string;
  weightOutOf: number;
  enterOutOf: number;
};

type GradeDescriptor = {
  grade: string;
  minScore: number;
  maxScore: number;
};

function gradeFromDescriptors(mark: number, descriptors: GradeDescriptor[], level: string) {
  const n = Number(mark);
  if (!Number.isFinite(n)) return "-";

  const found = descriptors.find((d) => n >= d.minScore && n <= d.maxScore);
  if (found?.grade) return found.grade;

  return gradeHint(n, level);
}

async function getGradeDescriptors(reportType: string, level: string): Promise<GradeDescriptor[]> {
  const p: any = prisma as any;

  const candidates = [
    p.gradeDescriptor,
    p.reportGradeDescriptor,
    p.reportGradeRule,
    p.gradeRule,
  ].filter(Boolean);

  for (const model of candidates) {
    try {
      const rows = await model.findMany({
        where: {
          OR: [
            { reportType },
            { level },
            { reportType, level },
          ],
          isActive: true,
        },
        orderBy: [{ minScore: "desc" }],
      });

      if (Array.isArray(rows) && rows.length) {
        return rows
          .map((r: any) => ({
            grade: String(r.grade || r.label || "").trim(),
            minScore: Number(r.minScore ?? r.min ?? 0),
            maxScore: Number(r.maxScore ?? r.max ?? 100),
          }))
          .filter((r: GradeDescriptor) => r.grade && Number.isFinite(r.minScore) && Number.isFinite(r.maxScore));
      }
    } catch {
      // Ignore optional grading tables that may not exist in some deployments.
    }
  }

  return [];
}

async function getSchemeComponentConfigs(params: {
  reportType: string;
  selectedAssessmentDefinitionId: string;
}) {
  const p: any = prisma as any;

  const configs: SchemeComponentConfig[] = [];

  const scheme = await p.reportScheme.findUnique({
    where: { reportType: params.reportType },
    select: {
      components: {
        orderBy: { order: "asc" },
        select: {
          assessmentDefinitionId: true,
          weightOutOf: true,
          enterOutOf: true,
          assessment: {
            select: {
              components: {
                orderBy: [{ order: "asc" }, { createdAt: "asc" }],
                take: 1,
                select: { id: true },
              },
            },
          },
        },
      },
    },
  });

  if (scheme?.components?.length) {
    for (const schemeComponent of scheme.components) {
      const componentId = schemeComponent.assessment?.components?.[0]?.id;
      if (!componentId) continue;

      configs.push({
        assessmentDefinitionId: schemeComponent.assessmentDefinitionId,
        componentId,
        weightOutOf: Number(schemeComponent.weightOutOf ?? 0),
        enterOutOf: Number(schemeComponent.enterOutOf ?? 100) || 100,
      });
    }
  }

  if (configs.length === 0) {
    const component = await prisma.assessmentComponent.findFirst({
      where: { definitionId: params.selectedAssessmentDefinitionId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });

    if (component) {
      configs.push({
        assessmentDefinitionId: params.selectedAssessmentDefinitionId,
        componentId: component.id,
        weightOutOf: 100,
        enterOutOf: 100,
      });
    }
  }

  return configs;
}

async function getPerformanceStats(params: {
  academicYearId: string;
  termId: string;
  classId: string;
  classLevel: string;
  reportType: string;
  selectedAssessmentDefinitionId: string;
}) {
  const schemeConfigs = await getSchemeComponentConfigs({
    reportType: params.reportType,
    selectedAssessmentDefinitionId: params.selectedAssessmentDefinitionId,
  });

  const componentConfigById = new Map(schemeConfigs.map((c) => [c.componentId, c]));
  const componentIds = schemeConfigs.map((c) => c.componentId);
  const totalSchemeWeight = schemeConfigs.reduce((sum, c) => sum + Number(c.weightOutOf || 0), 0) || 100;
  const gradeDescriptors = await getGradeDescriptors(params.reportType, params.classLevel);

  if (componentIds.length === 0) {
    return {
      bestStudents: [],
      bottomStudents: [],
      bestSubjects: [],
      gradeDistribution: [],
    };
  }

  const enrollments = await prisma.enrollment.findMany({
    where: {
      academicYearId: params.academicYearId,
      classId: params.classId,
      isActive: true,
    },
    select: {
      id: true,
      studentId: true,
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          otherNames: true,
          admissionNo: true,
        },
      },
      subjects: {
        select: {
          subject: {
            select: {
              id: true,
              name: true,
              code: true,
              level: true,
              isActive: true,
            },
          },
        },
      },
    },
  });

  const subjectNames = new Map<
    string,
    { subjectId: string; subjectName: string; subjectCode: string | null; level: string }
  >();

  for (const enrollment of enrollments) {
    for (const row of enrollment.subjects) {
      const subject = row.subject;
      if (!subject?.isActive) continue;

      subjectNames.set(subject.id, {
        subjectId: subject.id,
        subjectName: subject.name,
        subjectCode: subject.code,
        level: subject.level,
      });
    }
  }

  const entries = await prisma.markEntry.findMany({
    where: {
      academicYearId: params.academicYearId,
      termId: params.termId,
      componentId: { in: componentIds },
      enrollment: {
        academicYearId: params.academicYearId,
        classId: params.classId,
        isActive: true,
      },
    },
    select: {
      enrollmentId: true,
      studentId: true,
      subjectId: true,
      subjectPaperId: true,
      componentId: true,
      scoreRaw: true,
    },
  });

  /**
   * Match report-card calculation more closely:
   * 1) Marks are entered out of the configured enterOutOf, not always out of 100.
   * 2) Each report scheme component contributes weightOutOf.
   * 3) A-Level paper rows are first calculated per paper, then averaged into the subject.
   * 4) Student average is the average of final subject scores.
   */
  const grouped = new Map<string, Map<string, Map<string, Map<string, number[]>>>>();

  for (const entry of entries) {
    if (!grouped.has(entry.studentId)) grouped.set(entry.studentId, new Map());

    const studentMap = grouped.get(entry.studentId)!;
    if (!studentMap.has(entry.subjectId)) studentMap.set(entry.subjectId, new Map());

    const subjectMap = studentMap.get(entry.subjectId)!;
    const paperKey = entry.subjectPaperId || "NO_PAPER";
    if (!subjectMap.has(paperKey)) subjectMap.set(paperKey, new Map());

    const paperMap = subjectMap.get(paperKey)!;
    if (!paperMap.has(entry.componentId)) paperMap.set(entry.componentId, []);

    paperMap.get(entry.componentId)!.push(Number(entry.scoreRaw));
  }

  const studentRows: {
    studentId: string;
    name: string;
    admissionNo: string | null;
    average: number;
    subjectsCounted: number;
    position: number;
  }[] = [];

  const subjectTotals = new Map<string, number[]>();

  function computePaperScore(componentMap: Map<string, number[]>) {
    let total = 0;
    let usedWeight = 0;

    for (const [componentId, scores] of componentMap.entries()) {
      const config = componentConfigById.get(componentId);
      if (!config || !scores.length) continue;

      const rawAvg = scores.reduce((sum, s) => sum + Number(s || 0), 0) / scores.length;
      const enterOutOf = Number(config.enterOutOf || 100) || 100;
      const weight = Number(config.weightOutOf || 0);

      total += (rawAvg / enterOutOf) * weight;
      usedWeight += weight;
    }

    if (usedWeight <= 0) return null;

    // Convert to a 100-scale subject/paper score so it matches report averages.
    return round2((total / totalSchemeWeight) * 100);
  }

  for (const enrollment of enrollments) {
    const studentMap = grouped.get(enrollment.studentId);
    if (!studentMap) continue;

    const subjectScores: number[] = [];

    for (const [subjectId, paperMap] of studentMap.entries()) {
      const paperScores: number[] = [];

      for (const [, componentMap] of paperMap.entries()) {
        const paperScore = computePaperScore(componentMap);
        if (paperScore !== null) paperScores.push(paperScore);
      }

      if (paperScores.length === 0) continue;

      const subjectTotal = round2(
        paperScores.reduce((sum, score) => sum + score, 0) / paperScores.length
      );

      subjectScores.push(subjectTotal);

      if (!subjectTotals.has(subjectId)) subjectTotals.set(subjectId, []);
      subjectTotals.get(subjectId)!.push(subjectTotal);
    }

    if (subjectScores.length === 0) continue;

    const average = round2(
      subjectScores.reduce((sum, score) => sum + score, 0) / subjectScores.length
    );

    const student = enrollment.student;
    const name = [student.firstName, student.lastName, student.otherNames]
      .filter(Boolean)
      .join(" ");

    studentRows.push({
      studentId: student.id,
      name,
      admissionNo: student.admissionNo,
      average,
      subjectsCounted: subjectScores.length,
      position: 0,
    });
  }

  studentRows.sort((a, b) => b.average - a.average || a.name.localeCompare(b.name));

  studentRows.forEach((row, index) => {
    row.position = index + 1;
  });

  const bestStudents = studentRows.slice(0, 10);
  const bottomStudents = [...studentRows]
    .sort((a, b) => a.average - b.average || a.name.localeCompare(b.name))
    .slice(0, 10);

  const bestSubjects = Array.from(subjectTotals.entries())
    .map(([subjectId, scores]) => {
      const subject = subjectNames.get(subjectId);
      const level = subject?.level || params.classLevel;
      const descriptors = level === params.classLevel ? gradeDescriptors : [];
      const average = round2(scores.reduce((sum, score) => sum + score, 0) / scores.length);
      const gradeCounts = emptyGradeCounts(level);

      for (const score of scores) {
        const grade = gradeFromDescriptors(score, descriptors, level) as keyof GradeCounts;
        if (typeof gradeCounts[grade] === "number") {
          gradeCounts[grade] = Number(gradeCounts[grade] || 0) + 1;
        }
      }

      return {
        subjectId,
        subjectName: subject?.subjectName || "Unknown Subject",
        subjectCode: subject?.subjectCode || null,
        average,
        studentsCounted: scores.length,
        gradeHint: gradeFromDescriptors(average, descriptors, level),
        gradeCounts,
      };
    })
    .sort((a, b) => b.average - a.average || a.subjectName.localeCompare(b.subjectName));

  const distributionMap = new Map<string, number>();

  for (const student of studentRows) {
    const grade = gradeFromDescriptors(student.average, gradeDescriptors, params.classLevel);
    distributionMap.set(grade, (distributionMap.get(grade) || 0) + 1);
  }

  const gradeOrder =
    params.classLevel === "A_LEVEL"
      ? ["A", "B", "C", "D", "E", "O", "F"]
      : ["A", "B", "C", "D", "E"];

  const gradeDistribution = gradeOrder
    .map((grade) => ({ grade, count: distributionMap.get(grade) || 0 }))
    .filter((row) => row.count > 0);

  return {
    bestStudents,
    bottomStudents,
    bestSubjects,
    gradeDistribution,
  };
}

async function getClassEnrollment(params: {
  academicYearId: string;
  allowedClassIds: string[];
  user: Me;
}) {
  const classes = await prisma.class.findMany({
    where: {
      isActive: true,
      ...(params.user.role === "ADMIN" ? {} : { id: { in: params.allowedClassIds } }),
    },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          enrollments: {
            where: {
              academicYearId: params.academicYearId,
              isActive: true,
            },
          },
        },
      },
    },
  });

  return classes.map((c) => ({
    classId: c.id,
    className: c.name,
    students: c._count.enrollments,
  }));
}

export async function GET(req: Request) {
  try {
    const user = (await requireUser()) as Me;

    const basics = await getSelectedBasics(req, user);

    if (!basics.selectedAcademicYear || !basics.selectedTerm || !basics.selectedClass) {
      return NextResponse.json({
        me: user,
        filters: {
          academicYears: basics.academicYears.map((y) => ({ id: y.id, name: y.name })),
          terms: basics.terms.map((t) => ({ id: t.id, name: t.name })),
          classes: basics.classes.map((c) => ({ id: c.id, name: c.name, level: c.level })),
          assessments: basics.assessments.map((a) => ({
            id: a.id,
            name: a.name,
            level: a.level,
            type: a.type,
          })),
          selectedAcademicYearId: basics.selectedAcademicYear?.id || "",
          selectedTermId: basics.selectedTerm?.id || "",
          selectedClassId: basics.selectedClass?.id || "",
          selectedAssessmentDefinitionId: basics.selectedAssessment?.id || "",
          selectedReportType: basics.selectedReportType,
        },
        summary: {
          studentsCount: 0,
          teachersCount: 0,
          activeClassName: basics.selectedClass?.name || "",
          activeTermName: basics.selectedTerm?.name || "",
          activeAssessmentName: basics.selectedAssessment?.name || "",
          overallMarksCompletion: 0,
        },
        marksStatus: [],
        bestStudents: [],
        bottomStudents: [],
        bestSubjects: [],
        classEnrollment: [],
        gradeDistribution: [],
      });
    }

    const [studentsCount, teachersCount, marksStatusResult, performanceResult, classEnrollment] =
      await Promise.all([
        prisma.student.count({ where: { isActive: true } }),
        prisma.user.count({
          where: {
            isActive: true,
            role: { in: ["CLASS_TEACHER", "SUBJECT_TEACHER"] },
          },
        }),
        basics.selectedAssessment
          ? getMarksStatus({
              academicYearId: basics.selectedAcademicYear.id,
              termId: basics.selectedTerm.id,
              classId: basics.selectedClass.id,
              assessmentDefinitionId: basics.selectedAssessment.id,
            })
          : Promise.resolve({ marksStatus: [], overallMarksCompletion: 0 }),
        basics.selectedAssessment
          ? getPerformanceStats({
              academicYearId: basics.selectedAcademicYear.id,
              termId: basics.selectedTerm.id,
              classId: basics.selectedClass.id,
              classLevel: basics.selectedClass.level,
              reportType: basics.selectedReportType,
              selectedAssessmentDefinitionId: basics.selectedAssessment.id,
            })
          : Promise.resolve({
              bestStudents: [],
              bottomStudents: [],
              bestSubjects: [],
              gradeDistribution: [],
            }),
        getClassEnrollment({
          academicYearId: basics.selectedAcademicYear.id,
          allowedClassIds: basics.allowedClassIds,
          user,
        }),
      ]);

    return NextResponse.json({
      me: user,
      filters: {
        academicYears: basics.academicYears.map((y) => ({ id: y.id, name: y.name })),
        terms: basics.terms.map((t) => ({ id: t.id, name: t.name })),
        classes: basics.classes.map((c) => ({ id: c.id, name: c.name, level: c.level })),
        assessments: basics.assessments.map((a) => ({
          id: a.id,
          name: a.name,
          level: a.level,
          type: a.type,
        })),
        selectedAcademicYearId: basics.selectedAcademicYear.id,
        selectedTermId: basics.selectedTerm.id,
        selectedClassId: basics.selectedClass.id,
        selectedAssessmentDefinitionId: basics.selectedAssessment?.id || "",
        selectedReportType: basics.selectedReportType,
      },
      summary: {
        studentsCount,
        teachersCount,
        activeClassName: basics.selectedClass.name,
        activeTermName: basics.selectedTerm.name,
        activeAssessmentName: basics.selectedAssessment?.name || "",
        overallMarksCompletion: marksStatusResult.overallMarksCompletion,
      },
      marksStatus: marksStatusResult.marksStatus,
      bestStudents: performanceResult.bestStudents,
      bottomStudents: performanceResult.bottomStudents,
      bestSubjects: performanceResult.bestSubjects,
      classEnrollment,
      gradeDistribution: performanceResult.gradeDistribution,
    });
  } catch (e: any) {
    const msg = e?.message || "Error";
    const code = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;

    return NextResponse.json({ error: msg }, { status: code });
  }
}
