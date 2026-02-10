import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/auth";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    requireAdmin(user);

    const { id } = await ctx.params;
    const body = await req.json();

    // Expecting { isActive: boolean }
    const isActive = Boolean(body?.isActive);

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        fullName: true,
        initials: true,
        username: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (e: any) {
    const msg = e?.message || "Error";
    const code =
      msg === "UNAUTHENTICATED" ? 401 :
      msg === "FORBIDDEN" ? 403 :
      500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    requireAdmin(user);

    const { id } = await ctx.params;

    // Remove assignments first
    await prisma.teachingAssignment.deleteMany({ where: { userId: id } });
    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = e?.message || "Error";
    const code = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}
