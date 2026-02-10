import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();

    // ✅ ADMIN sees all active classes
    if (user.role === "ADMIN") {
      const rows = await prisma.class.findMany({
        where: { isActive: true },
        orderBy: [{ order: "asc" }, { name: "asc" }],
        select: { id: true, name: true, level: true, order: true, isActive: true },
      });

      return NextResponse.json(rows);
    }

    // ✅ Teachers: only classes they are assigned to (class teacher OR subject teacher)
    const assigned = await prisma.teachingAssignment.findMany({
      where: { userId: user.id },
      select: { classId: true },
    });

    const classIds = Array.from(new Set(assigned.map((a) => a.classId).filter(Boolean)));

    if (classIds.length === 0) return NextResponse.json([]);

    const rows = await prisma.class.findMany({
      where: { isActive: true, id: { in: classIds } },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: { id: true, name: true, level: true, order: true, isActive: true },
    });

    return NextResponse.json(rows);
  } catch (e: any) {
    const code = e?.message === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json({ error: e?.message || "Error" }, { status: code });
  }
}
