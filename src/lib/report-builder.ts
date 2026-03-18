import {
  getStudentById,
  getCurrentEnrollment,
  getClasses,
  getSubjectsForClass,
  getPapersForSubject,
  computeOLevelSubjectTotal,
  computeALevelPaperScore,
  gradeOLevel,
  getRemarkOverride,
  pickRemark,
  getClassTeacherAssignment,
  getSubjectTeacherAssignment,
  getTeacherById,
} from "@/lib/store";

export type OLevelReportType = "O_MID" | "O_EOT";

export type ReportSubjectRow = {
  subjectId: string;
  subjectName: string;
  teacherInitials: string | null;
  total: number | null;
  grade: string;
  papers?: {
    paperId: string;
    paperName: string;
    mid: number | null;
    eot: number | null;
    final: number | null;
  }[];
};

export type StudentReportCardData = {
  student: {
    id: string;
    fullName: string;
    studentNo: string;
  };
  academic: {
    academicYearId: string;
    termId: string;
    reportType: OLevelReportType;
    classId: string;
    className: string;
    streamName?: string;
    isALevel: boolean;
  };
  subjects: ReportSubjectRow[];
  overall: {
    average: number | null;
    grade: string;
  };
  remarks: {
    teacherRemark: string;
    headTeacherComment: string;
    teacherRemarkIsOverride: boolean;
    headTeacherCommentIsOverride: boolean;
  };
  teachers: {
    classTeacher: string;
  };
};

function gradeALevel(score: number | null) {
  if (score === null) return "X";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "E";
}

function roundOrNull(value: number | null) {
  return value === null ? null : Math.round(value);
}

export function buildStudentReportCard(params: {
  studentId: string;
  academicYearId: string;
  termId: string;
  reportType: OLevelReportType;
}): StudentReportCardData | null {
  const { studentId, academicYearId, termId, reportType } = params;

  const student = getStudentById(studentId);
  if (!student) return null;

  const enrollment = getCurrentEnrollment(studentId);
  const classId = enrollment?.classId ?? "";

  const streamName =
    (enrollment as any)?.streamName ??
    (enrollment as any)?.stream ??
    (enrollment as any)?.streamLabel ??
    undefined;

  const className =
    getClasses().find((c) => c.id === classId)?.name ?? student.className ?? "";

  const isALevel = className === "S5" || className === "S6";
  const subjects = getSubjectsForClass(classId);

  const subjectRows: ReportSubjectRow[] = subjects.map((subject) => {
    const teacherAssignment = getSubjectTeacherAssignment({
      classId,
      subjectId: subject.id,
      streamName,
    });
    const teacher = teacherAssignment
      ? getTeacherById(teacherAssignment.teacherId)
      : null;

    if (!isALevel) {
      const result = computeOLevelSubjectTotal({
        studentId,
        academicYearId,
        termId,
        reportType,
        subjectId: subject.id,
      });

      const total = roundOrNull(result.total);

      return {
        subjectId: subject.id,
        subjectName: subject.name,
        teacherInitials: teacher?.initials ?? null,
        total,
        grade: gradeOLevel(total),
      };
    }

    const papers = getPapersForSubject(subject.id).map((paper) => {
      const result = computeALevelPaperScore({
        studentId,
        academicYearId,
        termId,
        reportType,
        subjectId: subject.id,
        paperId: paper.id,
      });

      return {
        paperId: paper.id,
        paperName: paper.name,
        mid: result.mid ?? null,
        eot: result.eot ?? null,
        final: result.final ?? null,
      };
    });

    const paperFinals = papers
      .map((p) => p.final)
      .filter((x): x is number => typeof x === "number");

    const total =
      paperFinals.length > 0
        ? Math.round(
            paperFinals.reduce((sum, val) => sum + val, 0) / paperFinals.length
          )
        : null;

    return {
      subjectId: subject.id,
      subjectName: subject.name,
      teacherInitials: teacher?.initials ?? null,
      total,
      grade: gradeALevel(total),
      papers,
    };
  });

  let overallAverage: number | null = null;
  let overallGrade = "X";

  const totals = subjectRows
    .map((row) => row.total)
    .filter((x): x is number => typeof x === "number");

  if (totals.length > 0) {
    overallAverage = Math.round(
      totals.reduce((sum, val) => sum + val, 0) / totals.length
    );
    overallGrade = isALevel
      ? gradeALevel(overallAverage)
      : gradeOLevel(overallAverage);
  }

  const override = getRemarkOverride({
    studentId,
    academicYearId,
    termId,
    reportType,
  });

  const autoTeacherRemark =
    pickRemark({
      target: "teacher",
      reportType,
      grade: overallGrade,
      score: overallAverage,
    }) || "";

  const autoHeadTeacherComment =
    pickRemark({
      target: "headTeacher",
      reportType,
      grade: overallGrade,
      score: overallAverage,
    }) || "";

  const classTeacherAssignment = getClassTeacherAssignment(classId, streamName);
  const classTeacherRecord = classTeacherAssignment
    ? getTeacherById(classTeacherAssignment.teacherId)
    : null;

  return {
    student: {
      id: student.id,
      fullName: `${student.firstName} ${student.lastName}`,
      studentNo: student.studentNo,
    },
    academic: {
      academicYearId,
      termId,
      reportType,
      classId,
      className,
      streamName,
      isALevel,
    },
    subjects: subjectRows,
    overall: {
      average: overallAverage,
      grade: overallGrade,
    },
    remarks: {
      teacherRemark: override?.teacherRemark ?? autoTeacherRemark,
      headTeacherComment:
        override?.headTeacherComment ?? autoHeadTeacherComment,
      teacherRemarkIsOverride: Boolean(override?.teacherRemark),
      headTeacherCommentIsOverride: Boolean(override?.headTeacherComment),
    },
    teachers: {
      classTeacher: classTeacherRecord
        ? `${classTeacherRecord.fullName} (${classTeacherRecord.initials})`
        : "—",
    },
  };
}