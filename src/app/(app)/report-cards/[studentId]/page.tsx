"use client";

import React from "react";
import { useParams, useSearchParams } from "next/navigation";
import jsPDF from "jspdf";
import { Button, Card, CardHeader, Badge } from "@/components/ui";
import { getRemarkOverride, pickRemark } from "@/lib/store";
import type { ReportType } from "@/lib/store";

const SCHOOL_NAME = "Zana Christian High School";
const SCHOOL_MOTTO = "IN GOD, WE TRUST";
const SCHOOL_ADDRESS = "P.O. Box 21312, Kampala, Uganda";
const SCHOOL_CONTACT = "Tel: 0773 748 168 / 0704 590 234";

type StudentApiRow = {
  id: string;
  firstName: string;
  lastName: string;
  admissionNo?: string | null;
  studentNo?: string | null;
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

type SchemeComponent = {
  assessmentId: string;
  label: string;
  weightOutOf: number;
  order?: number;
};

type SchemeApiRow = {
  id: string;
  reportType: string;
  name: string;
  components: SchemeComponent[];
};

type MarksRow = {
  studentId: string;
  scoreRaw: number | null;
};

type SubjectReportRow = {
  subjectId: string;
  subjectName: string;
  componentScores: Array<{
    assessmentId: string;
    label: string;
    shortLabel: string;
    weightOutOf: number;
    rawScore: number | null;
    weightedScore: number | null;
  }>;
  total: number | null;
  grade: string;
  teacherInitials: string;
  teacherComment: string;
};

type AcademicYearRow = {
  id: string;
  name: string;
};

type TermRow = {
  id: string;
  name: string;
};

const GRADE_DESCRIPTORS = [
  {
    grade: "A",
    level: "Exceptional",
    range: "85+",
    descriptor:
      "Demonstrates an extraordinary level of competency by applying innovatively and creatively the acquired knowledge and skills in real-life situations.",
  },
  {
    grade: "B",
    level: "Outstanding",
    range: "70 – 84",
    descriptor:
      "Demonstrates a high level of competency by applying the acquired knowledge and skills in real-life situations.",
  },
  {
    grade: "C",
    level: "Satisfactory",
    range: "50 – 69",
    descriptor:
      "Demonstrates an adequate level of competency by applying the acquired knowledge and skills in real-life situations.",
  },
  {
    grade: "D",
    level: "Basic",
    range: "25 – 49",
    descriptor:
      "Demonstrates a minimum level of competency in applying the acquired knowledge and skills in real-life situations.",
  },
  {
    grade: "E",
    level: "Elementary",
    range: "0 – 24",
    descriptor:
      "Demonstrates below the basic level of competency in applying the acquired knowledge and skills in real-life situations.",
  },
];

function gradeScore(score: number | null) {
  if (score === null) return "—";
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 50) return "C";
  if (score >= 25) return "D";
  return "E";
}

function safeFileName(name: string) {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "").replace(/\s+/g, " ").trim();
}

function formatMark(value: number | null) {
  if (value === null || Number.isNaN(value)) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function toShortAssessmentLabel(_label: string, index: number) {
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

function ReportValue({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-semibold text-slate-900">
        {value}
      </div>
    </div>
  );
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
  const [loading, setLoading] = React.useState(true);
  const [downloading, setDownloading] = React.useState(false);
  const [error, setError] = React.useState("");

  const [student, setStudent] = React.useState<StudentApiRow | null>(null);
  const [scheme, setScheme] = React.useState<SchemeApiRow | null>(null);
  const [rows, setRows] = React.useState<SubjectReportRow[]>([]);
  const [activeEnrollment, setActiveEnrollment] = React.useState<
    StudentApiRow["enrollments"] extends Array<infer T> ? T | null : null
  >(null);
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

        const enrolledSubjects =
          loadedActiveEnrollment.subjects
            ?.map((s) => ({
              subjectId: s.subjectId,
              subjectName: s.subject?.name || "Unnamed Subject",
            }))
            .filter((s) => !!s.subjectId) || [];

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
            })
          ),
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
          classId: loadedActiveEnrollment.classId,
        });
        if (loadedActiveEnrollment.streamId) {
          metaParams.set("streamId", loadedActiveEnrollment.streamId);
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

        for (const subject of enrolledSubjects) {
          const componentScores: SubjectReportRow["componentScores"] = [];

          for (let i = 0; i < loadedScheme.components.length; i++) {
            const component = loadedScheme.components[i];

            const params = new URLSearchParams({
              academicYearId: yearId,
              termId,
              assessmentDefinitionId: component.assessmentId,
              classId: loadedActiveEnrollment.classId,
              subjectId: subject.subjectId,
            });

            const marksRes = await fetch(`/api/marks?${params.toString()}`, {
              cache: "no-store",
              credentials: "include",
            });
            const marksData = await marksRes.json();

            if (!marksRes.ok) {
              throw new Error(
                marksData?.error || `Failed to load marks for ${subject.subjectName}`
              );
            }

            const studentMark = Array.isArray(marksData)
              ? (marksData as MarksRow[]).find((m) => m.studentId === studentId)
              : null;

            const rawScore =
              typeof studentMark?.scoreRaw === "number" ? studentMark.scoreRaw : null;

            const weightedScore =
              rawScore === null
                ? null
                : Number(
                    ((rawScore * Number(component.weightOutOf || 0)) / 100).toFixed(1)
                  );

            componentScores.push({
              assessmentId: component.assessmentId,
              label: component.label,
              shortLabel: toShortAssessmentLabel(component.label, i),
              weightOutOf: Number(component.weightOutOf || 0),
              rawScore,
              weightedScore,
            });
          }

          const weightedValues = componentScores
            .map((c) => c.weightedScore)
            .filter((x): x is number => typeof x === "number");

          const total =
            weightedValues.length > 0
              ? Number(weightedValues.reduce((sum, value) => sum + value, 0).toFixed(1))
              : null;

          provisionalRows.push({
            subjectId: subject.subjectId,
            subjectName: subject.subjectName,
            total,
            grade: gradeScore(total),
            teacherInitials: teacherMap[subject.subjectId] || "—",
            componentScores,
          });
        }

        const totals = provisionalRows
          .map((r) => r.total)
          .filter((x): x is number => typeof x === "number");

        const overallAverage =
          totals.length > 0
            ? Number((totals.reduce((sum, v) => sum + v, 0) / totals.length).toFixed(1))
            : null;

        const overallGrade = gradeScore(overallAverage);

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
        setActiveEnrollment(loadedActiveEnrollment);
        setScheme(loadedScheme);
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
  }, [studentId, yearId, termId, reportType]);

  const fullName = student ? `${student.firstName} ${student.lastName}` : "";
  const studentNo =
    student?.admissionNo || student?.studentNo || "No admission number";
  const className = activeEnrollment?.class?.name || "—";

  const totals = rows
    .map((r) => r.total)
    .filter((x): x is number => typeof x === "number");

  const overallAverage =
    totals.length > 0
      ? Number((totals.reduce((sum, v) => sum + v, 0) / totals.length).toFixed(1))
      : null;

  const overallGrade = gradeScore(overallAverage);

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

      const pdf = new jsPDF("p", "mm", "a4");
      const left = 6.2;
      const usableWidth = 197.6;
      const pageWidth = 210;
      let y = 6.5;

      const drawText = (
        text: string,
        x: number,
        yy: number,
        opts?: { size?: number; style?: "normal" | "bold"; align?: "left" | "center" | "right" }
      ) => {
        pdf.setFont("helvetica", opts?.style || "normal");
        pdf.setFontSize(opts?.size || 10);
        pdf.text(text, x, yy, { align: opts?.align || "left" });
      };

      const drawBox = (
        x: number,
        yy: number,
        w: number,
        h: number,
        fillRgb?: [number, number, number]
      ) => {
        if (fillRgb) {
          pdf.setFillColor(fillRgb[0], fillRgb[1], fillRgb[2]);
          pdf.roundedRect(x, yy, w, h, 2, 2, "F");
        }
        pdf.setDrawColor(226, 232, 240);
        pdf.roundedRect(x, yy, w, h, 2, 2);
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
          size?: number;
        }
      ) => {
        if (opts?.fill) {
          pdf.setFillColor(248, 250, 252);
          pdf.rect(x, yy, w, h, "F");
        }
        pdf.setDrawColor(226, 232, 240);
        pdf.rect(x, yy, w, h);
        pdf.setFont("helvetica", opts?.bold ? "bold" : "normal");
        pdf.setFontSize(opts?.size || 7.8);

        const align = opts?.align || "left";
        const lines = pdf.splitTextToSize(String(text), w - 2);

        let tx = x + 1;
        if (align === "center") tx = x + w / 2;
        if (align === "right") tx = x + w - 1;

        const baseY = yy + 4.1;
        lines.slice(0, 3).forEach((line: string, idx: number) => {
          pdf.text(line, tx, baseY + idx * 3.2, { align });
        });
      };

      drawBox(left, y, usableWidth, 21, [255, 255, 255]);
      drawText(SCHOOL_NAME, pageWidth / 2, y + 5.8, {
        size: 16.5,
        style: "bold",
        align: "center",
      });
      drawText(SCHOOL_MOTTO, pageWidth / 2, y + 10.4, {
        size: 9,
        align: "center",
      });
      drawText(`${SCHOOL_ADDRESS} • ${SCHOOL_CONTACT}`, pageWidth / 2, y + 14.5, {
        size: 8.2,
        align: "center",
      });
      drawText("ACADEMIC REPORT CARD", pageWidth / 2, y + 19.2, {
        size: 11.3,
        style: "bold",
        align: "center",
      });

      y += 24;

      const infoW = (usableWidth - 4) / 3;
      drawBox(left, y, infoW, 12.5, [255, 255, 255]);
      drawBox(left + infoW + 2, y, infoW, 12.5, [255, 255, 255]);
      drawBox(left + infoW * 2 + 4, y, infoW, 12.5, [255, 255, 255]);

      drawText("Student Name", left + 2, y + 4.2, { size: 7.2, style: "bold" });
      drawText(fullName, left + 2, y + 9.2, { size: 8.8 });

      drawText("Student No.", left + infoW + 4, y + 4.2, { size: 7.2, style: "bold" });
      drawText(studentNo, left + infoW + 4, y + 9.2, { size: 8.8 });

      drawText("Class", left + infoW * 2 + 6, y + 4.2, { size: 7.2, style: "bold" });
      drawText(className, left + infoW * 2 + 6, y + 9.2, { size: 8.8 });

      y += 15.5;

      drawBox(left, y, infoW, 12.5, [255, 255, 255]);
      drawBox(left + infoW + 2, y, infoW, 12.5, [255, 255, 255]);
      drawBox(left + infoW * 2 + 4, y, infoW, 12.5, [255, 255, 255]);

      drawText("Academic Year", left + 2, y + 4.2, { size: 7.2, style: "bold" });
      drawText(academicYearName || yearId, left + 2, y + 9.2, { size: 8.8 });

      drawText("Term", left + infoW + 4, y + 4.2, { size: 7.2, style: "bold" });
      drawText(termName || termId, left + infoW + 4, y + 9.2, { size: 8.8 });

      drawText("Report Type", left + infoW * 2 + 6, y + 4.2, { size: 7.2, style: "bold" });
      drawText(reportTypeLabel(reportType), left + infoW * 2 + 6, y + 9.2, { size: 8.8 });

      y += 17;

      drawText("SUMMARY RESULTS", left, y, { size: 9.4, style: "bold" });
      y += 2.8;

      const s1 = 49;
      const s2 = 36;
      const s3 = 56.3;
      const s4 = 56.3;

      drawCell("Overall Average", left, y, s1, 8.5, { bold: true, fill: true, size: 7.8 });
      drawCell("Final Grade", left + s1, y, s2, 8.5, { bold: true, fill: true, size: 7.8 });
      drawCell("Best Score", left + s1 + s2, y, s3, 8.5, { bold: true, fill: true, size: 7.8 });
      drawCell("Lowest Score", left + s1 + s2 + s3, y, s4, 8.5, {
        bold: true,
        fill: true,
        size: 7.8,
      });
      y += 8.5;

      drawCell(formatMark(overallAverage), left, y, s1, 8.5, {
        align: "center",
        bold: true,
        size: 8.2,
      });
      drawCell(overallGrade, left + s1, y, s2, 8.5, {
        align: "center",
        bold: true,
        size: 8.2,
      });
      drawCell(
        bestRow ? `${formatMark(bestRow.total)} (${bestRow.subjectName})` : "—",
        left + s1 + s2,
        y,
        s3,
        8.5,
        { align: "center", bold: true, size: 7.4 }
      );
      drawCell(
        lowestRow ? `${formatMark(lowestRow.total)} (${lowestRow.subjectName})` : "—",
        left + s1 + s2 + s3,
        y,
        s4,
        8.5,
        { align: "center", bold: true, size: 7.4 }
      );

      y += 12.5;

      drawText("SUBJECT ACHIEVEMENT LEVEL", left, y, { size: 9.4, style: "bold" });
      y += 2.8;

      const componentCount = scheme.components.length;
      const subjectW = 34;
      const componentW = componentCount <= 2 ? 16 : componentCount === 3 ? 14 : 12;
      const totalW = 12;
      const gradeW = 11;
      const initialsW = 10;
      const commentW =
        usableWidth - (subjectW + componentCount * componentW + totalW + gradeW + initialsW);

      let x = left;
      drawCell("Subject", x, y, subjectW, 9.5, { bold: true, fill: true, size: 7.8 });
      x += subjectW;

      for (let i = 0; i < scheme.components.length; i++) {
        const component = scheme.components[i];
        drawCell(`CA ${i + 1}\n(Out of ${component.weightOutOf})`, x, y, componentW, 9.5, {
          bold: true,
          fill: true,
          align: "center",
          size: 7.0,
        });
        x += componentW;
      }

      drawCell("Total", x, y, totalW, 9.5, {
        bold: true,
        fill: true,
        align: "center",
        size: 7.8,
      });
      x += totalW;
      drawCell("Grade", x, y, gradeW, 9.5, {
        bold: true,
        fill: true,
        align: "center",
        size: 7.8,
      });
      x += gradeW;
      drawCell("Teacher Comment", x, y, commentW, 9.5, {
        bold: true,
        fill: true,
        size: 7.5,
      });
      x += commentW;
      drawCell("Init.", x, y, initialsW, 9.5, {
        bold: true,
        fill: true,
        align: "center",
        size: 7.8,
      });

      y += 9.5;

      for (const row of rows) {
        x = left;
        const rowHeight = 9;

        drawCell(row.subjectName, x, y, subjectW, rowHeight, { size: 7.8 });
        x += subjectW;

        for (const component of scheme.components) {
          const item = row.componentScores.find((c) => c.assessmentId === component.assessmentId);
          drawCell(formatMark(item?.weightedScore ?? null), x, y, componentW, rowHeight, {
            align: "center",
            size: 7.8,
          });
          x += componentW;
        }

        drawCell(formatMark(row.total), x, y, totalW, rowHeight, {
          align: "center",
          bold: true,
          size: 7.8,
        });
        x += totalW;
        drawCell(row.grade, x, y, gradeW, rowHeight, {
          align: "center",
          bold: true,
          size: 7.8,
        });
        x += gradeW;
        drawCell(row.teacherComment, x, y, commentW, rowHeight, { size: 7.0 });
        x += commentW;
        drawCell(row.teacherInitials, x, y, initialsW, rowHeight, {
          align: "center",
          bold: true,
          size: 7.8,
        });

        y += rowHeight;
      }

      y += 5.5;

      const gd1 = 16;
      const gd2 = 36;
      const gd3 = 25;
      const gd4 = usableWidth - (gd1 + gd2 + gd3);

      drawText("GRADE DESCRIPTOR TABLE", left, y, { size: 9.4, style: "bold" });
      y += 2.8;

      drawCell("Grade", left, y, gd1, 8, { bold: true, fill: true, size: 7.8 });
      drawCell("Achievement Level", left + gd1, y, gd2, 8, {
        bold: true,
        fill: true,
        size: 7.8,
      });
      drawCell("Marks", left + gd1 + gd2, y, gd3, 8, {
        bold: true,
        fill: true,
        size: 7.8,
      });
      drawCell("Descriptor", left + gd1 + gd2 + gd3, y, gd4, 8, {
        bold: true,
        fill: true,
        size: 7.8,
      });
      y += 8;

      for (const g of GRADE_DESCRIPTORS) {
        drawCell(g.grade, left, y, gd1, 9.5, { align: "center", bold: true, size: 7.8 });
        drawCell(g.level, left + gd1, y, gd2, 9.5, { size: 7.3 });
        drawCell(g.range, left + gd1 + gd2, y, gd3, 9.5, { align: "center", size: 7.3 });
        drawCell(g.descriptor, left + gd1 + gd2 + gd3, y, gd4, 9.5, { size: 7.0 });
        y += 9.5;
      }

      y += 5.5;
      drawText("HEAD TEACHER'S COMMENT", left, y, { size: 9.2, style: "bold" });
      y += 2.5;
      drawCell(headTeacherComment || "—", left, y, usableWidth, 11, { size: 7.6 });
      y += 15;

      drawText("Class Teacher Signature: ____________________", left, y, { size: 8.5 });
      drawText("Head Teacher Signature: ____________________", 108, y, { size: 8.5 });

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

      <div className="mx-auto w-full max-w-[210mm] rounded-[30px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 p-5 text-slate-900 shadow-xl">
        <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="text-center">
            <div className="text-2xl font-extrabold tracking-tight text-slate-900">
              {SCHOOL_NAME}
            </div>
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              {SCHOOL_MOTTO}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              {SCHOOL_ADDRESS} • {SCHOOL_CONTACT}
            </div>
            <div className="mt-3 inline-flex rounded-full bg-slate-900 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.24em] text-white shadow-sm">
              Academic Report Card
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-3">
          <ReportValue label="Student Name" value={fullName} />
          <ReportValue label="Student No." value={studentNo} />
          <ReportValue label="Class" value={className} />
          <ReportValue label="Academic Year" value={academicYearName || yearId} />
          <ReportValue label="Term" value={termName || termId} />
          <ReportValue label="Report Type" value={reportTypeLabel(reportType)} />
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-900 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white">
            Summary Results
          </div>
          <table className="w-full border-collapse text-[11px]">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 text-left font-bold">Overall Average</th>
                <th className="px-3 py-2 text-left font-bold">Final Grade</th>
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

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-900 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white">
            Subject Achievement Level
          </div>
          <table className="w-full border-collapse text-[10.8px]">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="w-[17%] px-2 py-2 text-left font-bold">Subject</th>
                {componentHeaders.map((component, index) => (
                  <th key={component.assessmentId} className="px-1 py-2 text-center font-bold">
                    <div>{`CA ${index + 1}`}</div>
                    <div className="text-[9px] font-medium text-slate-500">
                      {`(Out of ${component.weightOutOf})`}
                    </div>
                  </th>
                ))}
                <th className="w-[6%] px-1 py-2 text-center font-bold">Total</th>
                <th className="w-[6%] px-1 py-2 text-center font-bold">Grade</th>
                <th className="w-[28%] px-2 py-2 text-left font-bold">Teacher Comment</th>
                <th className="w-[6%] px-1 py-2 text-center font-bold">Init.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.subjectId} className={index % 2 === 0 ? "bg-white" : "bg-slate-50/70"}>
                  <td className="px-2 py-2 font-semibold text-slate-800">{row.subjectName}</td>
                  {componentHeaders.map((component) => {
                    const entry = row.componentScores.find(
                      (c) => c.assessmentId === component.assessmentId
                    );
                    return (
                      <td key={component.assessmentId} className="px-1 py-2 text-center text-slate-700">
                        {formatMark(entry?.weightedScore ?? null)}
                      </td>
                    );
                  })}
                  <td className="px-1 py-2 text-center font-bold text-slate-900">
                    {formatMark(row.total)}
                  </td>
                  <td className="px-1 py-2 text-center">
                    <Badge>{row.grade}</Badge>
                  </td>
                  <td className="px-2 py-2 text-[10.4px] leading-4 text-slate-700">
                    {row.teacherComment || "—"}
                  </td>
                  <td className="px-1 py-2 text-center font-bold text-slate-800">
                    {row.teacherInitials}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-900 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white">
            Grade Descriptor Table
          </div>
          <table className="w-full border-collapse text-[10.4px]">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-2 py-2 text-left font-bold">Grade</th>
                <th className="px-2 py-2 text-left font-bold">Achievement Level</th>
                <th className="px-2 py-2 text-left font-bold">Marks</th>
                <th className="px-2 py-2 text-left font-bold">Descriptor</th>
              </tr>
            </thead>
            <tbody>
              {GRADE_DESCRIPTORS.map((item, index) => (
                <tr key={item.grade} className={index % 2 === 0 ? "bg-white" : "bg-slate-50/70"}>
                  <td className="px-2 py-2 font-bold">{item.grade}</td>
                  <td className="px-2 py-2 font-semibold">{item.level}</td>
                  <td className="px-2 py-2">{item.range}</td>
                  <td className="px-2 py-2 leading-4">{item.descriptor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-900 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white">
            Head Teacher&apos;s Comment
          </div>
          <div className="px-3 py-3 text-[10.8px] leading-5 text-slate-700">
            {headTeacherComment || "—"}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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