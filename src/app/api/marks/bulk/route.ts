import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

function isInt0to100(n: any) {
  return Number.isInteger(n) && n >= 0 && n <= 100;
}

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

  // ✅ If the teacher is assigned as Class Teacher for this class,
  // they can enter/edit marks for ANY subject in that class.
  if (assignments.some((a) => a.isClassTeacher)) return true;

  // ✅ Otherwise, they can only enter/edit marks for subjects assigned to them in this class.
  return assignments.some((a) => a.subjectId === subjectId);
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

    const marks = Array.isArray(body?.marks) ? body.marks : [];

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

    const rows = await prisma.$transaction(async (tx) => {
      const out: any[] = [];

      for (const m of marks) {
        const studentId = String(m?.studentId || "").trim();
        const scoreRaw = m?.scoreRaw;

        if (!studentId) continue;
        if (scoreRaw !== null && scoreRaw !== "" && scoreRaw !== undefined) {
          const n = Number(scoreRaw);
          if (!isInt0to100(n)) continue;
        }

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

        const row = await tx.markEntry.upsert({
          where: {
            enrollmentId_componentId_subjectId_subjectPaperId: {
              enrollmentId: enrollment.id,
              componentId: component.id,
              subjectId,
              subjectPaperId,
            },
          },
          update: {
            academicYearId,
            termId,
            scoreRaw: scoreRaw === "" ? null : scoreRaw,
          },
          create: {
            academicYearId,
            termId,
            enrollmentId: enrollment.id,
            componentId: component.id,
            subjectId,
            subjectPaperId,
            scoreRaw: scoreRaw === "" ? null : scoreRaw,
          },
        });

        out.push(row);
      }

      return out;
    });

    return NextResponse.json({ ok: true, rows });
  } catch (e: any) {
    const msg = e?.message || "Error";
    const code = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}
