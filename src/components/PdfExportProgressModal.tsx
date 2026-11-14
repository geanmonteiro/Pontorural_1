import React from 'react';
import { Check, FileText, Loader2 } from 'lucide-react';
import { PdfExportProgress } from '../utils/pdfExport';

interface PdfExportProgressModalProps {
  open: boolean;
  progress: PdfExportProgress | null;
  sheetNames: string[];
  periodLabel: string;
  onCancel: () => void;
}

const STAGE_TITLES: Record<PdfExportProgress['stage'], string> = {
  preparing: 'Preparando folhas A4 e layout vetorial...',
  rendering: 'Gerando páginas vetoriais em alta definição...',
  assembling: 'Montando documento PDF final...',
  saving: 'Iniciando download do arquivo...',
};

export const PdfExportProgressModal: React.FC<PdfExportProgressModalProps> = ({
  open,
  progress,
  sheetNames,
  periodLabel,
  onCancel,
}) => {
  if (!open || !progress) return null;

  const total = Math.max(progress.total, 1);
  const completedCount = progress.completedIndexes.length;
  const percent =
    progress.stage === 'saving' || progress.stage === 'assembling'
      ? 100
      : Math.min(99, Math.round((completedCount / total) * 100));

  const stageDetail =
    progress.stage === 'rendering' && progress.currentLabel
      ? `Renderizando folha ${progress.current} de ${total}: ${progress.currentLabel}`
      : STAGE_TITLES[progress.stage];

  const canCancel = progress.stage !== 'saving';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-export-modal-title"
      className="no-print fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-[1px] flex items-center justify-center p-4"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full p-6 space-y-5 shadow-lg">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200/70 flex items-center justify-center shrink-0">
              <Loader2 className="w-5 h-5 text-emerald-700 animate-spin" />
            </div>
            <div className="min-w-0">
              <h2
                id="pdf-export-modal-title"
                className="font-display text-base font-bold text-slate-900"
              >
                {total > 1 ? 'Gerando PDF em Lote' : 'Gerando Folha em PDF'}
              </h2>
              <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span>{periodLabel}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular">
                  {total} {total === 1 ? 'folha A4' : 'folhas A4'}
                </span>
              </div>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="font-mono-tabular text-lg font-bold text-slate-900">{percent}%</div>
            <div className="font-mono-tabular text-xs text-slate-500">
              {completedCount}/{total} concluídas
            </div>
          </div>
        </div>

        {/* Barra de Progresso + Etapa Atual */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="font-medium text-slate-800 truncate">{stageDetail}</span>
            <span className="font-mono-tabular text-slate-500 shrink-0">
              Página {Math.min(progress.current || 1, total)}/{total}
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden"
          >
            <div
              className="h-full w-full bg-emerald-700 origin-left transition-transform duration-200 ease-out"
              style={{ transform: `scaleX(${Math.max(0.03, percent / 100)})` }}
            />
          </div>
        </div>

        {/* Skeleton da Folha A4 + Fila por Funcionário */}
        <div className="flex flex-col sm:flex-row gap-4 items-stretch">
          {/* Miniatura Skeleton A4 */}
          <div
            aria-hidden="true"
            className="hidden sm:flex w-28 aspect-[210/297] rounded-lg border border-slate-200 bg-slate-50 p-2.5 flex-col justify-between shrink-0"
          >
            <div className="space-y-1.5">
              <div className="h-2 w-full bg-slate-200 rounded animate-pulse" />
              <div className="h-1.5 w-4/5 bg-slate-200 rounded animate-pulse" />
              <div className="h-1.5 w-3/5 bg-slate-200 rounded animate-pulse" />
            </div>
            <div className="space-y-1 py-1 border-y border-slate-200/80">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1.5 w-full rounded animate-pulse ${
                    idx % 3 === 2 ? 'bg-slate-300' : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center justify-center gap-1 pt-0.5 text-[10px] font-mono-tabular text-slate-500">
              <FileText className="w-3 h-3 text-slate-400" />
              <span>A4</span>
            </div>
          </div>

          {/* Lista de folhas na fila */}
          <div className="flex-1 min-w-0 border border-slate-200 rounded-lg overflow-hidden bg-white">
            <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 text-xs font-semibold text-slate-600 flex items-center justify-between">
              <span>Progresso por colaborador</span>
              <span className="font-mono-tabular text-slate-500">
                {completedCount}/{total}
              </span>
            </div>
            <ul className="divide-y divide-slate-100 max-h-44 overflow-y-auto text-xs">
              {sheetNames.map((name, idx) => {
                const isDone = progress.completedIndexes.includes(idx);
                const isActive =
                  !isDone &&
                  progress.stage === 'rendering' &&
                  progress.current === idx + 1;

                return (
                  <li
                    key={`${idx}-${name}`}
                    className={`px-3 py-2 flex items-center justify-between gap-3 ${
                      isActive ? 'bg-emerald-50/60' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isDone ? (
                        <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      ) : isActive ? (
                        <Loader2 className="w-3.5 h-3.5 text-emerald-700 animate-spin shrink-0" />
                      ) : (
                        <span className="w-3.5 h-2 rounded bg-slate-200 animate-pulse shrink-0" />
                      )}
                      <span
                        className={`truncate ${
                          isDone
                            ? 'text-slate-700'
                            : isActive
                            ? 'font-semibold text-slate-900'
                            : 'text-slate-500'
                        }`}
                      >
                        {name}
                      </span>
                    </div>

                    <span
                      className={`font-mono-tabular shrink-0 ${
                        isDone
                          ? 'text-emerald-700 font-medium'
                          : isActive
                          ? 'text-emerald-800 font-medium'
                          : 'text-slate-400'
                      }`}
                    >
                      {isDone ? 'Pronta' : isActive ? 'Gerando...' : 'Na fila'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            Mantenha esta guia aberta até o download do PDF iniciar.
          </p>
          <button
            type="button"
            disabled={!canCancel}
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};
