import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

async function resolveClass(classId: string, className: string) {
  if (classId) {
    const byId = await prisma.class.findUnique({
      where: { id: classId },
      select: { id: true, name: true, level: true },
    });
    if (byId) return byId;
  }

  if (className) {
    const byName = await prisma.class.findUnique({
      where: { name: className },
      select: { id: true, name: true, level: true },
    });
    if (byName) return byName;
  }

  return null;
}

export async function GET(req: Request) {
  try {
    const user = await requireUser();

    const { searchParams } = new URL(req.url);
    const classId = (searchParams.get("classId") || "").trim();
    const className = (searchParams.get("className") || "").trim();

    if (!classId && !className) {
      return NextResponse.json({ error: "Missing classId" }, { status: 400 });
    }

    const cls = await resolveClass(classId, className);
    if (!cls) return NextResponse.json([]);

    if (user.role === "ADMIN") {
      const rows = await prisma.subject.findMany({
        where: {
          isActive: true,
          level: cls.level,
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

    const assignments = await prisma.teachingAssignment.findMany({
      where: {
        userId: user.id,
        classId: cls.id,
      },
      select: {
        isClassTeacher: true,
        subjectId: true,
      },
    });

    if (assignments.length === 0) {
      return NextResponse.json([]);
    }

    if (assignments.some((a) => a.isClassTeacher)) {
      const rows = await prisma.subject.findMany({
        where: {
          isActive: true,
          level: cls.level,
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
        level: cls.level,
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