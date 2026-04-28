import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/auth";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();

    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json({ error: "Missing subject id" }, { status: 400 });
    }

    const papers = await prisma.subjectPaper.findMany({
      where: { subjectId: id, isActive: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: {
        id: true,
        subjectId: true,
        name: true,
        code: true,
        order: true,
      },
    });

    return NextResponse.json(papers);
  } catch (e: any) {
    const code = e?.message === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json({ error: e?.message || "Error" }, { status: code });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    requireAdmin(user);

    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json({ error: "Missing subject id" }, { status: 400 });
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
        { error: "Papers can only be added to A-Level subjects" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const items = Array.isArray(body?.papers) ? body.papers : [body];

    const currentMax = await prisma.subjectPaper.aggregate({
      where: { subjectId: id, isActive: true },
      _max: { order: true },
    });

    let nextOrder = (currentMax._max.order || 0) + 1;

    const created = [];

    for (const it of items) {
      const name = String(it?.name || "").trim();
      const code =
        typeof it?.code === "string"
          ? it.code.trim() || null
          : it?.code === null
          ? null
          : undefined;

      const orderRaw = it?.order;
      const order =
        orderRaw === undefined || orderRaw === null || Number.isNaN(Number(orderRaw))
          ? nextOrder
          : Math.max(1, Math.floor(Number(orderRaw)));

      if (!name) continue;

      const existing = await prisma.subjectPaper.findFirst({
        where: {
          subjectId: id,
          name: {
            equals: name,
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          isActive: true,
        },
      });

      if (existing?.isActive) {
        const updated = await prisma.subjectPaper.update({
          where: { id: existing.id },
          data: {
            order,
            isActive: true,
            ...(code !== undefined ? { code } : {}),
          },
          select: {
            id: true,
            subjectId: true,
            name: true,
            code: true,
            order: true,
          },
        });

        created.push(updated);
      } else if (existing && !existing.isActive) {
        const restored = await prisma.subjectPaper.update({
          where: { id: existing.id },
          data: {
            name,
            order,
            isActive: true,
            ...(code !== undefined ? { code } : {}),
          },
          select: {
            id: true,
            subjectId: true,
            name: true,
            code: true,
            order: true,
          },
        });

        created.push(restored);
      } else {
        const newPaper = await prisma.subjectPaper.create({
          data: {
            subjectId: id,
            name,
            code: code ?? null,
            order,
            isActive: true,
          },
          select: {
            id: true,
            subjectId: true,
            name: true,
            code: true,
            order: true,
          },
        });

        created.push(newPaper);
      }

      nextOrder++;
    }

    return NextResponse.json(created);
  } catch (e: any) {
    const msg = e?.message || "Error";
    const code = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}