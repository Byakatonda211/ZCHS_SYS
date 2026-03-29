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

async function canViewClass(user: RoleUser, classId: string) {
  if (user.role === "ADMIN") return true;

  const assignments = await prisma.teachingAssignment.findMany({
    where: { userId: user.id, classId },
    select: { id: true },
  });

  return assignments.length > 0;
}

function round2(v: number) {
  return Math.round(v * 100) / 100;
}

function formatMark(v: number | null) {
  if (v === null || !Number.isFinite(v)) return "-";
  const n = round2(v);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
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
      assessment: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

function createPdfBuffer(doc: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer | Uint8Array) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

function abbreviateSubject(name: string) {
  const cleaned = String(name || "")
    .replace(/[()]/g, " ")
    .replace(/&/g, " AND ")
    .replace(/\s+/g, " ")
    .trim();

  const known: Record<string, string> = {
    MATHEMATICS: "MTC",
    "ADDITIONAL MATHEMATICS": "ADD MTC",
    HISTORY: "HIS",
    GEOGRAPHY: "GEO",
    BIOLOGY: "BIO",
    CHEMISTRY: "CHE",
    PHYSICS: "PHY",
    ENGLISH: "ENG",
    "ENGLISH LANGUAGE": "ENG",
    LITERATURE: "LIT",
    "LITERATURE IN ENGLISH": "LIT",
    KISWAHILI: "KIS",
    FRENCH: "FRE",
    LUGANDA: "LUG",
    CHRISTIAN: "CRE",
    "CHRISTIAN RELIGIOUS EDUCATION": "CRE",
    ISLAMIC: "IRE",
    "ISLAMIC RELIGIOUS EDUCATION": "IRE",
    COMMERCE: "COM",
    ENTREPRENEURSHIP: "ENT",
    ECONOMICS: "ECO",
    AGRICULTURE: "AGR",
    "AGRICULTURE SCIENCE": "AGR",
    "FINE ART": "ART",
    "ART AND DESIGN": "ART",
    MUSIC: "MUS",
    "PHYSICAL EDUCATION": "PE",
    COMPUTER: "ICT",
    "COMPUTER STUDIES": "ICT",
    "INFORMATION AND COMMUNICATION TECHNOLOGY": "ICT",
    TECHNICAL: "TECH",
    "HOME ECONOMICS": "H/E",
    "SUBSIDIARY MATHEMATICS": "S/MTC",
    "GENERAL PAPER": "GP",
  };

  const upper = cleaned.toUpperCase();
  if (known[upper]) return known[upper];

  const words = upper
    .split(" ")
    .map((w) => w.trim())
    .filter(Boolean)
    .filter((w) => !["AND", "OF", "IN", "THE", "FOR"].includes(w));

  if (words.length === 1) {
    return words[0].slice(0, 3);
  }

  const initials = words.map((w) => w[0]).join("");
  if (initials.length >= 2 && initials.length <= 5) return initials;

  return words
    .slice(0, 2)
    .map((w) => w.slice(0, 3))
    .join("/");
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
    const reportType = (searchParams.get("reportType") || "").trim();

    if ((!academicYearId && !academicYearName) || (!termId && !termName) || (!classId && !className) || !reportType) {
      return NextResponse.json({ error: "Missing required query params" }, { status: 400 });
    }

    const cls = await resolveClass(classId, className);
    const year = await resolveAcademicYear(academicYearId, academicYearName);
    const term = await resolveTerm(termId, termName, year?.id);

    if (!cls || !year || !term) {
      return NextResponse.json({ error: "Invalid selection" }, { status: 404 });
    }

    const allowed = await canViewClass(user, cls.id);
    if (!allowed) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const schemeComponents = await getSchemeComponents(reportType);
    if (!schemeComponents.length) {
      return NextResponse.json({ error: "Report scheme not found or has no components" }, { status: 400 });
    }

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
      },
      select: {
        id: true,
        student: {
          select: {
            firstName: true,
            lastName: true,
            otherNames: true,
          },
        },
        subjects: {
          select: { subjectId: true },
        },
      },
      orderBy: [
        { student: { lastName: "asc" } },
        { student: { firstName: "asc" } },
      ],
    });

    const enrollmentIds = enrollments.map((e) => e.id);

    const enrolledSubjectIds = Array.from(
      new Set(enrollments.flatMap((e) => e.subjects.map((s) => s.subjectId)))
    );

    let subjectRows = await prisma.subject.findMany({
      where: {
        id: { in: enrolledSubjectIds.length ? enrolledSubjectIds : ["__none__"] },
        isActive: true,
        level: cls.level,
      },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
      },
    });

    if (!subjectRows.length) {
      subjectRows = await prisma.subject.findMany({
        where: {
          isActive: true,
          level: cls.level,
        },
        orderBy: [{ name: "asc" }],
        select: {
          id: true,
          name: true,
        },
      });
    }

    const markEntries = await prisma.markEntry.findMany({
      where: {
        academicYearId: year.id,
        termId: term.id,
        enrollmentId: { in: enrollmentIds.length ? enrollmentIds : ["__none__"] },
        subjectId: { in: subjectRows.length ? subjectRows.map((s) => s.id) : ["__none__"] },
        componentId: {
          in: assessmentComponents.length ? assessmentComponents.map((c) => c.id) : ["__none__"],
        },
      },
      select: {
        enrollmentId: true,
        subjectId: true,
        componentId: true,
        subjectPaperId: true,
        scoreRaw: true,
      },
    });

    function computeSubjectMark(enrollmentId: string, subjectId: string): number | null {
      const subjectEntries = markEntries.filter(
        (m) => m.enrollmentId === enrollmentId && m.subjectId === subjectId
      );

      if (!subjectEntries.length) return null;

      let total = 0;
      let hasAny = false;
      const schemeMax = schemeComponents.reduce((sum: number, sc: any) => sum + (Number(sc.weightOutOf ?? 0) || 0), 0);

      for (const sc of schemeComponents) {
        const componentIds = definitionToComponentIds.get(sc.assessmentDefinitionId) ?? [];
        if (!componentIds.length) continue;

        const entries = subjectEntries.filter((m) => componentIds.includes(m.componentId));
        if (!entries.length) continue;

        hasAny = true;

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

      if (!hasAny) return null;
      if (schemeMax <= 0) return round2(total);

      return round2((total / schemeMax) * 100);
    }

    const rows = enrollments.map((enrollment) => {
      const studentName = [
        enrollment.student.firstName,
        enrollment.student.lastName,
        enrollment.student.otherNames,
      ]
        .filter(Boolean)
        .join(" ");

      const enrolledSet = new Set(enrollment.subjects.map((s) => s.subjectId));
      const marks: string[] = [];
      const numericMarks: number[] = [];

      for (const subject of subjectRows) {
        if (!enrolledSet.has(subject.id)) {
          marks.push("-");
          continue;
        }

        const mark = computeSubjectMark(enrollment.id, subject.id);
        if (mark === null) {
          marks.push("-");
        } else {
          marks.push(formatMark(mark));
          numericMarks.push(mark);
        }
      }

      const average =
        numericMarks.length > 0
          ? formatMark(round2(numericMarks.reduce((a, b) => a + b, 0) / numericMarks.length))
          : "-";

      return { studentName, marks, average };
    });

    const PDFDocument = (await import("pdfkit/js/pdfkit.standalone")).default;
    const doc: any = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 18,
    });

    const pdfPromise = createPdfBuffer(doc);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const left = 18;
    const usableWidth = pageWidth - 36;

    const title = "ZZANA CHRISTIAN HIGH SCHOOL";
    const subtitle = `SUMMARY SHEET • ${cls.name} • ${term.name} • ${year.name} • ${reportType.replace("_", " ")}`;

    const nameColWidth = 150;
    const avgColWidth = 42;
    const subjectCount = Math.max(subjectRows.length, 1);
    const subjectAreaWidth = usableWidth - nameColWidth - avgColWidth;
    const subjectColWidth = subjectAreaWidth / subjectCount;

    const useAbbrev = subjectColWidth < 42;
    const displayedHeaders = subjectRows.map((s) => ({
      id: s.id,
      label: useAbbrev ? abbreviateSubject(s.name) : s.name,
    }));

    const titleFont = 14;
    const subtitleFont = 9;
    const headerFont = useAbbrev ? 6.5 : subjectColWidth < 52 ? 7 : 8;
    const bodyFont = subjectColWidth < 42 ? 6.8 : 7.8;
    const studentFont = subjectColWidth < 42 ? 7 : 8.2;

    const headerHeight = useAbbrev ? 20 : subjectColWidth < 52 ? 24 : 28;
    const rowHeight = 16;

    function drawHeader() {
      doc.font("Helvetica-Bold").fontSize(titleFont).fillColor("#111827").text(title, left, 14, {
        width: usableWidth,
        align: "center",
      });

      doc.font("Helvetica").fontSize(subtitleFont).fillColor("#374151").text(subtitle, left, 32, {
        width: usableWidth,
        align: "center",
      });

      let x = left;
      const y = 56;

      doc.lineWidth(0.7).strokeColor("#111827");

      doc.rect(x, y, nameColWidth, headerHeight).stroke();
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#111827").text("Student Name", x + 3, y + 6, {
        width: nameColWidth - 6,
        align: "left",
      });
      x += nameColWidth;

      for (const subject of displayedHeaders) {
        doc.rect(x, y, subjectColWidth, headerHeight).stroke();
        doc.font("Helvetica-Bold").fontSize(headerFont).fillColor("#111827").text(subject.label, x + 1, y + 5, {
          width: subjectColWidth - 2,
          align: "center",
        });
        x += subjectColWidth;
      }

      doc.rect(x, y, avgColWidth, headerHeight).stroke();
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#111827").text("AVG", x + 1, y + 6, {
        width: avgColWidth - 2,
        align: "center",
      });

      return y + headerHeight;
    }

    let y = drawHeader();

    for (const row of rows) {
      if (y + rowHeight > pageHeight - 18) {
        doc.addPage({ size: "A4", layout: "landscape", margin: 18 });
        y = drawHeader();
      }

      let x = left;

      doc.rect(x, y, nameColWidth, rowHeight).stroke();
      doc.font("Helvetica").fontSize(studentFont).fillColor("#111827").text(row.studentName, x + 3, y + 4, {
        width: nameColWidth - 6,
        align: "left",
      });
      x += nameColWidth;

      for (const mark of row.marks) {
        doc.rect(x, y, subjectColWidth, rowHeight).stroke();
        doc.font("Helvetica").fontSize(bodyFont).fillColor("#111827").text(mark, x + 1, y + 4, {
          width: subjectColWidth - 2,
          align: "center",
        });
        x += subjectColWidth;
      }

      doc.rect(x, y, avgColWidth, rowHeight).stroke();
      doc.font("Helvetica").fontSize(bodyFont).fillColor("#111827").text(row.average, x + 1, y + 4, {
        width: avgColWidth - 2,
        align: "center",
      });

      y += rowHeight;
    }

    if (useAbbrev) {
      const legend = displayedHeaders
        .map((h, i) => `${h.label} = ${subjectRows[i].name}`)
        .join("   •   ");

      if (y + 24 > pageHeight - 18) {
        doc.addPage({ size: "A4", layout: "landscape", margin: 18 });
        y = 20;
      } else {
        y += 8;
      }

      doc.font("Helvetica-Bold").fontSize(8).fillColor("#111827").text("Subject Key", left, y, {
        width: usableWidth,
        align: "left",
      });

      doc.font("Helvetica").fontSize(7).fillColor("#374151").text(legend, left, y + 10, {
        width: usableWidth,
        align: "left",
      });
    }

    doc.end();
    const pdf = await pdfPromise;

    const filename = `${cls.name}-${reportType}-summary-sheet.pdf`
      .replace(/\s+/g, "_")
      .replace(/[^\w.-]+/g, "");

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
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