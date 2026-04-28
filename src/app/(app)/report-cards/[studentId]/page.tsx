"use client";

import React from "react";
import { useParams, useSearchParams } from "next/navigation";
import jsPDF from "jspdf";
import { Button, Card, CardHeader, Badge } from "@/components/ui";
import { getRemarkOverride, pickRemark } from "@/lib/store";
import type { ReportType } from "@/lib/store";

const SCHOOL_NAME = "ZANA CHRISTIAN HIGH SCHOOL";
const SCHOOL_MOTTO = "IN GOD, WE TRUST";
const SCHOOL_ADDRESS = "P.O. Box 21312, Kampala, Uganda";
const SCHOOL_CONTACT = "Tel: 0773 748 168 / 0704 590 234";

/**
 * Image sources for PDF generation only.
 */
const REPORT_BADGE_URL =
  process.env.NEXT_PUBLIC_REPORT_BADGE_URL || "/report-assets/badge.png";
const HEADTEACHER_SIGNATURE_URL =
  process.env.NEXT_PUBLIC_HEADTEACHER_SIGNATURE_URL ||
  "/report-assets/headteacher-signature.png";
const DEFAULT_STUDENT_PROFILE_URL =
  process.env.NEXT_PUBLIC_REPORT_STUDENT_PROFILE_URL ||
  "/report-assets/student-profile.png";

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

type AcademicYearRow = {
  id: string;
  name: string;
};

type TermRow = {
  id: string;
  name: string;
};

type LoadedPdfImage = {
  dataUrl: string;
  format: "PNG" | "JPEG";
  width: number;
  height: number;
  alias?: string;
};

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

function round2(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

function gradeScore(score: number | null, descriptors: GradeDescriptorRow[]) {
  if (score === null) return "—";
  const found = (descriptors || []).find(
    (d) => Number(score) >= Number(d.minMark) && Number(score) <= Number(d.maxMark)
  );
  return found?.grade || "—";
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

function gradeALevelSubject(subjectName: string, score: number | null, descriptors: GradeDescriptorRow[]) {
  if (score === null) return "—";

  // A-Level subsidiary subjects only carry either 1 point or 0 points.
  // Therefore they should display only O or F, not A/B/C/D/E.
  if (isTemporarySubsidiarySubject(subjectName)) {
    return Number(score) >= 50 ? "O" : "F";
  }

  return gradeScore(score, descriptors);
}

function getALevelPoints(subjectName: string, grade: string) {
  const g = String(grade || "").trim().toUpperCase();

  if (isTemporarySubsidiarySubject(subjectName)) {
    return g === "O" ? 1 : 0;
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

function getFullStudentName(student: StudentApiRow | null) {
  if (!student) return "";
  return [student.firstName, student.otherNames, student.lastName]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ");
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

function formatMark(value: number | null) {
  if (value === null || Number.isNaN(value)) return "—";
  const s = value.toFixed(2);
  return s.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function roundHalfUpToWhole(value: number | null) {
  if (value === null || Number.isNaN(Number(value))) return null;

  // Some totals come from weighted averages, so exact .5 values can arrive as
  // 59.499999999 or 77.499999999. This keeps normal rounding behaviour but
  // prevents those display-only floating-point cases from rounding down.
  return Math.round(Number(value) + 1e-6);
}

function formatPdfMark(value: number | null, reportType: string) {
  if (value === null || Number.isNaN(value)) return "—";

  // PDF-only: end-of-term report cards should show marks rounded to 0 decimal places.
  if (reportType === "O_EOT" || reportType === "A_EOT") {
    const rounded = roundHalfUpToWhole(value);
    return rounded === null ? "—" : String(rounded);
  }

  return formatMark(value);
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

function toShortAssessmentLabel(label: string, index: number) {
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

function toPdfShortAssessmentLabel(label: string, index: number, reportType: string) {
  // PDF-only: A-Level EOT should show MOT and EOT instead of CA 1 and CA 2.
  if (reportType === "A_EOT") {
    if (index === 0) return "MOT";
    if (index === 1) return "EOT";
    if (index === 2) return "EXAM";
  }

  // PDF-only: O-Level EOT has CA 1, CA 2, then EXAM — never CA 3.
  if (reportType === "O_EOT" && index === 2) {
    return "EXAM";
  }

  return toShortAssessmentLabel(label, index);
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

function averageRawNumbers(values: Array<number | null | undefined>) {
  const nums = values.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  if (nums.length === 0) return null;
  return nums.reduce((sum, v) => sum + v, 0) / nums.length;
}

function averageNumbers(values: Array<number | null | undefined>) {
  const rawAverage = averageRawNumbers(values);
  return rawAverage === null ? null : round2(rawAverage);
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

function ReportValueInline({
  label,
  value,
  className = "",
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`min-w-0 rounded-2xl border border-indigo-100 bg-white px-3 py-2.5 shadow-sm ${className}`}
    >
      <div className="truncate text-[11px] text-slate-900">
        <span className="font-bold text-indigo-700">{label}:</span>{" "}
        <span className="font-semibold text-slate-900">{value}</span>
      </div>
    </div>
  );
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function getDataUrlImageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return await new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.width || 1, height: img.height || 1 });
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function isPngImage(blob: Blob, dataUrl: string, url: string) {
  const mime = String(blob.type || "").toLowerCase();
  const cleanUrl = String(url || "").split("?")[0].toLowerCase();

  return (
    mime.includes("png") ||
    dataUrl.startsWith("data:image/png") ||
    cleanUrl.endsWith(".png")
  );
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

    // JPEG is used only for non-transparent images. It has no alpha channel,
    // so we intentionally flatten those images onto white for smaller PDFs.
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
    const originalDataUrl = await blobToDataUrl(blob);

    // Preserve transparent PNGs. Do not pass them through canvas.toDataURL("image/jpeg"),
    // because JPEG removes transparency and turns transparent areas white.
    if (isPngImage(blob, originalDataUrl, absoluteUrl)) {
      const size = await getDataUrlImageSize(originalDataUrl);

      return {
        dataUrl: originalDataUrl,
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

export default function StudentReportCardPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const sp = useSearchParams();
  const yearId = sp.get("yearId") || "";
  const termId = sp.get("termId") || "";
  const rawReportType = sp.get("reportType");

  const reportType: ReportType =
    rawReportType === "O_MID" ||
    rawReportType === "O_EOT" ||
    rawReportType === "A_MID" ||
    rawReportType === "A_EOT"
      ? rawReportType
      : "O_EOT";

  const isALevelReport = reportType === "A_MID" || reportType === "A_EOT";

  const [loading, setLoading] = React.useState(true);
  const [downloading, setDownloading] = React.useState(false);
  const [error, setError] = React.useState("");

  const [student, setStudent] = React.useState<StudentApiRow | null>(null);
  const [scheme, setScheme] = React.useState<SchemeApiRow | null>(null);
  const [rows, setRows] = React.useState<SubjectReportRow[]>([]);
  const [gradeDescriptors, setGradeDescriptors] = React.useState<GradeDescriptorRow[]>(
    DEFAULT_O_LEVEL_DESCRIPTORS
  );

  type ActiveEnrollment = NonNullable<StudentApiRow["enrollments"]>[number];

  const [activeEnrollment, setActiveEnrollment] =
    React.useState<ActiveEnrollment | null>(null);

  const [academicYearName, setAcademicYearName] = React.useState("");
  const [termName, setTermName] = React.useState("");
  const [headTeacherComment, setHeadTeacherComment] = React.useState("");

  React.useEffect(() => {
    if (!studentId || !yearId || !termId || !reportType) {
      setError("Missing required report parameters.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadReport() {
      try {
        setLoading(true);
        setError("");

        const [studentRes, schemeRes, yearsRes] = await Promise.all([
          fetch(`/api/students/${encodeURIComponent(studentId)}`, {
            cache: "no-store",
            credentials: "include",
          }),
          fetch(`/api/schemes?reportType=${encodeURIComponent(reportType)}`, {
            cache: "no-store",
            credentials: "include",
          }),
          fetch(`/api/academic-years`, {
            cache: "no-store",
            credentials: "include",
          }),
        ]);

        const studentData = await studentRes.json();
        const schemeData = await schemeRes.json();
        const yearsData = await yearsRes.json();

        if (!studentRes.ok) throw new Error(studentData?.error || "Failed to load student");
        if (!schemeRes.ok) throw new Error(schemeData?.error || "Failed to load report scheme");
        if (!yearsRes.ok) throw new Error(yearsData?.error || "Failed to load academic years");

        const loadedStudent: StudentApiRow | null = studentData?.student ?? null;
        if (!loadedStudent) throw new Error("Student not found.");

        const loadedActiveEnrollment =
          loadedStudent.enrollments?.find((e) => e?.isActive) ?? null;
        if (!loadedActiveEnrollment) throw new Error("Student has no active enrollment.");

        const activeEnrollmentData = loadedActiveEnrollment;

        const enrolledSubjectsMap = new Map<string, { subjectId: string; subjectName: string }>();
        for (const s of loadedActiveEnrollment.subjects || []) {
          const subjectId = String(s?.subjectId || "").trim();
          const subjectName = String(s?.subject?.name || "").trim() || "Unnamed Subject";
          if (subjectId && !enrolledSubjectsMap.has(subjectId)) {
            enrolledSubjectsMap.set(subjectId, { subjectId, subjectName });
          }
        }

        const enrolledSubjects = Array.from(enrolledSubjectsMap.values());

        if (enrolledSubjects.length === 0) {
          throw new Error("This student has no enrolled subjects.");
        }

        if (
          !schemeData ||
          !Array.isArray(schemeData.components) ||
          schemeData.components.length === 0
        ) {
          throw new Error("No report scheme found for this report type.");
        }

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
          gradeDescriptors:
            Array.isArray(schemeData.gradeDescriptors) &&
            schemeData.gradeDescriptors.length > 0
              ? schemeData.gradeDescriptors.map((g: any) => ({
                  ...g,
                  minMark: Number(g.minMark),
                  maxMark: Number(g.maxMark),
                }))
              : DEFAULT_O_LEVEL_DESCRIPTORS,
        };

        const foundYear = (Array.isArray(yearsData) ? yearsData : []).find(
          (y: AcademicYearRow) => y.id === yearId
        );

        const termsRes = await fetch(
          `/api/terms?academicYearId=${encodeURIComponent(yearId)}`,
          { cache: "no-store", credentials: "include" }
        );
        const termsData = await termsRes.json();
        if (!termsRes.ok) throw new Error(termsData?.error || "Failed to load terms");

        const foundTerm = (Array.isArray(termsData) ? termsData : []).find(
          (t: TermRow) => t.id === termId
        );

        const metaParams = new URLSearchParams({
          classId: activeEnrollmentData.classId,
        });
        if (activeEnrollmentData.streamId) {
          metaParams.set("streamId", activeEnrollmentData.streamId);
        }

        const metaRes = await fetch(`/api/report-card-meta?${metaParams.toString()}`, {
          cache: "no-store",
          credentials: "include",
        });
        const metaData = await metaRes.json();
        if (!metaRes.ok) {
          throw new Error(metaData?.error || "Failed to load report metadata");
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
            classId: activeEnrollmentData.classId,
            subjectId,
          });

          if (subjectPaperId) {
            params.set("subjectPaperId", subjectPaperId);
          }

          const marksRes = await fetch(`/api/marks?${params.toString()}`, {
            cache: "no-store",
            credentials: "include",
          });
          const marksData = await marksRes.json();

          if (!marksRes.ok) {
            throw new Error(
              marksData?.error || `Failed to load marks for subject ${subjectId}`
            );
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
            shortLabel: toShortAssessmentLabel(component.label, index),
            enterOutOf,
            weightOutOf,
            rawScore,
            weightedScore,
          };
        }

        for (const subject of enrolledSubjects) {
          if (isALevelReport) {
            const papersRes = await fetch(
              `/api/subjects/${encodeURIComponent(subject.subjectId)}/papers`,
              {
                cache: "no-store",
                credentials: "include",
              }
            );
            const papersData = await papersRes.json();

            if (!papersRes.ok) {
              throw new Error(
                papersData?.error || `Failed to load papers for ${subject.subjectName}`
              );
            }

            const subjectPapers: SubjectPaperApiRow[] = Array.isArray(papersData)
              ? papersData
              : [];

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

              // For A-Level end-of-term reports, the subject total should match the
              // visible paper totals on the report. Therefore, round each paper total first,
              // then average those rounded paper totals, and finally round the average.
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
              const subjectGrade = gradeALevelSubject(
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

          const total = sumNumbers(componentScores.map((c) => c.weightedScore));

          provisionalRows.push({
            subjectId: subject.subjectId,
            subjectName: subject.subjectName,
            componentScores,
            total,
            grade: isALevelReport
              ? gradeALevelSubject(
                  subject.subjectName,
                  total,
                  loadedScheme.gradeDescriptors || DEFAULT_O_LEVEL_DESCRIPTORS
                )
              : gradeScore(total, loadedScheme.gradeDescriptors || DEFAULT_O_LEVEL_DESCRIPTORS),
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

        const override = getRemarkOverride({
          studentId,
          academicYearId: yearId,
          termId,
          reportType,
        });

        const subjectRows: SubjectReportRow[] = provisionalRows.map((row) => {
          const subjectComment =
            pickRemark({
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
          pickRemark({
            target: "headTeacher",
            reportType,
            grade: overallGrade,
            score: overallAverage,
          }) ??
          "—";

        if (cancelled) return;

        setStudent(loadedStudent);
        setActiveEnrollment(activeEnrollmentData);
        setScheme(loadedScheme);
        setGradeDescriptors(loadedScheme.gradeDescriptors || DEFAULT_O_LEVEL_DESCRIPTORS);
        setRows(subjectRows);
        setAcademicYearName(foundYear?.name || yearId);
        setTermName(foundTerm?.name || termId);
        setHeadTeacherComment(computedHeadTeacherComment);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to build student report.");
          setStudent(null);
          setActiveEnrollment(null);
          setScheme(null);
          setGradeDescriptors(DEFAULT_O_LEVEL_DESCRIPTORS);
          setRows([]);
          setAcademicYearName("");
          setTermName("");
          setHeadTeacherComment("");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadReport();

    return () => {
      cancelled = true;
    };
  }, [studentId, yearId, termId, reportType, isALevelReport]);

  const fullName = getFullStudentName(student);
  const studentNo = student?.admissionNo || student?.studentNo || "No admission number";
  const className = activeEnrollment?.class?.name || "—";
  const reportHeading = getReportHeading(reportType, termName || termId, academicYearName || yearId);

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

  async function handleDownloadPdf() {
    if (!student || !scheme) return;

    try {
      setDownloading(true);

      const studentProfileImageUrl = getStudentProfileImageUrl(student);

      const [badgeImage, signatureImage, profileImage] = await Promise.all([
        loadPdfImage(REPORT_BADGE_URL, "badge"),
        loadPdfImage(HEADTEACHER_SIGNATURE_URL, "signature"),
        loadPdfImage(studentProfileImageUrl, "profile"),
      ]);

      const pdf = new jsPDF({
        orientation: "p",
        unit: "mm",
        format: "a4",
        compress: true,
        putOnlyUsedFonts: true,
        precision: 2,
      });

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
        // PDF-only palette. Sizes and layout are unchanged; only colour values change.
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
      const infoH = tightPdf ? 7.4 : compactPdf ? 8.0 : 8.8;
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
        pdf.setFontSize(tightPdf ? 6.8 : compactPdf ? 7.1 : 7.7);
        pdf.setTextColor(
          COLORS.primaryDark[0],
          COLORS.primaryDark[1],
          COLORS.primaryDark[2]
        );
        const labelText = `${label}:`;
        pdf.text(labelText, x + 2, yy + h / 2 + 1.1);

        const labelWidth = pdf.getTextWidth(labelText);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(tightPdf ? 6.8 : compactPdf ? 7.1 : 7.7);
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

      y += tightPdf ? 8.8 : compactPdf ? 9.8 : 11.2;

      const summaryBandH = tightPdf ? 5.4 : compactPdf ? 5.8 : 6.9;
      drawBox(left, y, usableWidth, summaryBandH, COLORS.secondaryDark, 0);
      drawText("SUMMARY RESULTS", left + 2, y + (tightPdf ? 3.85 : compactPdf ? 4.15 : 4.95), {
        size: tightPdf ? 7.2 : compactPdf ? 7.7 : 8.7,
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

      const summaryHeadH = tightPdf ? 6.2 : compactPdf ? 6.8 : 7.9;
      const summaryRowH = tightPdf ? 6.4 : compactPdf ? 7.0 : 8.4;

      drawCell("Overall Average", left, y, s1, summaryHeadH, {
        bold: true,
        fill: true,
        fillColor: COLORS.secondarySoft,
        size: tightPdf ? 6.0 : compactPdf ? 6.4 : 7.4,
      });
      drawCell("Final Grade", left + s1, y, s2, summaryHeadH, {
        bold: true,
        fill: true,
        fillColor: COLORS.secondarySoft,
        size: tightPdf ? 6.0 : compactPdf ? 6.4 : 7.4,
      });

      if (isSummaryWithPoints) {
        drawCell("Total Points", left + s1 + s2, y, s3, summaryHeadH, {
          bold: true,
          fill: true,
          fillColor: COLORS.secondarySoft,
          size: tightPdf ? 6.0 : compactPdf ? 6.4 : 7.4,
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
          size: tightPdf ? 6.0 : compactPdf ? 6.4 : 7.4,
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
          size: tightPdf ? 6.0 : compactPdf ? 6.4 : 7.4,
        }
      );

      y += summaryHeadH;

      drawCell(formatPdfMark(overallAverage, reportType), left, y, s1, summaryRowH, {
        align: "center",
        bold: true,
        size: tightPdf ? 6.1 : compactPdf ? 6.5 : 7.7,
        valign: "middle",
      });
      drawCell(overallGrade, left + s1, y, s2, summaryRowH, {
        align: "center",
        bold: true,
        size: tightPdf ? 6.1 : compactPdf ? 6.5 : 7.7,
        valign: "middle",
      });

      if (isSummaryWithPoints) {
        drawCell(String(totalPoints ?? 0), left + s1 + s2, y, s3, summaryRowH, {
          align: "center",
          bold: true,
          size: tightPdf ? 6.1 : compactPdf ? 6.5 : 7.7,
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
          size: tightPdf ? 5.4 : compactPdf ? 5.8 : 6.8,
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
          size: tightPdf ? 5.4 : compactPdf ? 5.8 : 6.8,
          valign: "middle",
        }
      );

      y += tightPdf ? 7.1 : compactPdf ? 7.9 : 10.0;

      const subjectBandH = tightPdf ? 5.4 : compactPdf ? 5.8 : 6.9;
      drawBox(left, y, usableWidth, subjectBandH, COLORS.primaryDark, 0);
      drawText(
        "SUBJECT ACHIEVEMENT LEVEL",
        left + 2,
        y + (tightPdf ? 3.85 : compactPdf ? 4.15 : 4.95),
        {
          size: tightPdf ? 7.2 : compactPdf ? 7.7 : 8.7,
          style: "bold",
          color: [255, 255, 255],
        }
      );
      y += tightPdf ? 5.7 : compactPdf ? 6.2 : 7.6;

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

      const tableWidth =
        subjectW +
        paperW +
        componentCount * componentW +
        totalW +
        gradeW +
        commentW +
        initialsW;

      // Keep the Subject Achievement Level table exactly aligned with the other PDF tables.
      // Any tiny width difference is absorbed into the comment column instead of centering
      // a slightly wider/narrower table.
      const tableLeft = left;
      const tableWidthDelta = usableWidth - tableWidth;
      commentW += tableWidthDelta;

      let x = tableLeft;
      const subjectHeadH = tightPdf ? 6.4 : compactPdf ? 7.0 : 8.6;

      drawCell("Subject", x, y, subjectW, subjectHeadH, {
        bold: true,
        fill: true,
        fillColor: COLORS.primarySoft,
        size: tightPdf ? 6.1 : compactPdf ? 6.5 : 7.4,
      });
      x += subjectW;

      if (hasPapers) {
        drawCell("Paper", x, y, paperW, subjectHeadH, {
          bold: true,
          fill: true,
          fillColor: COLORS.primarySoft,
          size: tightPdf ? 6.1 : compactPdf ? 6.5 : 7.4,
          align: "center",
        });
        x += paperW;
      }

      for (let i = 0; i < scheme.components.length; i++) {
        const component = scheme.components[i];
        drawCell(
          `${toPdfShortAssessmentLabel(component.label, i, reportType)}\n(Out of ${formatPdfMark(
            component.weightOutOf,
            reportType
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
            size: tightPdf
              ? 5.2
              : compactPdf
              ? 5.7
              : hasPapers && scheme.components.length <= 2
              ? 6.8
              : 6.4,
            lineHeight: tightPdf ? 2.4 : 2.7,
          }
        );
        x += componentW;
      }

      drawCell("Total", x, y, totalW, subjectHeadH, {
        bold: true,
        fill: true,
        fillColor: COLORS.primarySoft,
        align: "center",
        size: tightPdf ? 6.1 : compactPdf ? 6.5 : 7.4,
      });
      x += totalW;

      drawCell("Grade", x, y, gradeW, subjectHeadH, {
        bold: true,
        fill: true,
        fillColor: COLORS.primarySoft,
        align: "center",
        size: tightPdf ? 6.1 : compactPdf ? 6.5 : 7.4,
      });
      x += gradeW;

      drawCell("Teacher Comment", x, y, commentW, subjectHeadH, {
        bold: true,
        fill: true,
        fillColor: COLORS.primarySoft,
        size: tightPdf ? 5.7 : compactPdf ? 6.1 : 7.1,
      });
      x += commentW;

      drawCell("Init.", x, y, initialsW, subjectHeadH, {
        bold: true,
        fill: true,
        fillColor: COLORS.primarySoft,
        align: "center",
        size: tightPdf ? 6.1 : compactPdf ? 6.5 : 7.4,
      });

      y += subjectHeadH;

      const estimatedContentBottom =
        y +
        rows.length * (tightPdf ? 5.2 : compactPdf ? 5.8 : 7.2) +
        42;

      const freeVerticalSpace = Math.max(0, pageBottom - estimatedContentBottom);
      const verticalStretch =
        tightPdf
          ? 1
          : compactPdf
          ? Math.min(1.07, 1 + freeVerticalSpace / 260)
          : Math.min(1.18, 1 + freeVerticalSpace / 180);

      for (const row of rows) {
        const paperRows = row.papers || [];

        if (hasPapers && paperRows.length > 0) {
          const singlePaperHeightBase = tightPdf ? 5.1 : compactPdf ? 5.8 : 7.5;
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
            lineHeight: tightPdf ? 2.5 : 2.8,
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
                size: tightPdf ? 5.0 : compactPdf ? 5.4 : 6.4,
                valign: "middle",
                lineHeight: tightPdf ? 2.5 : 2.8,
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
          tightPdf ? 5.9 : compactPdf ? 6.2 : 7.2,
          tightPdf ? 2.5 : 2.8
        );
        const commentTextHeight = estimateCellHeight(
          row.teacherComment || "—",
          commentW,
          tightPdf ? 5.0 : compactPdf ? 5.4 : 6.4,
          tightPdf ? 2.5 : 2.8
        );
        const rowHeightBase = tightPdf ? 5.3 : compactPdf ? 6.1 : 8.1;
        const rowHeight = Math.max(
          rowHeightBase * verticalStretch,
          subjectTextHeight,
          commentTextHeight
        );

        ensurePageSpace(rowHeight + 1);

        x = tableLeft;
        drawCell(row.subjectName, x, y, subjectW, rowHeight, {
          size: tightPdf ? 5.9 : compactPdf ? 6.2 : 7.2,
          bold: true,
          valign: "middle",
          lineHeight: tightPdf ? 2.5 : 2.8,
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
            size: tightPdf ? 5.9 : compactPdf ? 6.2 : 7.2,
            valign: "middle",
          });
          x += componentW;
        }

        drawCell(formatPdfMark(row.total, reportType), x, y, totalW, rowHeight, {
          align: "center",
          bold: true,
          size: tightPdf ? 5.9 : compactPdf ? 6.2 : 7.2,
          valign: "middle",
        });
        x += totalW;

        drawCell(row.grade, x, y, gradeW, rowHeight, {
          align: "center",
          bold: true,
          size: tightPdf ? 5.9 : compactPdf ? 6.2 : 7.2,
          valign: "middle",
        });
        x += gradeW;

        drawCell(row.teacherComment, x, y, commentW, rowHeight, {
          size: tightPdf ? 5.0 : compactPdf ? 5.4 : 6.4,
          valign: "middle",
          lineHeight: tightPdf ? 2.5 : 2.8,
        });
        x += commentW;

        drawCell(row.teacherInitials, x, y, initialsW, rowHeight, {
          align: "center",
          bold: true,
          size: tightPdf ? 5.9 : compactPdf ? 6.2 : 7.2,
          valign: "middle",
        });

        y += rowHeight;
      }

      y += tightPdf ? 1.8 : compactPdf ? 2.4 : 3.8;

      const headCommentText = headTeacherComment || "—";

      // PDF-only bottom block sizing.
      // Keep the descriptor rows readable, but dynamically compress the bottom block when
      // many subjects have already consumed most of the page. This prevents the Head
      // Teacher's comment from being drawn below the visible page area.
      const remainingHeight = Math.max(pageBottom - y, 18);

      const base = {
        blockTitleH: tightPdf ? 4.8 : compactPdf ? 5.3 : 6.4,
        gdHeaderH: tightPdf ? 5.2 : compactPdf ? 5.8 : 6.7,
        gdRowH: tightPdf ? 6.5 : compactPdf ? 7.2 : 8.6,
        titleTableGap: tightPdf ? 0.7 : compactPdf ? 0.8 : 1.0,
        betweenBlocks: tightPdf ? 1.5 : compactPdf ? 1.8 : 2.4,
        commentMinH: tightPdf ? 7.8 : compactPdf ? 8.8 : 10.6,
        afterCommentGap: tightPdf ? 1.1 : compactPdf ? 1.4 : 2.1,
        signatureH: signatureImage ? (tightPdf ? 7.2 : compactPdf ? 8.3 : 10.0) : 4.8,
        labelFont: tightPdf ? 5.8 : compactPdf ? 6.2 : 7.1,
      };

      const desiredCommentFont = tightPdf ? 6.3 : compactPdf ? 6.8 : 7.8;
      const desiredGdFont = tightPdf ? 9 : compactPdf ? 9 : 9;
      const desiredGdDescriptorFont = tightPdf ? 9 : compactPdf ? 9 : 9;
      const desiredGdLineHeight = tightPdf ? 2.8 : compactPdf ? 3.05 : 3.4;

      const baseCommentContentH = Math.max(
        base.commentMinH,
        estimateCellHeight(
          headCommentText,
          usableWidth,
          desiredCommentFont,
          tightPdf ? 2.9 : compactPdf ? 3.1 : 3.45,
          4
        )
      );

      const baseBottomNeeded =
        base.blockTitleH +
        base.titleTableGap +
        base.gdHeaderH +
        gradeDescriptors.length * base.gdRowH +
        base.betweenBlocks +
        base.blockTitleH +
        base.titleTableGap +
        baseCommentContentH +
        base.afterCommentGap +
        base.signatureH;

      let bottomScale = 1;
      if (baseBottomNeeded > remainingHeight) {
        // Use the exact available-height ratio so the whole bottom block remains visible.
        // The lower bound only protects against impossible overflow; in such cases, we
        // still compress as much as needed instead of spilling onto a second page.
        bottomScale = Math.max(0.42, remainingHeight / baseBottomNeeded);
      }

      const sc = (n: number) => Math.max(0.1, round2(n * bottomScale) || n * bottomScale);
      const veryTightBottom = bottomScale < 0.78;

      const bottomTitleH = sc(base.blockTitleH);
      const gdHeaderH = veryTightBottom
        ? sc(base.gdHeaderH)
        : Math.max(sc(base.gdHeaderH), tightPdf ? 4.7 : compactPdf ? 5.1 : 5.7);
      const gdRowH = veryTightBottom
        ? sc(base.gdRowH)
        : Math.max(sc(base.gdRowH), tightPdf ? 5.2 : compactPdf ? 5.6 : 6.4);
      const titleTableGap = sc(base.titleTableGap);
      const betweenBlocks = sc(base.betweenBlocks);
      const commentFont = veryTightBottom
        ? Math.max(5.2, sc(desiredCommentFont))
        : Math.max(tightPdf ? 5.8 : compactPdf ? 6.2 : 7.0, sc(desiredCommentFont));
      const gdFont = veryTightBottom
        ? Math.max(4.8, sc(desiredGdFont))
        : Math.max(tightPdf ? 5.3 : compactPdf ? 5.7 : 6.3, sc(desiredGdFont));
      const gdDescriptorFont = veryTightBottom
        ? Math.max(4.6, sc(desiredGdDescriptorFont))
        : Math.max(tightPdf ? 5.0 : compactPdf ? 5.4 : 6.0, sc(desiredGdDescriptorFont));
      const gdLineHeight = veryTightBottom
        ? Math.max(2.05, sc(desiredGdLineHeight))
        : Math.max(tightPdf ? 2.25 : compactPdf ? 2.45 : 2.75, sc(desiredGdLineHeight));
      const commentContentH = Math.max(sc(base.commentMinH), sc(baseCommentContentH));
      const afterCommentGap = sc(base.afterCommentGap);
      const sigLabelFont = Math.max(4.8, sc(base.labelFont));

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
      y += bottomTitleH + titleTableGap;

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
          size: gdFont,
          valign: "middle",
        });
        drawCell(
          `${formatPdfMark(g.minMark, reportType)} - ${formatPdfMark(g.maxMark, reportType)}`,
          left + gd1 + gd2,
          y,
          gd3,
          gdRowH,
          {
            align: "center",
            size: gdFont,
            valign: "middle",
          }
        );
        drawCell(g.descriptor, left + gd1 + gd2 + gd3, y, gd4, gdRowH, {
          size: gdDescriptorFont,
          valign: "middle",
          lineHeight: gdLineHeight,
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
      y += bottomTitleH + titleTableGap;

      drawCell(headCommentText, left, y, usableWidth, commentContentH, {
        size: commentFont,
        valign: "middle",
        lineHeight: Math.max(2.4, sc(tightPdf ? 2.8 : compactPdf ? 3.0 : 3.3)),
      });
      y += commentContentH + afterCommentGap;

      const signatureY = y;
      const sigColW = 84;
      const sigGap = 18;
      const classSigX = left + 4;
      const headSigX = classSigX + sigColW + sigGap;

      if (signatureImage) {
        const sigMaxW = Math.max(39, sc(tightPdf ? 69 : compactPdf ? 78 : 90));
        const sigMaxH = Math.max(12.75, sc(tightPdf ? 15.75 : compactPdf ? 18.0 : 21.75));
        drawImageFit(
          signatureImage,
          headSigX + 1,
          signatureY - sigMaxH + 7.5,
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

      pdf.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
      pdf.line(classSigX + 32, signatureY + 0.9, classSigX + sigColW, signatureY + 0.9);

      pdf.save(`${safeFileName(fullName)} Report Card.pdf`);
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return <div className="p-4 text-sm text-slate-500">Loading report...</div>;
  }

  if (error) {
    return <div className="p-4 text-sm text-red-600">{error}</div>;
  }

  if (!student || !activeEnrollment) {
    return <div className="p-4 text-sm text-red-600">Student report not found.</div>;
  }

  const componentHeaders = scheme?.components || [];
  const hasPaperBreakdown = isALevelReport && rows.some((r) => (r.papers || []).length > 0);

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <Card>
        <CardHeader
          title="Student Report Card"
          subtitle={reportTypeLabel(reportType)}
          right={
            <Button onClick={handleDownloadPdf} disabled={downloading}>
              {downloading ? "Generating PDF..." : "Download PDF"}
            </Button>
          }
        />
      </Card>

      <div className="mx-auto w-full max-w-[210mm] rounded-[30px] border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-teal-50 p-5 text-slate-900 shadow-xl">
        <div className="rounded-[24px] border border-indigo-100 bg-white px-5 py-4 shadow-sm">
          <div className="text-center">
            <div className="text-2xl font-extrabold tracking-tight text-slate-900">
              {SCHOOL_NAME}
            </div>
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-indigo-700">
              {SCHOOL_MOTTO}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              {SCHOOL_ADDRESS} • {SCHOOL_CONTACT}
            </div>
            <div className="mt-3 inline-flex rounded-full bg-gradient-to-r from-indigo-700 to-teal-600 px-5 py-1.5 text-[10px] font-bold uppercase tracking-[0.24em] text-white shadow-sm">
              {reportHeading}
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-[1.55fr_1fr_0.72fr]">
          <ReportValueInline label="Name" value={fullName} />
          <ReportValueInline label="Student No" value={studentNo} />
          <ReportValueInline label="Class" value={className} />
        </div>

        <div className="mt-3.5 overflow-hidden rounded-2xl border border-teal-100 bg-white shadow-sm">
          <div className="border-b border-teal-100 bg-gradient-to-r from-teal-700 to-emerald-600 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white">
            Summary Results
          </div>
          <table className="w-full border-collapse text-[11px]">
            <thead className="bg-teal-50 text-slate-700">
              <tr>
                <th className="px-3 py-2 text-left font-bold">Overall Average</th>
                <th className="px-3 py-2 text-left font-bold">Final Grade</th>
                {isALevelReport && (
                  <th className="px-3 py-2 text-left font-bold">Total Points</th>
                )}
                <th className="px-3 py-2 text-left font-bold">Best Score</th>
                <th className="px-3 py-2 text-left font-bold">Lowest Score</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-white">
                <td className="px-3 py-2 font-semibold text-slate-900">
                  {formatMark(overallAverage)}
                </td>
                <td className="px-3 py-2">
                  <Badge>{overallGrade}</Badge>
                </td>
                {isALevelReport && (
                  <td className="px-3 py-2 font-semibold text-slate-900">
                    {totalPoints ?? 0}
                  </td>
                )}
                <td className="px-3 py-2 font-semibold text-slate-900">
                  {bestRow ? `${formatMark(bestRow.total)} (${bestRow.subjectName})` : "—"}
                </td>
                <td className="px-3 py-2 font-semibold text-slate-900">
                  {lowestRow ? `${formatMark(lowestRow.total)} (${lowestRow.subjectName})` : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-3.5 overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm">
          <div className="border-b border-indigo-100 bg-gradient-to-r from-indigo-700 to-teal-600 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white">
            Subject Achievement Level
          </div>
          <table className="w-full border-collapse text-[10.8px]">
            <thead>
              <tr className="bg-indigo-50 text-slate-700">
                <th className="px-2 py-[7px] text-left font-bold">Subject</th>
                {hasPaperBreakdown && (
                  <th className="px-2 py-[7px] text-center font-bold">Paper</th>
                )}
                {componentHeaders.map((component, index) => (
                  <th
                    key={component.assessmentId}
                    className={`px-1 py-[7px] text-center font-bold ${
                      hasPaperBreakdown && componentHeaders.length <= 2 ? "min-w-[72px]" : ""
                    }`}
                  >
                    <div>{toShortAssessmentLabel(component.label, index)}</div>
                    <div className="text-[9px] font-medium text-slate-500">
                      {`(Out of ${formatMark(component.weightOutOf)})`}
                    </div>
                  </th>
                ))}
                <th className="px-1 py-[7px] text-center font-bold">Total</th>
                <th className="px-1 py-[7px] text-center font-bold">Grade</th>
                <th className="px-2 py-[7px] text-left font-bold">Teacher Comment</th>
                <th className="px-1 py-[7px] text-center font-bold">Init.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const paperRows = row.papers || [];

                if (hasPaperBreakdown && paperRows.length > 0) {
                  return paperRows.map((paper, paperIndex) => (
                    <tr
                      key={`${row.subjectId}-${paper.paperId}`}
                      className={index % 2 === 0 ? "bg-white" : "bg-indigo-50/30"}
                    >
                      {paperIndex === 0 && (
                        <td
                          rowSpan={paperRows.length}
                          className="px-2 py-[7px] align-middle font-semibold text-slate-800"
                        >
                          {row.subjectName}
                        </td>
                      )}

                      <td className="px-2 py-[7px] text-center text-slate-700">
                        {paper.paperName}
                      </td>

                      {componentHeaders.map((component) => {
                        const entry = paper.componentScores.find(
                          (c) => c.assessmentId === component.assessmentId
                        );
                        return (
                          <td
                            key={component.assessmentId}
                            className={`px-1 py-[7px] text-center text-slate-700 ${
                              hasPaperBreakdown && componentHeaders.length <= 2
                                ? "min-w-[72px]"
                                : ""
                            }`}
                          >
                            {formatMark(entry?.weightedScore ?? null)}
                          </td>
                        );
                      })}

                      {paperIndex === 0 && (
                        <>
                          <td
                            rowSpan={paperRows.length}
                            className="px-1 py-[7px] text-center align-middle font-bold text-slate-900"
                          >
                            {formatMark(row.total)}
                          </td>
                          <td
                            rowSpan={paperRows.length}
                            className="px-1 py-[7px] text-center align-middle"
                          >
                            <Badge>{row.grade}</Badge>
                          </td>
                          <td
                            rowSpan={paperRows.length}
                            className="px-2 py-[7px] align-middle text-[10.2px] leading-4 text-slate-700"
                          >
                            {row.teacherComment || "—"}
                          </td>
                          <td
                            rowSpan={paperRows.length}
                            className="px-1 py-[7px] text-center align-middle font-bold text-slate-800"
                          >
                            {row.teacherInitials}
                          </td>
                        </>
                      )}
                    </tr>
                  ));
                }

                return (
                  <tr key={row.subjectId} className={index % 2 === 0 ? "bg-white" : "bg-indigo-50/30"}>
                    <td className="px-2 py-[7px] font-semibold text-slate-800">{row.subjectName}</td>
                    {hasPaperBreakdown && (
                      <td className="px-2 py-[7px] text-center text-slate-700">—</td>
                    )}
                    {componentHeaders.map((component) => {
                      const entry = row.componentScores.find(
                        (c) => c.assessmentId === component.assessmentId
                      );
                      return (
                        <td
                          key={component.assessmentId}
                          className={`px-1 py-[7px] text-center text-slate-700 ${
                            hasPaperBreakdown && componentHeaders.length <= 2
                              ? "min-w-[72px]"
                              : ""
                          }`}
                        >
                          {formatMark(entry?.weightedScore ?? null)}
                        </td>
                      );
                    })}
                    <td className="px-1 py-[7px] text-center font-bold text-slate-900">
                      {formatMark(row.total)}
                    </td>
                    <td className="px-1 py-[7px] text-center">
                      <Badge>{row.grade}</Badge>
                    </td>
                    <td className="px-2 py-[7px] text-[10.2px] leading-4 text-slate-700">
                      {row.teacherComment || "—"}
                    </td>
                    <td className="px-1 py-[7px] text-center font-bold text-slate-800">
                      {row.teacherInitials}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-3.5 overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-sm">
          <div className="border-b border-amber-100 bg-gradient-to-r from-amber-600 to-orange-500 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white">
            Grade Descriptor Table
          </div>
          <table className="w-full border-collapse text-[10.4px]">
            <thead className="bg-amber-50">
              <tr>
                <th className="px-2 py-[7px] text-left font-bold">Grade</th>
                <th className="px-2 py-[7px] text-left font-bold">Achievement Level</th>
                <th className="px-2 py-[7px] text-left font-bold">Marks</th>
                <th className="px-2 py-[7px] text-left font-bold">Descriptor</th>
              </tr>
            </thead>
            <tbody>
              {gradeDescriptors.map((item, index) => (
                <tr
                  key={`${item.grade}-${index}`}
                  className={index % 2 === 0 ? "bg-white" : "bg-amber-50/40"}
                >
                  <td className="px-2 py-[7px] font-bold">{item.grade}</td>
                  <td className="px-2 py-[7px] font-semibold">{item.achievementLevel}</td>
                  <td className="px-2 py-[7px]">{`${formatMark(item.minMark)} - ${formatMark(
                    item.maxMark
                  )}`}</td>
                  <td className="px-2 py-[7px] leading-4">{item.descriptor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3.5 overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm">
          <div className="border-b border-indigo-100 bg-gradient-to-r from-indigo-700 to-teal-600 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white">
            Head Teacher&apos;s Comment
          </div>
          <div className="px-3 py-2.5 text-[10.8px] leading-5 text-slate-700">
            {headTeacherComment || "—"}
          </div>
        </div>

        <div className="mt-3.5 rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="h-6" />
              <div className="border-t border-slate-300 pt-1 text-[10.5px] text-slate-700">
                Class Teacher Signature
              </div>
            </div>
            <div>
              <div className="h-6" />
              <div className="border-t border-slate-300 pt-1 text-[10.5px] text-slate-700">
                Head Teacher Signature
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}