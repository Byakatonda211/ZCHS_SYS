import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    await requireUser();

    const rows = await prisma.academicYear.findMany({
      orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
      select: { id: true, name: true, isCurrent: true, createdAt: true },
    });

    return NextResponse.json(rows);
  } catch (e: any) {
    const code = e?.message === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json({ error: e?.message || "Error" }, { status: code });
  }
}
