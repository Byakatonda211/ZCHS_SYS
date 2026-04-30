"use client";

import React from "react";
import { useRouter } from "next/navigation";
import jsPDF from "jspdf";
import { Card, CardHeader, Button, Input, Select, Badge } from "@/components/ui";

type AcademicYearRow = {
  id: string;
  name: string;
  isCurrent?: boolean;
};

type TermRow = {
  id: string;
  name: string;
  type?: string;
  academicYearId: string;
  isCurrent?: boolean;
};

type ClassRow = {
  id: string;
  name: string;
  level?: string;
  order?: number;
  isActive?: boolean;
};

type StudentRow = {
  id: string;
  firstName: string;
  otherNames?: string | null;
  lastName: string;
  admissionNo?: string | null;
  studentNo?: string | null;
  classId?: string | null;
  streamId?: string | null;
  className?: string | null;
  streamName?: string | null;
};

type StudentsResponse =
  | StudentRow[]
  | {
      items?: StudentRow[];
      total?: number;
      page?: number;
      totalPages?: number;
    };

type ReportType = "O_MID" | "O_EOT" | "A_MID" | "A_EOT";

type StudentApiRow = {
  id: string;
  firstName: string;
  otherNames?: string | null;
  lastName: string;
  admissionNo?: string | null;
  studentNo?: string | null;
  profilePictureUrl?: string | null;
  photoUrl?: string | null;
  imageUrl?: string | null;
  passportPhotoUrl?: string | null;
  enrollments?: Array<{
    id: string;
    isActive?: boolean;
    classId: string;
    streamId?: string | null;
    class?: { id: string; name: string; level?: string | null } | null;
    stream?: { id: string; name: string } | null;
    subjects?: Array<{
      subjectId: string;
      subject?: {
        id: string;
        name: string;
      } | null;
    }>;
  }>;
};

type GradeDescriptorRow = {
  id?: string;
  grade: string;
  achievementLevel: string;
  minMark: number;
  maxMark: number;
  descriptor: string;
  order?: number;
};

type SchemeComponent = {
  assessmentId: string;
  label: string;
  enterOutOf: number;
  weightOutOf: number;
  order?: number;
};

type SchemeApiRow = {
  id: string;
  reportType: string;
  name: string;
  components: SchemeComponent[];
  gradeDescriptors?: GradeDescriptorRow[];
};

type MarksRow = {
  studentId: string;
  scoreRaw: number | string | null;
};

type SubjectPaperApiRow = {
  id: string;
  subjectId: string;
  name: string;
  code?: string | null;
  order?: number | null;
};

type ComponentScoreRow = {
  assessmentId: string;
  label: string;
  shortLabel: string;
  enterOutOf: number;
  weightOutOf: number;
  rawScore: number | null;
  weightedScore: number | null;
};

type PaperReportRow = {
  paperId: string;
  paperName: string;
  paperCode?: string | null;
  componentScores: ComponentScoreRow[];
  total: number | null;
};

type SubjectReportRow = {
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

type LoadedPdfImage = {
  dataUrl: string;
  format: "JPEG" | "PNG";
  width: number;
  height: number;
  alias?: string;
};

type StudentReportPayload = {
  student: StudentApiRow;
  scheme: SchemeApiRow;
  rows: SubjectReportRow[];
  gradeDescriptors: GradeDescriptorRow[];
  activeEnrollment: NonNullable<StudentApiRow["enrollments"]>[number];
  academicYearName: string;
  termName: string;
  headTeacherComment: string;
  reportType: ReportType;
};

const SCHOOL_NAME = "ZANA CHRISTIAN HIGH SCHOOL";
const SCHOOL_MOTTO = "IN GOD, WE TRUST";
const SCHOOL_ADDRESS = "P.O. Box 21312, Kampala, Uganda";
const SCHOOL_CONTACT = "Tel: 0773 748 168 / 0704 590 234";

const REPORT_BADGE_URL =
  process.env.NEXT_PUBLIC_REPORT_BADGE_URL || "/report-assets/badge.png";
const HEADTEACHER_SIGNATURE_URL =
  process.env.NEXT_PUBLIC_HEADTEACHER_SIGNATURE_URL ||
  "/report-assets/headteacher-signature.png";
const DEFAULT_STUDENT_PROFILE_URL =
  process.env.NEXT_PUBLIC_REPORT_STUDENT_PROFILE_URL ||
  "/report-assets/student-profile.png";

const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: "O_MID", label: "O-Level Mid" },
  { value: "O_EOT", label: "O-Level End" },
  { value: "A_MID", label: "A-Level Mid" },
  { value: "A_EOT", label: "A-Level End" },
];

const DEFAULT_O_LEVEL_DESCRIPTORS: GradeDescriptorRow[] = [
  {
    grade: "A",
    achievementLevel: "Exceptional",
    minMark: 85.0,
    maxMark: 100.0,
    descriptor:
      "Demonstrates an extraordinary level of competency by applying innovatively and creatively the acquired knowledge and skills in real-life situations.",
    order: 1,
  },
  {
    grade: "B",
    achievementLevel: "Outstanding",
    minMark: 70.0,
    maxMark: 84.99,
    descriptor:
      "Demonstrates a high level of competency by applying the acquired knowledge and skills in real-life situations.",
    order: 2,
  },
  {
    grade: "C",
    achievementLevel: "Satisfactory",
    minMark: 50.0,
    maxMark: 69.99,
    descriptor:
      "Demonstrates an adequate level of competency by applying the acquired knowledge and skills in real-life situations.",
    order: 3,
  },
  {
    grade: "D",
    achievementLevel: "Basic",
    minMark: 25.0,
    maxMark: 49.99,
    descriptor:
      "Demonstrates a minimum level of competency in applying the acquired knowledge and skills in real-life situations.",
    order: 4,
  },
  {
    grade: "E",
    achievementLevel: "Elementary",
    minMark: 0.0,
    maxMark: 24.99,
    descriptor:
      "Demonstrates below the basic level of competency in applying the acquired knowledge and skills in real-life situations.",
    order: 5,
  },
];

const DEFAULT_A_LEVEL_DESCRIPTORS: GradeDescriptorRow[] = [
  {
    grade: "A",
    achievementLevel: "Excellent",
    minMark: 80,
    maxMark: 100,
    descriptor: "Excellent performance with a very strong demonstration of knowledge and skill.",
    order: 1,
  },
  {
    grade: "B",
    achievementLevel: "Very Good",
    minMark: 75,
    maxMark: 79.99,
    descriptor: "Very good performance with clear understanding and sound application.",
    order: 2,
  },
  {
    grade: "C",
    achievementLevel: "Good",
    minMark: 60,
    maxMark: 74.99,
    descriptor: "Good performance showing adequate understanding and application.",
    order: 3,
  },
  {
    grade: "D",
    achievementLevel: "Credit",
    minMark: 50,
    maxMark: 59.99,
    descriptor: "Creditable performance with acceptable competence.",
    order: 4,
  },
  {
    grade: "E",
    achievementLevel: "Fair",
    minMark: 45,
    maxMark: 49.99,
    descriptor: "Fair performance with moderate competence.",
    order: 5,
  },
  {
    grade: "O",
    achievementLevel: "Pass",
    minMark: 40,
    maxMark: 44.99,
    descriptor: "Pass level performance with minimum acceptable competence.",
    order: 6,
  },
  {
    grade: "F",
    achievementLevel: "Fail",
    minMark: 0,
    maxMark: 39.99,
    descriptor: "Below the expected minimum standard.",
    order: 7,
  },
];

function getEffectiveGradeDescriptors(
  reportType: ReportType | string,
  schemeDescriptors?: GradeDescriptorRow[]
) {
  if (reportType === "A_MID" || reportType === "A_EOT") {
    return DEFAULT_A_LEVEL_DESCRIPTORS;
  }

  return Array.isArray(schemeDescriptors) && schemeDescriptors.length > 0
    ? schemeDescriptors
    : DEFAULT_O_LEVEL_DESCRIPTORS;
}

function getStudentProfileImageUrl(student: StudentApiRow | null) {
  if (!student) return DEFAULT_STUDENT_PROFILE_URL;
  return (
    student.profilePictureUrl ||
    student.photoUrl ||
    student.imageUrl ||
    student.passportPhotoUrl ||
    DEFAULT_STUDENT_PROFILE_URL
  );
}

function studentsFromResponse(data: StudentsResponse): StudentRow[] {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.items) ? data.items : [];
}

function studentsTotalPagesFromResponse(data: StudentsResponse): number {
  if (Array.isArray(data)) return 1;
  return Number(data?.totalPages ?? 1);
}

function studentsTotalFromResponse(data: StudentsResponse, fallback: number): number {
  if (Array.isArray(data)) return fallback;
  return Number(data?.total ?? fallback);
}

async function readJsonSafely<T = any>(res: Response, fallbackMessage: string): Promise<T> {
  const text = await res.text();

  if (!text.trim()) {
    if (!res.ok) throw new Error(`${fallbackMessage} (${res.status})`);
    return null as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    const preview = text.replace(/\s+/g, " ").slice(0, 220);
    throw new Error(
      `${fallbackMessage}. The server returned a non-JSON response (${res.status}). ${preview}`
    );
  }
}

async function fetchJsonSafely<T = any>(
  url: string,
  init: RequestInit,
  fallbackMessage: string
): Promise<T> {
  const res = await fetch(url, init);
  const data = await readJsonSafely<T>(res, fallbackMessage);

  if (!res.ok) {
    const apiError =
      typeof data === "object" && data && "error" in data
        ? String((data as any).error)
        : "";
    throw new Error(apiError || `${fallbackMessage} (${res.status})`);
  }

  return data;
}

function round2(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

function formatMark(value: number | null) {
  if (value === null || Number.isNaN(value)) return "—";
  const s = value.toFixed(2);
  return s.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function gradeScore(score: number | null, descriptors: GradeDescriptorRow[]) {
  if (score === null) return "—";

  const n = Number(score);
  if (!Number.isFinite(n)) return "—";

  const sorted = [...(descriptors || [])].sort(
    (a, b) => Number(a.minMark) - Number(b.minMark)
  );

  // Borderline rule: if a mark sits exactly on a shared boundary,
  // award the higher grade. Example: if 40-50 = E and 50-60 = D,
  // a mark of 50 should become D, not E.
  const epsilon = 0.000001;
  const matches = sorted.filter(
    (d) => n + epsilon >= Number(d.minMark) && n - epsilon <= Number(d.maxMark)
  );

  const found = matches.sort(
    (a, b) => Number(b.minMark) - Number(a.minMark)
  )[0];

  if (found?.grade) return found.grade;

  if (sorted.length > 0) {
    if (n < Number(sorted[0].minMark)) return sorted[0].grade || "—";
    if (n > Number(sorted[sorted.length - 1].maxMark)) {
      return sorted[sorted.length - 1].grade || "—";
    }
  }

  return "—";
}

function normalizeSubjectName(name: string) {
  return String(name || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function isTemporarySubsidiarySubject(subjectName: string) {
  const n = normalizeSubjectName(subjectName);
  return (
    n === "GENERAL PAPER" ||
    n === "GP" ||
    n === "SUBSIDIARY MATHEMATICS" ||
    n === "SUBSIDIARY MATH" ||
    n === "SUB MATH" ||
    n === "SUB MATHS" ||
    n === "INFORMATION AND COMMUNICATION TECHNOLOGY" ||
    n === "ICT"
  );
}

function gradeSubjectScore(subjectName: string, score: number | null, descriptors: GradeDescriptorRow[]) {
  if (isTemporarySubsidiarySubject(subjectName)) {
    if (score === null) return "—";
    return Number(score) >= 50 ? "O" : "F";
  }

  return gradeScore(score, descriptors);
}

function roundHalfUpToWhole(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n + 1e-6);
}

function formatPdfMark(value: number | null, reportType: ReportType) {
  if (value === null || Number.isNaN(Number(value))) return "—";
  if (reportType === "O_EOT" || reportType === "A_EOT") {
    const rounded = roundHalfUpToWhole(value);
    return rounded === null ? "—" : String(rounded);
  }
  return formatMark(value);
}

function getALevelPoints(subjectName: string, grade: string) {
  const g = String(grade || "").trim().toUpperCase();

  if (isTemporarySubsidiarySubject(subjectName)) {
    if (["A", "B", "C", "D", "E", "O"].includes(g)) return 1;
    return 0;
  }

  switch (g) {
    case "A":
      return 6;
    case "B":
      return 5;
    case "C":
      return 4;
    case "D":
      return 3;
    case "E":
      return 2;
    case "O":
      return 1;
    case "F":
      return 0;
    default:
      return 0;
  }
}

function safeFileName(name: string) {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "").replace(/\s+/g, " ").trim();
}

function extractTermNumber(termName: string, fallback = "1") {
  const match = String(termName || "").match(/(\d+)/);
  return match?.[1] || fallback;
}

function getReportHeading(reportType: string, termName: string, academicYearName: string) {
  const termNo = extractTermNumber(termName, "1");
  const year = String(academicYearName || "").trim() || "—";

  if (reportType === "O_MID" || reportType === "A_MID") {
    return `MIDTERM ${termNo} ACADEMIC REPORT CARD ${year}`;
  }

  if (reportType === "O_EOT" || reportType === "A_EOT") {
    return `END OF TERM ${termNo} ACADEMIC REPORT CARD ${year}`;
  }

  return `ACADEMIC REPORT CARD ${year}`;
}

function toShortAssessmentLabel(label: string, index: number, reportType?: ReportType) {
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

  if (clean.includes("MID")) return `CA ${index + 1}`;
  if (clean.includes("EXAM")) return "EXAM";
  if (clean.includes("EOT")) return "EXAM";
  if (clean.includes("FINAL")) return "EXAM";

  return `CA ${index + 1}`;
}

function reportTypeLabel(reportType: string) {
  switch (reportType) {
    case "O_MID":
      return "O-Level Mid Term";
    case "O_EOT":
      return "O-Level End of Term";
    case "A_MID":
      return "A-Level Mid Term";
    case "A_EOT":
      return "A-Level End of Term";
    default:
      return reportType;
  }
}

function averageNumbers(values: Array<number | null | undefined>) {
  const nums = values.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  if (nums.length === 0) return null;
  return round2(nums.reduce((sum, v) => sum + v, 0) / nums.length);
}

function averageRawNumbers(values: Array<number | null | undefined>) {
  const nums = values.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  if (nums.length === 0) return null;
  return nums.reduce((sum, v) => sum + v, 0) / nums.length;
}

function sumNumbers(values: Array<number | null | undefined>) {
  const nums = values.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  if (nums.length === 0) return null;
  return round2(nums.reduce((sum, v) => sum + v, 0));
}

function paperDisplayName(paper: { name?: string | null; code?: string | null }) {
  const code = String(paper.code || "").trim();
  const name = String(paper.name || "").trim();
  return code || name || "Paper";
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function blobToCompressedJpegData(
  blob: Blob,
  quality = 0.72
): Promise<{ dataUrl: string; width: number; height: number }> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = objectUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = img.width || 1;
    canvas.height = img.height || 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context unavailable");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    return {
      dataUrl,
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function loadPdfImage(url: string, alias: string): Promise<LoadedPdfImage | null> {
  try {
    const absoluteUrl =
      typeof window !== "undefined" && url.startsWith("/")
        ? `${window.location.origin}${url}`
        : url;

    const res = await fetch(absoluteUrl, { cache: "force-cache" });
    if (!res.ok) return null;

    const blob = await res.blob();

    const isPng =
      blob.type === "image/png" ||
      absoluteUrl.toLowerCase().includes(".png") ||
      alias === "badge" ||
      alias === "profile" ||
      alias === "signature";

    if (isPng) {
      const dataUrl = await blobToDataUrl(blob);
      const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => resolve({ width: img.width || 1, height: img.height || 1 });
        img.onerror = reject;
        img.src = dataUrl;
      });

      return {
        dataUrl,
        format: "PNG",
        width: size.width,
        height: size.height,
        alias,
      };
    }

    const compressed = await blobToCompressedJpegData(blob, 0.72);

    return {
      dataUrl: compressed.dataUrl,
      format: "JPEG",
      width: compressed.width,
      height: compressed.height,
      alias,
    };
  } catch {
    return null;
  }
}

async function buildStudentReportPayload(params: {
  studentId: string;
  yearId: string;
  termId: string;
  reportType: ReportType;
}): Promise<StudentReportPayload> {
  const { studentId, yearId, termId, reportType } = params;
  const isALevelReport = reportType === "A_MID" || reportType === "A_EOT";

  const [studentData, schemeData, yearsData] = await Promise.all([
    fetchJsonSafely(`/api/students/${encodeURIComponent(studentId)}`, {
      cache: "no-store",
      credentials: "include",
    }, "Failed to load student"),
    fetchJsonSafely(`/api/schemes?reportType=${encodeURIComponent(reportType)}`, {
      cache: "no-store",
      credentials: "include",
    }, "Failed to load report scheme"),
    fetchJsonSafely(`/api/academic-years`, {
      cache: "no-store",
      credentials: "include",
    }, "Failed to load academic years"),
  ]);

  const loadedStudent: StudentApiRow | null = studentData?.student ?? null;
  if (!loadedStudent) throw new Error("Student not found.");

  const activeEnrollmentFound =
     loadedStudent.enrollments?.find((e) => e?.isActive) ?? null;
  if (!activeEnrollmentFound) throw new Error("Student has no active enrollment.");

  const activeEnrollment = activeEnrollmentFound;

  const enrolledSubjectsMap = new Map<string, { subjectId: string; subjectName: string }>();
  for (const s of activeEnrollment.subjects || []) {
    const subjectId = String(s?.subjectId || "").trim();
    const subjectName = String(s?.subject?.name || "").trim() || "Unnamed Subject";
    if (subjectId && !enrolledSubjectsMap.has(subjectId)) {
      enrolledSubjectsMap.set(subjectId, { subjectId, subjectName });
    }
  }

  const enrolledSubjects = Array.from(enrolledSubjectsMap.values());

  const loadedScheme: SchemeApiRow = {
    ...schemeData,
    components: (schemeData.components || []).map(
      (component: SchemeComponent, index: number) => ({
        ...component,
        label: component.label || `Assessment ${index + 1}`,
        enterOutOf: Number(component.enterOutOf ?? 100),
        weightOutOf: Number(component.weightOutOf ?? 0),
      })
    ),
    gradeDescriptors: getEffectiveGradeDescriptors(
      reportType,
      Array.isArray(schemeData.gradeDescriptors)
        ? schemeData.gradeDescriptors.map((g: any) => ({
            ...g,
            minMark: Number(g.minMark),
            maxMark: Number(g.maxMark),
          }))
        : []
    ),
  };

  const foundYear = (Array.isArray(yearsData) ? yearsData : []).find(
    (y: AcademicYearRow) => y.id === yearId
  );

  const termsData = await fetchJsonSafely(
    `/api/terms?academicYearId=${encodeURIComponent(yearId)}`,
    { cache: "no-store", credentials: "include" },
    "Failed to load terms"
  );

  const foundTerm = (Array.isArray(termsData) ? termsData : []).find(
    (t: TermRow) => t.id === termId
  );

  const metaParams = new URLSearchParams({
    classId: activeEnrollment.classId,
  });
  if (activeEnrollment.streamId) metaParams.set("streamId", activeEnrollment.streamId);

  let metaData: any = {};
  try {
    metaData = await fetchJsonSafely(`/api/report-card-meta?${metaParams.toString()}`, {
      cache: "no-store",
      credentials: "include",
    }, "Failed to load report metadata");
  } catch (err) {
    console.warn("Report metadata could not be loaded; continuing with blank teacher initials.", err);
  }

  const teacherMap: Record<string, string> = metaData?.subjectTeachers || {};
  const provisionalRows: Omit<SubjectReportRow, "teacherComment">[] = [];

  async function fetchComponentScore(
    subjectId: string,
    component: SchemeComponent,
    index: number,
    subjectPaperId?: string | null
  ): Promise<ComponentScoreRow> {
    const params = new URLSearchParams({
      academicYearId: yearId,
      termId,
      assessmentDefinitionId: component.assessmentId,
      classId: activeEnrollment.classId,
      subjectId,
    });

    if (subjectPaperId) {
      params.set("subjectPaperId", subjectPaperId);
    }

    let marksData: any[] = [];
    try {
      marksData = await fetchJsonSafely(`/api/marks?${params.toString()}`, {
        cache: "no-store",
        credentials: "include",
      }, `Failed to load marks for subject ${subjectId}`);
    } catch (err) {
      console.warn("Marks could not be loaded; using blank score.", {
        studentId,
        subjectId,
        subjectPaperId,
        err,
      });
    }

    const studentMark = Array.isArray(marksData)
      ? (marksData as MarksRow[]).find((m) => m.studentId === studentId)
      : null;

    const rawScore = round2(studentMark?.scoreRaw);
    const enterOutOf = Number(component.enterOutOf ?? 100);
    const weightOutOf = Number(component.weightOutOf ?? 0);

    const weightedScore =
      rawScore === null
        ? null
        : round2((rawScore * weightOutOf) / Math.max(enterOutOf, 0.01));

    return {
      assessmentId: component.assessmentId,
      label: component.label,
      shortLabel: toShortAssessmentLabel(component.label, index, reportType),
      enterOutOf,
      weightOutOf,
      rawScore,
      weightedScore,
    };
  }

  for (const subject of enrolledSubjects) {
    if (isALevelReport) {
      let papersData: any[] = [];
      try {
        papersData = await fetchJsonSafely(
          `/api/subjects/${encodeURIComponent(subject.subjectId)}/papers`,
          {
            cache: "no-store",
            credentials: "include",
          },
          `Failed to load papers for ${subject.subjectName}`
        );
      } catch (err) {
        console.warn("Subject papers could not be loaded; treating subject as non-paper-based.", {
          studentId,
          subjectId: subject.subjectId,
          err,
        });
      }

      const subjectPapers: SubjectPaperApiRow[] = Array.isArray(papersData) ? papersData : [];

      if (subjectPapers.length > 0) {
        const paperRows: PaperReportRow[] = await Promise.all(
          subjectPapers.map(async (paper) => {
            const componentScores = await Promise.all(
              loadedScheme.components.map((component, i) =>
                fetchComponentScore(subject.subjectId, component, i, paper.id)
              )
            );

            const total = sumNumbers(componentScores.map((c) => c.weightedScore));

            return {
              paperId: paper.id,
              paperName: paperDisplayName(paper),
              paperCode: paper.code || null,
              componentScores,
              total,
            };
          })
        );

        const subjectTotalRaw =
          reportType === "A_EOT"
            ? averageRawNumbers(paperRows.map((p) => roundHalfUpToWhole(p.total)))
            : averageRawNumbers(paperRows.map((p) => p.total));

        const subjectTotal =
          reportType === "A_EOT"
            ? roundHalfUpToWhole(subjectTotalRaw)
            : subjectTotalRaw === null
            ? null
            : round2(subjectTotalRaw);

        const subjectGrade = gradeSubjectScore(
          subject.subjectName,
          subjectTotal,
          loadedScheme.gradeDescriptors || DEFAULT_O_LEVEL_DESCRIPTORS
        );

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

    const componentScores = await Promise.all(
      loadedScheme.components.map((component, i) =>
        fetchComponentScore(subject.subjectId, component, i)
      )
    );

    const totalRaw = sumNumbers(componentScores.map((c) => c.weightedScore));
    const total = reportType === "A_EOT" && totalRaw !== null ? roundHalfUpToWhole(totalRaw) : totalRaw;

    provisionalRows.push({
      subjectId: subject.subjectId,
      subjectName: subject.subjectName,
      componentScores,
      total,
      grade: gradeSubjectScore(
        subject.subjectName,
        total,
        loadedScheme.gradeDescriptors || DEFAULT_O_LEVEL_DESCRIPTORS
      ),
      teacherInitials: teacherMap[subject.subjectId] || "—",
      papers: [],
      isPaperBased: false,
    });
  }

  const totals = provisionalRows
    .map((r) => r.total)
    .filter((x): x is number => typeof x === "number");

  const overallAverage =
    totals.length > 0
      ? round2(totals.reduce((sum, v) => sum + v, 0) / totals.length)
      : null;

  const overallGrade = gradeScore(
    overallAverage,
    loadedScheme.gradeDescriptors || DEFAULT_O_LEVEL_DESCRIPTORS
  );

  const [remarkModule, storeModule] = await Promise.all([
    import("@/lib/store"),
    import("@/lib/store"),
  ]);

  const override = storeModule.getRemarkOverride({
    studentId,
    academicYearId: yearId,
    termId,
    reportType,
  });

  const subjectRows: SubjectReportRow[] = provisionalRows.map((row) => {
    const subjectComment =
      remarkModule.pickRemark({
        target: "teacher",
        reportType,
        grade: row.grade,
        score: row.total,
      }) ?? "—";

    return {
      ...row,
      teacherComment: subjectComment,
    };
  });

  const computedHeadTeacherComment =
    override?.headTeacherComment ??
    remarkModule.pickRemark({
      target: "headTeacher",
      reportType,
      grade: overallGrade,
      score: overallAverage,
    }) ??
    "—";

  return {
    student: loadedStudent,
    scheme: loadedScheme,
    rows: subjectRows,
    gradeDescriptors: loadedScheme.gradeDescriptors || DEFAULT_O_LEVEL_DESCRIPTORS,
    activeEnrollment,
    academicYearName: foundYear?.name || yearId,
    termName: foundTerm?.name || termId,
    headTeacherComment: computedHeadTeacherComment,
    reportType,
  };
}

function renderStudentReportPage(
  pdf: jsPDF,
  payload: StudentReportPayload,
  assets: {
    badgeImage: LoadedPdfImage | null;
    signatureImage: LoadedPdfImage | null;
    profileImage: LoadedPdfImage | null;
  },
  isFirstPage: boolean
) {
  if (!isFirstPage) pdf.addPage();

  const {
    student,
    scheme,
    rows,
    gradeDescriptors,
    activeEnrollment,
    academicYearName,
    termName,
    headTeacherComment,
    reportType,
  } = payload;

  const isALevelReport = reportType === "A_MID" || reportType === "A_EOT";
  const isOLevelReport = reportType === "O_MID" || reportType === "O_EOT";
  const fullName = [student.firstName, student.otherNames, student.lastName]
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .join(" ");
  const studentNo = student.admissionNo || student.studentNo || "No admission number";
  const className = activeEnrollment?.class?.name || "—";
  const reportHeading = getReportHeading(reportType, termName, academicYearName);

  const totals = rows
    .map((r) => r.total)
    .filter((x): x is number => typeof x === "number");

  const overallAverage =
    totals.length > 0
      ? round2(totals.reduce((sum, v) => sum + v, 0) / totals.length)
      : null;

  const overallGrade = gradeScore(overallAverage, gradeDescriptors);

  const totalPoints = isALevelReport
    ? rows.reduce((sum, row) => sum + getALevelPoints(row.subjectName, row.grade), 0)
    : null;

  const bestRow =
    rows
      .filter((r) => typeof r.total === "number")
      .sort((a, b) => (b.total as number) - (a.total as number))[0] || null;

  const lowestRow =
    rows
      .filter((r) => typeof r.total === "number")
      .sort((a, b) => (a.total as number) - (b.total as number))[0] || null;

  const badgeImage = assets.badgeImage;
  const signatureImage = assets.signatureImage;
  const profileImage = assets.profileImage;
  void signatureImage;

  const left = 6.2;
  const usableWidth = 197.6;
  const pageBottom = 287;
  let y = 6.0;

  const hasPapers = isALevelReport && rows.some((r) => (r.papers || []).length > 0);
  const visualLoad =
    rows.length +
    (hasPapers
      ? rows.reduce((n, r) => n + Math.max((r.papers?.length || 0) - 1, 0), 0)
      : 0);

  const density: "normal" | "compact" | "tight" =
    visualLoad >= 18 ? "tight" : visualLoad >= 15 ? "compact" : "normal";

  const compactPdf = density !== "normal";
  const tightPdf = density === "tight";

  const loosenFactor = tightPdf ? 0 : compactPdf ? 0.04 : 0.12;

  const COLORS = {
    bodyText: [30, 41, 59] as [number, number, number],
    headerText: [17, 50, 83] as [number, number, number],
    mutedText: [71, 85, 105] as [number, number, number],
    border: [176, 190, 205] as [number, number, number],
    slateFill: [250, 252, 247] as [number, number, number],
    headerFill: [255, 253, 247] as [number, number, number],
    imageBoxFill: [246, 249, 244] as [number, number, number],
    primaryDark: [25, 77, 112] as [number, number, number],
    primarySoft: [225, 240, 249] as [number, number, number],
    secondaryDark: [28, 116, 88] as [number, number, number],
    secondarySoft: [224, 243, 234] as [number, number, number],
    accentDark: [178, 82, 49] as [number, number, number],
    accentSoft: [255, 240, 224] as [number, number, number],
  };

  const drawText = (
    text: string,
    x: number,
    yy: number,
    opts?: {
      size?: number;
      style?: "normal" | "bold";
      align?: "left" | "center" | "right";
      color?: [number, number, number];
    }
  ) => {
    pdf.setFont("helvetica", opts?.style || "normal");
    pdf.setFontSize(opts?.size || 10);
    const color = opts?.color || COLORS.bodyText;
    pdf.setTextColor(color[0], color[1], color[2]);
    pdf.text(text, x, yy, { align: opts?.align || "left" });
    pdf.setTextColor(COLORS.bodyText[0], COLORS.bodyText[1], COLORS.bodyText[2]);
  };

  const drawBox = (
    x: number,
    yy: number,
    w: number,
    h: number,
    fillRgb?: [number, number, number],
    radius = 1.2
  ) => {
    const squareCorners = radius <= 0;

    if (fillRgb) {
      pdf.setFillColor(fillRgb[0], fillRgb[1], fillRgb[2]);
      if (squareCorners) {
        pdf.rect(x, yy, w, h, "F");
      } else {
        pdf.roundedRect(x, yy, w, h, radius, radius, "F");
      }
    }
    pdf.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
    if (squareCorners) {
      pdf.rect(x, yy, w, h);
    } else {
      pdf.roundedRect(x, yy, w, h, radius, radius);
    }
  };

  const estimateCellHeight = (
    text: string,
    width: number,
    fontSize: number,
    lineHeight = 3.2,
    horizontalPadding = 2
  ) => {
    pdf.setFontSize(fontSize);
    const lines = pdf.splitTextToSize(
      String(text || ""),
      Math.max(width - horizontalPadding, 1)
    );
    return Math.max(lines.length, 1) * lineHeight + 2.2;
  };

  const drawCell = (
    text: string,
    x: number,
    yy: number,
    w: number,
    h: number,
    opts?: {
      align?: "left" | "center" | "right";
      bold?: boolean;
      fill?: boolean;
      fillColor?: [number, number, number];
      size?: number;
      valign?: "top" | "middle";
      textColor?: [number, number, number];
      lineHeight?: number;
    }
  ) => {
    const fontSize = opts?.size || 7.8;
    const lineHeight = opts?.lineHeight || 3.2;

    if (opts?.fill) {
      const fill = opts.fillColor || COLORS.slateFill;
      pdf.setFillColor(fill[0], fill[1], fill[2]);
      pdf.rect(x, yy, w, h, "F");
    }

    pdf.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
    pdf.rect(x, yy, w, h);

    pdf.setFont("helvetica", opts?.bold ? "bold" : "normal");
    pdf.setFontSize(fontSize);

    const textColor = opts?.textColor || COLORS.bodyText;
    pdf.setTextColor(textColor[0], textColor[1], textColor[2]);

    const align = opts?.align || "left";
    const lines = pdf.splitTextToSize(String(text || ""), Math.max(w - 2, 1));

    let tx = x + 1;
    if (align === "center") tx = x + w / 2;
    if (align === "right") tx = x + w - 1;

    const totalTextHeight = Math.max(lines.length, 1) * lineHeight;
    const startY =
      opts?.valign === "middle"
        ? yy + Math.max((h - totalTextHeight) / 2 + 2.3, 3.2)
        : yy + 3.7;

    lines.slice(0, 8).forEach((line: string, idx: number) => {
      pdf.text(line, tx, startY + idx * lineHeight, { align });
    });

    pdf.setTextColor(COLORS.bodyText[0], COLORS.bodyText[1], COLORS.bodyText[2]);
  };

  const drawImageFit = (
    image: LoadedPdfImage,
    x: number,
    yy: number,
    maxW: number,
    maxH: number
  ) => {
    const aspect = image.width / Math.max(image.height, 1);
    let drawW = maxW;
    let drawH = drawW / aspect;

    if (drawH > maxH) {
      drawH = maxH;
      drawW = drawH * aspect;
    }

    const dx = x + (maxW - drawW) / 2;
    const dy = yy + (maxH - drawH) / 2;

    pdf.addImage(
      image.dataUrl,
      image.format,
      dx,
      dy,
      drawW,
      drawH,
      image.alias,
      "MEDIUM"
    );
  };

  const ensurePageSpace = (requiredHeight: number) => {
    if (y + requiredHeight <= pageBottom) return;
    pdf.addPage();
    y = 8;
  };

  const headerH = tightPdf ? 24.8 : compactPdf ? 27.4 : 31.8;
  const headerBandH = tightPdf ? 5.0 : compactPdf ? 5.5 : 6.5;

  const outerPad = tightPdf ? 1.4 : 1.6;
  const sideSlotW = tightPdf ? 35 : compactPdf ? 39 : 43;
  const sideBoxW = sideSlotW - 1.2;
  const sideBoxH = headerH - 3.2;
  const sideBoxY = y + 1.2;

  drawBox(left, y, usableWidth, headerH, COLORS.headerFill, 2.2);

  if (badgeImage) {
    const badgeBoxX = left + outerPad;
    drawBox(
      badgeBoxX,
      sideBoxY,
      sideBoxW,
      sideBoxH,
      badgeImage.format === "PNG" ? undefined : COLORS.imageBoxFill,
      1.2
    );
    drawImageFit(
      badgeImage,
      badgeBoxX + 0.3,
      sideBoxY + 0.3,
      sideBoxW - 0.6,
      sideBoxH - 0.6
    );
  }

  if (profileImage) {
    const profileBoxX = left + usableWidth - outerPad - sideBoxW;
    drawBox(
      profileBoxX,
      sideBoxY,
      sideBoxW,
      sideBoxH,
      profileImage.format === "PNG" ? undefined : COLORS.imageBoxFill,
      1.2
    );
    drawImageFit(
      profileImage,
      profileBoxX + 0.3,
      sideBoxY + 0.3,
      sideBoxW - 0.6,
      sideBoxH - 0.6
    );
  }

  const contentLeft = left + sideSlotW + (tightPdf ? 2 : 3);
  const contentRight = left + usableWidth - sideSlotW - (tightPdf ? 2 : 3);
  const contentWidth = contentRight - contentLeft;
  const contentCenterX = left + usableWidth / 2;

  drawText(SCHOOL_NAME, contentCenterX, y + (tightPdf ? 6.1 : compactPdf ? 6.9 : 7.8), {
    size: tightPdf ? 14 : compactPdf ? 15.2 : 16.8,
    style: "bold",
    align: "center",
    color: COLORS.headerText,
  });
  drawText(SCHOOL_MOTTO, contentCenterX, y + (tightPdf ? 9.9 : compactPdf ? 10.9 : 12.5), {
    size: tightPdf ? 7.6 : compactPdf ? 8.2 : 9.0,
    align: "center",
    color: COLORS.secondaryDark,
  });
  drawText(
    `${SCHOOL_ADDRESS} • ${SCHOOL_CONTACT}`,
    contentCenterX,
    y + (tightPdf ? 13.2 : compactPdf ? 14.5 : 17.1),
    {
      size: tightPdf ? 6.7 : compactPdf ? 7.2 : 8.0,
      align: "center",
      color: COLORS.mutedText,
    }
  );

  const bandX = contentLeft + (tightPdf ? 7 : compactPdf ? 8 : 10);
  const bandW = contentWidth - (tightPdf ? 14 : compactPdf ? 16 : 20);
  drawBox(
    bandX,
    y + headerH - headerBandH - 1.5,
    bandW,
    headerBandH,
    COLORS.primaryDark,
    1.2
  );
  drawText(
    reportHeading,
    contentCenterX,
    y + headerH - (tightPdf ? 2.1 : compactPdf ? 2.25 : 2.45),
    {
      size: tightPdf ? 7.2 : compactPdf ? 7.9 : 8.9,
      style: "bold",
      align: "center",
      color: [255, 255, 255],
    }
  );

  y += headerH + (tightPdf ? 1.8 : compactPdf ? 2.2 : 2.5);

  const infoGap = 2;
  const infoH = isOLevelReport ? 10.8 : tightPdf ? 7.9 : compactPdf ? 8.5 : 9.4;
  const nameW = tightPdf ? 95 : compactPdf ? 98 : 100;
  const numberW = tightPdf ? 51 : compactPdf ? 53 : 55;
  const classW = usableWidth - nameW - numberW - infoGap * 2;

  const drawInlineInfoBox = (
    x: number,
    yy: number,
    w: number,
    h: number,
    label: string,
    value: string
  ) => {
    drawBox(x, yy, w, h, [255, 255, 255], 1.4);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(isOLevelReport ? 9.6 : tightPdf ? 7.2 : compactPdf ? 7.6 : 8.4);
    pdf.setTextColor(
      COLORS.primaryDark[0],
      COLORS.primaryDark[1],
      COLORS.primaryDark[2]
    );
    const labelText = `${label}:`;
    pdf.text(labelText, x + 2, yy + h / 2 + 1.1);

    const labelWidth = pdf.getTextWidth(labelText);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(isOLevelReport ? 9.6 : tightPdf ? 7.2 : compactPdf ? 7.6 : 8.4);
    pdf.setTextColor(COLORS.bodyText[0], COLORS.bodyText[1], COLORS.bodyText[2]);
    pdf.text(String(value || "—"), x + 2 + labelWidth + 1.2, yy + h / 2 + 1.1);
  };

  drawInlineInfoBox(left, y, nameW, infoH, "Name", fullName);
  drawInlineInfoBox(left + nameW + infoGap, y, numberW, infoH, "Student No", studentNo);
  drawInlineInfoBox(
    left + nameW + infoGap + numberW + infoGap,
    y,
    classW,
    infoH,
    "Class",
    className
  );

  y += isOLevelReport ? 12.6 : tightPdf ? 8.8 : compactPdf ? 9.8 : 11.2;

  const summaryBandH = tightPdf ? 5.4 : compactPdf ? 5.8 : 6.9;
  drawBox(left, y, usableWidth, summaryBandH, COLORS.secondaryDark, 0);
  drawText("SUMMARY RESULTS", left + 2, y + (tightPdf ? 3.85 : compactPdf ? 4.15 : 4.95), {
    size: tightPdf ? 7.2 : compactPdf ? 11.2 : 8.7,
    style: "bold",
    color: [255, 255, 255],
  });
  y += tightPdf ? 5.7 : compactPdf ? 6.2 : 7.6;

  const isSummaryWithPoints = isALevelReport;

  const s1 = isSummaryWithPoints ? 38 : 49;
  const s2 = isSummaryWithPoints ? 28 : 36;
  const s3 = isSummaryWithPoints ? 28 : 0;
  const s4 = isSummaryWithPoints ? 51.8 : 56.3;
  const s5 = isSummaryWithPoints ? 51.8 : 56.3;

  const summaryHeadH = isOLevelReport ? 9.8 : tightPdf ? 6.2 : compactPdf ? 6.8 : 7.9;
  const summaryRowH = isOLevelReport ? 13.0 : tightPdf ? 6.4 : compactPdf ? 7.0 : 8.4;

  drawCell("Overall Average", left, y, s1, summaryHeadH, {
    bold: true,
    fill: true,
    fillColor: COLORS.secondarySoft,
    size: isOLevelReport ? 8.8 : tightPdf ? 6.0 : compactPdf ? 6.4 : 7.4,
  });
  drawCell("Final Grade", left + s1, y, s2, summaryHeadH, {
    bold: true,
    fill: true,
    fillColor: COLORS.secondarySoft,
    size: isOLevelReport ? 8.8 : tightPdf ? 6.0 : compactPdf ? 6.4 : 7.4,
  });

  if (isSummaryWithPoints) {
    drawCell("Total Points", left + s1 + s2, y, s3, summaryHeadH, {
      bold: true,
      fill: true,
      fillColor: COLORS.secondarySoft,
      size: isOLevelReport ? 8.8 : tightPdf ? 6.0 : compactPdf ? 6.4 : 7.4,
    });
  }

  drawCell(
    "Best Score",
    left + s1 + s2 + (isSummaryWithPoints ? s3 : 0),
    y,
    s4,
    summaryHeadH,
    {
      bold: true,
      fill: true,
      fillColor: COLORS.secondarySoft,
      size: isOLevelReport ? 8.8 : tightPdf ? 6.0 : compactPdf ? 6.4 : 7.4,
    }
  );
  drawCell(
    "Lowest Score",
    left + s1 + s2 + (isSummaryWithPoints ? s3 : 0) + s4,
    y,
    s5,
    summaryHeadH,
    {
      bold: true,
      fill: true,
      fillColor: COLORS.secondarySoft,
      size: isOLevelReport ? 8.8 : tightPdf ? 6.0 : compactPdf ? 6.4 : 7.4,
    }
  );

  y += summaryHeadH;

  drawCell(formatPdfMark(overallAverage, reportType), left, y, s1, summaryRowH, {
    align: "center",
    bold: true,
    size: isOLevelReport ? 9.2 : tightPdf ? 6.1 : compactPdf ? 6.5 : 7.7,
    valign: "middle",
  });
  drawCell(overallGrade, left + s1, y, s2, summaryRowH, {
    align: "center",
    bold: true,
    size: isOLevelReport ? 9.2 : tightPdf ? 6.1 : compactPdf ? 6.5 : 7.7,
    valign: "middle",
  });

  if (isSummaryWithPoints) {
    drawCell(String(totalPoints ?? 0), left + s1 + s2, y, s3, summaryRowH, {
      align: "center",
      bold: true,
      size: isOLevelReport ? 9.2 : tightPdf ? 6.1 : compactPdf ? 6.5 : 7.7,
      valign: "middle",
    });
  }

  drawCell(
    bestRow ? `${formatPdfMark(bestRow.total, reportType)} (${bestRow.subjectName})` : "—",
    left + s1 + s2 + (isSummaryWithPoints ? s3 : 0),
    y,
    s4,
    summaryRowH,
    {
      align: "center",
      bold: true,
      size: isOLevelReport ? 9.4 : tightPdf ? 5.4 : compactPdf ? 5.8 : 6.8,
      valign: "middle",
    }
  );
  drawCell(
    lowestRow ? `${formatPdfMark(lowestRow.total, reportType)} (${lowestRow.subjectName})` : "—",
    left + s1 + s2 + (isSummaryWithPoints ? s3 : 0) + s4,
    y,
    s5,
    summaryRowH,
    {
      align: "center",
      bold: true,
      size: isOLevelReport ? 9.4 : tightPdf ? 5.4 : compactPdf ? 5.8 : 6.8,
      valign: "middle",
    }
  );

  y += summaryRowH + (isOLevelReport ? 4.3 : tightPdf ? 1.6 : compactPdf ? 2.0 : 2.4);

  const subjectBandH = tightPdf ? 5.4 : compactPdf ? 5.8 : 6.9;
  drawBox(left, y, usableWidth, subjectBandH, COLORS.primaryDark, 0);
  drawText(
    "SUBJECT ACHIEVEMENT LEVEL",
    left + 2,
    y + (tightPdf ? 3.85 : compactPdf ? 4.15 : 4.95),
    {
      size: tightPdf ? 7.2 : compactPdf ? 11.2 : 8.7,
      style: "bold",
      color: [255, 255, 255],
    }
  );
  y += isOLevelReport ? 9.6 : tightPdf ? 5.7 : compactPdf ? 6.2 : 7.6;

  const componentCount = scheme.components.length;

  let subjectW = hasPapers
    ? tightPdf
      ? 23
      : compactPdf
      ? 24
      : 29
    : tightPdf
    ? 33
    : compactPdf
    ? 35
    : 41;

  let paperW = hasPapers ? (tightPdf ? 14 : compactPdf ? 15 : 18) : 0;

  let componentW = hasPapers
    ? componentCount <= 2
      ? tightPdf
        ? 16
        : compactPdf
        ? 17
        : 19
      : componentCount === 3
      ? tightPdf
        ? 12
        : compactPdf
        ? 13
        : 15
      : tightPdf
      ? 9.8
      : compactPdf
      ? 10.6
      : 12.2
    : componentCount <= 2
    ? tightPdf
      ? 14.5
      : compactPdf
      ? 15.5
      : 17.5
    : componentCount === 3
    ? tightPdf
      ? 12.2
      : compactPdf
      ? 13.2
      : 15.2
    : tightPdf
    ? 10.4
    : compactPdf
    ? 11.2
    : 13.0;

  let totalW = tightPdf ? 10.4 : compactPdf ? 11.2 : 13.6;
  let gradeW = tightPdf ? 9.2 : compactPdf ? 10.0 : 12.4;
  let initialsW = tightPdf ? 8.5 : compactPdf ? 9.2 : 11.0;

  const widthSlack = Math.min(5.5, 2.5 + visualLoad * 0.12) * loosenFactor;
  subjectW += widthSlack * 1.6;
  totalW += widthSlack * 0.25;
  gradeW += widthSlack * 0.2;

  let commentW =
    usableWidth -
    (subjectW +
      paperW +
      componentCount * componentW +
      totalW +
      gradeW +
      initialsW);

  const minCommentW = tightPdf ? 35 : compactPdf ? 38 : 47;
  if (commentW < minCommentW) {
    const needed = minCommentW - commentW;
    commentW += needed;
    subjectW -= Math.min(needed, 3);
  } else if (!tightPdf) {
    const subjectBoost = Math.min(4, commentW - minCommentW) * 0.35;
    const commentBoost = Math.min(6, commentW - minCommentW) * 0.4;
    subjectW += subjectBoost;
    commentW -= subjectBoost;
    commentW += commentBoost;
  }

  if (isOLevelReport) {
    paperW = 0;
    subjectW = 39;
    componentW = componentCount <= 2 ? 18 : componentCount === 3 ? 16 : 13.5;
    totalW = 15;
    gradeW = 14;
    initialsW = 14;
    commentW = usableWidth - (subjectW + componentCount * componentW + totalW + gradeW + initialsW);
    if (commentW < 45) {
      const deficit = 45 - commentW;
      commentW += deficit;
      subjectW = Math.max(34, subjectW - deficit);
    }
  }

  const tableWidth =
    subjectW + paperW + componentCount * componentW + totalW + gradeW + commentW + initialsW;

  const tableLeft = left;

  let x = tableLeft;
  const subjectHeadH = isOLevelReport ? 9.4 : tightPdf ? 6.4 : compactPdf ? 7.0 : 8.6;

  drawCell("Subject", x, y, subjectW, subjectHeadH, {
    bold: true,
    fill: true,
    fillColor: COLORS.primarySoft,
    size: isOLevelReport ? 10.2 : tightPdf ? 6.1 : compactPdf ? 6.5 : 7.4,
  });
  x += subjectW;

  if (hasPapers) {
    drawCell("Paper", x, y, paperW, subjectHeadH, {
      bold: true,
      fill: true,
      fillColor: COLORS.primarySoft,
      size: isOLevelReport ? 10.2 : tightPdf ? 6.1 : compactPdf ? 6.5 : 7.4,
      align: "center",
    });
    x += paperW;
  }

  for (let i = 0; i < scheme.components.length; i++) {
    const component = scheme.components[i];
    drawCell(
      `${toShortAssessmentLabel(component.label, i, reportType)}\n(Out of ${formatMark(
        component.weightOutOf
      )})`,
      x,
      y,
      componentW,
      subjectHeadH,
      {
        bold: true,
        fill: true,
        fillColor: COLORS.primarySoft,
        align: "center",
        size: isOLevelReport
          ? 7.6
          : tightPdf
          ? 5.2
          : compactPdf
          ? 5.7
          : hasPapers && scheme.components.length <= 2
          ? 6.8
          : 6.4,
        lineHeight: isOLevelReport ? 2.65 : tightPdf ? 2.4 : 2.7,
      }
    );
    x += componentW;
  }

  drawCell("Total", x, y, totalW, subjectHeadH, {
    bold: true,
    fill: true,
    fillColor: COLORS.primarySoft,
    align: "center",
    size: isOLevelReport ? 10.2 : tightPdf ? 6.1 : compactPdf ? 6.5 : 7.4,
  });
  x += totalW;

  drawCell("Grade", x, y, gradeW, subjectHeadH, {
    bold: true,
    fill: true,
    fillColor: COLORS.primarySoft,
    align: "center",
    size: isOLevelReport ? 10.2 : tightPdf ? 6.1 : compactPdf ? 6.5 : 7.4,
  });
  x += gradeW;

  drawCell("Teacher Comment", x, y, commentW, subjectHeadH, {
    bold: true,
    fill: true,
    fillColor: COLORS.primarySoft,
    size: isOLevelReport ? 10.0 : tightPdf ? 5.7 : compactPdf ? 6.1 : 7.1,
  });
  x += commentW;

  drawCell("Init.", x, y, initialsW, subjectHeadH, {
    bold: true,
    fill: true,
    fillColor: COLORS.primarySoft,
    align: "center",
    size: isOLevelReport ? 10.2 : tightPdf ? 6.1 : compactPdf ? 6.5 : 7.4,
  });

  y += subjectHeadH;

  const teacherCommentFontSize = isOLevelReport
    ? 11.2
    : tightPdf
    ? 5.6
    : compactPdf
    ? 6.0
    : 7.0;
  const teacherCommentLineHeight = isOLevelReport
    ? 4.35
    : tightPdf
    ? 2.7
    : compactPdf
    ? 3.0
    : 3.2;

  const estimatedContentBottom =
    y +
    rows.length * (tightPdf ? 5.2 : compactPdf ? 5.8 : 7.2) +
    42;

  const freeVerticalSpace = Math.max(0, pageBottom - estimatedContentBottom);
  const verticalStretch =
    tightPdf ? 1 : compactPdf ? Math.min(1.07, 1 + freeVerticalSpace / 260) : Math.min(1.18, 1 + freeVerticalSpace / 180);

  const oLevelBodyFont = 8.8;
  const oLevelBodyLineHeight = 3.45;
  const oLevelRowBaseH = 9.0;

  for (const row of rows) {
    const paperRows = row.papers || [];

    if (hasPapers && paperRows.length > 0) {
      const singlePaperHeightBase = tightPdf ? 6.3 : compactPdf ? 7.0 : 9.0;
      const singlePaperHeight = singlePaperHeightBase * verticalStretch;
      const groupHeight = singlePaperHeight * paperRows.length;
      const subjectHeightNeeded = Math.max(
        groupHeight,
        estimateCellHeight(
          row.subjectName,
          subjectW,
          tightPdf ? 5.8 : compactPdf ? 6.2 : 7.2,
          tightPdf ? 2.5 : 2.8
        )
      );

      ensurePageSpace(subjectHeightNeeded + 1);

      let groupX = tableLeft;
      drawCell(row.subjectName, groupX, y, subjectW, subjectHeightNeeded, {
        size: tightPdf ? 5.8 : compactPdf ? 6.2 : 7.2,
        bold: true,
        valign: "middle",
        lineHeight: tightPdf ? 2.7 : compactPdf ? 3.0 : 3.2,
      });
      groupX += subjectW;

      for (let i = 0; i < paperRows.length; i++) {
        const paper = paperRows[i];
        let rowX = groupX;
        const rowY = y + i * singlePaperHeight;

        drawCell(paper.paperName, rowX, rowY, paperW, singlePaperHeight, {
          size: tightPdf ? 5.4 : compactPdf ? 5.8 : 6.8,
          align: "center",
          valign: "middle",
        });
        rowX += paperW;

        for (const component of scheme.components) {
          const item = paper.componentScores.find(
            (c) => c.assessmentId === component.assessmentId
          );
          drawCell(
            formatPdfMark(item?.weightedScore ?? null, reportType),
            rowX,
            rowY,
            componentW,
            singlePaperHeight,
            {
              align: "center",
              size: tightPdf ? 5.8 : compactPdf ? 6.1 : 7.0,
              valign: "middle",
            }
          );
          rowX += componentW;
        }

        if (i === 0) {
          drawCell(formatPdfMark(row.total, reportType), rowX, y, totalW, subjectHeightNeeded, {
            align: "center",
            bold: true,
            size: tightPdf ? 6.0 : compactPdf ? 6.3 : 7.3,
            valign: "middle",
          });
          rowX += totalW;

          drawCell(row.grade, rowX, y, gradeW, subjectHeightNeeded, {
            align: "center",
            bold: true,
            size: tightPdf ? 6.0 : compactPdf ? 6.3 : 7.3,
            valign: "middle",
          });
          rowX += gradeW;

          drawCell(row.teacherComment, rowX, y, commentW, subjectHeightNeeded, {
            size: teacherCommentFontSize,
            valign: "middle",
            lineHeight: teacherCommentLineHeight,
          });
          rowX += commentW;

          drawCell(row.teacherInitials, rowX, y, initialsW, subjectHeightNeeded, {
            align: "center",
            bold: true,
            size: tightPdf ? 5.8 : compactPdf ? 6.1 : 7.1,
            valign: "middle",
          });
        }
      }

      y += subjectHeightNeeded;
      continue;
    }

    const subjectTextHeight = estimateCellHeight(
      row.subjectName,
      subjectW,
      isOLevelReport ? oLevelBodyFont : tightPdf ? 5.9 : compactPdf ? 6.2 : 7.2,
      isOLevelReport ? oLevelBodyLineHeight : tightPdf ? 2.5 : 2.8
    );
    const commentTextHeight = estimateCellHeight(
      row.teacherComment || "—",
      commentW,
      teacherCommentFontSize,
      isOLevelReport ? oLevelBodyLineHeight : tightPdf ? 2.5 : 2.8
    );
    const rowHeightBase = isOLevelReport ? oLevelRowBaseH : tightPdf ? 6.4 : compactPdf ? 7.2 : 9.4;
    const rowHeight = Math.max(
      rowHeightBase * verticalStretch,
      subjectTextHeight,
      commentTextHeight
    );

    ensurePageSpace(rowHeight + 1);

    x = tableLeft;
    drawCell(row.subjectName, x, y, subjectW, rowHeight, {
      size: isOLevelReport ? oLevelBodyFont : tightPdf ? 5.9 : compactPdf ? 6.2 : 7.2,
      bold: true,
      valign: "middle",
      lineHeight: isOLevelReport ? oLevelBodyLineHeight : tightPdf ? 2.7 : compactPdf ? 3.0 : 3.2,
    });
    x += subjectW;

    if (hasPapers) {
      drawCell("—", x, y, paperW, rowHeight, {
        align: "center",
        size: tightPdf ? 5.8 : compactPdf ? 6.1 : 7.0,
        valign: "middle",
      });
      x += paperW;
    }

    for (const component of scheme.components) {
      const item = row.componentScores.find((c) => c.assessmentId === component.assessmentId);
      drawCell(formatPdfMark(item?.weightedScore ?? null, reportType), x, y, componentW, rowHeight, {
        align: "center",
        size: isOLevelReport ? oLevelBodyFont : tightPdf ? 5.9 : compactPdf ? 6.2 : 7.2,
        valign: "middle",
      });
      x += componentW;
    }

    drawCell(formatPdfMark(row.total, reportType), x, y, totalW, rowHeight, {
      align: "center",
      bold: true,
      size: isOLevelReport ? oLevelBodyFont : tightPdf ? 5.9 : compactPdf ? 6.2 : 7.2,
      valign: "middle",
    });
    x += totalW;

    drawCell(row.grade, x, y, gradeW, rowHeight, {
      align: "center",
      bold: true,
      size: isOLevelReport ? oLevelBodyFont : tightPdf ? 5.9 : compactPdf ? 6.2 : 7.2,
      valign: "middle",
    });
    x += gradeW;

    drawCell(row.teacherComment, x, y, commentW, rowHeight, {
      size: teacherCommentFontSize,
      valign: "middle",
      lineHeight: teacherCommentLineHeight,
    });
    x += commentW;

    drawCell(row.teacherInitials, x, y, initialsW, rowHeight, {
      align: "center",
      bold: true,
      size: isOLevelReport ? oLevelBodyFont : tightPdf ? 5.9 : compactPdf ? 6.2 : 7.2,
      valign: "middle",
    });

    y += rowHeight;
  }

  y += isOLevelReport ? 4.2 : tightPdf ? 1.8 : compactPdf ? 2.4 : 3.8;

  const headCommentText = headTeacherComment || "—";

  if (isOLevelReport) {
    const commentTitleH = 5.8;
    const commentFont = 11.2;
    const commentLineHeight = 4.35;
    const headCommentH = Math.max(
      12.0,
      estimateCellHeight(headCommentText, usableWidth, commentFont, commentLineHeight, 3)
    );
    const signatureH = signatureImage ? 14.0 : 8.0;
    const firstPageBottomNeeded =
      commentTitleH +
      headCommentH +
      2.0 +
      signatureH;

    // Keep the comment and signature on page 1 for O-Level bulk reports.
    // If the subject table is long, compress only this small bottom block instead of creating
    // another page before the grade descriptor page.
    const availableFirstPageBottom = Math.max(16, pageBottom - y - 0.8);
    const oLevelBottomScale = firstPageBottomNeeded > availableFirstPageBottom
      ? Math.max(0.72, availableFirstPageBottom / firstPageBottomNeeded)
      : 1;
    const scaledCommentTitleH = round2(commentTitleH * oLevelBottomScale) ?? commentTitleH;
    const scaledCommentFont = Math.max(9.2, round2(commentFont * oLevelBottomScale) ?? commentFont);
    const scaledCommentLineHeight = Math.max(3.55, round2(commentLineHeight * oLevelBottomScale) ?? commentLineHeight);
    const scaledHeadCommentH = Math.max(10.5, round2(headCommentH * oLevelBottomScale) ?? headCommentH);

    drawBox(left, y, usableWidth, scaledCommentTitleH, COLORS.primaryDark, 0);
    drawText("HEAD TEACHER'S COMMENT", left + 2, y + scaledCommentTitleH - 1.25, {
      size: Math.max(7.0, round2(8.8 * oLevelBottomScale) ?? 8.8),
      style: "bold",
      color: [255, 255, 255],
    });
    y += scaledCommentTitleH + Math.max(0.8, round2(1.0 * oLevelBottomScale) ?? 1.0);

    drawCell(headCommentText, left, y, usableWidth, scaledHeadCommentH, {
      size: scaledCommentFont,
      valign: "middle",
      lineHeight: scaledCommentLineHeight,
    });
    y += scaledHeadCommentH + Math.max(1.2, round2(2.0 * oLevelBottomScale) ?? 2.0);

    const signatureY = y;
    const sigColW = 84;
    const sigGap = 18;
    const classSigX = left + 4;
    const headSigX = classSigX + sigColW + sigGap;
    const sigLabelFont = Math.max(6.2, round2(7.4 * oLevelBottomScale) ?? 7.4);

    if (signatureImage) {
      const sigMaxW = Math.max(50, round2(76 * oLevelBottomScale) ?? 76);
      const sigMaxH = Math.max(9, round2(15 * oLevelBottomScale) ?? 15);
      drawImageFit(
        signatureImage,
        headSigX + 1,
        signatureY - sigMaxH + Math.max(4.8, round2(7.2 * oLevelBottomScale) ?? 7.2),
        sigMaxW,
        sigMaxH
      );
    }

    drawText("Class Teacher Signature:", classSigX, signatureY + 1.4, {
      size: sigLabelFont,
      color: COLORS.primaryDark,
    });
    drawText("Head Teacher Signature:", headSigX, signatureY + 1.4, {
      size: sigLabelFont,
      color: COLORS.primaryDark,
    });

    pdf.setDrawColor(148, 163, 184);
    pdf.line(classSigX + 34, signatureY + 1.1, classSigX + sigColW, signatureY + 1.1);
    pdf.line(headSigX + 34, signatureY + 1.1, headSigX + sigColW, signatureY + 1.1);

    pdf.addPage();
    y = 10;

    const descriptorTitleH = 8.0;
    const descriptorHeaderH = 10.5;
    const descriptorHeaderFont = 12.2;
    const descriptorBodyFont = 11.2;
    const descriptorLineHeight = 4.35;
    const gd1 = 17;
    const gd2 = 41;
    const gd3 = 30;
    const gd4 = usableWidth - (gd1 + gd2 + gd3);

    drawBox(left, y, usableWidth, descriptorTitleH, COLORS.accentDark, 0);
    drawText("GRADE DESCRIPTOR TABLE", left + 2, y + descriptorTitleH - 2.0, {
      size: 12,
      style: "bold",
      color: [255, 255, 255],
    });
    y += descriptorTitleH + 1.2;

    drawCell("Grade", left, y, gd1, descriptorHeaderH, {
      bold: true,
      fill: true,
      fillColor: COLORS.accentSoft,
      size: descriptorHeaderFont,
      align: "center",
      valign: "middle",
    });
    drawCell("Achievement Level", left + gd1, y, gd2, descriptorHeaderH, {
      bold: true,
      fill: true,
      fillColor: COLORS.accentSoft,
      size: descriptorHeaderFont,
      valign: "middle",
    });
    drawCell("Marks", left + gd1 + gd2, y, gd3, descriptorHeaderH, {
      bold: true,
      fill: true,
      fillColor: COLORS.accentSoft,
      size: descriptorHeaderFont,
      align: "center",
      valign: "middle",
    });
    drawCell("Descriptor", left + gd1 + gd2 + gd3, y, gd4, descriptorHeaderH, {
      bold: true,
      fill: true,
      fillColor: COLORS.accentSoft,
      size: descriptorHeaderFont,
      valign: "middle",
    });
    y += descriptorHeaderH;

    for (const g of gradeDescriptors) {
      const rowH = Math.max(
        15.5,
        estimateCellHeight(g.achievementLevel, gd2, descriptorBodyFont, descriptorLineHeight, 3),
        estimateCellHeight(g.descriptor, gd4, descriptorBodyFont, descriptorLineHeight, 4)
      );

      drawCell(g.grade, left, y, gd1, rowH, {
        align: "center",
        bold: true,
        size: descriptorBodyFont,
        valign: "middle",
      });
      drawCell(g.achievementLevel, left + gd1, y, gd2, rowH, {
        size: descriptorBodyFont,
        valign: "middle",
        lineHeight: descriptorLineHeight,
      });
      drawCell(
        `${formatMark(g.minMark)} - ${formatMark(g.maxMark)}`,
        left + gd1 + gd2,
        y,
        gd3,
        rowH,
        {
          align: "center",
          size: descriptorBodyFont,
          valign: "middle",
          lineHeight: descriptorLineHeight,
        }
      );
      drawCell(g.descriptor, left + gd1 + gd2 + gd3, y, gd4, rowH, {
        size: descriptorBodyFont,
        valign: "middle",
        lineHeight: descriptorLineHeight,
      });
      y += rowH;
    }

    return;
  }

  const remainingHeight = Math.max(pageBottom - y, 28);

  const base = {
    blockTitleH: tightPdf ? 4.9 : compactPdf ? 5.4 : 6.5,
    gdHeaderH: isOLevelReport
      ? tightPdf
        ? 5.6
        : compactPdf
        ? 6.2
        : 7.0
      : tightPdf
      ? 4.9
      : compactPdf
      ? 5.4
      : 6.2,
    gdRowH: isOLevelReport
      ? tightPdf
        ? 5.8
        : compactPdf
        ? 6.5
        : 7.8
      : tightPdf
      ? 5.0
      : compactPdf
      ? 5.6
      : 6.8,
    betweenBlocks: tightPdf ? 1.9 : compactPdf ? 2.2 : 2.8,
    commentMinH: tightPdf ? 7.4 : compactPdf ? 8.3 : 10.0,
    afterCommentGap: tightPdf ? 2.0 : compactPdf ? 2.3 : 3.2,
    signatureH: signatureImage ? (tightPdf ? 10.4 : compactPdf ? 11.8 : 14.4) : 5.8,
    labelFont: tightPdf ? 6.0 : compactPdf ? 6.4 : 7.4,
  };

  const baseCommentContentH = Math.max(
    base.commentMinH,
    estimateCellHeight(
      headCommentText,
      usableWidth,
      tightPdf ? 6.0 : compactPdf ? 6.6 : 7.6,
      tightPdf ? 2.8 : compactPdf ? 3.1 : 3.4,
      4
    )
  );

  const baseBottomNeeded =
    base.blockTitleH +
    base.gdHeaderH +
    gradeDescriptors.length * base.gdRowH +
    base.betweenBlocks +
    base.blockTitleH +
    baseCommentContentH +
    base.afterCommentGap +
    base.signatureH;

  let bottomScale = 1;
  if (baseBottomNeeded > remainingHeight) {
    bottomScale = Math.max(0.72, remainingHeight / baseBottomNeeded);
  }

  const sc = (n: number) => Math.max(0.1, round2(n * bottomScale) || n * bottomScale);

  const bottomTitleH = sc(base.blockTitleH);
  const gdHeaderH = sc(base.gdHeaderH);
  const gdRowH = sc(base.gdRowH);
  const betweenBlocks = sc(base.betweenBlocks);
  const commentFont = Math.max(5.4, sc(tightPdf ? 6.0 : compactPdf ? 6.6 : 7.6));
  const gdFont = isOLevelReport
    ? Math.max(5.6, sc(tightPdf ? 6.3 : compactPdf ? 6.8 : 7.8))
    : Math.max(4.8, sc(tightPdf ? 5.6 : compactPdf ? 6.0 : 7.0));
  const commentContentH = Math.max(sc(base.commentMinH), sc(baseCommentContentH));
  const afterCommentGap = sc(base.afterCommentGap);
  const sigLabelFont = Math.max(5.0, sc(base.labelFont));

  const gd1 = tightPdf ? 12 : compactPdf ? 13 : 16;
  const gd2 = tightPdf ? 25 : compactPdf ? 28 : 36;
  const gd3 = tightPdf ? 18 : compactPdf ? 20 : 25;
  const gd4 = usableWidth - (gd1 + gd2 + gd3);

  drawBox(left, y, usableWidth, bottomTitleH, COLORS.accentDark, 0);
  drawText("GRADE DESCRIPTOR TABLE", left + 2, y + bottomTitleH - 1.2, {
    size: Math.max(5.8, sc(tightPdf ? 6.8 : compactPdf ? 7.2 : 8.0)),
    style: "bold",
    color: [255, 255, 255],
  });
  y += bottomTitleH;

  drawCell("Grade", left, y, gd1, gdHeaderH, {
    bold: true,
    fill: true,
    fillColor: COLORS.accentSoft,
    size: gdFont,
  });
  drawCell("Achievement Level", left + gd1, y, gd2, gdHeaderH, {
    bold: true,
    fill: true,
    fillColor: COLORS.accentSoft,
    size: gdFont,
  });
  drawCell("Marks", left + gd1 + gd2, y, gd3, gdHeaderH, {
    bold: true,
    fill: true,
    fillColor: COLORS.accentSoft,
    size: gdFont,
  });
  drawCell("Descriptor", left + gd1 + gd2 + gd3, y, gd4, gdHeaderH, {
    bold: true,
    fill: true,
    fillColor: COLORS.accentSoft,
    size: gdFont,
  });
  y += gdHeaderH;

  for (const g of gradeDescriptors) {
    drawCell(g.grade, left, y, gd1, gdRowH, {
      align: "center",
      bold: true,
      size: gdFont,
      valign: "middle",
    });
    drawCell(g.achievementLevel, left + gd1, y, gd2, gdRowH, {
      size: isOLevelReport ? gdFont : Math.max(4.7, gdFont - 0.2),
      valign: "middle",
    });
    drawCell(
      `${formatMark(g.minMark)} - ${formatMark(g.maxMark)}`,
      left + gd1 + gd2,
      y,
      gd3,
      gdRowH,
      {
        align: "center",
        size: isOLevelReport ? gdFont : Math.max(4.7, gdFont - 0.2),
        valign: "middle",
      }
    );
    drawCell(g.descriptor, left + gd1 + gd2 + gd3, y, gd4, gdRowH, {
      size: isOLevelReport ? Math.max(5.4, gdFont - 0.1) : Math.max(4.5, gdFont - 0.5),
      valign: "middle",
      lineHeight: isOLevelReport ? Math.max(2.4, sc(2.9)) : Math.max(2.0, sc(2.5)),
    });
    y += gdRowH;
  }

  y += betweenBlocks;

  drawBox(left, y, usableWidth, bottomTitleH, COLORS.primaryDark, 0);
  drawText("HEAD TEACHER'S COMMENT", left + 2, y + bottomTitleH - 1.2, {
    size: Math.max(5.8, sc(tightPdf ? 6.8 : compactPdf ? 7.2 : 8.0)),
    style: "bold",
    color: [255, 255, 255],
  });
  y += bottomTitleH;

  drawCell(headCommentText, left, y, usableWidth, commentContentH, {
    size: commentFont,
    valign: "middle",
    lineHeight: Math.max(2.4, sc(tightPdf ? 2.8 : compactPdf ? 3.1 : 3.4)),
  });
  y += commentContentH + afterCommentGap;

  const signatureY = y;
  const sigColW = 84;
  const sigGap = 18;
  const classSigX = left + 4;
  const headSigX = classSigX + sigColW + sigGap;

  if (signatureImage) {
    const sigMaxW = Math.max(28, sc(tightPdf ? 69 : compactPdf ? 78 : 90));
    const sigMaxH = Math.max(10, sc(tightPdf ? 15.75 : compactPdf ? 18.0 : 21.75));
    drawImageFit(
      signatureImage,
      headSigX + 2,
      signatureY - sigMaxH + 6.5,
      sigMaxW,
      sigMaxH
    );
  }

  drawText("Class Teacher Signature:", classSigX, signatureY + 1.2, {
    size: sigLabelFont,
    color: COLORS.primaryDark,
  });
  drawText("Head Teacher Signature:", headSigX, signatureY + 1.2, {
    size: sigLabelFont,
    color: COLORS.primaryDark,
  });

  pdf.setDrawColor(148, 163, 184);
  pdf.line(classSigX + 32, signatureY + 0.9, classSigX + sigColW, signatureY + 0.9);
}

export default function ReportCardsPage() {
  const router = useRouter();

  const [mounted, setMounted] = React.useState(false);

  const [years, setYears] = React.useState<AcademicYearRow[]>([]);
  const [terms, setTerms] = React.useState<TermRow[]>([]);
  const [classes, setClasses] = React.useState<ClassRow[]>([]);
  const [students, setStudents] = React.useState<StudentRow[]>([]);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [totalStudents, setTotalStudents] = React.useState(0);

  const [yearId, setYearId] = React.useState("");
  const [termId, setTermId] = React.useState("");
  const [classId, setClassId] = React.useState("");
  const [reportType, setReportType] = React.useState<ReportType>("O_EOT");
  const [query, setQuery] = React.useState("");

  const [bootLoading, setBootLoading] = React.useState(true);
  const [studentsLoading, setStudentsLoading] = React.useState(false);
  const [bulkDownloading, setBulkDownloading] = React.useState(false);
  const [bootError, setBootError] = React.useState("");
  const [studentsError, setStudentsError] = React.useState("");

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    setPage(1);
  }, [classId, query]);

  React.useEffect(() => {
    if (!mounted) return;

    let cancelled = false;

    async function loadInitialData() {
      try {
        setBootLoading(true);
        setBootError("");

        const [yearsData, classesData] = await Promise.all([
          fetchJsonSafely("/api/academic-years", { cache: "no-store", credentials: "include" }, "Failed to load academic years"),
          fetchJsonSafely("/api/classes", { cache: "no-store", credentials: "include" }, "Failed to load classes"),
        ]);

        const loadedYears: AcademicYearRow[] = Array.isArray(yearsData) ? yearsData : [];
        const loadedClasses: ClassRow[] = Array.isArray(classesData) ? classesData : [];

        const currentYear = loadedYears.find((y) => y.isCurrent) ?? loadedYears[0] ?? null;

        let loadedTerms: TermRow[] = [];
        if (currentYear?.id) {
          const termsData = await fetchJsonSafely(
            `/api/terms?academicYearId=${encodeURIComponent(currentYear.id)}`,
            { cache: "no-store", credentials: "include" },
            "Failed to load terms"
          );
          loadedTerms = Array.isArray(termsData) ? termsData : [];
        }

        const currentTerm = loadedTerms.find((t) => t.isCurrent) ?? loadedTerms[0] ?? null;

        if (cancelled) return;

        setYears(loadedYears);
        setClasses(loadedClasses);
        setTerms(loadedTerms);
        setYearId(currentYear?.id ?? "");
        setTermId(currentTerm?.id ?? "");
        setClassId(loadedClasses[0]?.id ?? "");
      } catch (err: any) {
        if (!cancelled) setBootError(err?.message || "Failed to load page data");
      } finally {
        if (!cancelled) setBootLoading(false);
      }
    }

    loadInitialData();

    return () => {
      cancelled = true;
    };
  }, [mounted]);

  React.useEffect(() => {
    if (!mounted || !yearId) {
      setTerms([]);
      setTermId("");
      return;
    }

    let cancelled = false;

    async function loadTerms() {
      try {
        const data = await fetchJsonSafely(
          `/api/terms?academicYearId=${encodeURIComponent(yearId)}`,
          { cache: "no-store", credentials: "include" },
          "Failed to load terms"
        );

        const loadedTerms: TermRow[] = Array.isArray(data) ? data : [];
        const nextTerm =
          loadedTerms.find((t) => t.isCurrent) ??
          loadedTerms.find((t) => t.id === termId) ??
          loadedTerms[0] ??
          null;

        if (!cancelled) {
          setTerms(loadedTerms);
          setTermId(nextTerm?.id ?? "");
        }
      } catch {
        if (!cancelled) {
          setTerms([]);
          setTermId("");
        }
      }
    }

    loadTerms();

    return () => {
      cancelled = true;
    };
  }, [mounted, yearId, termId]);

  React.useEffect(() => {
    if (!mounted || !classId) {
      setStudents([]);
      setTotalPages(1);
      setTotalStudents(0);
      return;
    }

    let cancelled = false;

    async function loadStudents() {
      try {
        setStudentsLoading(true);
        setStudentsError("");

        const params = new URLSearchParams();
        params.set("classId", classId);
        params.set("page", String(page));
        params.set("pageSize", "30");
        if (query.trim()) params.set("q", query.trim());

        const data = await fetchJsonSafely<StudentsResponse>(`/api/students?${params.toString()}`, {
          cache: "no-store",
          credentials: "include",
        }, "Failed to load students");

        if (!cancelled) {
          const items = studentsFromResponse(data);
          setStudents(items);
          setTotalPages(studentsTotalPagesFromResponse(data));
          setTotalStudents(studentsTotalFromResponse(data, items.length));
        }
      } catch (err: any) {
        if (!cancelled) {
          setStudents([]);
          setStudentsError(err?.message || "Failed to load students");
          setTotalPages(1);
          setTotalStudents(0);
        }
      } finally {
        if (!cancelled) setStudentsLoading(false);
      }
    }

    loadStudents();

    return () => {
      cancelled = true;
    };
  }, [mounted, classId, query, page]);

  async function handleDownloadClassPdf() {
    if (!classId || !yearId || !termId) return;

    try {
      setBulkDownloading(true);

      const [badgeImage, signatureImage] = await Promise.all([
        loadPdfImage(REPORT_BADGE_URL, "badge"),
        loadPdfImage(HEADTEACHER_SIGNATURE_URL, "signature"),
      ]);

      const classInfo = classes.find((c) => c.id === classId);
      const termInfo = terms.find((t) => t.id === termId);
      const yearInfo = years.find((y) => y.id === yearId);

      const params = new URLSearchParams();
      params.set("classId", classId);
      params.set("page", "1");
      params.set("pageSize", "500");
      if (query.trim()) params.set("q", query.trim());

      const data = await fetchJsonSafely<StudentsResponse>(`/api/students?${params.toString()}`, {
        cache: "no-store",
        credentials: "include",
      }, "Failed to load class students");

      const classStudents = studentsFromResponse(data);
      if (classStudents.length === 0) {
        throw new Error("No students found for the selected class.");
      }

      const pdf = new jsPDF({
        orientation: "p",
        unit: "mm",
        format: "a4",
        compress: true,
        putOnlyUsedFonts: true,
        precision: 2,
      });

      let first = true;

      const skippedStudents: string[] = [];

      for (const s of classStudents) {
        try {
          const payload = await buildStudentReportPayload({
            studentId: s.id,
            yearId,
            termId,
            reportType,
          });

          const profileImage = await loadPdfImage(
            getStudentProfileImageUrl(payload.student),
            `profile-${payload.student.id}`
          );

          renderStudentReportPage(
            pdf,
            payload,
            { badgeImage, signatureImage, profileImage },
            first
          );
          first = false;
        } catch (err) {
          const studentName = [s.firstName, s.lastName].filter(Boolean).join(" ") || s.studentNo || s.id;
          skippedStudents.push(studentName);
          console.warn("Skipped student during class PDF generation", { student: s, err });
          continue;
        }
      }

      if (first) {
        throw new Error(
          skippedStudents.length > 0
            ? `No report cards could be generated. First skipped student: ${skippedStudents[0]}`
            : "No report cards could be generated."
        );
      }

      const fileName = safeFileName(
        `${classInfo?.name || "Class"} ${reportTypeLabel(reportType)} ${termInfo?.name || ""} ${yearInfo?.name || ""} Report Cards`
      );

      pdf.save(`${fileName}.pdf`);

      if (skippedStudents.length > 0) {
        alert(
          `Class PDF generated, but ${skippedStudents.length} student(s) were skipped because their data could not be loaded. Check the browser console for details.`
        );
      }
    } catch (err: any) {
      alert(err?.message || "Failed to generate class report cards PDF");
    } finally {
      setBulkDownloading(false);
    }
  }

  if (!mounted || bootLoading) {
    return <div className="p-4 text-sm text-slate-500">Loading report cards...</div>;
  }

  if (bootError) {
    return (
      <div className="p-4">
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {bootError}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Report Cards"
          subtitle="Choose report settings and open a student's report card"
          right={
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                disabled={!classId || !yearId || !termId || bulkDownloading || studentsLoading}
                onClick={handleDownloadClassPdf}
              >
                {bulkDownloading ? "Building Class PDF..." : "Download Class PDF"}
              </Button>
            </div>
          }
        />
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5">
          <div>
            <div className="mb-1 text-xs font-medium text-slate-500">Academic Year</div>
            <Select
              value={yearId}
              onChange={(e) => setYearId(e.target.value)}
              options={years.map((y) => ({ value: y.id, label: y.name }))}
            />
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-slate-500">Term</div>
            <Select
              value={termId}
              onChange={(e) => setTermId(e.target.value)}
              options={terms.map((t) => ({ value: t.id, label: t.name }))}
            />
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-slate-500">Class</div>
            <Select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              options={classes.map((c) => ({ value: c.id, label: c.name }))}
            />
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-slate-500">Report Type</div>
            <Select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              options={REPORT_TYPES.map((r) => ({ value: r.value, label: r.label }))}
            />
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-slate-500">Search</div>
            <Input
              placeholder="Name or admission no..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Students"
          subtitle={classId ? "Students in selected class" : "Select a class first"}
          right={<Badge>{studentsLoading ? "Loading..." : `${totalStudents} found`}</Badge>}
        />

        <div className="p-4">
          {studentsError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {studentsError}
            </div>
          ) : !classId ? (
            <div className="text-sm text-slate-500">Select a class to view students.</div>
          ) : studentsLoading ? (
            <div className="text-sm text-slate-500">Loading students...</div>
          ) : students.length === 0 ? (
            <div className="text-sm text-slate-500">No students found for the selected class.</div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {students.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-900">
                        {s.firstName} {s.lastName}
                      </div>
                      <div className="truncate text-xs text-slate-500">
                        {s.admissionNo || s.studentNo || "No admission number"}
                        {s.className ? ` • ${s.className}` : ""}
                        {s.streamName ? ` • ${s.streamName}` : ""}
                      </div>
                    </div>

                    <Button
                      disabled={!yearId || !termId}
                      onClick={() =>
                        router.push(
                          `/report-cards/${s.id}?yearId=${encodeURIComponent(
                            yearId
                          )}&termId=${encodeURIComponent(
                            termId
                          )}&reportType=${encodeURIComponent(reportType)}`
                        )
                      }
                    >
                      Open
                    </Button>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-slate-500">
                  Page {page} of {totalPages}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    disabled={page <= 1 || studentsLoading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={page >= totalPages || studentsLoading}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}