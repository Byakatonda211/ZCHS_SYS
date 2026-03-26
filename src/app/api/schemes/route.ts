import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

function modelFlags() {
  const p: any = prisma as any;
  return {
    hasReportScheme: !!p.reportScheme,
    hasReportSchemeComponent: !!p.reportSchemeComponent,
    hasGradeDescriptor: !!p.reportSchemeGradeDescriptor,
  };
}

function toNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function round2(v: any, fallback = 0) {
  const n = toNum(v, fallback);
  return Math.round(n * 100) / 100;
}

function defaultDescriptorsFor(reportType: string) {
  const isALevel = String(reportType || "").startsWith("A_");

  if (isALevel) {
    return [
      { grade: "A", achievementLevel: "Excellent", minMark: 80.0, maxMark: 100.0, descriptor: "Excellent performance with a very strong demonstration of knowledge and skill.", order: 1 },
      { grade: "B", achievementLevel: "Very Good", minMark: 75.0, maxMark: 79.99, descriptor: "Very good performance with clear understanding and sound application.", order: 2 },
      { grade: "C", achievementLevel: "Good", minMark: 70.0, maxMark: 74.99, descriptor: "Good performance showing adequate understanding and application.", order: 3 },
      { grade: "D", achievementLevel: "Credit", minMark: 65.0, maxMark: 69.99, descriptor: "Creditable performance with acceptable competence.", order: 4 },
      { grade: "E", achievementLevel: "Fair", minMark: 60.0, maxMark: 64.99, descriptor: "Fair performance with moderate competence.", order: 5 },
      { grade: "O", achievementLevel: "Pass", minMark: 50.0, maxMark: 59.99, descriptor: "Pass level performance with minimum acceptable competence.", order: 6 },
      { grade: "F", achievementLevel: "Fail", minMark: 0.0, maxMark: 49.99, descriptor: "Below the expected minimum standard.", order: 7 },
    ];
  }

  return [
    {
      grade: "A",
      achievementLevel: "Exceptional",
      minMark: 85.0,
      maxMark: 100.0,
      descriptor:
        "Demonstrates an extraordinary level of competency by applying innovatively and creatively the acquired knowledge and skills in real-life situations.",
      order: 1,
    },
    {
      grade: "B",
      achievementLevel: "Outstanding",
      minMark: 70.0,
      maxMark: 84.99,
      descriptor:
        "Demonstrates a high level of competency by applying the acquired knowledge and skills in real-life situations.",
      order: 2,
    },
    {
      grade: "C",
      achievementLevel: "Satisfactory",
      minMark: 50.0,
      maxMark: 69.99,
      descriptor:
        "Demonstrates an adequate level of competency by applying the acquired knowledge and skills in real-life situations.",
      order: 3,
    },
    {
      grade: "D",
      achievementLevel: "Basic",
      minMark: 25.0,
      maxMark: 49.99,
      descriptor:
        "Demonstrates a minimum level of competency in applying the acquired knowledge and skills in real-life situations.",
      order: 4,
    },
    {
      grade: "E",
      achievementLevel: "Elementary",
      minMark: 0.0,
      maxMark: 24.99,
      descriptor:
        "Demonstrates below the basic level of competency in applying the acquired knowledge and skills in real-life situations.",
      order: 5,
    },
  ];
}

function normalizeDescriptorRow(d: any, idx: number) {
  return {
    grade: String(d?.grade || "").trim().toUpperCase(),
    achievementLevel: String(d?.achievementLevel || "").trim(),
    minMark: round2(d?.minMark, 0),
    maxMark: round2(d?.maxMark, 0),
    descriptor: String(d?.descriptor || "").trim(),
    order: Number(d?.order ?? idx + 1) || idx + 1,
  };
}

export async function GET(req: Request) {
  try {
    await requireUser();

    const { hasReportScheme, hasGradeDescriptor } = modelFlags();
    if (!hasReportScheme) {
      return NextResponse.json(
        { error: "Prisma client is outdated. Run prisma generate." },
        { status: 500 }
      );
    }

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
            enterOutOf: true,
            weightOutOf: true,
            order: true,
            assessment: {
              select: {
                id: true,
                name: true,
                level: true,
                type: true,
              },
            },
          },
        },
        ...(hasGradeDescriptor
          ? {
              gradeDescriptors: {
                orderBy: [{ order: "asc" }],
                select: {
                  id: true,
                  grade: true,
                  achievementLevel: true,
                  minMark: true,
                  maxMark: true,
                  descriptor: true,
                  order: true,
                },
              },
            }
          : {}),
      },
    });

    if (!scheme) return NextResponse.json(null);

    return NextResponse.json({
      id: scheme.id,
      reportType: scheme.reportType,
      name: scheme.name,
      components: (scheme.components || []).map((c: any, idx: number) => ({
        assessmentId: c.assessmentDefinitionId,
        label: c?.assessment?.name?.trim() || `CA${typeof c?.order === "number" ? c.order : idx + 1}`,
        enterOutOf: round2(c.enterOutOf, 100),
        weightOutOf: round2(c.weightOutOf, 0),
        order: c.order ?? idx + 1,
      })),
      gradeDescriptors:
        hasGradeDescriptor &&
        Array.isArray((scheme as any).gradeDescriptors) &&
        (scheme as any).gradeDescriptors.length > 0
          ? (scheme as any).gradeDescriptors.map((d: any) => ({
              ...d,
              minMark: round2(d.minMark, 0),
              maxMark: round2(d.maxMark, 0),
            }))
          : defaultDescriptorsFor(reportType),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireUser();

    const { hasReportScheme, hasReportSchemeComponent, hasGradeDescriptor } = modelFlags();
    if (!hasReportScheme || !hasReportSchemeComponent || !hasGradeDescriptor) {
      return NextResponse.json(
        {
          error:
            "Database/client not updated yet. Run prisma migrate and prisma generate, then restart the dev server.",
        },
        { status: 500 }
      );
    }

    const body = await req.json();

    const reportType = String(body?.reportType || "").trim();
    const name = String(body?.name || "").trim();
    const components = Array.isArray(body?.components) ? body.components : [];
    const gradeDescriptors = Array.isArray(body?.gradeDescriptors) ? body.gradeDescriptors : [];

    if (!reportType || !name) {
      return NextResponse.json({ error: "Missing reportType or name" }, { status: 400 });
    }

    const cleanedComponents = components
      .map((c: any, idx: number) => ({
        assessmentDefinitionId: String(c?.assessmentDefinitionId || c?.assessmentId || "").trim(),
        enterOutOf: Math.max(0.01, round2(c?.enterOutOf, 100)),
        weightOutOf: Math.max(0, round2(c?.weightOutOf, 0)),
        order: idx + 1,
      }))
      .filter((c: any) => !!c.assessmentDefinitionId);

    const cleanedDescriptors = (gradeDescriptors.length > 0
      ? gradeDescriptors
      : defaultDescriptorsFor(reportType))
      .map((d: any, idx: number) => normalizeDescriptorRow(d, idx))
      .filter((d: any) => d.grade && d.achievementLevel && d.descriptor);

    const result = await (prisma as any).$transaction(async (tx: any) => {
      const up = await tx.reportScheme.upsert({
        where: { reportType },
        update: { name },
        create: { reportType, name },
        select: { id: true, reportType: true, name: true },
      });

      await tx.reportSchemeComponent.deleteMany({ where: { schemeId: up.id } });
      await tx.reportSchemeGradeDescriptor.deleteMany({ where: { schemeId: up.id } });

      if (cleanedComponents.length) {
        await tx.reportSchemeComponent.createMany({
          data: cleanedComponents.map((c: any) => ({ ...c, schemeId: up.id })),
        });
      }

      if (cleanedDescriptors.length) {
        await tx.reportSchemeGradeDescriptor.createMany({
          data: cleanedDescriptors.map((d: any) => ({ ...d, schemeId: up.id })),
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
              enterOutOf: true,
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
          gradeDescriptors: {
            orderBy: [{ order: "asc" }],
            select: {
              id: true,
              grade: true,
              achievementLevel: true,
              minMark: true,
              maxMark: true,
              descriptor: true,
              order: true,
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
        label: c?.assessment?.name?.trim() || `CA${typeof c?.order === "number" ? c.order : idx + 1}`,
        enterOutOf: round2(c.enterOutOf, 100),
        weightOutOf: round2(c.weightOutOf, 0),
        order: c.order ?? idx + 1,
      })),
      gradeDescriptors: (result.gradeDescriptors || []).map((d: any) => ({
        ...d,
        minMark: round2(d.minMark, 0),
        maxMark: round2(d.maxMark, 0),
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error" }, { status: 500 });
  }
}