import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    await requireUser();

    const { searchParams } = new URL(req.url);
    const classId = (searchParams.get("classId") || "").trim();
    if (!classId) return NextResponse.json({ error: "Missing classId" }, { status: 400 });

    const cls = await prisma.class.findUnique({
      where: { id: classId },
      select: { level: true },
    });
    if (!cls) return NextResponse.json([]);

    const rows = await prisma.subject.findMany({
      where: { isActive: true, level: String(cls.level) }, // "O_LEVEL" | "A_LEVEL"
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, code: true, level: true, isActive: true },
    });

    return NextResponse.json(rows);
  } catch (e: any) {
    const code = e?.message === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json({ error: e?.message || "Error" }, { status: code });
  }
}
