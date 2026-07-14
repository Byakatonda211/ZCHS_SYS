import { NextResponse } from "next/server";
import { chromium } from "playwright";
import { requireUser } from "@/lib/auth";
import {
  buildStudentReportPayload,
  canGenerateClassReports,
  listClassStudentIds,
  type ReportType,
} from "@/lib/report-card-data";
import { renderModernReportDocument } from "@/lib/report-card-html-modern";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isReportType(value: string): value is ReportType {
  return value === "O_MID" || value === "O_EOT" || value === "A_MID" || value === "A_EOT";
}

function safeFileName(name: string) {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "").replace(/\s+/g, " ").trim();
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
) {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.min(Math.max(1, limit), items.length);
  await Promise.all(Array.from({ length: workerCount }, runWorker));
  return results;
}

async function htmlToPdfBuffer(html: string) {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--font-render-hinting=none",
    ],
  });

  try {
    const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
    page.setDefaultTimeout(120_000);
    page.setDefaultNavigationTimeout(120_000);

    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.emulateMedia({ media: "print" });

    return await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
    });
  } finally {
    await browser.close();
  }
}

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);

    const studentId = (searchParams.get("studentId") || "").trim();
    const classId = (searchParams.get("classId") || "").trim();
    const academicYearId = (searchParams.get("academicYearId") || searchParams.get("yearId") || "").trim();
    const termId = (searchParams.get("termId") || "").trim();
    const rawReportType = (searchParams.get("reportType") || "").trim();
    const q = (searchParams.get("q") || "").trim();

    if (!academicYearId || !termId || !isReportType(rawReportType)) {
      return NextResponse.json(
        { error: "Missing academicYearId, termId, or valid reportType" },
        { status: 400 }
      );
    }

    let studentIds: string[] = [];
    let fileStem = "New Report Design";

    if (studentId) {
      studentIds = [studentId];
    } else if (classId) {
      const allowed = await canGenerateClassReports(user, classId);
      if (!allowed) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
      studentIds = await listClassStudentIds({ classId, academicYearId, q });
      fileStem = "Class New Report Design";
    } else {
      return NextResponse.json({ error: "Provide either studentId or classId" }, { status: 400 });
    }

    if (studentIds.length === 0) {
      return NextResponse.json({ error: "No students found for this report." }, { status: 404 });
    }

    const skipped: string[] = [];

    const payloadResults = await mapWithConcurrency(studentIds, studentId ? 1 : 4, async (id) => {
      try {
        return await buildStudentReportPayload({
          studentId: id,
          academicYearId,
          termId,
          reportType: rawReportType,
        });
      } catch (error: any) {
        skipped.push(`${id}: ${error?.message || "failed"}`);
        if (studentId) throw error;
        return null;
      }
    });

    const payloads = payloadResults.filter((x): x is NonNullable<typeof x> => Boolean(x));

    if (payloads.length === 0) {
      return NextResponse.json({ error: "No report cards could be generated.", skipped }, { status: 500 });
    }

    const html = renderModernReportDocument(payloads, { title: fileStem });
    const pdf = await htmlToPdfBuffer(html);

    const first = payloads[0];
    const firstName = [first.student.firstName, first.student.otherNames, first.student.lastName]
      .filter(Boolean)
      .join(" ");
    const filename = safeFileName(
      studentId ? `${firstName} New Report Design.pdf` : `${fileStem}.pdf`
    );

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        ...(skipped.length ? { "X-Skipped-Reports": String(skipped.length) } : {}),
      },
    });
  } catch (error: any) {
    const message = error?.message || "Failed to generate new report design";
    const status = message === "UNAUTHENTICATED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
