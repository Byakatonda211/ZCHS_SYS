import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();

    const { id } = await ctx.params;

    const papers = await prisma.subjectPaper.findMany({
      where: { subjectId: id, isActive: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: { id: true, subjectId: true, name: true, code: true, order: true },
    });

    return NextResponse.json(papers);
  } catch (e: any) {
    const code = e?.message === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json({ error: e?.message || "Error" }, { status: code });
  }
}
