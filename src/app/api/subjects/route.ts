import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await requireUser();

    const { searchParams } = new URL(req.url);
    const classId = (searchParams.get("classId") || "").trim();
    if (!classId) {
      return NextResponse.json({ error: "Missing classId" }, { status: 400 });
    }

    const cls = await prisma.class.findUnique({
      where: { id: classId },
      select: { level: true },
    });

    if (!cls) return NextResponse.json([]);

    // Admin can see all subjects for the class level
    if (user.role === "ADMIN") {
      const rows = await prisma.subject.findMany({
        where: {
          isActive: true,
          level: String(cls.level),
        },
        orderBy: [{ name: "asc" }],
        select: {
          id: true,
          name: true,
          code: true,
          level: true,
          isActive: true,
          isCompulsory: true,
        },
      });

      return NextResponse.json(rows);
    }

    // Use the SAME permission source as marks routes
    const assignments = await prisma.teachingAssignment.findMany({
      where: {
        userId: user.id,
        classId,
      },
      select: {
        isClassTeacher: true,
        subjectId: true,
      },
    });

    if (assignments.length === 0) {
      return NextResponse.json([]);
    }

    // Class teacher for this class can see all subjects
    if (assignments.some((a) => a.isClassTeacher)) {
      const rows = await prisma.subject.findMany({
        where: {
          isActive: true,
          level: String(cls.level),
        },
        orderBy: [{ name: "asc" }],
        select: {
          id: true,
          name: true,
          code: true,
          level: true,
          isActive: true,
          isCompulsory: true,
        },
      });

      return NextResponse.json(rows);
    }

    // Subject teacher can only see assigned subjects
    const subjectIds = assignments
      .map((a) => a.subjectId)
      .filter((id): id is string => Boolean(id));

    if (subjectIds.length === 0) {
      return NextResponse.json([]);
    }

    const rows = await prisma.subject.findMany({
      where: {
        id: { in: subjectIds },
        isActive: true,
        level: String(cls.level),
      },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        code: true,
        level: true,
        isActive: true,
        isCompulsory: true,
      },
    });

    return NextResponse.json(rows);
  } catch (e: any) {
    const code = e?.message === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json({ error: e?.message || "Error" }, { status: code });
  }
}