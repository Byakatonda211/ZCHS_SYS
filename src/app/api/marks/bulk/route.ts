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
        const raw = m?.scoreRaw;

        if (!studentId) continue;

        // Normalize scoreRaw to number|null (and validate 0..100 integers)
        // Score is required by schema (Int). If blank/invalid, skip this mark row.
        if (raw === null || raw === "" || raw === undefined) continue;

        const scoreRaw = Number(raw);
        if (!isInt0to100(scoreRaw)) continue;


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

        // Prisma's WhereUniqueInput for a named composite unique can still require non-null fields.
        // So: use upsert only when subjectPaperId is a string; otherwise do findFirst -> update/create.
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
              studentId, // ✅ add this
              componentId: component.id,
              subjectId,
              subjectPaperId,
              scoreRaw,
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
                studentId, // ✅ add this
                componentId: component.id,
                subjectId,
                subjectPaperId: null,
                scoreRaw,
              },
           });

          }
        }

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
