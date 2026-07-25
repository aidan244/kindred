/**
 * Lays out a CanonicalReportData as a jsPDF document — direct text/table/
 * vector layout, never html2canvas, so it reads as a document rather than
 * a picture of an app. Times New Roman (a base-14 PDF font: no loading, no
 * embedding, no network — `doc.setFont('times', ...)` alone is enough),
 * A4, monochrome, 20mm margins, hairline (0.3mm) rules throughout.
 *
 * Only this file touches jsPDF/jspdf-autotable directly — `sections.ts` is
 * the single source of truth for what the report *says*; this module only
 * places that content on the page.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  buildCanonicalReportSections,
  formatDateOnly,
  formatEntryPath,
  NOT_RECORDED_ASSESSMENT,
  reportFilename,
} from './sections.ts';
import type { CanonicalReportData } from './types.ts';

const PAGE_MARGIN_MM = 20;
const TITLE_SIZE = 14;
const HEADING_SIZE = 11;
const BODY_SIZE = 10.5;
const BODY_LEADING_MM = 5;
const TABLE_BODY_SIZE = 9.5;
const HEADER_FOOTER_SIZE = 8;
const VERBATIM_SIZE = 10.5;
const VERBATIM_INDENT_MM = 8;
const RULE_WIDTH_MM = 0.3;

function surnameFirstName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return fullName;
  }
  const surname = parts[parts.length - 1];
  const forenames = parts.slice(0, -1).join(' ');
  return `${surname}, ${forenames}`;
}

/** jspdf-autotable attaches the last table's metadata to the doc instance
 * as `lastAutoTable` — stable across the plugin's v3-v5 API changes, but
 * not part of the typed surface, hence the narrow local cast rather than
 * `any`. */
function lastAutoTableFinalY(doc: jsPDF, fallback: number): number {
  const withTable = doc as unknown as { lastAutoTable?: { finalY?: number } };
  return withTable.lastAutoTable?.finalY ?? fallback;
}

/** Diagonal hatching confined to (x, y, w, h) via jsPDF's native path
 * clipping — draws full-length diagonals and lets the clip region do the
 * cropping, rather than hand-computing line-segment intersections. */
function drawHatchedRect(doc: jsPDF, x: number, y: number, w: number, h: number): void {
  doc.saveGraphicsState();
  doc.rect(x, y, w, h);
  doc.clip();
  doc.discardPath();

  doc.setDrawColor(190);
  doc.setLineWidth(0.15);
  const spacing = 1.6;
  for (let offset = -h; offset <= w; offset += spacing) {
    doc.line(x + offset, y + h, x + offset + h, y);
  }
  doc.restoreGraphicsState();
}

function drawMovementBand(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  hourly: Array<{ hourLabel: string; covered: boolean; activeFraction: number }>,
  baselineFraction: number
): void {
  const barGapMm = 0.4;
  const barWidth = width / hourly.length;

  doc.setDrawColor(0);
  doc.setLineWidth(RULE_WIDTH_MM);
  doc.rect(x, y, width, height);

  const baselineY = y + height - baselineFraction * height;
  doc.setLineDashPattern([1, 1], 0);
  doc.setDrawColor(120);
  doc.setLineWidth(0.2);
  doc.line(x, baselineY, x + width, baselineY);
  doc.setLineDashPattern([], 0);

  hourly.forEach((bucket, i) => {
    const barX = x + i * barWidth;
    if (!bucket.covered) {
      drawHatchedRect(doc, barX, y, barWidth, height);
      return;
    }
    const barHeight = Math.max(0.8, bucket.activeFraction * height);
    doc.setFillColor(70, 70, 70);
    doc.rect(barX + barGapMm / 2, y + height - barHeight, Math.max(0, barWidth - barGapMm), barHeight, 'F');
  });

  doc.setFont('times', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(90);
  doc.text('24 hours ago', x, y + height + 4);
  doc.text('now', x + width, y + height + 4, { align: 'right' });
  doc.setTextColor(0);
}

export function buildCanonicalReportPdf(data: CanonicalReportData): jsPDF {
  const sections = buildCanonicalReportSections(data);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.setFont('times', 'normal');

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - PAGE_MARGIN_MM * 2;
  const contentBottom = pageHeight - PAGE_MARGIN_MM;

  let y = PAGE_MARGIN_MM;

  function ensureSpace(height: number): void {
    if (y + height > contentBottom) {
      doc.addPage();
      y = PAGE_MARGIN_MM;
    }
  }

  function drawHeading(text: string, reserveBelow = 0): void {
    ensureSpace(12 + reserveBelow);
    doc.setFont('times', 'bold');
    doc.setFontSize(HEADING_SIZE);
    doc.setTextColor(0);
    doc.text(text, PAGE_MARGIN_MM, y);
    y += 2;
    doc.setLineWidth(RULE_WIDTH_MM);
    doc.setDrawColor(0);
    doc.line(PAGE_MARGIN_MM, y, pageWidth - PAGE_MARGIN_MM, y);
    y += 6;
  }

  function drawParagraph(text: string, options: { italic?: boolean; indent?: number; size?: number } = {}): void {
    doc.setFont('times', options.italic ? 'italic' : 'normal');
    doc.setFontSize(options.size ?? BODY_SIZE);
    const indent = options.indent ?? 0;
    const lines = doc.splitTextToSize(text, contentWidth - indent) as string[];
    for (const line of lines) {
      ensureSpace(BODY_LEADING_MM);
      doc.text(line, PAGE_MARGIN_MM + indent, y);
      y += BODY_LEADING_MM;
    }
  }

  function drawBoldLine(text: string): void {
    ensureSpace(BODY_LEADING_MM);
    doc.setFont('times', 'bold');
    doc.setFontSize(BODY_SIZE);
    doc.text(text, PAGE_MARGIN_MM, y);
    y += BODY_LEADING_MM;
    doc.setFont('times', 'normal');
  }

  // Title block (once, top of page 1) — the running header (added at the
  // end, on every page) is a slimmer identification strip, not a repeat of
  // this.
  doc.setFont('times', 'bold');
  doc.setFontSize(TITLE_SIZE);
  doc.text(sections.documentTitle.toUpperCase(), PAGE_MARGIN_MM, y);
  y += 7;
  doc.setFont('times', 'normal');
  doc.setFontSize(BODY_SIZE);
  doc.text(sections.generatedLine, PAGE_MARGIN_MM, y);
  y += 9;

  drawHeading('1. Patient identification');
  sections.patientIdentification.forEach((line) => drawParagraph(line));
  y += 3;

  drawHeading('2. Reason for contact');
  sections.reasonForContact.forEach((line) => drawParagraph(line));
  y += 3;

  drawHeading('3. Red flag responses', 30);
  const redFlagRows: Array<[string, string, string]> = [];
  sections.redFlagEntries.forEach((entry) => {
    redFlagRows.push([entry.question, entry.answer === 'yes' ? 'Yes' : 'No', entry.detail ?? '']);
    entry.followUps?.forEach((followUp) => {
      redFlagRows.push([`   — ${followUp.question}`, '', followUp.answer]);
    });
  });
  autoTable(doc, {
    startY: y,
    margin: { left: PAGE_MARGIN_MM, right: PAGE_MARGIN_MM },
    head: [['Question', 'Answer', 'Detail']],
    body: redFlagRows,
    theme: 'grid',
    styles: { font: 'times', fontSize: TABLE_BODY_SIZE, lineWidth: RULE_WIDTH_MM, lineColor: 0, textColor: 0 },
    headStyles: { font: 'times', fontStyle: 'bold', fillColor: 255, textColor: 0, lineWidth: RULE_WIDTH_MM, lineColor: 0 },
  });
  y = lastAutoTableFinalY(doc, y) + 8;

  drawHeading("4. Patient's description");
  if (sections.description.structuredParagraphs.length > 0) {
    sections.description.structuredParagraphs.forEach((paragraph) => drawParagraph(paragraph));
  } else if (sections.description.rawFallback) {
    drawParagraph(sections.description.rawFallback);
  } else {
    drawParagraph('(No description provided.)');
  }
  if (sections.description.verbatimHighlights.length > 0) {
    y += 2;
    sections.description.verbatimHighlights.forEach((quote) => {
      drawParagraph(`"${quote}"`, { italic: true, indent: VERBATIM_INDENT_MM, size: VERBATIM_SIZE });
    });
  }
  y += 3;

  const bandHeight = 26;
  drawHeading('5. Fetal movement record (preceding 24 hours)', bandHeight + 20);
  drawMovementBand(
    doc,
    PAGE_MARGIN_MM,
    y,
    contentWidth,
    bandHeight,
    sections.hourlyBuckets,
    sections.movementFigures.baselineFraction
  );
  // Clears the band's own "24 hours ago" / "now" axis labels (drawn at
  // bandHeight+4 inside drawMovementBand) with real room to spare — too
  // tight a gap here is what caused the caption to visually collide with
  // those labels during review.
  y += bandHeight + 10;
  drawParagraph(
    'Grey diagonal hatching marks hours with no sensor data — an absence of data, not a still baby.',
    { italic: true, size: HEADER_FOOTER_SIZE }
  );
  y += 1;
  const figures = sections.movementFigures;
  drawParagraph(
    `Active fraction: ${(figures.activeFraction * 100).toFixed(0)}% (her baseline: ${(figures.baselineFraction * 100).toFixed(0)}%).`
  );
  drawParagraph(
    figures.quietInterval
      ? `Longest quiet interval: ${figures.quietInterval.durationMinutes} minutes (uncertainty ±${figures.quietInterval.uncertaintyMinutes} minutes, from the sensor's miss rate).`
      : 'Longest quiet interval: none identified in this window.'
  );
  drawParagraph(`Coverage: ${figures.coveragePercent.toFixed(0)}% of the preceding 24 hours.`);
  y += 3;

  drawHeading('6. Perception context');
  drawParagraph(sections.perceptionContext.sensorParagraph);
  drawParagraph(sections.perceptionContext.selfReportParagraph);
  y += 3;

  drawHeading('7. History and previous episodes', 18);
  sections.onboardingParagraphs.forEach((paragraph) => drawParagraph(paragraph));
  y += 2;
  drawBoldLine(`Contacts in this pregnancy so far: ${sections.recurrenceCount}`);
  y += 1;

  if (sections.priorEpisodes.length > 0) {
    const priorRows = sections.priorEpisodes.map((episode) => [
      formatDateOnly(episode.date),
      formatEntryPath(episode.entryPath),
      episode.disposition ?? 'Not recorded',
      NOT_RECORDED_ASSESSMENT,
    ]);
    autoTable(doc, {
      startY: y,
      margin: { left: PAGE_MARGIN_MM, right: PAGE_MARGIN_MM },
      head: [['Date', 'Entry route', 'Outcome', 'Assessment']],
      body: priorRows,
      theme: 'grid',
      styles: { font: 'times', fontSize: TABLE_BODY_SIZE, lineWidth: RULE_WIDTH_MM, lineColor: 0, textColor: 0 },
      headStyles: { font: 'times', fontStyle: 'bold', fillColor: 255, textColor: 0, lineWidth: RULE_WIDTH_MM, lineColor: 0 },
    });
    y = lastAutoTableFinalY(doc, y) + 8;
  } else {
    drawParagraph('No previous episodes recorded in this pregnancy.');
    y += 3;
  }

  drawHeading('8. Data provenance and limitations');
  sections.disclaimerParagraphs.forEach((paragraph) => drawParagraph(paragraph));

  applyRunningHeaderFooter(doc, data, pageWidth, pageHeight);

  return doc;
}

function applyRunningHeaderFooter(
  doc: jsPDF,
  data: CanonicalReportData,
  pageWidth: number,
  pageHeight: number
): void {
  const totalPages = doc.getNumberOfPages();
  const identityLine = `${surnameFirstName(data.patientName)} · DOB ${formatDateOnly(data.dateOfBirth)} · ${
    data.clinicReference ?? 'no clinic ref'
  }`;

  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setFont('times', 'normal');
    doc.setFontSize(HEADER_FOOTER_SIZE);
    doc.setTextColor(90);

    doc.text('HELD — MATERNITY CONTACT REPORT', PAGE_MARGIN_MM, 10);
    doc.text(data.clinicName, pageWidth - PAGE_MARGIN_MM, 10, { align: 'right' });
    doc.setLineWidth(RULE_WIDTH_MM);
    doc.setDrawColor(170);
    doc.line(PAGE_MARGIN_MM, 12, pageWidth - PAGE_MARGIN_MM, 12);

    const footerRuleY = pageHeight - 13;
    doc.line(PAGE_MARGIN_MM, footerRuleY, pageWidth - PAGE_MARGIN_MM, footerRuleY);
    doc.text(`${identityLine} · Page ${page} of ${totalPages}`, PAGE_MARGIN_MM, pageHeight - 10);

    doc.setTextColor(0);
  }
}

/** Builds and returns the PDF as a Blob, ready for Storage upload — this
 * module never triggers a browser download itself (unlike the frontend's
 * own downloadReportPdf); that's storeReport()'s job in the backend. */
export function buildCanonicalReportPdfBlob(data: CanonicalReportData): Blob {
  const doc = buildCanonicalReportPdf(data);
  return doc.output('blob');
}

export { reportFilename };
