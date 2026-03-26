import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

async function canEnterMarks(
  user: { id: string; role: string },
  classId: string,
  subjectId: string
) {
  if (user.role === "ADMIN") return true;

  const assignments = await prisma.teachingAssignment.findMany({
    where: { userId: user.id, classId },
    select: { isClassTeacher: true, subjectId: true },
  });

  if (assignments.length === 0) return false;
  if (assignments.some((a) => a.isClassTeacher)) return true;

  return assignments.some((a) => a.subjectId === subjectId);
}

function round2(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

async function resolveEnterOutOf(classId: string, assessmentDefinitionId: string) {
  try {
    const cls = await prisma.class.findUnique({
      where: { id: classId },
      select: { level: true },
    });

    const def = await prisma.assessmentDefinition.findUnique({
      where: { id: assessmentDefinitionId },
      select: { type: true },
    });

    if (!cls || !def) return 100;

    const reportType =
      cls.level === "A_LEVEL"
        ? def.type === "ENDTERM"
          ? "A_EOT"
          : "A_MID"
        : def.type === "ENDTERM"
        ? "O_EOT"
        : "O_MID";

    const p: any = prisma as any;
    if (!p.reportSchemeComponent) return 100;

    const component = await p.reportSchemeComponent.findFirst({
      where: {
        scheme: { reportType },
        assessmentDefinitionId,
      },
      select: {
        enterOutOf: true,
      },
    });

    return round2(component?.enterOutOf) ?? 100;
  } catch {
    return 100;
  }
}

function isValidMark(n: any, max: number) {
  if (!Number.isFinite(n)) return false;
  if (n < 0) return false;
  if (n > max) return false;
  const rounded = Math.round(n * 100) / 100;
  return Math.abs(n - rounded) < 1e-9;
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();

    const academicYearId = String(body?.academicYearId || "").trim();
    const termId = String(body?.termId || "").trim();
    const assessmentDefinitionId = String(body?.assessmentDefinitionId || "").trim();
    const classId = String(body?.classId || "").trim();
    const subjectId = String(body?.subjectId || "").trim();

    const subjectPaperId =
      body?.subjectPaperId !== null &&
      body?.subjectPaperId !== undefined &&
      String(body?.subjectPaperId).trim()
        ? String(body.subjectPaperId).trim()
        : null;

    const marks = Array.isArray(body?.marks)
      ? body.marks
      : Array.isArray(body?.entries)
      ? body.entries
      : [];

    if (!academicYearId || !termId || !assessmentDefinitionId || !classId || !subjectId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const allowed = await canEnterMarks(user, classId, subjectId);
    if (!allowed) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    const component = await prisma.assessmentComponent.findFirst({
      where: { definitionId: assessmentDefinitionId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });

    if (!component) {
      return NextResponse.json({ error: "Assessment component not found" }, { status: 400 });
    }

    const enterOutOf = await resolveEnterOutOf(classId, assessmentDefinitionId);

    const rows = await prisma.$transaction(async (tx) => {
      const out: any[] = [];

      for (const m of marks) {
        const studentId = String(m?.studentId || "").trim();
        const raw = m?.scoreRaw;

        if (!studentId) continue;
        if (raw === null || raw === "" || raw === undefined) continue;

        const scoreRaw = round2(raw);
        if (scoreRaw === null || !isValidMark(scoreRaw, enterOutOf)) continue;

        const enrollment = await tx.enrollment.findFirst({
          where: {
            studentId,
            academicYearId,
            classId,
            isActive: true,
          },
          select: { id: true },
        });

        if (!enrollment) continue;

        let row: any;

        if (subjectPaperId) {
          row = await tx.markEntry.upsert({
            where: {
              term_enroll_subject_paper_component: {
                termId,
                enrollmentId: enrollment.id,
                subjectId,
                subjectPaperId,
                componentId: component.id,
              },
            },
            update: {
              academicYearId,
              termId,
              scoreRaw,
            },
            create: {
              academicYearId,
              termId,
              enrollmentId: enrollment.id,
              studentId,
              componentId: component.id,
              subjectId,
              subjectPaperId,
              scoreRaw,
              createdByUserId: user.id,
            },
          });
        } else {
          const existing = await tx.markEntry.findFirst({
            where: {
              termId,
              enrollmentId: enrollment.id,
              subjectId,
              componentId: component.id,
              subjectPaperId: null,
            },
            select: { id: true },
          });

          if (existing) {
            row = await tx.markEntry.update({
              where: { id: existing.id },
              data: {
                academicYearId,
                termId,
                scoreRaw,
              },
            });
          } else {
            row = await tx.markEntry.create({
              data: {
                academicYearId,
                termId,
                enrollmentId: enrollment.id,
                studentId,
                componentId: component.id,
                subjectId,
                subjectPaperId: null,
                scoreRaw,
                createdByUserId: user.id,
              },
            });
          }
        }

        out.push(row);
      }

      return out;
    });

    return NextResponse.json({
      ok: true,
      rows: rows.map((r: any) => ({
        ...r,
        scoreRaw: round2(r.scoreRaw),
      })),
      enterOutOf,
    });
  } catch (e: any) {
    const msg = e?.message || "Error";
    const code = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}