import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

function toBoolOrUndefined(v: any): boolean | undefined {
  if (v === undefined) return undefined;
  return v === true || v === "true" || v === 1 || v === "1";
}

async function addCompulsorySubjectToExistingOLevelEnrollments(subjectId: string) {
  const activeOLevelEnrollments = await prisma.enrollment.findMany({
    where: {
      isActive: true,
      class: {
        level: "O_LEVEL",
        isActive: true,
      },
    },
    select: { id: true },
  });

  if (!activeOLevelEnrollments.length) return;

  await prisma.enrollmentSubject.createMany({
    data: activeOLevelEnrollments.map((enr) => ({
      enrollmentId: enr.id,
      subjectId,
    })),
    skipDuplicates: true,
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();

    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));

    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const code =
      typeof body?.code === "string"
        ? body.code.trim() || null
        : body?.code === null
        ? null
        : undefined;

    const requestedIsCompulsory = toBoolOrUndefined(body?.isCompulsory);

    const current = await prisma.subject.findUnique({
      where: { id },
      select: { id: true, level: true, isActive: true, isCompulsory: true },
    });

    if (!current || !current.isActive) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    if (!name) {
      return NextResponse.json({ error: "Subject name is required" }, { status: 400 });
    }

    const duplicate = await prisma.subject.findFirst({
      where: {
        id: { not: id },
        level: current.level,
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
        { error: "Another subject with this name already exists for that level" },
        { status: 409 }
      );
    }

    const nextIsCompulsory =
      current.level === "O_LEVEL"
        ? requestedIsCompulsory ?? current.isCompulsory
        : false;

    const updated = await prisma.subject.update({
      where: { id },
      data: {
        name,
        ...(code !== undefined ? { code } : {}),
        ...(current.level === "O_LEVEL" ? { isCompulsory: nextIsCompulsory } : {}),
      },
      select: {
        id: true,
        name: true,
        code: true,
        level: true,
        isCompulsory: true,
        papers: {
          where: { isActive: true },
          orderBy: [{ order: "asc" }, { name: "asc" }],
          select: {
            id: true,
            subjectId: true,
            name: true,
            code: true,
            order: true,
          },
        },
      },
    });

    if (updated.level === "O_LEVEL" && !current.isCompulsory && updated.isCompulsory) {
      await addCompulsorySubjectToExistingOLevelEnrollments(updated.id);
    }

    return NextResponse.json(updated);
  } catch (e: any) {
    const msg = e?.message || "Error";
    const code = msg === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();

    const { id } = await ctx.params;

    const subject = await prisma.subject.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });

    if (!subject || !subject.isActive) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.subjectPaper.updateMany({
        where: { subjectId: id, isActive: true },
        data: { isActive: false },
      }),
      prisma.subject.update({
        where: { id },
        data: { isActive: false },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = e?.message || "Error";
    const code = msg === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}