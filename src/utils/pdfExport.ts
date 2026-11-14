import { jsPDF } from 'jspdf';
import {
  Company,
  Employee,
  GeneratedDayRow,
  PrintCalibration,
  Schedule,
} from '../types/timesheet';
import { formatDateBr, formatMonthYearPt } from './holidays';

export function sanitizeFilename(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

export type PdfExportStage = 'preparing' | 'rendering' | 'assembling' | 'saving';

export interface PdfExportProgress {
  stage: PdfExportStage;
  current: number;
  total: number;
  currentLabel?: string;
  completedIndexes: number[];
}

export interface TimesheetPdfSheetInput {
  employee: Employee;
  schedule?: Schedule;
  rows: GeneratedDayRow[];
}

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const PT_TO_MM = 0.352778;
const BORDER_WIDTH_MM = 0.25;

// Exact 15-column percentages matching TimesheetA4Sheet.tsx
const COL_PCTS = [
  4.2, // 0: Dia Mês
  4.8, // 1: Dia Sem
  7.2, // 2: Manhã Entrada 1
  7.2, // 3: Manhã Saída 1
  5.2, // 4: Manhã Entrada 2 ("Folga")
  5.2, // 5: Manhã Saída 2 ("12:00" / "Feriado")
  5.2, // 6: Tarde Entrada 1 ("13:00")
  5.2, // 7: Tarde Saída 1
  7.2, // 8: Tarde Entrada 2
  7.2, // 9: Tarde Saída 2
  5.2, // 10: HE Manhã Entrada
  5.2, // 11: HE Manhã Saída
  5.2, // 12: HE Tarde Entrada
  5.2, // 13: HE Tarde Saída
  20.6, // 14: Assinatura do Empregado
] as const;

function yieldToUi(ms = 8): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException('Exportação de PDF cancelada pelo usuário.', 'AbortError');
  }
}

function fitFontSize(
  doc: jsPDF,
  text: string,
  maxWidthMm: number,
  targetPt: number,
  fontStyle: 'normal' | 'bold',
  minPt = 5.4
): number {
  if (!text) return targetPt;
  doc.setFont('helvetica', fontStyle);
  doc.setFontSize(targetPt);
  const measured = doc.getTextWidth(text);
  if (measured <= maxWidthMm || measured <= 0) {
    return targetPt;
  }
  const scaled = (targetPt * maxWidthMm) / measured;
  return Math.max(minPt, Math.floor(scaled * 10) / 10);
}

function drawCenteredText(
  doc: jsPDF,
  text: string,
  cellX: number,
  cellY: number,
  cellW: number,
  cellH: number,
  fontPt: number,
  fontStyle: 'normal' | 'bold' = 'normal',
  horizontalPadMm = 0.45
) {
  if (!text) return;
  const maxWidth = Math.max(2, cellW - horizontalPadMm * 2);
  const fittedPt = fitFontSize(doc, text, maxWidth, fontPt, fontStyle);
  doc.setFont('helvetica', fontStyle);
  doc.setFontSize(fittedPt);
  doc.text(text, cellX + cellW / 2, cellY + cellH / 2, {
    align: 'center',
    baseline: 'middle',
  });
}

interface WrappedHeaderRowSpec {
  type: 'full' | 'split';
  leftText: string;
  leftBold?: boolean;
  rightText?: string;
  rightBold?: boolean;
}

interface MeasuredHeaderRow {
  spec: WrappedHeaderRowSpec;
  leftLines: string[];
  rightLines: string[];
  heightMm: number;
}

function measureHeaderRows(
  doc: jsPDF,
  specs: WrappedHeaderRowSpec[],
  printableWidthMm: number,
  headerFontPt: number
): MeasuredHeaderRow[] {
  const padX = 1.6;
  const padY = 1.05;
  const lineStepMm = headerFontPt * PT_TO_MM * 1.24;
  const leftColW = printableWidthMm * 0.58;
  const rightColW = printableWidthMm * 0.42;

  return specs.map((spec) => {
    if (spec.type === 'full') {
      doc.setFont('helvetica', spec.leftBold ? 'bold' : 'normal');
      doc.setFontSize(headerFontPt);
      const maxTextW = Math.max(10, printableWidthMm - padX * 2);
      const leftLines = doc.splitTextToSize(spec.leftText, maxTextW) as string[];
      const lineCount = Math.max(1, leftLines.length);
      const heightMm = lineCount * lineStepMm + padY * 2;
      return { spec, leftLines, rightLines: [], heightMm };
    }

    doc.setFont('helvetica', spec.leftBold ? 'bold' : 'normal');
    doc.setFontSize(headerFontPt);
    const leftLines = doc.splitTextToSize(
      spec.leftText,
      Math.max(10, leftColW - padX * 2)
    ) as string[];

    doc.setFont('helvetica', spec.rightBold ? 'bold' : 'normal');
    doc.setFontSize(headerFontPt);
    const rightLines = doc.splitTextToSize(
      spec.rightText ?? '',
      Math.max(10, rightColW - padX * 2)
    ) as string[];

    const maxLines = Math.max(1, leftLines.length, rightLines.length);
    const heightMm = maxLines * lineStepMm + padY * 2;
    return { spec, leftLines, rightLines, heightMm };
  });
}

function drawMultilineLeftText(
  doc: jsPDF,
  lines: string[],
  cellX: number,
  cellY: number,
  cellH: number,
  fontPt: number,
  bold: boolean,
  padX = 1.6
) {
  if (lines.length === 0) return;
  const lineStepMm = fontPt * PT_TO_MM * 1.24;
  const firstLineCenterY =
    cellY + cellH / 2 - ((lines.length - 1) * lineStepMm) / 2;

  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(fontPt);

  lines.forEach((line, idx) => {
    doc.text(line, cellX + padX, firstLineCenterY + idx * lineStepMm, {
      align: 'left',
      baseline: 'middle',
    });
  });
}

function renderTimesheetPage(
  doc: jsPDF,
  params: {
    company: Company;
    sheet: TimesheetPdfSheetInput;
    year: number;
    month: number;
    calibration: PrintCalibration;
  }
) {
  const { company, sheet, year, month, calibration } = params;
  const { employee, schedule, rows } = sheet;

  const marginLeft = calibration.marginSideMm;
  const marginTop = calibration.marginTopMm;
  const marginBottom = calibration.marginBottomMm;
  const printableW = A4_WIDTH_MM - marginLeft * 2;
  const maxBottomY = A4_HEIGHT_MM - marginBottom;

  const monthYearLabel = formatMonthYearPt(year, month);
  const admissionLabel = formatDateBr(employee.admissionDate);
  const scheduleDesc =
    schedule?.descriptionText || '07:00 AS 12:00 / 13:00 AS 17:00';

  const headerSpecs: WrappedHeaderRowSpec[] = [
    {
      type: 'full',
      leftText: `EMPREGADOR: ${company.name} - ${company.cnpj}`,
      leftBold: true,
    },
    {
      type: 'full',
      leftText: `Endereço: ${company.address}`,
    },
    {
      type: 'full',
      leftText: `Nome do Empregado: ${employee.name}`,
      leftBold: true,
    },
    {
      type: 'split',
      leftText: `Cargo: ${employee.role}`,
      rightText: `CPF: ${employee.cpf}`,
    },
    {
      type: 'split',
      leftText: `Nº de Registro do Empregado: ${employee.registrationNumber}`,
      rightText: `Admissão: ${admissionLabel}`,
    },
    {
      type: 'full',
      leftText: `Jornada de Trabalho: ${scheduleDesc}`,
    },
    {
      type: 'full',
      leftText: `MÊS E ANO: ${monthYearLabel}`,
      leftBold: true,
    },
  ];

  const measuredHeaders = measureHeaderRows(
    doc,
    headerSpecs,
    printableW,
    calibration.headerFontPt
  );
  const totalHeaderH = measuredHeaders.reduce((sum, r) => sum + r.heightMm, 0);

  const th1H = 4.4;
  const th2H = 4.4;
  const th3H = 4.5;
  const totalTableHeadH = th1H + th2H + th3H;
  const sigRowH = 13;

  // Keep calibrated day row height unless custom margins + wrapped headers exceed A4 height
  const fixedVerticalH = totalHeaderH + totalTableHeadH + sigRowH;
  const availableForDays = Math.max(90, maxBottomY - marginTop - fixedVerticalH);
  const desiredDaysH = rows.length * calibration.rowHeightMm;
  const dayRowH =
    desiredDaysH <= availableForDays
      ? calibration.rowHeightMm
      : Math.floor((availableForDays / Math.max(1, rows.length)) * 100) / 100;

  // Common stroke & text setup
  doc.setDrawColor(0, 0, 0);
  doc.setTextColor(0, 0, 0);
  doc.setLineWidth(BORDER_WIDTH_MM);

  // 1. Render Header Table
  const leftSplitW = printableW * 0.58;
  const rightSplitW = printableW * 0.42;
  let cursorY = marginTop;

  for (const row of measuredHeaders) {
    if (row.spec.type === 'full') {
      doc.rect(marginLeft, cursorY, printableW, row.heightMm, 'S');
      drawMultilineLeftText(
        doc,
        row.leftLines,
        marginLeft,
        cursorY,
        row.heightMm,
        calibration.headerFontPt,
        Boolean(row.spec.leftBold)
      );
    } else {
      doc.rect(marginLeft, cursorY, leftSplitW, row.heightMm, 'S');
      doc.rect(marginLeft + leftSplitW, cursorY, rightSplitW, row.heightMm, 'S');
      drawMultilineLeftText(
        doc,
        row.leftLines,
        marginLeft,
        cursorY,
        row.heightMm,
        calibration.headerFontPt,
        Boolean(row.spec.leftBold)
      );
      drawMultilineLeftText(
        doc,
        row.rightLines,
        marginLeft + leftSplitW,
        cursorY,
        row.heightMm,
        calibration.headerFontPt,
        Boolean(row.spec.rightBold)
      );
    }
    cursorY += row.heightMm;
  }

  // 2. Precompute 15 column geometries
  const colW = COL_PCTS.map((pct) => (pct / 100) * printableW);
  const colX: number[] = [];
  let accX = marginLeft;
  for (let i = 0; i < colW.length; i++) {
    colX.push(accX);
    accX += colW[i];
  }

  const spanW = (startCol: number, count: number) => {
    let total = 0;
    for (let i = 0; i < count; i++) total += colW[startCol + i];
    return total;
  };

  // 3. Render Main Table 3-Row Header
  const headTopY = cursorY;
  const row12H = th1H + th2H;
  const row123H = th1H + th2H + th3H;
  const tableFontPt = calibration.tableFontPt;

  // Row 1+2 merged headers
  const headMergedTop: Array<{
    x: number;
    y: number;
    w: number;
    h: number;
    label: string;
  }> = [
    { x: colX[0], y: headTopY, w: colW[0], h: row12H, label: 'Dia' },
    { x: colX[1], y: headTopY, w: colW[1], h: row12H, label: 'Dia' },
    { x: colX[2], y: headTopY, w: spanW(2, 4), h: row12H, label: 'MANHÃ' },
    { x: colX[6], y: headTopY, w: spanW(6, 4), h: row12H, label: 'TARDE' },
    {
      x: colX[10],
      y: headTopY,
      w: spanW(10, 4),
      h: th1H,
      label: 'Horas Extras',
    },
    {
      x: colX[10],
      y: headTopY + th1H,
      w: spanW(10, 2),
      h: th2H,
      label: 'MANHÃ',
    },
    {
      x: colX[12],
      y: headTopY + th1H,
      w: spanW(12, 2),
      h: th2H,
      label: 'TARDE',
    },
  ];

  for (const box of headMergedTop) {
    doc.rect(box.x, box.y, box.w, box.h, 'S');
    drawCenteredText(doc, box.label, box.x, box.y, box.w, box.h, tableFontPt);
  }

  // Col 14 ("Assinatura do Empregado") spans all 3 table header rows
  doc.rect(colX[14], headTopY, colW[14], row123H, 'S');
  drawCenteredText(
    doc,
    'Assinatura do Empregado',
    colX[14],
    headTopY,
    colW[14],
    row123H,
    tableFontPt,
    'normal',
    1.0
  );

  // Row 3 sub-column labels (cols 0..13)
  const subLabels = [
    'Mês',
    'Sem',
    'Entrada',
    'Saída',
    'Entrada',
    'Saída',
    'Entrada',
    'Saída',
    'Entrada',
    'Saída',
    'Entrada',
    'Saída',
    'Entrada',
    'Saída',
  ];
  const subRowY = headTopY + row12H;
  for (let c = 0; c < subLabels.length; c++) {
    doc.rect(colX[c], subRowY, colW[c], th3H, 'S');
    drawCenteredText(
      doc,
      subLabels[c],
      colX[c],
      subRowY,
      colW[c],
      th3H,
      tableFontPt,
      'normal',
      0.4
    );
  }

  cursorY = headTopY + totalTableHeadH;

  // 4. Render Day Rows
  for (const row of rows) {
    if (row.shaded) {
      doc.setFillColor(191, 191, 191);
      doc.rect(marginLeft, cursorY, printableW, dayRowH, 'F');
    }

    // Crisp outer row border + 14 vertical cell dividers
    doc.rect(marginLeft, cursorY, printableW, dayRowH, 'S');
    for (let c = 1; c < colX.length; c++) {
      doc.line(colX[c], cursorY, colX[c], cursorY + dayRowH);
    }

    drawCenteredText(doc, row.dayKey, colX[0], cursorY, colW[0], dayRowH, tableFontPt);
    drawCenteredText(
      doc,
      row.weekdayShort,
      colX[1],
      cursorY,
      colW[1],
      dayRowH,
      tableFontPt
    );
    if (row.col5Text) {
      drawCenteredText(
        doc,
        row.col5Text,
        colX[4],
        cursorY,
        colW[4],
        dayRowH,
        tableFontPt,
        'normal',
        0.35
      );
    }
    if (row.col6Text) {
      drawCenteredText(
        doc,
        row.col6Text,
        colX[5],
        cursorY,
        colW[5],
        dayRowH,
        tableFontPt,
        'normal',
        0.35
      );
    }
    if (row.col7Text) {
      drawCenteredText(
        doc,
        row.col7Text,
        colX[6],
        cursorY,
        colW[6],
        dayRowH,
        tableFontPt,
        'normal',
        0.35
      );
    }

    cursorY += dayRowH;
  }

  // 5. Render Bottom Signature Row (13mm height)
  const leftSigW = spanW(0, 10); // cols 0..9 = 60.2%
  const rightSigW = spanW(10, 5); // cols 10..14 = 39.8%

  doc.rect(marginLeft, cursorY, leftSigW, sigRowH, 'S');
  doc.rect(colX[10], cursorY, rightSigW, sigRowH, 'S');

  const sigLineW = leftSigW * 0.66;
  const sigLineX = marginLeft + (leftSigW - sigLineW) / 2;
  const sigBottomY = cursorY + sigRowH;
  const sigLineY = sigBottomY - 4.4;

  doc.line(sigLineX, sigLineY, sigLineX + sigLineW, sigLineY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(calibration.headerFontPt);
  doc.text(
    'ASSINATURA DO EMPREGADO',
    marginLeft + leftSigW / 2,
    sigBottomY - 2.2,
    {
      align: 'center',
      baseline: 'middle',
    }
  );
}

export async function exportTimesheetSheetsToPdf(params: {
  company: Company;
  sheets: TimesheetPdfSheetInput[];
  year: number;
  month: number;
  calibration: PrintCalibration;
  filename: string;
  signal?: AbortSignal;
  onProgress?: (progress: PdfExportProgress) => void;
}): Promise<void> {
  const {
    company,
    sheets,
    year,
    month,
    calibration,
    filename,
    signal,
    onProgress,
  } = params;

  const total = sheets.length;
  if (total === 0) {
    throw new Error('Nenhuma folha selecionada para exportação.');
  }

  throwIfAborted(signal);

  const completedIndexes: number[] = [];
  onProgress?.({
    stage: 'preparing',
    current: 0,
    total,
    currentLabel: sheets[0]?.employee.name,
    completedIndexes: [],
  });
  await yieldToUi(12);
  throwIfAborted(signal);

  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation: 'portrait',
    compress: true,
  });

  const yieldEvery = total > 20 ? 4 : 1;

  for (let i = 0; i < total; i++) {
    throwIfAborted(signal);

    onProgress?.({
      stage: 'rendering',
      current: i + 1,
      total,
      currentLabel: sheets[i].employee.name,
      completedIndexes: [...completedIndexes],
    });

    if (i > 0) {
      doc.addPage('a4', 'portrait');
    }

    renderTimesheetPage(doc, {
      company,
      sheet: sheets[i],
      year,
      month,
      calibration,
    });

    completedIndexes.push(i);

    if (i % yieldEvery === 0 || i === total - 1) {
      await yieldToUi(total > 20 ? 4 : 10);
      throwIfAborted(signal);
    }
  }

  onProgress?.({
    stage: 'assembling',
    current: total,
    total,
    completedIndexes: [...completedIndexes],
  });
  await yieldToUi(16);
  throwIfAborted(signal);

  onProgress?.({
    stage: 'saving',
    current: total,
    total,
    completedIndexes: [...completedIndexes],
  });
  await yieldToUi(16);

  doc.save(filename);
}
