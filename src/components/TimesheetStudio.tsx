import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Loader2,
  Printer,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  Company,
  CustomHoliday,
  DEFAULT_PRINT_CALIBRATION,
  DayOverrideEntry,
  DayOverrideStatus,
  Employee,
  GeneratedDayRow,
  MonthOverride,
  PrintCalibration,
  Schedule,
} from '../types/timesheet';
import {
  MONTH_NAMES_PT,
  formatMonthYearPt,
  formatYearMonthKey,
  getMonthCalendarRows,
} from '../utils/holidays';
import {
  PdfExportProgress,
  exportA4SheetsToPdf,
  sanitizeFilename,
} from '../utils/pdfExport';
import { PdfExportProgressModal } from './PdfExportProgressModal';
import { TimesheetA4Sheet } from './TimesheetA4Sheet';

interface TimesheetStudioProps {
  activeCompany: Company | null;
  schedules: Schedule[];
  employees: Employee[];
  customHolidays: CustomHoliday[];
  monthOverrides: MonthOverride[];
  includeFacultativos: boolean;
  onToggleFacultativos: (val: boolean) => void;
  initialFocusEmployeeId?: string | null;
  onSaveDayOverride: (params: {
    companyId: string;
    yearMonth: string;
    targetId: string;
    dayKey: string;
    entry: DayOverrideEntry | null;
  }) => Promise<void>;
  onClearMonthOverrides: (
    companyId: string,
    yearMonth: string,
    targetId: string
  ) => Promise<void>;
  onGoToCompanies: () => void;
  onGoToEmployees: () => void;
  onSeedExample?: () => Promise<void>;
}

export const TimesheetStudio: React.FC<TimesheetStudioProps> = ({
  activeCompany,
  schedules,
  employees,
  customHolidays,
  monthOverrides,
  includeFacultativos,
  onToggleFacultativos,
  initialFocusEmployeeId,
  onSaveDayOverride,
  onClearMonthOverrides,
  onGoToCompanies,
  onGoToEmployees,
  onSeedExample,
}) => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1..12
  const [mode, setMode] = useState<'batch' | 'single'>('batch');
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [focusedEmployeeId, setFocusedEmployeeId] = useState<string>('');
  const [showCalibration, setShowCalibration] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportProgress, setExportProgress] = useState<PdfExportProgress | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const exportContainerRef = useRef<HTMLDivElement | null>(null);
  const exportAbortRef = useRef<AbortController | null>(null);

  const [calibration, setCalibration] = useState<PrintCalibration>(() => {
    try {
      const saved = localStorage.getItem('pontorural_print_calibration');
      return saved ? { ...DEFAULT_PRINT_CALIBRATION, ...JSON.parse(saved) } : DEFAULT_PRINT_CALIBRATION;
    } catch {
      return DEFAULT_PRINT_CALIBRATION;
    }
  });

  // Day editor state when clicking a row on the preview
  const [editingDayRow, setEditingDayRow] = useState<GeneratedDayRow | null>(null);
  const [overrideScope, setOverrideScope] = useState<'ALL' | 'EMPLOYEE'>('ALL');
  const [overrideStatus, setOverrideStatus] = useState<DayOverrideStatus>('auto');
  const [overrideMorningEnd, setOverrideMorningEnd] = useState('12:00');
  const [overrideAfternoonStart, setOverrideAfternoonStart] = useState('13:00');
  const [savingDay, setSavingDay] = useState(false);

  // Save calibration to localStorage
  useEffect(() => {
    localStorage.setItem('pontorural_print_calibration', JSON.stringify(calibration));
  }, [calibration]);

  // Sync employee selection when company or employee list changes
  useEffect(() => {
    const activeIds = employees.filter((e) => e.active).map((e) => e.id);
    setSelectedBatchIds(activeIds);

    if (initialFocusEmployeeId && employees.some((e) => e.id === initialFocusEmployeeId)) {
      setFocusedEmployeeId(initialFocusEmployeeId);
      setMode('single');
    } else if (!employees.some((e) => e.id === focusedEmployeeId)) {
      setFocusedEmployeeId(activeIds[0] ?? employees[0]?.id ?? '');
    }
  }, [employees, initialFocusEmployeeId, focusedEmployeeId]);

  const scheduleMap = useMemo(() => {
    const map = new Map<string, Schedule>();
    for (const s of schedules) map.set(s.id, s);
    return map;
  }, [schedules]);

  const yearMonthKey = formatYearMonthKey(year, month);

  const companyMonthOverrideMap = useMemo(() => {
    if (!activeCompany) return {};
    const found = monthOverrides.find(
      (m) =>
        m.companyId === activeCompany.id && m.yearMonth === yearMonthKey && m.targetId === 'ALL'
    );
    return found?.dayOverrides ?? {};
  }, [activeCompany, monthOverrides, yearMonthKey]);

  const employeesToPrint = useMemo(() => {
    if (mode === 'single') {
      const emp = employees.find((e) => e.id === focusedEmployeeId);
      return emp ? [emp] : [];
    }
    return employees.filter((e) => selectedBatchIds.includes(e.id));
  }, [mode, employees, focusedEmployeeId, selectedBatchIds]);

  const previewEmployee = useMemo(() => {
    if (mode === 'single') {
      return employees.find((e) => e.id === focusedEmployeeId) ?? employees[0] ?? null;
    }
    return (
      employeesToPrint.find((e) => e.id === focusedEmployeeId) ??
      employeesToPrint[0] ??
      employees[0] ??
      null
    );
  }, [mode, employees, employeesToPrint, focusedEmployeeId]);

  const getRowsForEmployee = (emp: Employee): GeneratedDayRow[] => {
    const sch = scheduleMap.get(emp.scheduleId);
    const empOverride = activeCompany
      ? monthOverrides.find(
          (m) =>
            m.companyId === activeCompany.id &&
            m.yearMonth === yearMonthKey &&
            m.targetId === emp.id
        )?.dayOverrides
      : undefined;

    return getMonthCalendarRows({
      year,
      month,
      schedule: sch,
      customHolidays,
      companyOverrides: companyMonthOverrideMap,
      employeeOverrides: empOverride,
      includeFacultativos,
    });
  };

  const previewRows = useMemo(() => {
    if (!previewEmployee) return [];
    return getRowsForEmployee(previewEmployee);
  }, [
    previewEmployee,
    year,
    month,
    schedules,
    customHolidays,
    companyMonthOverrideMap,
    monthOverrides,
    includeFacultativos,
  ]);

  const detectedHolidaysInMonth = useMemo(() => {
    return previewRows.filter((r) => r.isHoliday && r.holidayName);
  }, [previewRows]);

  const stepMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
    setEditingDayRow(null);
  };

  const handleOpenDayEditor = (row: GeneratedDayRow) => {
    if (!previewEmployee || !activeCompany) return;
    setEditingDayRow(row);
    const empOverride = monthOverrides.find(
      (m) =>
        m.companyId === activeCompany.id &&
        m.yearMonth === yearMonthKey &&
        m.targetId === previewEmployee.id
    )?.dayOverrides?.[row.dayKey];

    const compOverride = companyMonthOverrideMap[row.dayKey];
    const current = empOverride ?? compOverride;

    setOverrideScope(empOverride ? 'EMPLOYEE' : 'ALL');
    setOverrideStatus(current?.status ?? 'auto');
    const sch = scheduleMap.get(previewEmployee.scheduleId);
    setOverrideMorningEnd(current?.morningEnd ?? sch?.defaultMorningEnd ?? '12:00');
    setOverrideAfternoonStart(current?.afternoonStart ?? sch?.defaultAfternoonStart ?? '13:00');
  };

  const handleSaveDayOverride = async () => {
    if (!activeCompany || !editingDayRow || !previewEmployee) return;
    setSavingDay(true);
    try {
      const targetId = overrideScope === 'ALL' ? 'ALL' : previewEmployee.id;
      if (overrideStatus === 'auto') {
        await onSaveDayOverride({
          companyId: activeCompany.id,
          yearMonth: yearMonthKey,
          targetId,
          dayKey: editingDayRow.dayKey,
          entry: null,
        });
      } else {
        await onSaveDayOverride({
          companyId: activeCompany.id,
          yearMonth: yearMonthKey,
          targetId,
          dayKey: editingDayRow.dayKey,
          entry: {
            status: overrideStatus,
            morningEnd: overrideMorningEnd,
            afternoonStart: overrideAfternoonStart,
          },
        });
      }
      setEditingDayRow(null);
    } finally {
      setSavingDay(false);
    }
  };

  const toggleBatchEmployee = (id: string) => {
    setSelectedBatchIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleExportPdf = async () => {
    if (!activeCompany || employeesToPrint.length === 0 || exportingPdf) return;
    setExportError(null);
    const controller = new AbortController();
    exportAbortRef.current = controller;
    setExportingPdf(true);
    setExportProgress({
      stage: 'preparing',
      current: 0,
      total: employeesToPrint.length,
      currentLabel: employeesToPrint[0]?.name,
      completedIndexes: [],
    });

    try {
      // Wait for off-screen export sheets to mount cleanly in DOM
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );

      if (controller.signal.aborted) return;

      const container = exportContainerRef.current;
      if (!container) {
        throw new Error('Não foi possível preparar as folhas para exportação.');
      }

      const sheetElements = Array.from(
        container.querySelectorAll<HTMLElement>('.a4-sheet')
      );
      const sheetLabels = employeesToPrint.map((emp) => emp.name);

      const baseLabel =
        mode === 'single' && employeesToPrint[0]
          ? `Folha_Ponto_${sanitizeFilename(employeesToPrint[0].name)}_${yearMonthKey}.pdf`
          : `Folhas_Ponto_${sanitizeFilename(activeCompany.name)}_${yearMonthKey}.pdf`;

      await exportA4SheetsToPdf({
        sheetElements,
        sheetLabels,
        filename: baseLabel,
        signal: controller.signal,
        onProgress: (nextProgress) => setExportProgress(nextProgress),
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      setExportError(
        err instanceof Error ? err.message : 'Ocorreu um erro ao gerar o arquivo PDF.'
      );
    } finally {
      exportAbortRef.current = null;
      setExportingPdf(false);
      setExportProgress(null);
    }
  };

  const handleCancelPdfExport = () => {
    exportAbortRef.current?.abort();
  };

  if (!activeCompany) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
        <Calendar className="w-8 h-8 text-slate-400 mx-auto" />
        <h3 className="font-display text-base font-semibold text-slate-900">
          Cadastre ou selecione uma empresa para gerar folhas
        </h3>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Comece cadastrando a fazenda ou empresa empregadora e seus colaboradores.
        </p>
        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onGoToCompanies}
            className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold cursor-pointer"
          >
            Cadastrar Empresa
          </button>
          {onSeedExample && (
            <button
              type="button"
              onClick={onSeedExample}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-emerald-700" />
              Carregar Modelo Exemplo
            </button>
          )}
        </div>
      </div>
    );
  }

  if (employees.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
        <Users className="w-8 h-8 text-slate-400 mx-auto" />
        <h3 className="font-display text-base font-semibold text-slate-900">
          Nenhum funcionário cadastrado em {activeCompany.name}
        </h3>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Adicione ao menos um funcionário para visualizar e imprimir a folha de ponto A4.
        </p>
        <button
          type="button"
          onClick={onGoToEmployees}
          className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold cursor-pointer"
        >
          Cadastrar Funcionário
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="no-print space-y-5">
        {/* Barra Superior de Geração e Impressão */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Seletor Mês / Ano */}
            <div className="inline-flex items-center border border-slate-200 rounded-lg bg-slate-50">
              <button
                type="button"
                onClick={() => stepMonth(-1)}
                title="Mês anterior"
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-l-lg cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <select
                aria-label="Mês"
                value={month}
                onChange={(e) => {
                  setMonth(Number(e.target.value));
                  setEditingDayRow(null);
                }}
                className="bg-transparent px-2 py-1.5 text-sm font-semibold text-slate-900 focus:outline-none cursor-pointer"
              >
                {MONTH_NAMES_PT.map((mName, idx) => (
                  <option key={mName} value={idx + 1}>
                    {mName}
                  </option>
                ))}
              </select>
              <select
                aria-label="Ano"
                value={year}
                onChange={(e) => {
                  setYear(Number(e.target.value));
                  setEditingDayRow(null);
                }}
                className="bg-transparent pr-2 py-1.5 text-sm font-mono-tabular font-semibold text-slate-900 focus:outline-none cursor-pointer"
              >
                {Array.from({ length: 11 }, (_, i) => now.getFullYear() - 3 + i).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => stepMonth(1)}
                title="Próximo mês"
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-r-lg cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Modo Lote vs Individual */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setMode('batch')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  mode === 'batch'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Lote ({selectedBatchIds.length})
              </button>
              <button
                type="button"
                onClick={() => setMode('single')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  mode === 'single'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Individual
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowCalibration((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                showCalibration
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Margens e Fonte
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={employeesToPrint.length === 0 || exportingPdf}
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Imprimir
            </button>

            <button
              type="button"
              disabled={employeesToPrint.length === 0 || exportingPdf}
              onClick={handleExportPdf}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition-colors disabled:opacity-60 whitespace-nowrap cursor-pointer"
            >
              {exportingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileDown className="w-4 h-4" />
              )}
              {exportingPdf && exportProgress
                ? `Gerando PDF (${exportProgress.completedIndexes.length}/${exportProgress.total})...`
                : `Exportar PDF (${employeesToPrint.length} ${
                    employeesToPrint.length === 1 ? 'folha' : 'folhas'
                  })`}
            </button>
          </div>
        </div>

        {exportError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700 flex items-center justify-between gap-3">
            <span>{exportError}</span>
            <button
              type="button"
              onClick={() => setExportError(null)}
              className="font-semibold hover:underline cursor-pointer"
            >
              Fechar
            </button>
          </div>
        )}

        {/* Painel de Calibração Fina (opcional) */}
        {showCalibration && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-900">
                Calibração Fina da Folha A4 (pré-calibrada para o modelo PDF)
              </div>
              <button
                type="button"
                onClick={() => setCalibration(DEFAULT_PRINT_CALIBRATION)}
                className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Restaurar Padrão
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              <label className="space-y-1">
                <span className="text-slate-600 block">Margem Sup (mm)</span>
                <input
                  type="number"
                  step="0.5"
                  min="3"
                  max="20"
                  value={calibration.marginTopMm}
                  onChange={(e) =>
                    setCalibration((c) => ({ ...c, marginTopMm: Number(e.target.value) || 8 }))
                  }
                  className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 font-mono-tabular"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-600 block">Margem Inf (mm)</span>
                <input
                  type="number"
                  step="0.5"
                  min="3"
                  max="20"
                  value={calibration.marginBottomMm}
                  onChange={(e) =>
                    setCalibration((c) => ({ ...c, marginBottomMm: Number(e.target.value) || 8 }))
                  }
                  className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 font-mono-tabular"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-600 block">Margem Lat (mm)</span>
                <input
                  type="number"
                  step="0.5"
                  min="3"
                  max="20"
                  value={calibration.marginSideMm}
                  onChange={(e) =>
                    setCalibration((c) => ({ ...c, marginSideMm: Number(e.target.value) || 8 }))
                  }
                  className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 font-mono-tabular"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-600 block">Fonte Cabeçalho (pt)</span>
                <input
                  type="number"
                  step="0.5"
                  min="7"
                  max="11"
                  value={calibration.headerFontPt}
                  onChange={(e) =>
                    setCalibration((c) => ({ ...c, headerFontPt: Number(e.target.value) || 8.5 }))
                  }
                  className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 font-mono-tabular"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-600 block">Fonte Grade (pt)</span>
                <input
                  type="number"
                  step="0.5"
                  min="6.5"
                  max="10"
                  value={calibration.tableFontPt}
                  onChange={(e) =>
                    setCalibration((c) => ({ ...c, tableFontPt: Number(e.target.value) || 8 }))
                  }
                  className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 font-mono-tabular"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-600 block">Altura Linha (mm)</span>
                <input
                  type="number"
                  step="0.1"
                  min="5"
                  max="7.2"
                  value={calibration.rowHeightMm}
                  onChange={(e) =>
                    setCalibration((c) => ({ ...c, rowHeightMm: Number(e.target.value) || 6.3 }))
                  }
                  className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 font-mono-tabular"
                />
              </label>
            </div>
          </div>
        )}

        {/* Área Principal: Controles Laterais + Mesa de Pré-visualização A4 */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Coluna de Seleção e Ajustes do Mês */}
          <div className="xl:col-span-4 space-y-4">
            {/* Lista de Funcionários para Impressão / Visualização */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  {mode === 'batch' ? 'Selecionar Equipe para Lote' : 'Selecionar Funcionário'}
                </span>
                {mode === 'batch' && (
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedBatchIds(employees.filter((e) => e.active).map((e) => e.id))
                      }
                      className="text-emerald-700 hover:underline cursor-pointer"
                    >
                      Ativos
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedBatchIds([])}
                      className="text-slate-500 hover:underline cursor-pointer"
                    >
                      Limpar
                    </button>
                  </div>
                )}
              </div>

              <ul className="divide-y divide-slate-100 max-h-64 overflow-y-auto text-sm">
                {employees.map((emp) => {
                  const isChecked = selectedBatchIds.includes(emp.id);
                  const isFocused = previewEmployee?.id === emp.id;
                  return (
                    <li
                      key={emp.id}
                      className={`px-4 py-2.5 flex items-center justify-between gap-2 transition-colors ${
                        isFocused ? 'bg-emerald-50/60' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {mode === 'batch' ? (
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleBatchEmployee(emp.id)}
                            className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-700 cursor-pointer"
                          />
                        ) : (
                          <input
                            type="radio"
                            name="single-employee"
                            checked={focusedEmployeeId === emp.id}
                            onChange={() => setFocusedEmployeeId(emp.id)}
                            className="border-slate-300 text-emerald-700 focus:ring-emerald-700 cursor-pointer"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => setFocusedEmployeeId(emp.id)}
                          className="text-left min-w-0 flex-1 cursor-pointer"
                        >
                          <div className="font-medium text-slate-900 truncate">{emp.name}</div>
                          <div className="text-xs text-slate-500 truncate">
                            Reg. {emp.registrationNumber} · {emp.active ? 'Ativo' : 'Inativo'}
                          </div>
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Editor de Dia Selecionado na Folha */}
            {editingDayRow && previewEmployee ? (
              <div className="bg-white border border-emerald-700/40 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="text-sm font-semibold text-slate-900">
                    Ajustar Dia {editingDayRow.dayKey}/{String(month).padStart(2, '0')} (
                    {editingDayRow.weekdayShort})
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingDayRow(null)}
                    className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="font-medium text-slate-700 block mb-1">Aplicar em:</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setOverrideScope('ALL')}
                        className={`px-2.5 py-1.5 rounded-md border font-medium cursor-pointer ${
                          overrideScope === 'ALL'
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        Toda a Empresa
                      </button>
                      <button
                        type="button"
                        onClick={() => setOverrideScope('EMPLOYEE')}
                        className={`px-2.5 py-1.5 rounded-md border font-medium truncate cursor-pointer ${
                          overrideScope === 'EMPLOYEE'
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        Só este Colab.
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="font-medium text-slate-700 block mb-1">
                      Marcação do Dia:
                    </label>
                    <select
                      value={overrideStatus}
                      onChange={(e) => setOverrideStatus(e.target.value as DayOverrideStatus)}
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900"
                    >
                      <option value="auto">Automático (Calendário e Jornada)</option>
                      <option value="work">Dia Útil (Fundo branco + intervalo)</option>
                      <option value="rest">Folga (Fundo cinza + &quot;Folga&quot;)</option>
                      <option value="holiday">Feriado (Fundo cinza + &quot;Feriado&quot;)</option>
                      <option value="rest_holiday">Folga + Feriado (Fundo cinza + ambos)</option>
                      <option value="blank">Em branco (Fundo branco sem horários)</option>
                    </select>
                  </div>

                  {overrideStatus === 'work' && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <label>
                        <span className="text-slate-600 block mb-0.5">Saída Manhã</span>
                        <input
                          type="text"
                          maxLength={10}
                          value={overrideMorningEnd}
                          onChange={(e) => setOverrideMorningEnd(e.target.value)}
                          className="w-full rounded-md border border-slate-200 px-2 py-1 font-mono-tabular"
                        />
                      </label>
                      <label>
                        <span className="text-slate-600 block mb-0.5">Entrada Tarde</span>
                        <input
                          type="text"
                          maxLength={10}
                          value={overrideAfternoonStart}
                          onChange={(e) => setOverrideAfternoonStart(e.target.value)}
                          className="w-full rounded-md border border-slate-200 px-2 py-1 font-mono-tabular"
                        />
                      </label>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    disabled={savingDay}
                    onClick={handleSaveDayOverride}
                    className="px-4 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
                  >
                    {savingDay ? 'Salvando...' : 'Aplicar Ajuste'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600">
                Clique em qualquer linha da folha ao lado para ajustar manualmente um dia
                específico (ex.: transformar um dia útil em feriado/folga ou liberar hora extra).
              </div>
            )}

            {/* Resumo dos Feriados Detectados no Mês */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  Feriados em {formatMonthYearPt(year, month)}
                </span>
                {Object.keys(companyMonthOverrideMap).length > 0 && (
                  <button
                    type="button"
                    onClick={() => onClearMonthOverrides(activeCompany.id, yearMonthKey, 'ALL')}
                    className="text-xs text-red-600 hover:underline cursor-pointer"
                  >
                    Limpar ajustes
                  </button>
                )}
              </div>

              {detectedHolidaysInMonth.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Nenhum feriado automático detectado neste mês.
                </p>
              ) : (
                <ul className="space-y-1.5 text-xs">
                  {detectedHolidaysInMonth.map((h) => (
                    <li key={h.dayKey} className="flex items-center justify-between gap-2">
                      <span className="text-slate-800 font-medium truncate">{h.holidayName}</span>
                      <span className="font-mono-tabular text-slate-500 shrink-0">
                        {h.dayKey}/{String(month).padStart(2, '0')} ({h.weekdayShort})
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <label className="pt-2 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeFacultativos}
                  onChange={(e) => onToggleFacultativos(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-700"
                />
                Incluir Carnaval e Corpus Christi
              </label>
            </div>
          </div>

          {/* Mesa de Pré-visualização A4 WYSIWYG */}
          <div className="xl:col-span-8 bg-slate-200/75 border border-slate-200 rounded-xl p-4 sm:p-6 overflow-x-auto">
            {previewEmployee ? (
              <div className="flex flex-col items-center space-y-3">
                <div className="w-full max-w-[210mm] flex items-center justify-between text-xs text-slate-600">
                  <span>
                    Visualizando:{' '}
                    <strong className="text-slate-900">{previewEmployee.name}</strong>
                  </span>
                  <span className="font-mono-tabular">
                    A4 Retrato · {previewRows.length} dias ·{' '}
                    {mode === 'batch' ? `${employeesToPrint.length} folha(s) no lote` : '1 folha'}
                  </span>
                </div>
                <TimesheetA4Sheet
                  company={activeCompany}
                  employee={previewEmployee}
                  schedule={scheduleMap.get(previewEmployee.scheduleId)}
                  year={year}
                  month={month}
                  rows={previewRows}
                  calibration={calibration}
                  interactive
                  selectedDayKey={editingDayRow?.dayKey ?? null}
                  onDayClick={handleOpenDayEditor}
                />
              </div>
            ) : (
              <div className="p-12 text-center text-sm text-slate-600">
                Selecione um funcionário ao lado para visualizar a folha A4.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Container exclusivo de Impressão em Lote (1 folha A4 por página, 100% escala real) */}
      <div className="hidden print-only-container">
        {employeesToPrint.map((emp) => (
          <TimesheetA4Sheet
            key={emp.id}
            company={activeCompany}
            employee={emp}
            schedule={scheduleMap.get(emp.scheduleId)}
            year={year}
            month={month}
            rows={getRowsForEmployee(emp)}
            calibration={calibration}
          />
        ))}
      </div>

      {/* Container temporário off-screen para captura exata em lote pelo html2pdf.js */}
      {exportingPdf && (
        <div
          ref={exportContainerRef}
          data-pdf-export-root="true"
          aria-hidden="true"
          className="no-print"
          style={{
            position: 'fixed',
            left: '-10000px',
            top: 0,
            width: '210mm',
            backgroundColor: '#ffffff',
            pointerEvents: 'none',
            zIndex: -1,
          }}
        >
          {employeesToPrint.map((emp) => (
            <TimesheetA4Sheet
              key={emp.id}
              company={activeCompany}
              employee={emp}
              schedule={scheduleMap.get(emp.scheduleId)}
              year={year}
              month={month}
              rows={getRowsForEmployee(emp)}
              calibration={calibration}
            />
          ))}
        </div>
      )}

      <PdfExportProgressModal
        open={exportingPdf}
        progress={exportProgress}
        sheetNames={employeesToPrint.map((e) => e.name)}
        periodLabel={formatMonthYearPt(year, month)}
        onCancel={handleCancelPdfExport}
      />
    </>
  );
};
