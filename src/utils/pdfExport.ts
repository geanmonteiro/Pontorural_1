import html2pdf from 'html2pdf.js';

const ISOLATED_A4_CSS = `
  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: #ffffff !important;
    color: #000000 !important;
  }
  .a4-sheet {
    width: 210mm;
    height: 296mm;
    background-color: #ffffff;
    color: #000000;
    font-family: Arial, Helvetica, sans-serif;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .a4-sheet table {
    border-collapse: collapse;
    width: 100%;
    color: #000000;
  }
  .a4-sheet td,
  .a4-sheet th {
    border: 1px solid #000000;
    box-sizing: border-box;
  }
  .a4-row-shaded {
    background-color: #bfbfbf !important;
  }
`;

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

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 16));
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException('Exportação de PDF cancelada pelo usuário.', 'AbortError');
  }
}

export async function exportA4SheetsToPdf(params: {
  sheetElements: HTMLElement[];
  sheetLabels?: string[];
  filename: string;
  signal?: AbortSignal;
  onProgress?: (progress: PdfExportProgress) => void;
}): Promise<void> {
  const { sheetElements, sheetLabels = [], filename, signal, onProgress } = params;
  const total = sheetElements.length;
  if (total === 0) {
    throw new Error('Nenhuma folha selecionada para exportação.');
  }

  throwIfAborted(signal);

  const completedIndexes: number[] = [];
  onProgress?.({
    stage: 'preparing',
    current: 0,
    total,
    currentLabel: sheetLabels[0],
    completedIndexes: [],
  });
  await yieldToUi();
  throwIfAborted(signal);

  const baseOptions = {
    margin: 0,
    filename,
    image: { type: 'png' as const, quality: 1 },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait' as const,
    },
    html2canvas: {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      scrollX: 0,
      scrollY: 0,
      onclone: (clonedDoc: Document) => {
        // Strip Tailwind v4 oklch styles so html2canvas renders pure hex A4 sheet cleanly
        clonedDoc.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
          node.remove();
        });
        const cleanStyle = clonedDoc.createElement('style');
        cleanStyle.textContent = ISOLATED_A4_CSS;
        clonedDoc.head.appendChild(cleanStyle);

        const exportRoot = clonedDoc.querySelector<HTMLElement>('[data-pdf-export-root="true"]');
        if (exportRoot) {
          exportRoot.style.position = 'static';
          exportRoot.style.left = '0';
          exportRoot.style.top = '0';
        }
      },
    },
  };

  onProgress?.({
    stage: 'rendering',
    current: 1,
    total,
    currentLabel: sheetLabels[0],
    completedIndexes: [...completedIndexes],
  });
  await yieldToUi();
  throwIfAborted(signal);

  // Build PDF page-by-page using html2pdf worker so large batches never hit canvas max-height limits
  const firstWorker = html2pdf().set(baseOptions).from(sheetElements[0]).toPdf();
  const pdf = await firstWorker.get('pdf');
  completedIndexes.push(0);
  throwIfAborted(signal);

  for (let i = 1; i < total; i++) {
    onProgress?.({
      stage: 'rendering',
      current: i + 1,
      total,
      currentLabel: sheetLabels[i],
      completedIndexes: [...completedIndexes],
    });
    await yieldToUi();
    throwIfAborted(signal);

    const canvas: HTMLCanvasElement = await html2pdf()
      .set(baseOptions)
      .from(sheetElements[i])
      .toCanvas()
      .get('canvas');

    throwIfAborted(signal);

    const imgData = canvas.toDataURL('image/png');
    pdf.addPage('a4', 'portrait');
    pdf.addImage(imgData, 'PNG', 0, 0, 210, 297);
    completedIndexes.push(i);
  }

  onProgress?.({
    stage: 'assembling',
    current: total,
    total,
    completedIndexes: [...completedIndexes],
  });
  await yieldToUi();
  throwIfAborted(signal);

  onProgress?.({
    stage: 'saving',
    current: total,
    total,
    completedIndexes: [...completedIndexes],
  });
  await yieldToUi();

  pdf.save(filename);
}
