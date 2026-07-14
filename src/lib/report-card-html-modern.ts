import "server-only";

import fs from "node:fs";
import path from "node:path";
import type {
  StudentReportPayload,
  SubjectReportRow,
} from "@/lib/report-card-data";
import {
  formatMark,
  formatPdfMark,
  getALevelPoints,
  getReportHeading,
  toShortAssessmentLabel,
} from "@/lib/report-card-data";

const SCHOOL_NAME = "ZANA CHRISTIAN HIGH SCHOOL";
const SCHOOL_MOTTO = "IN GOD, WE TRUST";
const SCHOOL_ADDRESS = "P.O. Box 21312, Kampala, Uganda";
const SCHOOL_CONTACT = "Tel: 0773 748 168 / 0704 590 234";

const REPORT_BADGE_PATH = "report-assets/badge.png";
const STUDENT_PROFILE_PATH = "report-assets/student-profile.png";
const HEADTEACHER_SIGNATURE_PATH = "report-assets/headteacher-signature.png";

function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const dataUriCache = new Map<string, string>();

function assetToDataUri(publicPath: string) {
  try {
    const clean = publicPath.replace(/^\/+/, "");
    const cached = dataUriCache.get(clean);
    if (cached !== undefined) return cached;

    const abs = path.join(process.cwd(), "public", clean);
    if (!fs.existsSync(abs)) {
      dataUriCache.set(clean, "");
      return "";
    }

    const ext = path.extname(abs).toLowerCase();
    const mime =
      ext === ".jpg" || ext === ".jpeg"
        ? "image/jpeg"
        : ext === ".webp"
          ? "image/webp"
          : ext === ".svg"
            ? "image/svg+xml"
            : "image/png";

    const dataUri = `data:${mime};base64,${fs.readFileSync(abs).toString("base64")}`;
    dataUriCache.set(clean, dataUri);
    return dataUri;
  } catch {
    return "";
  }
}

function fullName(payload: StudentReportPayload) {
  const s = payload.student;
  return [s.firstName, s.otherNames, s.lastName]
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .join(" ");
}

function studentNumber(payload: StudentReportPayload) {
  return payload.student.admissionNo || payload.student.studentNo || "—";
}

function className(payload: StudentReportPayload) {
  return payload.activeEnrollment?.class?.name || "—";
}

function streamName(payload: StudentReportPayload) {
  return payload.activeEnrollment?.stream?.name || "—";
}

function isALevel(payload: StudentReportPayload) {
  return payload.reportType === "A_MID" || payload.reportType === "A_EOT";
}

function isOLevel(payload: StudentReportPayload) {
  return payload.reportType === "O_MID" || payload.reportType === "O_EOT";
}

function reportLevelLabel(payload: StudentReportPayload) {
  return isALevel(payload) ? "A-Level" : "O-Level";
}

function visualRowCount(payload: StudentReportPayload) {
  if (!isALevel(payload)) return payload.rows.length;
  return payload.rows.reduce(
    (sum, row) => sum + Math.max(row.papers?.length || 1, 1),
    0,
  );
}

function densityClass(payload: StudentReportPayload) {
  const rows = visualRowCount(payload);
  if (rows >= 24) return "density-ultra";
  if (rows >= 18) return "density-tight";
  if (rows >= 13) return "density-compact";
  return "density-normal";
}

function gradeCounts(rows: SubjectReportRow[], aLevel = false) {
  const order = aLevel
    ? ["A", "B", "C", "D", "E", "—"]
    : ["A", "B", "C", "D", "E", "—"];
  const map = new Map<string, number>();
  for (const row of rows) {
    const grade =
      String(row.grade || "—")
        .trim()
        .toUpperCase() || "—";
    map.set(grade, (map.get(grade) || 0) + 1);
  }
  return order
    .filter((grade) => map.has(grade))
    .map((grade) => ({ grade, count: map.get(grade) || 0 }));
}

function descriptorForGrade(payload: StudentReportPayload, grade: string) {
  const clean = String(grade || "")
    .trim()
    .toUpperCase();
  const row = payload.gradeDescriptors.find(
    (g) => String(g.grade).toUpperCase() === clean,
  );
  return row?.achievementLevel || "—";
}

function safeScore(value: number | null) {
  if (value === null || Number.isNaN(Number(value))) return 0;
  return Math.max(0, Math.min(100, Number(value)));
}

function totalSubjects(payload: StudentReportPayload) {
  return payload.rows.length;
}

function totalPapers(payload: StudentReportPayload) {
  return payload.rows.reduce((sum, row) => sum + (row.papers?.length || 0), 0);
}

function performanceMessage(payload: StudentReportPayload) {
  const grade = String(payload.overallGrade || "—").toUpperCase();
  const descriptor = descriptorForGrade(payload, grade);
  if (grade === "—")
    return "Performance summary will appear once marks have been entered.";
  return `${grade} • ${descriptor}`;
}

function pointsLegend() {
  return `
    <div class="points-legend">
      <span>A = 5</span><span>B = 4</span><span>C = 3</span><span>D = 2</span><span>E = 1</span>
      <span class="subsidiary-note">GP / Subsidiary Math / ICT: max 1 point</span>
    </div>`;
}

function statCards(payload: StudentReportPayload) {
  const best = payload.bestRow;
  const lowest = payload.lowestRow;
  const overall = formatPdfMark(payload.overallAverage, payload.reportType);
  const grade = payload.overallGrade || "—";
  const isA = isALevel(payload);
  const cards = [
    {
      icon: "▣",
      label: "Overall Average",
      value: overall,
      detail: performanceMessage(payload),
    },
    {
      icon: "★",
      label: "Final Grade",
      value: grade,
      detail: descriptorForGrade(payload, grade),
    },
    {
      icon: "▲",
      label: "Best Subject",
      value: best ? formatPdfMark(best.total, payload.reportType) : "—",
      detail: best ? best.subjectName : "—",
    },
    {
      icon: "▼",
      label: "Lowest Subject",
      value: lowest ? formatPdfMark(lowest.total, payload.reportType) : "—",
      detail: lowest ? lowest.subjectName : "—",
    },
  ];

  if (isA) {
    cards.splice(2, 0, {
      icon: "●",
      label: "Overall Points",
      value: String(payload.totalPoints ?? 0),
      detail: "Principal subjects A=5 … E=1",
    });
  }

  return cards
    .map(
      (card) => `
        <div class="stat-card ${card.label === "Overall Points" ? "overall-points-card" : ""}">
          <div class="stat-icon">${esc(card.icon)}</div>
          <div class="stat-label">${esc(card.label)}</div>
          <div class="stat-value">
            ${card.label === "Overall Points"
              ? `${esc(card.value)} <span class="points-out-of">out of 17</span>`
              : esc(card.value)}
          </div>
          <div class="stat-detail">${esc(card.detail)}</div>
        </div>`,
    )
    .join("");
}

function gradeDistribution(payload: StudentReportPayload) {
  const counts = gradeCounts(payload.rows, isALevel(payload));
  const total = Math.max(payload.rows.length, 1);

  return counts
    .map((item) => {
      const pct = Math.round((item.count / total) * 100);
      return `
        <div class="grade-dist-row">
          <span class="grade-mini grade-${esc(item.grade)}">${esc(item.grade)}</span>
          <span class="grade-bar"><span style="width:${pct}%"></span></span>
          <strong>${item.count}</strong>
        </div>`;
    })
    .join("");
}

function assessmentChips(payload: StudentReportPayload) {
  return payload.scheme.components
    .map(
      (component, index) => `
        <span class="chip">
          <strong>${esc(toShortAssessmentLabel(component.label, index, payload.reportType))}</strong>
          <span>Out of ${esc(formatMark(component.weightOutOf))}</span>
        </span>`,
    )
    .join("");
}

function gradeScale(payload: StudentReportPayload) {
  const rows = payload.gradeDescriptors
    .map(
      (g) => `
        <div class="scale-row">
          <span class="grade-mini grade-${esc(g.grade)}">${esc(g.grade)}</span>
          <span>${esc(g.achievementLevel)}</span>
          <strong>${esc(formatMark(g.minMark))}–${esc(formatMark(g.maxMark))}</strong>
        </div>`,
    )
    .join("");

  return rows;
}

function subjectRows(payload: StudentReportPayload) {
  const componentCount = payload.scheme.components.length;
  const showPapers =
    isALevel(payload) && payload.rows.some((r) => (r.papers || []).length > 0);
  const pointColumn = isALevel(payload);

  return payload.rows
    .map((row, index) => {
      const papers = row.papers || [];
      const rowClass = index % 2 === 0 ? "even" : "odd";

      if (showPapers && papers.length > 0) {
        return papers
          .map((paper, paperIndex) => {
            const points = getALevelPoints(row.subjectName, row.grade);
            return `
              <tr class="${rowClass}">
                ${paperIndex === 0 ? `<td class="subject strong" rowspan="${papers.length}">${esc(row.subjectName)}</td>` : ""}
                <td class="paper">${esc(paper.paperName)}</td>
                ${payload.scheme.components
                  .map((component) => {
                    const entry = paper.componentScores.find(
                      (c) => c.assessmentId === component.assessmentId,
                    );
                    return `<td class="center score-cell">${esc(formatPdfMark(entry?.weightedScore ?? null, payload.reportType))}</td>`;
                  })
                  .join("")}
                ${
                  paperIndex === 0
                    ? `
                      <td class="center strong" rowspan="${papers.length}">${esc(formatPdfMark(row.total, payload.reportType))}</td>
                      <td class="center" rowspan="${papers.length}"><span class="grade-pill grade-${esc(row.grade)}">${esc(row.grade)}</span></td>
                      ${pointColumn ? `<td class="center strong points-cell" rowspan="${papers.length}">${points}</td>` : ""}
                      <td class="comment" rowspan="${papers.length}">${esc(row.teacherComment || "—")}</td>
                      <td class="center initials" rowspan="${papers.length}">${esc(row.teacherInitials || "—")}</td>`
                    : ""
                }
              </tr>`;
          })
          .join("");
      }

      const points = getALevelPoints(row.subjectName, row.grade);
      return `
        <tr class="${rowClass}">
          <td class="subject strong">${esc(row.subjectName)}</td>
          ${showPapers ? `<td class="paper center">—</td>` : ""}
          ${payload.scheme.components
            .map((component) => {
              const entry = row.componentScores.find(
                (c) => c.assessmentId === component.assessmentId,
              );
              return `<td class="center score-cell">${esc(formatPdfMark(entry?.weightedScore ?? null, payload.reportType))}</td>`;
            })
            .join("")}
          <td class="center strong">${esc(formatPdfMark(row.total, payload.reportType))}</td>
          <td class="center"><span class="grade-pill grade-${esc(row.grade)}">${esc(row.grade)}</span></td>
          ${pointColumn ? `<td class="center strong points-cell">${points}</td>` : ""}
          <td class="comment">${esc(row.teacherComment || "—")}</td>
          <td class="center initials">${esc(row.teacherInitials || "—")}</td>
        </tr>`;
    })
    .join("");
}

function subjectTable(payload: StudentReportPayload) {
  const showPapers =
    isALevel(payload) && payload.rows.some((r) => (r.papers || []).length > 0);
  const pointColumn = isALevel(payload);

  return `
    <table class="results-table ${showPapers ? "paper-table" : ""} ${pointColumn ? "points-table" : ""}">
      <thead>
        <tr>
          <th class="subject-head">Subject</th>
          ${showPapers ? `<th>Paper</th>` : ""}
          ${payload.scheme.components
            .map(
              (component, index) => `
                <th class="assessment-head">
                  <span>${esc(toShortAssessmentLabel(component.label, index, payload.reportType))}</span>
                  <small>Out of ${esc(formatMark(component.weightOutOf))}</small>
                </th>`,
            )
            .join("")}
          <th>Total</th>
          <th>Grade</th>
          ${pointColumn ? `<th>Pts</th>` : ""}
          <th class="comment-head">Teacher Comment</th>
          <th>Init.</th>
        </tr>
      </thead>
      <tbody>${subjectRows(payload)}</tbody>
    </table>`;
}

function remarksPreview(payload: StudentReportPayload) {
  const useful = payload.rows
    .filter((row) => row.teacherComment && row.teacherComment !== "—")
    .slice(0, 2);

  if (!useful.length)
    return "Subject teacher comments are shown in the achievement table above.";

  return useful
    .map((row) => `${row.subjectName}: ${row.teacherComment}`)
    .join(" ");
}

function renderOneReport(payload: StudentReportPayload, _index: number) {
  const badge = assetToDataUri(REPORT_BADGE_PATH);
  const profile = assetToDataUri(STUDENT_PROFILE_PATH);
  const signature = assetToDataUri(HEADTEACHER_SIGNATURE_PATH);
  const isA = isALevel(payload);
  const levelClass = isA ? "level-a" : "level-o";
  const density = densityClass(payload);
  const average = safeScore(payload.overallAverage);
  const averagePct = Math.round(average);
  const heading = getReportHeading(
    payload.reportType,
    payload.termName,
    payload.academicYearName,
  );
  const stream = streamName(payload);
  const paperCount = totalPapers(payload);

  return `
    <section class="report-page ${levelClass} ${density}">
      <div class="top-rule"></div>

      <header class="school-header">
        <div class="crest-wrap">
          <div class="crest-ring">
            ${badge ? `<img src="${badge}" alt="School badge" />` : `<div class="crest-fallback">ZCHS</div>`}
          </div>
        </div>
        <div class="school-title">
          <div class="level-kicker">${esc(reportLevelLabel(payload))} Academic Report</div>
          <h1>${esc(SCHOOL_NAME)}</h1>
          <p class="motto">${esc(SCHOOL_MOTTO)}</p>
          <p class="contact">${esc(SCHOOL_ADDRESS)} · ${esc(SCHOOL_CONTACT)}</p>
        </div>
        <div class="term-card">
          <span>Academic Year</span>
          <strong>${esc(payload.academicYearName)}</strong>
          <span>Period</span>
          <strong>${esc(payload.termName)}</strong>
        </div>
      </header>

      <div class="report-title-row">
        <div class="title-lines"></div>
        <h2>${esc(heading)}</h2>
        <div class="title-lines"></div>
      </div>

      <section class="profile-performance-row">
        <div class="profile-card">
          <div class="photo-frame">
            ${profile ? `<img src="${profile}" alt="Student photo" />` : `<div class="photo-fallback">👤</div>`}
          </div>
          <div class="profile-grid">
            <div><span>Student Name</span><strong>${esc(fullName(payload))}</strong></div>
            <div><span>Student No.</span><strong>${esc(studentNumber(payload))}</strong></div>
            <div><span>Class</span><strong>${esc(className(payload))}</strong></div>
            <div><span>Stream</span><strong>${esc(stream)}</strong></div>
          </div>
        </div>

        <div class="performance-card">
          <div class="score-tile">
            <span>Overall Average</span>
            <strong>${esc(formatPdfMark(payload.overallAverage, payload.reportType))}</strong>
            <div class="score-track"><i style="width:${averagePct}%"></i></div>
          </div>
          <div class="grade-showcase">
            <span>Final Grade</span>
            <strong class="grade-big grade-${esc(payload.overallGrade)}">${esc(payload.overallGrade || "—")}</strong>
            <em>${esc(descriptorForGrade(payload, payload.overallGrade))}</em>
          </div>
        </div>
      </section>

      <section class="stats-row ${isA ? "stats-a" : ""}">
        ${statCards(payload)}
      </section>

      <main class="report-body">
        <section class="main-column">
          <div class="section-title"><span>▦</span><strong>Subject Achievement Level</strong></div>
          <div class="table-wrap">${subjectTable(payload)}</div>
          ${isA ? `
            <section class="alevel-lower-row">
              <div class="comment-box head-box">
                <div class="comment-title"><span>✪</span><strong>Head Teacher's Comment</strong></div>
                <p>${esc(payload.headTeacherComment || "—")}</p>
              </div>
              <div class="signature-box">
                <div class="signature-slot">
                  ${signature ? `<img src="${signature}" alt="Signature" />` : ""}
                  <div class="signature-line"></div>
                  <strong>Head Teacher</strong>
                </div>
                <div class="signature-slot">
                  <div class="signature-line"></div>
                  <strong>Class Teacher</strong>
                </div>
              </div>
            </section>` : ""}
        </section>

        <aside class="side-column">
          <div class="side-panel summary-panel">
            <div class="panel-title"><span>◉</span><strong>Performance Snapshot</strong></div>
            <div class="snapshot-line"><span>Subjects</span><strong>${totalSubjects(payload)}</strong></div>
            ${isA ? `<div class="snapshot-line"><span>Papers</span><strong>${paperCount || "—"}</strong></div>` : ""}
            ${isA ? `<div class="snapshot-line points-total"><span>Total Points</span><strong>${payload.totalPoints ?? 0}</strong></div>` : ""}
            <div class="mini-note">${esc(performanceMessage(payload))}</div>
          </div>

          <div class="side-panel distribution-panel">
            <div class="panel-title"><span>◌</span><strong>Grade Distribution</strong></div>
            ${gradeDistribution(payload)}
          </div>

          <div class="side-panel weights-panel">
            <div class="panel-title"><span>◆</span><strong>Assessment Weights</strong></div>
            <div class="chips">${assessmentChips(payload)}</div>
          </div>

          <div class="side-panel scale-panel">
            <div class="panel-title"><span>◇</span><strong>${isA ? "A-Level Grade & Points" : "Grade Scale"}</strong></div>
            ${isA ? pointsLegend() : ""}
            <div class="scale-list">${gradeScale(payload)}</div>
          </div>
        </aside>
      </main>

      ${!isA ? `
      <section class="bottom-row">
        <div class="comment-box head-box">
          <div class="comment-title"><span>✪</span><strong>Head Teacher's Comment</strong></div>
          <p>${esc(payload.headTeacherComment || "—")}</p>
        </div>
        <div class="signature-box">
          <div class="signature-slot">
            ${signature ? `<img src="${signature}" alt="Signature" />` : ""}
            <div class="signature-line"></div>
            <strong>Head Teacher</strong>
          </div>
          <div class="signature-slot">
            <div class="signature-line"></div>
            <strong>Class Teacher</strong>
          </div>
        </div>
      </section>` : ""}

      <footer class="report-footer">
        <span>IN GOD, WE TRUST</span>
      </footer>
    </section>`;
}

export function renderModernReportDocument(
  payloads: StudentReportPayload[],
  opts?: { title?: string },
) {
  const title = opts?.title || "Modern Report Card";
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${esc(title)}</title>
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; color: #172033; background: #ffffff; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

    .report-page {
      width: 210mm;
      height: 297mm;
      padding: 6.5mm;
      page-break-after: always;
      position: relative;
      overflow: hidden;
      display: grid;
      grid-template-rows: auto auto auto auto auto minmax(0, 1fr) auto auto;
      row-gap: 2.2mm;
      background: #fbfaf6;
      border: 1px solid #d9d1bf;
    }
    .report-page:last-child { page-break-after: auto; }
    .top-rule { height: 3mm; background: #12264a; border-bottom: 1mm solid #9f1f2d; margin: -6.5mm -6.5mm 0; }
    .level-a .top-rule { background: #12264a; border-bottom-color: #9f1f2d; }

    .school-header {
      min-height: 31mm;
      display: grid;
      grid-template-columns: 34mm 1fr 36mm;
      gap: 4mm;
      align-items: center;
      padding: 3mm 4mm;
      border: 1px solid #d4c7ad;
      border-radius: 4mm;
      background: #fffdf6;
      box-shadow: 0 1.2mm 3mm rgba(33, 38, 41, 0.08);
    }
    .level-a .school-header { border-color: #c8d0df; background: #fbfcff; }
    .crest-wrap { display: flex; justify-content: center; align-items: center; }
    .crest-ring {
      width: 27mm; height: 27mm;
      border-radius: 50%;
      border: 1.2mm solid #9f1f2d;
      background: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0.75mm;
      box-shadow: inset 0 0 0 0.8mm #eef2f9;
    }
    .level-a .crest-ring { border-color: #9f1f2d; box-shadow: inset 0 0 0 0.8mm #eef2f9; }
    .crest-ring img { width: 112%; height: 112%; max-width: 112%; max-height: 112%; object-fit: contain; }
    .crest-fallback { font-size: 12px; font-weight: 900; color: #0f4a3a; }

    .school-title { text-align: center; min-width: 0; }
    .level-kicker { font-size: 8.5pt; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 800; color: #9f1f2d; margin-bottom: 1mm; }
    .level-a .level-kicker { color: #9f1f2d; }
    .school-title h1 { margin: 0; font-size: 19pt; line-height: 1; color: #12264a; letter-spacing: 0.02em; }
    .level-a .school-title h1 { color: #12264a; }
    .motto { margin: 1.3mm 0 0; font-size: 9pt; font-weight: 800; letter-spacing: 0.2em; color: #12264a; }
    .level-a .motto { color: #12264a; }
    .contact { margin: 1.5mm 0 0; font-size: 7.6pt; color: #4d5562; }

    .term-card {
      align-self: stretch;
      border-radius: 3mm;
      border: 1px solid #d2c6b2;
      background: #f6f0e5;
      padding: 2.5mm;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 0.9mm;
      text-align: center;
    }
    .level-a .term-card { background: #f0f3f8; border-color: #cbd3e0; }
    .term-card span { text-transform: uppercase; font-size: 7pt; font-weight: 800; color: #786044; letter-spacing: 0.08em; }
    .level-a .term-card span { color: #5f6c85; }
    .term-card strong { font-size: 9.5pt; color: #172033; }

    .report-title-row { display: grid; grid-template-columns: 1fr auto 1fr; gap: 4mm; align-items: center; margin: 0; min-height: 10mm; }
    .report-title-row h2 { margin: 0; color: #12264a; font-size: 19pt; text-transform: uppercase; letter-spacing: 0.08em; }
    .level-a .report-title-row h2 { color: #12264a; }
    .title-lines { height: 1.2mm; border-top: 0.6mm solid #9f1f2d; border-bottom: 0.3mm solid #12264a; }
    .level-a .title-lines { border-top-color: #9f1f2d; border-bottom-color: #12264a; }

    .profile-performance-row { display: grid; grid-template-columns: 1.65fr 1fr; gap: 4mm; min-height: 31mm; }
    .profile-card, .performance-card, .stat-card, .side-panel, .comment-box, .signature-box {
      border: 1px solid #d4c7ad;
      background: #ffffff;
      border-radius: 4mm;
      box-shadow: 0 0.8mm 2.5mm rgba(33, 38, 41, 0.06);
    }
    .level-a .profile-card, .level-a .performance-card, .level-a .stat-card, .level-a .side-panel, .level-a .comment-box, .level-a .signature-box { border-color: #cbd3e0; }

    .profile-card { display: grid; grid-template-columns: 28mm 1fr; gap: 4mm; align-items: center; padding: 3mm; }
    .photo-frame { width: 25mm; height: 25mm; border-radius: 50%; border: 1mm solid #9f1f2d; background: #f2f5fa; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .level-a .photo-frame { border-color: #9f1f2d; background: #f2f5fa; }
    .photo-frame img { width: 100%; height: 100%; object-fit: contain; }
    .photo-fallback { font-size: 20pt; color: #6a7281; }
    .profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2mm 3mm; }
    .profile-grid div { border-bottom: 1px solid #e6dfd0; padding-bottom: 1.2mm; }
    .profile-grid span { display: block; font-size: 7pt; text-transform: uppercase; font-weight: 800; color: #6b5b43; letter-spacing: 0.08em; }
    .level-a .profile-grid span { color: #5f6c85; }
    .profile-grid strong { display: block; margin-top: 0.7mm; font-size: 10.5pt; color: #111827; }

    .performance-card { display: grid; grid-template-columns: 1fr 1fr; align-items: stretch; padding: 3mm; gap: 3mm; }
    .score-tile { border-right: 1px solid #e4dac9; padding-right: 3mm; display: flex; flex-direction: column; justify-content: center; }
    .level-a .score-tile { border-right-color: #d8deea; }
    .score-tile span, .grade-showcase span { font-size: 7pt; text-transform: uppercase; font-weight: 900; letter-spacing: 0.1em; color: #6b5b43; }
    .level-a .score-tile span, .level-a .grade-showcase span { color: #5f6c85; }
    .score-tile strong { display: block; margin: 1.5mm 0; font-size: 24pt; line-height: 0.95; color: #12264a; }
    .level-a .score-tile strong { color: #12264a; }
    .score-track { width: 100%; height: 3mm; border-radius: 20mm; background: #e8dfce; overflow: hidden; }
    .level-a .score-track { background: #e1e6ef; }
    .score-track i { display: block; height: 100%; border-radius: inherit; background: #12264a; }
    .level-a .score-track i { background: #12264a; }
    .grade-showcase { text-align: center; display: flex; flex-direction: column; justify-content: center; }
    .grade-showcase strong { display: block; font-size: 28pt; line-height: 0.95; margin: 1mm 0; color: #9f1f2d; }
    .level-a .grade-showcase strong { color: #9f1f2d; }
    .grade-showcase em { display: block; font-size: 8pt; font-style: normal; font-weight: 800; color: #172033; }

    .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; margin: 0; min-height: 21mm; }
    .stats-row.stats-a { grid-template-columns: repeat(5, 1fr); }
    .stat-card { padding: 2.2mm 2.4mm; position: relative; overflow: hidden; }
    .stat-card::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 1.2mm; background: #12264a; }
    .level-a .stat-card::before { background: #12264a; }
    .stat-icon { width: 7mm; height: 7mm; border-radius: 50%; background: #eef2f9; color: #12264a; display: inline-flex; align-items: center; justify-content: center; font-weight: 900; font-size: 9pt; }
    .level-a .stat-icon { background: #eef2f9; color: #12264a; }
    .stat-label { margin-top: 1.2mm; font-size: 6.8pt; text-transform: uppercase; font-weight: 900; letter-spacing: 0.07em; color: #687282; }
    .stat-value { margin-top: 0.7mm; font-size: 14pt; font-weight: 900; color: #172033; }
    .points-out-of { display: inline-block; margin-left: 0.9mm; font-size: 6.4pt; font-weight: 800; color: #9aa4b2; vertical-align: baseline; white-space: nowrap; }
    .overall-points-card .stat-value { white-space: nowrap; }
    .stat-detail { margin-top: 0.3mm; font-size: 7pt; line-height: 1.2; color: #4b5563; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .report-body { min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 52mm; gap: 3.2mm; overflow: hidden; align-self: stretch; }
    .main-column, .side-column { min-height: 0; }
    .main-column { display: flex; flex-direction: column; }
    .side-column { display: flex; flex-direction: column; gap: 2.1mm; overflow: hidden; min-height: 0; }
    .section-title, .panel-title, .comment-title { min-height: 8mm; display: flex; align-items: center; gap: 2mm; padding: 0 3mm; background: #12264a; color: #fff; border-radius: 3mm 3mm 0 0; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 900; font-size: 9.2pt; }
    .level-a .section-title, .level-a .panel-title, .level-a .comment-title { background: #12264a; }
    .section-title span, .panel-title span, .comment-title span { color: #d19a3a; font-size: 11pt; }
    .level-a .section-title span, .level-a .panel-title span, .level-a .comment-title span { color: #d19a3a; }
    .table-wrap { flex: 1; min-height: 0; border: 1px solid #d4c7ad; border-top: 0; border-radius: 0 0 3mm 3mm; overflow: hidden; background: #fff; }
    .level-a .table-wrap { border-color: #cbd3e0; }

    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .results-table th { background: #f1eadc; color: #172033; font-size: 8.1pt; padding: 2mm 1.3mm; border: 1px solid #d6cbb7; text-align: center; }
    .level-a .results-table th { background: #eef2f8; border-color: #d7ddea; }
    .results-table th small { display: block; font-size: 6.3pt; font-weight: 700; color: #647082; margin-top: 0.3mm; }
    .results-table td { border: 1px solid #e0d6c6; padding: 1.65mm 1.4mm; font-size: 8.1pt; line-height: 1.14; vertical-align: middle; color: #172033; }
    .level-a .results-table td { border-color: #dce2ec; }
    .results-table .odd td { background: #fcfaf5; }
    .level-a .results-table .odd td { background: #f8faff; }
    .subject-head { width: 24%; text-align: left !important; }
    .paper-table .subject-head { width: 20%; }
    .assessment-head { width: 10%; }
    .comment-head { width: 26%; text-align: left !important; }
    .points-table .comment-head { width: 21%; }
    .subject { text-transform: uppercase; }
    .strong { font-weight: 900; }
    .center { text-align: center; }
    .comment { font-size: 7.7pt !important; color: #334155; }
    .initials { font-weight: 900; }
    .grade-pill, .grade-mini { display: inline-flex; align-items: center; justify-content: center; min-width: 7mm; height: 6mm; border-radius: 20mm; font-weight: 900; background: #f4e8ea; color: #9f1f2d; border: 1px solid #ddb9bf; }
    .level-a .grade-pill, .level-a .grade-mini { background: #f4e8ea; color: #9f1f2d; border-color: #ddb9bf; }
    .points-cell { color: #9f1f2d; }

    .side-panel { padding-bottom: 1.4mm; overflow: hidden; flex: 0 1 auto; min-height: 0; }
    .scale-panel { flex: 1 1 auto; }
    .side-panel .panel-title { border-radius: 3mm 3mm 0 0; min-height: 7mm; font-size: 7.7pt; padding: 0 2.2mm; }
    .snapshot-line { display: flex; justify-content: space-between; align-items: center; padding: 1.6mm 2.4mm; border-bottom: 1px solid #e8dfd0; font-size: 8.2pt; }
    .level-a .snapshot-line { border-bottom-color: #e3e8f1; }
    .snapshot-line span { color: #5b6472; font-weight: 800; }
    .snapshot-line strong { color: #172033; font-size: 11pt; }
    .points-total strong { color: #9f1f2d; }
    .mini-note { padding: 1.8mm 2.4mm 0; font-size: 7.5pt; line-height: 1.25; color: #465064; }

    .grade-dist-row { display: grid; grid-template-columns: 8mm 1fr 7mm; gap: 1.5mm; align-items: center; padding: 1.2mm 2.2mm; }
    .grade-bar { height: 2.5mm; border-radius: 10mm; background: #ece5d8; overflow: hidden; }
    .level-a .grade-bar { background: #e5eaf3; }
    .grade-bar span { display: block; height: 100%; background: #12264a; }
    .level-a .grade-bar span { background: #12264a; }
    .grade-dist-row strong { text-align: right; font-size: 8pt; }

    .chips { display: flex; flex-wrap: wrap; gap: 1.5mm; padding: 2mm; }
    .chip { border: 1px solid #d8c9ab; background: #fbf6ea; border-radius: 20mm; padding: 1.1mm 1.8mm; font-size: 6.7pt; }
    .level-a .chip { border-color: #cbd3e0; background: #f6f8fc; }
    .chip strong { color: #12264a; margin-right: 1mm; }
    .level-a .chip strong { color: #12264a; }

    .points-legend { padding: 1.2mm 1.6mm 0; display: flex; flex-wrap: wrap; gap: 0.55mm; }
    .points-legend span { background: #f4e8ea; color: #9f1f2d; border: 1px solid #e0bdc3; border-radius: 20mm; padding: 0.55mm 0.85mm; font-size: 5.25pt; font-weight: 900; line-height: 1; }
    .points-legend span:not(.subsidiary-note) { flex: 0 0 auto; }
    .points-legend .subsidiary-note { flex: 1 1 100%; border-radius: 1.6mm; color: #334155; background: #f8fafc; font-size: 5.1pt; padding: 0.65mm 0.9mm; }
    .scale-list { padding: 1.0mm 2mm 0; overflow: hidden; }
    .scale-row { display: grid; grid-template-columns: 8mm 1fr 17mm; gap: 1mm; align-items: center; font-size: 6.7pt; padding: 0.7mm 0; border-bottom: 1px solid #eee5d8; }
    .level-a .scale-row { border-bottom-color: #e5eaf3; }
    .scale-row strong { text-align: right; color: #172033; }

    .bottom-row { display: grid; grid-template-columns: minmax(0, 1fr) 56mm; gap: 3mm; height: 29mm; min-height: 29mm; max-height: 29mm; margin-top: 0; align-items: stretch; position: relative; z-index: 1; }
    .level-a .report-body { grid-template-columns: minmax(0, 1fr) 50mm; gap: 3mm; overflow: visible; }
    .level-a .main-column { display: grid; grid-template-rows: auto minmax(0, 1fr) 24mm; gap: 2mm; min-height: 0; overflow: hidden; }
    .level-a .main-column .section-title { grid-row: 1; }
    .level-a .main-column .table-wrap { grid-row: 2; min-height: 0; overflow: hidden; }
    .level-a .alevel-lower-row { grid-row: 3; display: grid; grid-template-columns: minmax(0, 1fr) 42mm; gap: 2mm; min-height: 0; height: 24mm; }
    .level-a .alevel-lower-row .comment-box,
    .level-a .alevel-lower-row .signature-box { min-height: 0; overflow: hidden; box-shadow: 0 0.5mm 1.5mm rgba(33, 38, 41, 0.05); }
    .level-a .alevel-lower-row .comment-title { min-height: 6mm; font-size: 6.7pt; padding: 0 2mm; }
    .level-a .alevel-lower-row .comment-box p { margin: 1.1mm 1.8mm; font-size: 6.7pt; line-height: 1.18; }
    .level-a .alevel-lower-row .signature-box { grid-template-rows: 1fr 1fr; padding: 1.2mm; gap: 0.4mm; }
    .level-a .alevel-lower-row .signature-line { width: 32mm; }
    .level-a .alevel-lower-row .signature-slot strong { font-size: 5.8pt; }
    .level-a .alevel-lower-row .signature-slot img { top: -0.8mm; max-width: 28mm; max-height: 9mm; }
    .level-a .side-column { overflow: hidden; }
    .level-a .scale-panel { flex: 1 1 auto; min-height: 42mm; }
    .level-a .scale-row { font-size: 7.25pt; padding: 0.82mm 0; grid-template-columns: 8mm 1fr 16mm; }
    .level-a .results-table th { font-size: 7.4pt; padding: 1.65mm 1mm; }
    .level-a .results-table th small { font-size: 5.7pt; }
    .level-a .results-table td { font-size: 7.35pt; padding: 1.65mm 0.95mm; line-height: 1.16; }
    .level-a .comment { font-size: 6.65pt !important; line-height: 1.16; }

    .head-box { min-width: 0; overflow: hidden; }
    .signature-box { min-width: 0; overflow: hidden; }
    .side-column, .side-panel, .table-wrap { overflow: hidden; }
    .comment-box p { margin: 1.6mm 2.4mm; font-size: 7.6pt; line-height: 1.25; color: #263345; }
    .signature-box { display: grid; grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; gap: 0.6mm; padding: 1.6mm; }
    .signature-slot { position: relative; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 1mm; }
    .signature-slot img { position: absolute; top: -0.5mm; max-width: 34mm; max-height: 12mm; object-fit: contain; opacity: 0.9; }
    .signature-line { width: 42mm; border-top: 1px solid #8a94a6; }
    .signature-slot strong { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.08em; color: #4b5563; }

    .report-footer { margin-top: 0; min-height: 7mm; background: #12264a; color: #fff; border-radius: 2.5mm; display: flex; align-items: center; justify-content: center; padding: 0 5mm; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.18em; font-weight: 900; text-align: center; }
    .level-a .report-footer { background: #12264a; }

    .density-compact { padding: 5.5mm; row-gap: 1.8mm; }
    .density-compact .school-header { min-height: 28mm; }
    .density-compact .school-title h1 { font-size: 17pt; }
    .density-compact .profile-performance-row { min-height: 28mm; }
    .density-compact .stats-row { min-height: 18mm; gap: 2mm; }
    .density-compact .stat-value { font-size: 12pt; }
    .density-compact .points-out-of { font-size: 5.6pt; margin-left: 0.55mm; }
    .density-compact .results-table th { font-size: 7.2pt; padding: 1.4mm 1mm; }
    .density-compact .results-table td { font-size: 7.1pt; padding: 1.15mm 1mm; }
    .density-compact.level-a .results-table td { font-size: 7.0pt; padding: 1.35mm 0.85mm; line-height: 1.14; }
    .density-compact.level-a .scale-panel { min-height: 37mm; }
    .density-compact.level-a .scale-row { font-size: 6.55pt; padding: 0.62mm 0; grid-template-columns: 7.5mm 1fr 15mm; }
    .density-compact .comment { font-size: 6.8pt !important; }
    .density-compact .bottom-row { height: 27mm; min-height: 27mm; max-height: 27mm; }
    .density-compact.level-a .main-column { grid-template-rows: auto minmax(0, 1fr) 22mm; gap: 1.6mm; }
    .density-compact.level-a .alevel-lower-row { height: 22mm; grid-template-columns: minmax(0, 1fr) 39mm; gap: 1.6mm; }
    .density-compact.level-a .alevel-lower-row .comment-title { min-height: 5.5mm; font-size: 6.1pt; }
    .density-compact.level-a .alevel-lower-row .comment-box p { font-size: 6.1pt; line-height: 1.14; margin: 1mm 1.4mm; }
    .density-compact.level-a .alevel-lower-row .signature-line { width: 30mm; }

    .density-compact .comment-box p { font-size: 7.3pt; }

    .density-tight, .density-ultra { padding: 4.8mm; row-gap: 1.3mm; }
    .density-tight .top-rule, .density-ultra .top-rule { margin: -4.8mm -4.8mm 0; height: 2.2mm; border-bottom-width: 0.7mm; }
    .density-tight .school-header, .density-ultra .school-header { min-height: 24mm; grid-template-columns: 27mm 1fr 30mm; padding: 2mm 3mm; gap: 2mm; }
    .density-tight .crest-ring, .density-ultra .crest-ring { width: 21mm; height: 21mm; }
    .density-tight .school-title h1, .density-ultra .school-title h1 { font-size: 14pt; }
    .density-tight .motto, .density-ultra .motto { font-size: 7pt; }
    .density-tight .contact, .density-ultra .contact { font-size: 6.2pt; }
    .density-tight .report-title-row, .density-ultra .report-title-row { margin: 0; min-height: 7mm; }
    .density-tight .report-title-row h2, .density-ultra .report-title-row h2 { font-size: 14pt; }
    .density-tight .profile-performance-row, .density-ultra .profile-performance-row { min-height: 23mm; gap: 2mm; }
    .density-tight .profile-card, .density-ultra .profile-card { grid-template-columns: 21mm 1fr; gap: 2mm; padding: 2mm; }
    .density-tight .photo-frame, .density-ultra .photo-frame { width: 19mm; height: 19mm; }
    .density-tight .profile-grid strong, .density-ultra .profile-grid strong { font-size: 8.2pt; }
    .density-tight .performance-card, .density-ultra .performance-card { padding: 2mm; gap: 2mm; }
    .density-tight .score-tile strong, .density-ultra .score-tile strong,
    .density-tight .grade-showcase strong, .density-ultra .grade-showcase strong { font-size: 21pt; }
    .density-tight .stats-row, .density-ultra .stats-row { min-height: 15mm; gap: 1.6mm; margin: 0; }
    .density-tight .stat-card, .density-ultra .stat-card { padding: 1.3mm 1.6mm; }
    .density-tight .stat-icon, .density-ultra .stat-icon { width: 5.5mm; height: 5.5mm; font-size: 7pt; }
    .density-tight .stat-label, .density-ultra .stat-label { font-size: 5.7pt; }
    .density-tight .stat-value, .density-ultra .stat-value { font-size: 10pt; }
    .density-tight .points-out-of, .density-ultra .points-out-of { font-size: 4.8pt; margin-left: 0.35mm; }
    .density-tight .stat-detail, .density-ultra .stat-detail { font-size: 5.8pt; }
    .density-tight .report-body, .density-ultra .report-body { grid-template-columns: 1fr 46mm; gap: 2mm; }
    .density-tight .section-title, .density-ultra .section-title { min-height: 6mm; font-size: 7.2pt; }
    .density-tight .side-panel .panel-title, .density-ultra .side-panel .panel-title { min-height: 5.5mm; font-size: 6pt; }
    .density-tight .results-table th, .density-ultra .results-table th { font-size: 6.1pt; padding: 0.9mm 0.7mm; }
    .density-tight .results-table th small, .density-ultra .results-table th small { font-size: 4.9pt; }
    .density-tight .results-table td, .density-ultra .results-table td { font-size: 5.9pt; padding: 0.7mm 0.7mm; }
    .density-tight.level-a .results-table td, .density-ultra.level-a .results-table td { font-size: 5.9pt; padding: 0.9mm 0.65mm; line-height: 1.12; }
    .density-tight.level-a .scale-panel, .density-ultra.level-a .scale-panel { min-height: 30mm; }
    .density-tight.level-a .scale-row, .density-ultra.level-a .scale-row { font-size: 5.55pt; padding: 0.42mm 0; grid-template-columns: 6.5mm 1fr 13mm; }
    .density-tight .comment, .density-ultra .comment { font-size: 5.5pt !important; }
    .density-tight .bottom-row, .density-ultra .bottom-row { height: 24mm; min-height: 24mm; max-height: 24mm; margin-top: 0; gap: 2mm; grid-template-columns: minmax(0, 1fr) 45mm; }
    .density-tight.level-a .main-column, .density-ultra.level-a .main-column { grid-template-rows: auto minmax(0, 1fr) 19mm; gap: 1.2mm; }
    .density-tight.level-a .alevel-lower-row, .density-ultra.level-a .alevel-lower-row { height: 19mm; grid-template-columns: minmax(0, 1fr) 34mm; gap: 1.2mm; }
    .density-tight.level-a .alevel-lower-row .comment-title, .density-ultra.level-a .alevel-lower-row .comment-title { min-height: 4.8mm; font-size: 5.4pt; }
    .density-tight.level-a .alevel-lower-row .comment-box p, .density-ultra.level-a .alevel-lower-row .comment-box p { font-size: 5.2pt; line-height: 1.12; margin: 0.8mm 1.1mm; }
    .density-tight.level-a .alevel-lower-row .signature-line, .density-ultra.level-a .alevel-lower-row .signature-line { width: 25mm; }
    .density-tight.level-a .alevel-lower-row .signature-slot strong, .density-ultra.level-a .alevel-lower-row .signature-slot strong { font-size: 4.8pt; }
    .density-tight.level-a .alevel-lower-row .signature-slot img, .density-ultra.level-a .alevel-lower-row .signature-slot img { max-width: 22mm; max-height: 7mm; }

    .density-tight .comment-title, .density-ultra .comment-title { min-height: 5.5mm; font-size: 6.3pt; }
    .density-tight .comment-box p, .density-ultra .comment-box p { font-size: 6.1pt; line-height: 1.2; margin: 1.4mm 1.8mm; }
    .density-tight .report-footer, .density-ultra .report-footer { min-height: 5mm; margin-top: 0; font-size: 6.2pt; }

    @media screen {
      body { background: #e5e7eb; padding: 16px; }
      .report-page { margin: 0 auto 20px; box-shadow: 0 8px 24px rgba(0,0,0,0.14); }
    }
  </style>
</head>
<body>
  ${payloads.map((payload, index) => renderOneReport(payload, index)).join("\n")}
</body>
</html>`;
}
