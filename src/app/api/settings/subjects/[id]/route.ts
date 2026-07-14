import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

function toBoolOrUndefined(v: any): boolean | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  return v === true || v === "true" || v === 1 || v === "1";
}

type Ctx = { params: Promise<{ id: string }> | { id: string } };

async function getId(ctx: Ctx) {
  const params = await Promise.resolve(ctx.params);
  return String(params?.id || "").trim();
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

const subjectSelect = {
  id: true,
  name: true,
  code: true,
  level: true,
  isActive: true,
  isCompulsory: true,
  papers: {
    where: { isActive: true },
    orderBy: [{ order: "asc" as const }, { name: "asc" as const }],
    select: {
      id: true,
      subjectId: true,
      name: true,
      code: true,
      order: true,
    },
  },
} as const;

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requireUser();

    const id = await getId(ctx);
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const name = typeof body?.name === "string" ? body.name.trim() : undefined;
    const code =
      typeof body?.code === "string"
        ? body.code.trim() || null
        : body?.code === null
        ? null
        : undefined;
    const requestedIsCompulsory = toBoolOrUndefined(body?.isCompulsory);

    const current = await prisma.subject.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        level: true,
        isActive: true,
        isCompulsory: true,
      },
    });

    if (!current) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    if (name && name.toLowerCase() !== current.name.toLowerCase()) {
      const duplicate = await prisma.subject.findFirst({
        where: {
          level: current.level,
          name: { equals: name, mode: "insensitive" },
          NOT: { id },
        },
        select: { id: true },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: "A subject with this name already exists for that level" },
          { status: 409 }
        );
      }
    }

    const data: {
      name?: string;
      code?: string | null;
      isCompulsory?: boolean;
      isActive?: boolean;
    } = {};

    if (name !== undefined) data.name = name;
    if (code !== undefined) data.code = code;

    if (requestedIsCompulsory !== undefined) {
      // The current UI uses compulsory subjects for O-Level student registration.
      // Keep A-Level subjects optional even if the checkbox value is accidentally sent.
      data.isCompulsory = current.level === "O_LEVEL" ? requestedIsCompulsory : false;
    }

    if (body?.isActive !== undefined) {
      data.isActive = Boolean(body.isActive);
    }

    const updated = await prisma.subject.update({
      where: { id },
      data,
      select: subjectSelect,
    });

    if (
      updated.level === "O_LEVEL" &&
      updated.isCompulsory &&
      current.isCompulsory !== updated.isCompulsory
    ) {
      await addCompulsorySubjectToExistingOLevelEnrollments(updated.id);
    }

    return NextResponse.json(updated);
  } catch (e: any) {
    const msg = e?.message || "Error";
    const code = msg === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    await requireUser();

    const id = await getId(ctx);
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const existing = await prisma.subject.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    const updated = await prisma.subject.update({
      where: { id },
      data: {
        isActive: false,
        isCompulsory: false,
      },
      select: { id: true, name: true, code: true, level: true, isActive: true, isCompulsory: true },
    });

    return NextResponse.json({ ok: true, subject: updated });
  } catch (e: any) {
    const msg = e?.message || "Error";
    const code = msg === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}
