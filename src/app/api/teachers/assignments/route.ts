import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/auth";

function asId(v: any): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

export async function GET() {
  try {
    const user = await requireUser();
    requireAdmin(user);

    const rows = await prisma.teachingAssignment.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, fullName: true, initials: true } },
        class: { select: { id: true, name: true, level: true } },
        stream: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(rows);
  } catch (e: any) {
    const msg = e?.message || "Error";
    const code = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    requireAdmin(user);

    const body = await req.json();

    // Accept both "userId" and "teacherId" (UI uses teacherId)
    const userId = asId(body?.userId) || asId(body?.teacherId);
    const classId = asId(body?.classId);
    const streamId = asId(body?.streamId);
    const subjectIdRaw = asId(body?.subjectId);
    const isClassTeacher = Boolean(body?.isClassTeacher);

    if (!userId || !classId) {
      return NextResponse.json({ error: "Missing userId/classId" }, { status: 400 });
    }

    if (!isClassTeacher && !subjectIdRaw) {
      return NextResponse.json(
        { error: "Subject required unless Class Teacher" },
        { status: 400 }
      );
    }

    const created = await prisma.teachingAssignment.create({
      data: {
        userId,
        classId,
        streamId,
        subjectId: isClassTeacher ? null : subjectIdRaw,
        isClassTeacher,
      },
    });

    return NextResponse.json(created);
  } catch (e: any) {
    const msg = e?.message || "Error";
    const code = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}
