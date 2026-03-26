import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

async function canViewMarks(
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

export async function GET(req: Request) {
  try {
    const user = await requireUser();

    const { searchParams } = new URL(req.url);

    const academicYearId = (searchParams.get("academicYearId") || "").trim();
    const termId = (searchParams.get("termId") || "").trim();
    const assessmentDefinitionId = (searchParams.get("assessmentDefinitionId") || "").trim();
    const classId = (searchParams.get("classId") || "").trim();
    const subjectId = (searchParams.get("subjectId") || "").trim();
    const subjectPaperIdRaw = searchParams.get("subjectPaperId");
    const subjectPaperId =
      subjectPaperIdRaw !== null &&
      subjectPaperIdRaw !== undefined &&
      String(subjectPaperIdRaw).trim()
        ? String(subjectPaperIdRaw).trim()
        : null;

    if (!academicYearId || !termId || !assessmentDefinitionId || !classId || !subjectId) {
      return NextResponse.json({ error: "Missing required query params" }, { status: 400 });
    }

    const allowed = await canViewMarks(user, classId, subjectId);
    if (!allowed) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    const component = await prisma.assessmentComponent.findFirst({
      where: { definitionId: assessmentDefinitionId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });

    if (!component) return NextResponse.json([]);

    const rows = await prisma.markEntry.findMany({
      where: {
        academicYearId,
        termId,
        componentId: component.id,
        subjectId,
        subjectPaperId,
        enrollment: {
          isActive: true,
          academicYearId,
          classId,
        },
      },
      select: {
        studentId: true,
        scoreRaw: true,
      },
    });

    return NextResponse.json(
      rows.map((r) => ({
        studentId: r.studentId,
        scoreRaw: round2(r.scoreRaw),
      }))
    );
  } catch (e: any) {
    const msg = e?.message || "Error";
    const code = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}