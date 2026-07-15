import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

type ReportType = "O_MID" | "O_EOT" | "A_MID" | "A_EOT";
type RemarkTarget = "teacher" | "headTeacher";
type RemarkMatchType = "grade" | "range";

type IncomingRule = {
  id?: string;
  target?: RemarkTarget;
  reportType?: ReportType;
  matchType?: RemarkMatchType;
  grade?: string;
  min?: number;
  max?: number;
  text?: string;
  isActive?: boolean;
};

const REPORT_TYPES: ReportType[] = ["O_MID", "O_EOT", "A_MID", "A_EOT"];
const TARGETS: RemarkTarget[] = ["teacher", "headTeacher"];

function isReportType(value: unknown): value is ReportType {
  return REPORT_TYPES.includes(String(value) as ReportType);
}

function isTarget(value: unknown): value is RemarkTarget {
  return TARGETS.includes(String(value) as RemarkTarget);
}

function reportTypeToLevel(reportType: ReportType) {
  return reportType.startsWith("A_") ? "A_LEVEL" : "O_LEVEL";
}

function targetToDbType(target: RemarkTarget) {
  return target === "headTeacher" ? "HEADTEACHER" : "TEACHER";
}

function dbTypeToTarget(type: string): RemarkTarget {
  return String(type).toUpperCase() === "HEADTEACHER" ? "headTeacher" : "teacher";
}

function levelToReportType(level: string): ReportType {
  return String(level).toUpperCase() === "A_LEVEL" ? "A_EOT" : "O_EOT";
}

function cleanGrade(value: unknown) {
  const grade = String(value ?? "").trim().toUpperCase();
  return grade || null;
}

function intOrDefault(value: unknown, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(n);
}

function toClientRule(row: any, requestedReportType?: ReportType) {
  const grade = cleanGrade(row.grade);
  const reportType = requestedReportType || levelToReportType(String(row.level));

  return {
    id: row.id,
    target: dbTypeToTarget(row.type),
    reportType,
    matchType: grade ? "grade" : "range",
    grade: grade || undefined,
    min: Number(row.minScore),
    max: Number(row.maxScore),
    text: row.text,
    isActive: Boolean(row.isActive),
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt || ""),
  };
}

function ruleData(input: IncomingRule) {
  if (!isReportType(input.reportType)) {
    throw new Error("Invalid report type");
  }
  if (!isTarget(input.target)) {
    throw new Error("Invalid target");
  }

  const text = String(input.text || "").trim();
  if (!text) {
    throw new Error("Remark text is required");
  }

  const matchType = input.matchType === "range" ? "range" : "grade";
  const grade = matchType === "grade" ? cleanGrade(input.grade) : null;

  if (matchType === "grade" && !grade) {
    throw new Error("Grade is required for grade remarks");
  }

  const minScore = matchType === "range" ? intOrDefault(input.min, 0) : 0;
  const maxScore = matchType === "range" ? intOrDefault(input.max, 100) : 100;

  return {
    type: targetToDbType(input.target) as any,
    level: reportTypeToLevel(input.reportType) as any,
    grade,
    minScore,
    maxScore,
    text,
    isActive: input.isActive ?? true,
  };
}

function defaultRules() {
  const rows: Array<{
    reportType: ReportType;
    target: RemarkTarget;
    grade: string;
    text: string;
  }> = [];

  const oTeacher: Record<string, string> = {
    A: "Excellent work. Keep it up!",
    B: "Very good performance. Aim even higher.",
    C: "Good effort. Improve with more practice.",
    D: "Fair attempt. Work harder for better results.",
    E: "Below average. Seek help and revise regularly.",
  };

  const oHead: Record<string, string> = {
    A: "Outstanding performance. Keep the momentum.",
    B: "Good work. Continue aiming for excellence.",
    C: "Good progress. Keep improving steadily.",
    D: "Work harder and consult your teachers.",
    E: "More effort and consistency are needed.",
  };

  const aTeacher: Record<string, string> = {
    A: "Excellent mastery of the subject. Keep focused.",
    B: "Very good work. Maintain consistency.",
    C: "Good performance. More revision will improve results.",
    D: "Basic performance. Work harder and seek guidance.",
    E: "More effort is required to improve understanding.",
  };

  const aHead: Record<string, string> = {
    A: "Excellent performance. Keep it up.",
    B: "Very good performance. Keep improving.",
    C: "Good progress. More effort is encouraged.",
    D: "Work harder and consult your teachers.",
    E: "Immediate improvement is required.",
  };

  for (const reportType of ["O_EOT"] as ReportType[]) {
    for (const [grade, text] of Object.entries(oTeacher)) rows.push({ reportType, target: "teacher", grade, text });
    for (const [grade, text] of Object.entries(oHead)) rows.push({ reportType, target: "headTeacher", grade, text });
  }

  for (const reportType of ["A_EOT"] as ReportType[]) {
    for (const [grade, text] of Object.entries(aTeacher)) rows.push({ reportType, target: "teacher", grade, text });
    for (const [grade, text] of Object.entries(aHead)) rows.push({ reportType, target: "headTeacher", grade, text });
  }

  return rows.map((r) => ruleData({ ...r, matchType: "grade", min: 0, max: 100, isActive: true }));
}

export async function GET(req: Request) {
  try {
    await requireUser();
    const { searchParams } = new URL(req.url);
    const all = searchParams.get("all") === "1";
    const rawReportType = searchParams.get("reportType") || "O_EOT";
    const rawTarget = searchParams.get("target") || "teacher";

    if (all) {
      const rows = await prisma.remarkRule.findMany({
        orderBy: [{ type: "asc" }, { level: "asc" }, { grade: "asc" }, { minScore: "asc" }],
      });
      return NextResponse.json({ total: rows.length, rules: rows.map((r) => toClientRule(r)) });
    }

    if (!isReportType(rawReportType) || !isTarget(rawTarget)) {
      return NextResponse.json({ error: "Invalid report type or target" }, { status: 400 });
    }

    const rows = await prisma.remarkRule.findMany({
      where: {
        type: targetToDbType(rawTarget) as any,
        level: reportTypeToLevel(rawReportType) as any,
      },
      orderBy: [{ grade: "asc" }, { minScore: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json(rows.map((r) => toClientRule(r, rawReportType)));
  } catch (e: any) {
    const msg = e?.message || "Error";
    const code = msg === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "add");

    if (action === "add") {
      const created = await prisma.remarkRule.create({ data: ruleData(body) });
      return NextResponse.json(toClientRule(created, body.reportType));
    }

    if (action === "update") {
      const id = String(body?.id || "").trim();
      if (!id) return NextResponse.json({ error: "Missing remark id" }, { status: 400 });

      const data = ruleData(body);
      const updated = await prisma.remarkRule.update({ where: { id }, data });
      return NextResponse.json(toClientRule(updated, body.reportType));
    }

    if (action === "toggle") {
      const id = String(body?.id || "").trim();
      if (!id) return NextResponse.json({ error: "Missing remark id" }, { status: 400 });
      const updated = await prisma.remarkRule.update({
        where: { id },
        data: { isActive: Boolean(body?.isActive) },
      });
      return NextResponse.json(toClientRule(updated, body.reportType));
    }

    if (action === "delete") {
      const id = String(body?.id || "").trim();
      if (!id) return NextResponse.json({ error: "Missing remark id" }, { status: 400 });
      await prisma.remarkRule.delete({ where: { id } });
      return NextResponse.json({ ok: true });
    }

    if (action === "resetDefaults") {
      await prisma.remarkRule.deleteMany({});
      const defaults = defaultRules();
      if (defaults.length) {
        await prisma.remarkRule.createMany({ data: defaults });
      }
      return NextResponse.json({ ok: true, count: defaults.length });
    }

    if (action === "importLegacy") {
      const rawRules = Array.isArray(body?.rules) ? body.rules : [];
      const replace = Boolean(body?.replace);

      const prepared = rawRules
        .map((rule: IncomingRule) => {
          try {
            return ruleData(rule);
          } catch {
            return null;
          }
        })
        .filter(Boolean) as ReturnType<typeof ruleData>[];

      if (replace) {
        await prisma.remarkRule.deleteMany({});
      }

      for (const item of prepared) {
        await prisma.remarkRule.create({ data: item });
      }

      return NextResponse.json({ ok: true, count: prepared.length });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: any) {
    const msg = e?.message || "Error";
    const code = msg === "UNAUTHENTICATED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}
