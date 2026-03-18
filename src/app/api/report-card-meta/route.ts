import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    await requireUser();

    const { searchParams } = new URL(req.url);
    const classId = (searchParams.get("classId") || "").trim();
    const streamIdRaw = (searchParams.get("streamId") || "").trim();
    const streamId = streamIdRaw || null;

    if (!classId) {
      return NextResponse.json({ error: "Missing classId" }, { status: 400 });
    }

    const assignments = await prisma.teachingAssignment.findMany({
      where: {
        classId,
        ...(streamId ? { streamId } : {}),
      },
      select: {
        subjectId: true,
        isClassTeacher: true,
        user: {
          select: {
            id: true,
            fullName: true,
            initials: true,
          },
        },
      },
    });

    const subjectTeachers = assignments
      .filter((a) => !a.isClassTeacher && a.subjectId)
      .reduce((acc: Record<string, string>, a) => {
        if (!acc[a.subjectId!]) {
          acc[a.subjectId!] = a.user?.initials || "—";
        }
        return acc;
      }, {});

    const classTeacher = assignments.find((a) => a.isClassTeacher);

    return NextResponse.json({
      classTeacher: classTeacher
        ? {
            fullName: classTeacher.user?.fullName || "—",
            initials: classTeacher.user?.initials || "—",
          }
        : null,
      subjectTeachers,
    });
  } catch (e: any) {
    const msg = e?.message || "Error";
    const code = msg === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}