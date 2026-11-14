import React, { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertCircle,
  Check,
  Download,
  FileSpreadsheet,
  Loader2,
  RotateCcw,
  Upload,
  Users,
} from 'lucide-react';
import { Company, Employee, Schedule } from '../types/timesheet';
import { formatDateBr } from '../utils/holidays';
import {
  ColumnMapping,
  EmployeeColumnKey,
  NormalizedEmployeeRow,
  ParsedSpreadsheetData,
  autoDetectColumnMapping,
  downloadEmployeeTemplateCsv,
  downloadEmployeeTemplateXlsx,
  extractSheetData,
  normalizeEmployeeRows,
  readSpreadsheetWorkbook,
} from '../utils/employeeSpreadsheet';

interface ImportEmployeesViewProps {
  activeCompany: Company | null;
  schedules: Schedule[];
  employees: Employee[];
  onImportEmployees: (params: {
    companyId: string;
    rows: NormalizedEmployeeRow[];
    duplicateStrategy: 'update' | 'skip';
    onProgress?: (done: number, total: number) => void;
  }) => Promise<{ created: number; updated: number; skipped: number }>;
  onGoToCompanies: () => void;
  onGoToSchedules: () => void;
  onGoToEmployees: () => void;
  canImport?: boolean;
}

const MAPPING_FIELDS: { key: EmployeeColumnKey; label: string; required?: boolean }[] = [
  { key: 'name', label: 'Nome do Empregado', required: true },
  { key: 'cpf', label: 'CPF', required: true },
  { key: 'role', label: 'Cargo / Função' },
  { key: 'registrationNumber', label: 'Nº de Registro' },
  { key: 'birthDate', label: 'Data de Nascimento' },
  { key: 'admissionDate', label: 'Data de Admissão' },
  { key: 'scheduleName', label: 'Jornada (opcional)' },
  { key: 'active', label: 'Situação (opcional)' },
];

export const ImportEmployeesView: React.FC<ImportEmployeesViewProps> = ({
  activeCompany,
  schedules,
  employees,
  onImportEmployees,
  onGoToCompanies,
  onGoToSchedules,
  onGoToEmployees,
  canImport = true,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetData, setSheetData] = useState<ParsedSpreadsheetData | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({
    name: '',
    cpf: '',
    role: '',
    registrationNumber: '',
    admissionDate: '',
    birthDate: '',
    scheduleName: '',
    active: '',
  });
  const [defaultScheduleId, setDefaultScheduleId] = useState<string>(schedules[0]?.id ?? '');
  const [duplicateStrategy, setDuplicateStrategy] = useState<'update' | 'skip'>('update');
  const [excludedRowIndexes, setExcludedRowIndexes] = useState<number[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'valid' | 'errors'>('all');
  const [isDragging, setIsDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(
    null
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultSummary, setResultSummary] = useState<{
    created: number;
    updated: number;
    skipped: number;
  } | null>(null);

  const effectiveDefaultScheduleId = useMemo(() => {
    if (schedules.some((s) => s.id === defaultScheduleId)) return defaultScheduleId;
    return schedules[0]?.id ?? '';
  }, [schedules, defaultScheduleId]);

  const normalizedRows = useMemo(() => {
    if (!sheetData) return [];
    return normalizeEmployeeRows({
      rows: sheetData.rows,
      mapping,
      schedules,
      defaultScheduleId: effectiveDefaultScheduleId,
      existingEmployees: employees,
    });
  }, [sheetData, mapping, schedules, effectiveDefaultScheduleId, employees]);

  const validRows = useMemo(
    () => normalizedRows.filter((r) => r.errors.length === 0),
    [normalizedRows]
  );

  const errorRows = useMemo(
    () => normalizedRows.filter((r) => r.errors.length > 0),
    [normalizedRows]
  );

  const rowsSelectedForImport = useMemo(
    () =>
      validRows.filter((r) => {
        if (excludedRowIndexes.includes(r.rowIndex)) return false;
        if (duplicateStrategy === 'skip' && r.existingEmployeeId) return false;
        return true;
      }),
    [validRows, excludedRowIndexes, duplicateStrategy]
  );

  const filteredPreviewRows = useMemo(() => {
    if (statusFilter === 'valid') return validRows;
    if (statusFilter === 'errors') return errorRows;
    return normalizedRows;
  }, [normalizedRows, validRows, errorRows, statusFilter]);

  if (!activeCompany) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
        <Users className="w-8 h-8 text-slate-400 mx-auto" />
        <h3 className="font-display text-base font-semibold text-slate-900">
          Selecione ou cadastre uma empresa primeiro
        </h3>
        <p className="text-sm text-slate-600">
          Os funcionários importados serão vinculados à empresa empregadora ativa.
        </p>
        <button
          type="button"
          onClick={onGoToCompanies}
          className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold cursor-pointer"
        >
          Ir para Empresas
        </button>
      </div>
    );
  }

  if (schedules.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
        <Users className="w-8 h-8 text-slate-400 mx-auto" />
        <h3 className="font-display text-base font-semibold text-slate-900">
          Cadastre uma jornada antes de importar funcionários
        </h3>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Todo colaborador precisa estar vinculado a uma jornada de trabalho para gerar as folhas
          A4 automaticamente.
        </p>
        <button
          type="button"
          onClick={onGoToSchedules}
          className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold cursor-pointer"
        >
          Cadastrar Jornada
        </button>
      </div>
    );
  }

  const processFile = async (file: File) => {
    setErrorMsg(null);
    setResultSummary(null);
    setParsing(true);
    try {
      const { workbook: wb, data } = await readSpreadsheetWorkbook(file);
      if (data.rows.length === 0) {
        throw new Error('A planilha selecionada não possui linhas com dados.');
      }
      setWorkbook(wb);
      setSheetData(data);
      setMapping(autoDetectColumnMapping(data.headers));
      setExcludedRowIndexes([]);
      setStatusFilter('all');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Não foi possível ler a planilha selecionada.'
      );
    } finally {
      setParsing(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
    e.target.value = '';
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const handleSheetChange = (nextSheet: string) => {
    if (!workbook || !sheetData) return;
    setErrorMsg(null);
    setResultSummary(null);
    try {
      const nextData = extractSheetData(workbook, sheetData.fileName, nextSheet);
      setSheetData(nextData);
      setMapping(autoDetectColumnMapping(nextData.headers));
      setExcludedRowIndexes([]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao trocar de aba.');
    }
  };

  const toggleRowIncluded = (rowIndex: number) => {
    setExcludedRowIndexes((prev) =>
      prev.includes(rowIndex) ? prev.filter((x) => x !== rowIndex) : [...prev, rowIndex]
    );
  };

  const resetUpload = () => {
    setWorkbook(null);
    setSheetData(null);
    setExcludedRowIndexes([]);
    setErrorMsg(null);
    setResultSummary(null);
  };

  const handleConfirmImport = async () => {
    if (!activeCompany || rowsSelectedForImport.length === 0 || importing) return;
    setErrorMsg(null);
    setImporting(true);
    setImportProgress({ done: 0, total: rowsSelectedForImport.length });
    try {
      const res = await onImportEmployees({
        companyId: activeCompany.id,
        rows: rowsSelectedForImport,
        duplicateStrategy,
        onProgress: (done, total) => setImportProgress({ done, total }),
      });
      setResultSummary(res);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Erro ao gravar funcionários no banco de dados.'
      );
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  };

  const progressPercent =
    importProgress && importProgress.total > 0
      ? Math.round((importProgress.done / importProgress.total) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            Importar Planilha de Funcionários — {activeCompany.name}
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Envie uma planilha Excel (.xlsx / .xls) ou CSV para cadastrar ou atualizar colaboradores
            em lote.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={downloadEmployeeTemplateXlsx}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-700" />
            Modelo Excel (.xlsx)
          </button>
          <button
            type="button"
            onClick={downloadEmployeeTemplateCsv}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Modelo CSV
          </button>
        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="font-semibold hover:underline cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {resultSummary && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
              <Check className="w-4 h-4 text-emerald-700" />
              <span>Importação concluída no banco de dados</span>
            </div>
            <p className="text-xs text-emerald-800 font-mono-tabular">
              {resultSummary.created} cadastrado(s) · {resultSummary.updated} atualizado(s) ·{' '}
              {resultSummary.skipped} ignorado(s)
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={resetUpload}
              className="px-3.5 py-2 rounded-lg border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-900 text-xs font-semibold cursor-pointer"
            >
              Nova Importação
            </button>
            <button
              type="button"
              onClick={onGoToEmployees}
              className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
            >
              Ver Funcionários
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv,.tsv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Área de Upload (quando nenhuma planilha carregada) */}
      {!sheetData ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`bg-white border-2 border-dashed rounded-xl p-10 text-center space-y-4 transition-colors ${
            isDragging ? 'border-emerald-700 bg-emerald-50/40' : 'border-slate-300'
          }`}
        >
          <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto">
            {parsing ? (
              <Loader2 className="w-6 h-6 text-emerald-700 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-6 h-6 text-emerald-700" />
            )}
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="font-display text-base font-semibold text-slate-900">
              {parsing ? 'Lendo planilha...' : 'Arraste sua planilha aqui ou selecione o arquivo'}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Aceita arquivos <strong>.xlsx</strong>, <strong>.xls</strong> e <strong>.csv</strong>{' '}
              com colunas como Registro, Nome, CPF, Cargo, Data de Nascimento, Data de Admissão e
              Jornada.
            </p>
          </div>
          <div className="pt-1 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              disabled={parsing}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold disabled:opacity-60 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              Selecionar Planilha
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Painel de Mapeamento de Colunas e Configurações */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span className="font-display text-sm font-bold text-slate-900 truncate">
                    {sheetData.fileName}
                  </span>
                </div>
                <div className="text-xs text-slate-500 font-mono-tabular">
                  {normalizedRows.length} linha(s) encontrada(s) · {validRows.length} válida(s) ·{' '}
                  {errorRows.length} com pendência(s)
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {sheetData.sheetNames.length > 1 && (
                  <select
                    aria-label="Aba da planilha"
                    value={sheetData.activeSheet}
                    onChange={(e) => handleSheetChange(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800"
                  >
                    {sheetData.sheetNames.map((s) => (
                      <option key={s} value={s}>
                        Aba: {s}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Trocar Arquivo
                </button>
                <button
                  type="button"
                  onClick={resetUpload}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-600 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Limpar
                </button>
              </div>
            </div>

            {/* Mapeamento de Colunas */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-700">
                Correspondência de Colunas da Planilha
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {MAPPING_FIELDS.map((field) => (
                  <label key={field.key} className="block space-y-1">
                    <span className="text-xs font-medium text-slate-600 block">
                      {field.label}
                      {field.required ? ' *' : ''}
                    </span>
                    <select
                      value={mapping[field.key]}
                      onChange={(e) =>
                        setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                    >
                      <option value="">-- Não mapear --</option>
                      {sheetData.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}

                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-600 block">
                    Jornada Padrão (fallback) *
                  </span>
                  <select
                    value={effectiveDefaultScheduleId}
                    onChange={(e) => setDefaultScheduleId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                  >
                    {schedules.map((sch) => (
                      <option key={sch.id} value={sch.id}>
                        {sch.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {/* Política de Duplicados + Ação Principal */}
            <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="font-medium text-slate-700">Se o CPF ou Registro já existir:</span>
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setDuplicateStrategy('update')}
                    className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                      duplicateStrategy === 'update'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Atualizar cadastro
                  </button>
                  <button
                    type="button"
                    onClick={() => setDuplicateStrategy('skip')}
                    className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                      duplicateStrategy === 'skip'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Ignorar duplicados
                  </button>
                </div>
              </div>

              {canImport ? (
                <button
                  type="button"
                  disabled={importing || rowsSelectedForImport.length === 0}
                  onClick={handleConfirmImport}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold disabled:opacity-60 whitespace-nowrap cursor-pointer"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>
                        Importando ({importProgress?.done ?? 0}/{importProgress?.total ?? 0})...
                      </span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>
                        Importar {rowsSelectedForImport.length}{' '}
                        {rowsSelectedForImport.length === 1 ? 'Funcionário' : 'Funcionários'}
                      </span>
                    </>
                  )}
                </button>
              ) : (
                <div className="text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Seu perfil permite apenas pré-visualizar planilhas (gravação desabilitada).
                </div>
              )}
            </div>

            {importing && importProgress && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs text-slate-600 font-mono-tabular">
                  <span>Gravando colaboradores no Firestore...</span>
                  <span>
                    {importProgress.done}/{importProgress.total} ({progressPercent}%)
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full w-full bg-emerald-700 origin-left transition-transform duration-150"
                    style={{ transform: `scaleX(${Math.max(0.03, progressPercent / 100)})` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Barra de filtro da pré-visualização */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
              {(
                [
                  { id: 'all', label: `Todas (${normalizedRows.length})` },
                  { id: 'valid', label: `Válidas (${validRows.length})` },
                  { id: 'errors', label: `Com erro (${errorRows.length})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    statusFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="text-xs text-slate-500 font-mono-tabular">
              {rowsSelectedForImport.length} selecionado(s) para gravação
            </div>
          </div>

          {/* Tabela de Pré-visualização */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-2.5 px-3 w-10">Inc.</th>
                    <th className="py-2.5 px-3">Linha</th>
                    <th className="py-2.5 px-3">Registro</th>
                    <th className="py-2.5 px-3">Nome do Empregado</th>
                    <th className="py-2.5 px-3">CPF</th>
                    <th className="py-2.5 px-3">Cargo</th>
                    <th className="py-2.5 px-3">Nascimento</th>
                    <th className="py-2.5 px-3">Admissão</th>
                    <th className="py-2.5 px-3">Jornada</th>
                    <th className="py-2.5 px-3">Validação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredPreviewRows.map((row) => {
                    const hasErrors = row.errors.length > 0;
                    const willSkip = duplicateStrategy === 'skip' && Boolean(row.existingEmployeeId);
                    const checked =
                      !hasErrors && !willSkip && !excludedRowIndexes.includes(row.rowIndex);

                    return (
                      <tr
                        key={row.rowIndex}
                        className={hasErrors ? 'bg-red-50/40' : 'hover:bg-slate-50/80'}
                      >
                        <td className="py-2.5 px-3">
                          <input
                            type="checkbox"
                            disabled={hasErrors || willSkip}
                            checked={checked}
                            onChange={() => toggleRowIncluded(row.rowIndex)}
                            className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-700 disabled:opacity-40 cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 px-3 font-mono-tabular text-slate-500">
                          {row.rowIndex}
                        </td>
                        <td className="py-2.5 px-3 font-mono-tabular text-slate-700 whitespace-nowrap">
                          {row.registrationNumber || '—'}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          {row.name || <span className="text-red-600">Sem nome</span>}
                        </td>
                        <td className="py-2.5 px-3 font-mono-tabular text-slate-700 whitespace-nowrap">
                          {row.cpf || <span className="text-red-600">Inválido</span>}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 max-w-[180px] truncate">
                          {row.role}
                        </td>
                        <td className="py-2.5 px-3 font-mono-tabular text-slate-700 whitespace-nowrap">
                          {row.birthDate ? formatDateBr(row.birthDate) : '—'}
                        </td>
                        <td className="py-2.5 px-3 font-mono-tabular text-slate-700 whitespace-nowrap">
                          {formatDateBr(row.admissionDate)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 max-w-[180px] truncate">
                          {row.scheduleLabel}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {hasErrors ? (
                            <span className="text-red-700 font-medium">
                              {row.errors.join(' · ')}
                            </span>
                          ) : willSkip ? (
                            <span className="text-slate-500">Já existe (ignorar)</span>
                          ) : row.existingEmployeeId ? (
                            <span className="text-amber-700 font-medium">Atualizar existente</span>
                          ) : (
                            <span className="text-emerald-700 font-medium">Novo cadastro</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredPreviewRows.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-sm text-slate-500">
                        Nenhuma linha encontrada para este filtro.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
