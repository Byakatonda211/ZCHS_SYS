import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

function toBool(v: any): boolean {
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

export async function GET(req: Request) {
  try {
    await requireUser();

    const { searchParams } = new URL(req.url);
    const level = (searchParams.get("level") || "").trim();

    if (!level) {
      return NextResponse.json({ error: "Missing level" }, { status: 400 });
    }

    const rows = await prisma.subject.findMany({
      where: {
        level,
        isActive: true,
      },
      orderBy: [{ name: "asc" }],
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
            order: true,
          },
        },
      },
    });

    return NextResponse.json(rows);
  } catch (e: any) {
    const code = e?.message === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json({ error: e?.message || "Error" }, { status: code });
  }
}

export async function POST(req: Request) {
  try {
    await requireUser();

    const body = await req.json().catch(() => ({}));
    const name = String(body?.name || "").trim();
    const code = typeof body?.code === "string" ? body.code.trim() : "";
    const level = String(body?.level || "").trim();
    const isCompulsory = level === "O_LEVEL" ? toBool(body?.isCompulsory) : false;

    if (!name) {
      return NextResponse.json({ error: "Subject name is required" }, { status: 400 });
    }

    if (!level || !["O_LEVEL", "A_LEVEL"].includes(level)) {
      return NextResponse.json({ error: "Valid subject level is required" }, { status: 400 });
    }

    const existing = await prisma.subject.findFirst({
      where: {
        level,
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
      select: { id: true, isActive: true },
    });

    if (existing?.isActive) {
      return NextResponse.json(
        { error: "A subject with this name already exists for that level" },
        { status: 409 }
      );
    }

    if (existing && !existing.isActive) {
      const restored = await prisma.subject.update({
        where: { id: existing.id },
        data: {
          name,
          code: code || null,
          isActive: true,
          isCompulsory,
        },
        select: {
          id: true,
          name: true,
          code: true,
          level: true,
          isCompulsory: true,
        },
      });

      if (restored.level === "O_LEVEL" && restored.isCompulsory) {
        await addCompulsorySubjectToExistingOLevelEnrollments(restored.id);
      }

      return NextResponse.json(restored);
    }

    const created = await prisma.subject.create({
      data: {
        name,
        code: code || null,
        level,
        isCompulsory,
      },
      select: {
        id: true,
        name: true,
        code: true,
        level: true,
        isCompulsory: true,
      },
    });

    if (created.level === "O_LEVEL" && created.isCompulsory) {
      await addCompulsorySubjectToExistingOLevelEnrollments(created.id);
    }

    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    const msg = e?.message || "Error";
    const code = msg === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}