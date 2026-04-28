import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/auth";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; paperId: string }> }
) {
  try {
    const user = await requireUser();
    requireAdmin(user);

    const { id, paperId } = await ctx.params;

    if (!id || !paperId) {
      return NextResponse.json({ error: "Missing subject or paper id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));

    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const code =
      typeof body?.code === "string"
        ? body.code.trim() || null
        : body?.code === null
        ? null
        : undefined;

    const orderRaw = body?.order;
    const order =
      orderRaw === undefined || orderRaw === null || Number.isNaN(Number(orderRaw))
        ? undefined
        : Math.max(1, Math.floor(Number(orderRaw)));

    if (!name) {
      return NextResponse.json({ error: "Paper name is required" }, { status: 400 });
    }

    const subject = await prisma.subject.findUnique({
      where: { id },
      select: {
        id: true,
        level: true,
        isActive: true,
      },
    });

    if (!subject || !subject.isActive) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    if (subject.level !== "A_LEVEL") {
      return NextResponse.json(
        { error: "Papers can only be edited under A-Level subjects" },
        { status: 400 }
      );
    }

    const current = await prisma.subjectPaper.findFirst({
      where: {
        id: paperId,
        subjectId: id,
        isActive: true,
      },
      select: {
        id: true,
        subjectId: true,
      },
    });

    if (!current) {
      return NextResponse.json({ error: "Paper not found" }, { status: 404 });
    }

    const duplicate = await prisma.subjectPaper.findFirst({
      where: {
        id: { not: paperId },
        subjectId: id,
        isActive: true,
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    if (duplicate) {
      return NextResponse.json(
        { error: "Another active paper with this name already exists under this subject" },
        { status: 409 }
      );
    }

    const updated = await prisma.subjectPaper.update({
      where: { id: paperId },
      data: {
        name,
        ...(code !== undefined ? { code } : {}),
        ...(order !== undefined ? { order } : {}),
      },
      select: {
        id: true,
        subjectId: true,
        name: true,
        code: true,
        order: true,
      },
    });

    return NextResponse.json(updated);
  } catch (e: any) {
    const msg = e?.message || "Error";
    const code = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}

export async function DELETE(
  _: Request,
  ctx: { params: Promise<{ id: string; paperId: string }> }
) {
  try {
    const user = await requireUser();
    requireAdmin(user);

    const { id, paperId } = await ctx.params;

    if (!id || !paperId) {
      return NextResponse.json({ error: "Missing subject or paper id" }, { status: 400 });
    }

    const subject = await prisma.subject.findUnique({
      where: { id },
      select: {
        id: true,
        level: true,
        isActive: true,
      },
    });

    if (!subject || !subject.isActive) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    if (subject.level !== "A_LEVEL") {
      return NextResponse.json(
        { error: "Papers can only be deleted under A-Level subjects" },
        { status: 400 }
      );
    }

    const paper = await prisma.subjectPaper.findFirst({
      where: {
        id: paperId,
        subjectId: id,
        isActive: true,
      },
      select: { id: true },
    });

    if (!paper) {
      return NextResponse.json({ error: "Paper not found" }, { status: 404 });
    }

    await prisma.subjectPaper.update({
      where: { id: paperId },
      data: { isActive: false },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = e?.message || "Error";
    const code = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}