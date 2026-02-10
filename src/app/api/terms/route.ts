import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    await requireUser();

    const { searchParams } = new URL(req.url);
    let academicYearId = (searchParams.get("academicYearId") || "").trim();

    if (!academicYearId) {
      const current = await prisma.academicYear.findFirst({
        where: { isCurrent: true },
        select: { id: true },
      });
      academicYearId = current?.id || "";
    }

    const rows = await prisma.term.findMany({
      where: academicYearId ? { academicYearId } : {},
      orderBy: [{ createdAt: "asc" }],
      select: {
        id: true,
        academicYearId: true,
        type: true,
        name: true,
        startDate: true,
        endDate: true,
        isCurrent: true,
        createdAt: true,
      },
    });

    return NextResponse.json(rows);
  } catch (e: any) {
    const code = e?.message === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json({ error: e?.message || "Error" }, { status: code });
  }
}
