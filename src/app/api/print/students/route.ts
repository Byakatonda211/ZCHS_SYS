import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";

function safe(v: any): string {
  return String(v ?? "").trim();
}

function studentFullName(s: any): string {
  const parts = [s?.firstName, s?.otherNames, s?.lastName]
    .map((x) => safe(x))
    .filter(Boolean);
  return parts.join(" ") || "-";
}

function buildMetaLine({
  q,
  className,
  streamName,
}: {
  q?: string;
  className?: string;
  streamName?: string;
}) {
  const bits: string[] = [];
  if (className) bits.push(`Class: ${className}`);
  if (streamName) bits.push(`Stream: ${streamName}`);
  if (q) bits.push(`Search: "${q}"`);
  bits.push(`Generated: ${new Date().toLocaleString()}`);
  return bits.join("   |   ");
}

export async function GET(req: Request) {
  try {
    await requireUser();

    const { searchParams } = new URL(req.url);
    const q = safe(searchParams.get("q"));
    const classId = safe(searchParams.get("classId"));
    const streamId = safe(searchParams.get("streamId"));

    const where: any = {
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { otherNames: { contains: q, mode: "insensitive" } },
              { admissionNo: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      enrollments: {
        some: {
          isActive: true,
          ...(classId ? { classId } : {}),
          ...(streamId ? { streamId } : {}),
        },
      },
    };

    const students = await prisma.student.findMany({
      where,
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      include: {
        enrollments: {
          where: {
            isActive: true,
            ...(classId ? { classId } : {}),
            ...(streamId ? { streamId } : {}),
          },
          take: 1,
          orderBy: { createdAt: "desc" },
          include: { class: true, stream: true },
        },
      },
    });

    const rows = students.map((s: any) => {
      const e = s.enrollments?.[0];
      return {
        name: studentFullName(s),
        className: safe(e?.class?.name) || "-",
        streamName: safe(e?.stream?.name) || "-",
      };
    });

    const className =
      safe(rows.find((r) => r.className && r.className !== "-")?.className) || "";
    const streamName =
      safe(rows.find((r) => r.streamName && r.streamName !== "-")?.streamName) ||
      "";

    const metaLine = buildMetaLine({
      q: q || undefined,
      className: className || undefined,
      streamName: streamName || undefined,
    });

    // ---- PDF ----
    const pdfDoc = await PDFDocument.create();
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const PAGE_W = 595.28; // A4
    const PAGE_H = 841.89;

    const margin = 48;
    const rowH = 18;

    const colNameW = 320;
    const colClassW = 110;
    const colStreamW = 110;

    const xName = margin;
    const xClass = xName + colNameW;
    const xStream = xClass + colClassW;

    const tableTopStart = PAGE_H - margin - 70;


    function drawCenteredText(page: any, text: string, y: number, size: number, font: any) {
      const w = font.widthOfTextAtSize(text, size);
      const x = (PAGE_W - w) / 2;
      page.drawText(text, { x, y, size, font });
    }

    function addPageWithHeader() {
      const page = pdfDoc.addPage([PAGE_W, PAGE_H]);

      drawCenteredText(page, "ZZANA CHRISTIAN HIGH SCHOOL", PAGE_H - margin - 10, 16, fontBold);

      drawCenteredText(page, "CLASS LIST", PAGE_H - margin - 32, 12, fontBold);

      drawCenteredText(page, metaLine, PAGE_H - margin - 50, 9, fontRegular);

      const yHeader = tableTopStart;

      page.drawText("Name", { x: xName + 4, y: yHeader - 8, size: 10, font: fontBold });
      page.drawText("Class", {
        x: xClass + 4,
        y: yHeader - 8,
        size: 10,
        font: fontBold,
      });
      page.drawText("Stream", {
        x: xStream + 4,
        y: yHeader - 8,
        size: 10,
        font: fontBold,
      });


      // Table grid settings
      const xLeft = margin;
      const xRight = PAGE_W - margin;
      const headerTop = yHeader + 6;
      const headerBottom = yHeader - rowH + 6;

      // Header grid lines (no fills)
      page.drawLine({ start: { x: xLeft, y: headerTop }, end: { x: xRight, y: headerTop }, thickness: 1 });
      page.drawLine({ start: { x: xLeft, y: headerBottom }, end: { x: xRight, y: headerBottom }, thickness: 1 });
      page.drawLine({ start: { x: xLeft, y: headerTop }, end: { x: xLeft, y: headerBottom }, thickness: 1 });
      page.drawLine({ start: { x: xRight, y: headerTop }, end: { x: xRight, y: headerBottom }, thickness: 1 });

// Header column separators
      page.drawLine({
        start: { x: xClass, y: headerTop },
        end: { x: xClass, y: headerBottom },
        thickness: 1,
      });
      page.drawLine({
        start: { x: xStream, y: headerTop },
        end: { x: xStream, y: headerBottom },
        thickness: 1,
      });


      return { page, y: yHeader - rowH - 4 };
    }

    let { page, y } = addPageWithHeader();

    for (const r of rows) {
      if (y < margin + 20) {
        ({ page, y } = addPageWithHeader());
      }


      // Row borders (full grid: outer + columns)
      const xLeft = margin;
      const xRight = PAGE_W - margin;
      const rowTop = y + 4;
      const rowBottom = y - rowH + 4;

      // Row grid lines (no fills)
      page.drawLine({ start: { x: xLeft, y: rowTop }, end: { x: xRight, y: rowTop }, thickness: 1 });
      page.drawLine({ start: { x: xLeft, y: rowBottom }, end: { x: xRight, y: rowBottom }, thickness: 1 });
      page.drawLine({ start: { x: xLeft, y: rowTop }, end: { x: xLeft, y: rowBottom }, thickness: 1 });
      page.drawLine({ start: { x: xRight, y: rowTop }, end: { x: xRight, y: rowBottom }, thickness: 1 });

page.drawLine({
        start: { x: xClass, y: rowTop },
        end: { x: xClass, y: rowBottom },
        thickness: 1,
      });
      page.drawLine({
        start: { x: xStream, y: rowTop },
        end: { x: xStream, y: rowBottom },
        thickness: 1,
      });

      page.drawText(r.name || "-", { x: xName + 4, y: y - 10, size: 10, font: fontRegular });
      page.drawText(r.className || "-", {
        x: xClass + 4,
        y: y - 10,
        size: 10,
        font: fontRegular,
      });
      page.drawText(r.streamName || "-", {
        x: xStream + 4,
        y: y - 10,
        size: 10,
        font: fontRegular,
      });

      y -= rowH;
    }

    const bytes = await pdfDoc.save();

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="class_list.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
