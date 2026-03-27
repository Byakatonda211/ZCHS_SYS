import {
  getStudentById,
  getCurrentEnrollment,
  getClasses,
  getSubjectsForClass,
  computeOLevelSubjectTotal,
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
    isALevel: false;
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

type EnrollmentSubjectLike = {
  subjectId?: string;
  id?: string;
  subject?: {
    id?: string;
    name?: string;
  } | null;
  name?: string;
};

type NormalizedEnrollmentSubject = {
  id: string;
  name: string;
};

function roundOrNull(value: number | null) {
  return value === null ? null : Math.round(value);
}

function isNormalizedEnrollmentSubject(
  item: NormalizedEnrollmentSubject | null
): item is NormalizedEnrollmentSubject {
  return item !== null;
}

function getEnrolledSubjectsFromEnrollment(enrollment: any) {
  const rawSubjects: EnrollmentSubjectLike[] = Array.isArray(enrollment?.subjects)
    ? enrollment.subjects
    : [];

  const normalized: NormalizedEnrollmentSubject[] = rawSubjects
    .map((item: EnrollmentSubjectLike): NormalizedEnrollmentSubject | null => {
      const subjectId = String(
        item?.subjectId || item?.subject?.id || item?.id || ""
      ).trim();

      const subjectName = String(
        item?.subject?.name || item?.name || ""
      ).trim();

      if (!subjectId) return null;

      return {
        id: subjectId,
        name: subjectName || "Unnamed Subject",
      };
    })
    .filter(isNormalizedEnrollmentSubject);

  const deduped = new Map<string, NormalizedEnrollmentSubject>();
  for (const subject of normalized) {
    if (!deduped.has(subject.id)) {
      deduped.set(subject.id, subject);
    }
  }

  return Array.from(deduped.values());
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
    (enrollment as any)?.stream?.name ??
    (enrollment as any)?.stream ??
    (enrollment as any)?.streamLabel ??
    undefined;

  const className =
    getClasses().find((c) => c.id === classId)?.name ?? student.className ?? "";

  const enrolledSubjects = getEnrolledSubjectsFromEnrollment(enrollment);

  const subjects =
    enrolledSubjects.length > 0 ? enrolledSubjects : getSubjectsForClass(classId);

  const subjectRows: ReportSubjectRow[] = subjects.map((subject) => {
    const teacherAssignment = getSubjectTeacherAssignment({
      classId,
      subjectId: subject.id,
      streamName,
    });

    const teacher = teacherAssignment
      ? getTeacherById(teacherAssignment.teacherId)
      : null;

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
    overallGrade = gradeOLevel(overallAverage);
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
      isALevel: false,
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