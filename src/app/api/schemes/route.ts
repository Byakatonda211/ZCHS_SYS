import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

function ensureModel() {
  const p: any = prisma as any;
  if (!p.reportScheme || !p.reportSchemeComponent) {
    throw new Error(
      "Prisma Client missing ReportScheme models. Run: npx prisma migrate dev && npx prisma generate, then restart dev server."
    );
  }
}

export async function GET(req: Request) {
  try {
    await requireUser();
    ensureModel();

    const { searchParams } = new URL(req.url);
    const reportType = (searchParams.get("reportType") || "").trim();

    if (!reportType) {
      return NextResponse.json({ error: "Missing reportType" }, { status: 400 });
    }

    const scheme = await (prisma as any).reportScheme.findUnique({
      where: { reportType },
      select: {
        id: true,
        reportType: true,
        name: true,
        components: {
          orderBy: [{ order: "asc" }],
          select: {
            assessmentDefinitionId: true,
            weightOutOf: true,
            order: true,
            assessment: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!scheme) return NextResponse.json(null);

    return NextResponse.json({
      id: scheme.id,
      reportType: scheme.reportType,
      name: scheme.name,
      components: (scheme.components || []).map((c: any, idx: number) => ({
        assessmentId: c.assessmentDefinitionId,
        label:
          c?.assessment?.name?.trim() ||
          `CA${typeof c?.order === "number" ? c.order : idx + 1}`,
        weightOutOf: c.weightOutOf,
        order: c.order ?? idx + 1,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireUser();
    ensureModel();

    const body = await req.json();

    const reportType = String(body?.reportType || "").trim();
    const name = String(body?.name || "").trim();
    const components = Array.isArray(body?.components) ? body.components : [];

    if (!reportType || !name) {
      return NextResponse.json({ error: "Missing reportType or name" }, { status: 400 });
    }

    const cleaned = components
      .map((c: any, idx: number) => ({
        assessmentDefinitionId: String(
          c?.assessmentDefinitionId || c?.assessmentId || ""
        ).trim(),
        weightOutOf: Math.max(0, Number(c?.weightOutOf) || 0),
        order: idx + 1,
      }))
      .filter((c: any) => !!c.assessmentDefinitionId);

    const result = await (prisma as any).$transaction(async (tx: any) => {
      const up = await tx.reportScheme.upsert({
        where: { reportType },
        update: { name },
        create: { reportType, name },
        select: { id: true, reportType: true, name: true },
      });

      await tx.reportSchemeComponent.deleteMany({ where: { schemeId: up.id } });

      if (cleaned.length) {
        await tx.reportSchemeComponent.createMany({
          data: cleaned.map((c: any) => ({ ...c, schemeId: up.id })),
        });
      }

      const scheme = await tx.reportScheme.findUnique({
        where: { id: up.id },
        select: {
          id: true,
          reportType: true,
          name: true,
          components: {
            orderBy: [{ order: "asc" }],
            select: {
              assessmentDefinitionId: true,
              weightOutOf: true,
              order: true,
              assessment: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      return scheme;
    });

    return NextResponse.json({
      id: result.id,
      reportType: result.reportType,
      name: result.name,
      components: (result.components || []).map((c: any, idx: number) => ({
        assessmentId: c.assessmentDefinitionId,
        label:
          c?.assessment?.name?.trim() ||
          `CA${typeof c?.order === "number" ? c.order : idx + 1}`,
        weightOutOf: c.weightOutOf,
        order: c.order ?? idx + 1,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error" }, { status: 500 });
  }
}