import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

function combineName(code: string, name: string) {
  const c = (code || "").trim().toUpperCase();
  const n = (name || "").trim();
  return n ? `${c} — ${n}` : c;
}

function splitName(combined: string) {
  const s = (combined || "").trim();
  const parts = s.split("—").map((p) => p.trim());
  if (parts.length >= 2) {
    const code = (parts[0] || "").trim().toUpperCase();
    const name = parts.slice(1).join(" — ").trim();
    return { code: code || s.toUpperCase(), name: name || code || s };
  }
  // if no separator, treat whole as code
  return { code: s.toUpperCase(), name: s };
}

function inferTypeFromCode(code: string) {
  const c = (code || "").toUpperCase();
  if (c.includes("EOT") || c.includes("END") || c.includes("FINAL")) return "ENDTERM";
  return "MIDTERM";
}

async function ensureDefaultComponent(definitionId: string) {
  const existing = await prisma.assessmentComponent.findFirst({
    where: { definitionId },
    select: { id: true },
  });
  if (existing) return;

  await prisma.assessmentComponent.create({
    data: {
      definitionId,
      key: "TOTAL",
      label: "Total",
      weight: 100,
      order: 1,
      isRequired: false,
    },
  });
}

export async function GET(req: Request) {
  try {
    await requireUser();

    const { searchParams } = new URL(req.url);
    const activeOnly = (searchParams.get("activeOnly") || "").trim() === "1";

    const rows = await prisma.assessmentDefinition.findMany({
      where: activeOnly ? { isActive: true } : {},
      orderBy: [{ createdAt: "asc" }],
      select: {
        id: true,
        level: true,
        type: true,
        name: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Return shape expected by your UI/store AssessmentDef
    const out = rows
      .map((r) => {
        const parsed = splitName(r.name);
        return {
          id: r.id,
          code: parsed.code,
          name: parsed.name,
          isActive: r.isActive,
        };
      })
      .sort((a, b) => (a.code > b.code ? 1 : -1));

    return NextResponse.json(out);
  } catch (e: any) {
    const code = e?.message === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json({ error: e?.message || "Error" }, { status: code });
  }
}

export async function POST(req: Request) {
  try {
    await requireUser();
    const body = await req.json();

    // special action: reset defaults
    if (String(body?.action || "") === "resetDefaults") {
      const defaults = [
        { code: "CA1", name: "Continuous Assessment 1" },
        { code: "CA2", name: "Continuous Assessment 2" },
        { code: "MID", name: "Midterm" },
        { code: "EOT", name: "End of Term" },
      ];

      for (const d of defaults) {
        const full = combineName(d.code, d.name);
        const type = inferTypeFromCode(d.code);

        // keep it simple: store as O_LEVEL (works for both in your current UI)
        const def = await prisma.assessmentDefinition.upsert({
          where: {
            level_type_name: {
              level: "O_LEVEL" as any,
              type: type as any,
              name: full,
            },
          },
          update: { isActive: true },
          create: {
            level: "O_LEVEL" as any,
            type: type as any,
            name: full,
            isActive: true,
          },
          select: { id: true },
        });

        await ensureDefaultComponent(def.id);
      }

      return NextResponse.json({ ok: true });
    }

    // normal create
    const codeStr = String(body?.code || "").trim().toUpperCase();
    const nameStr = String(body?.name || "").trim();
    if (!codeStr || !nameStr) {
      return NextResponse.json({ error: "Missing name or code" }, { status: 400 });
    }

    const full = combineName(codeStr, nameStr);
    const type = inferTypeFromCode(codeStr);

    const created = await prisma.assessmentDefinition.create({
      data: {
        level: "O_LEVEL" as any,
        type: type as any,
        name: full,
        isActive: true,
      },
      select: { id: true },
    });

    await ensureDefaultComponent(created.id);

    return NextResponse.json({ ok: true, id: created.id });
  } catch (e: any) {
    const code = e?.message === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json({ error: e?.message || "Error" }, { status: code });
  }
}

export async function PUT(req: Request) {
  try {
    await requireUser();
    const body = await req.json();

    const id = String(body?.id || "").trim();
    const codeStr = String(body?.code || "").trim().toUpperCase();
    const nameStr = String(body?.name || "").trim();
    if (!id || !codeStr || !nameStr) {
      return NextResponse.json({ error: "Missing id/name/code" }, { status: 400 });
    }

    const full = combineName(codeStr, nameStr);
    const type = inferTypeFromCode(codeStr);

    const updated = await prisma.assessmentDefinition.update({
      where: { id },
      data: { name: full, type: type as any },
      select: { id: true },
    });

    await ensureDefaultComponent(updated.id);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const code = e?.message === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json({ error: e?.message || "Error" }, { status: code });
  }
}

export async function PATCH(req: Request) {
  try {
    await requireUser();
    const body = await req.json();

    const id = String(body?.id || "").trim();
    const isActive = Boolean(body?.isActive);

    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    await prisma.assessmentDefinition.update({
      where: { id },
      data: { isActive },
      select: { id: true },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const code = e?.message === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json({ error: e?.message || "Error" }, { status: code });
  }
}

export async function DELETE(req: Request) {
  try {
    await requireUser();
    const { searchParams } = new URL(req.url);
    const id = (searchParams.get("id") || "").trim();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    await prisma.assessmentDefinition.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const code = e?.message === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json({ error: e?.message || "Error" }, { status: code });
  }
}
