import * as XLSX from 'xlsx';
import { Employee, FIELD_LIMITS, Schedule } from '../types/timesheet';
import { formatCpfInput } from './holidays';

export type EmployeeColumnKey =
  | 'name'
  | 'cpf'
  | 'role'
  | 'registrationNumber'
  | 'admissionDate'
  | 'birthDate'
  | 'scheduleName'
  | 'active';

export type ColumnMapping = Record<EmployeeColumnKey, string>;

export interface ParsedSpreadsheetData {
  fileName: string;
  sheetNames: string[];
  activeSheet: string;
  headers: string[];
  rows: Record<string, unknown>[];
}

export interface NormalizedEmployeeRow {
  rowIndex: number; // 1-based row number in spreadsheet (excluding header)
  name: string;
  cpf: string;
  cpfDigits: string;
  role: string;
  registrationNumber: string;
  admissionDate: string; // YYYY-MM-DD
  birthDate: string; // YYYY-MM-DD or ''
  scheduleId: string;
  scheduleLabel: string;
  active: boolean;
  existingEmployeeId?: string;
  errors: string[];
}

function normalizeHeaderText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const COLUMN_ALIASES: Record<EmployeeColumnKey, string[]> = {
  name: ['nome', 'nome completo', 'empregado', 'funcionario', 'colaborador', 'nome do empregado'],
  cpf: ['cpf', 'documento', 'cpf empregado'],
  role: ['cargo', 'funcao', 'ocupacao', 'cbo', 'cargo funcao'],
  registrationNumber: ['registro', 'n registro', 'numero de registro', 'matricula', 'codigo', 're'],
  admissionDate: ['admissao', 'data de admissao', 'data admissao', 'dt admissao', 'inicio'],
  birthDate: ['nascimento', 'data de nascimento', 'data nascimento', 'dt nascimento', 'dt nasc', 'aniversario'],
  scheduleName: ['jornada', 'escala', 'horario', 'turno', 'jornada de trabalho'],
  active: ['situacao', 'status', 'ativo', 'estado'],
};

export function autoDetectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    name: '',
    cpf: '',
    role: '',
    registrationNumber: '',
    admissionDate: '',
    birthDate: '',
    scheduleName: '',
    active: '',
  };

  const normalizedHeaders = headers.map((h) => ({
    raw: h,
    norm: normalizeHeaderText(h),
  }));

  (Object.keys(COLUMN_ALIASES) as EmployeeColumnKey[]).forEach((key) => {
    const aliases = COLUMN_ALIASES[key];
    // Exact alias match first
    const exact = normalizedHeaders.find((h) => aliases.includes(h.norm));
    if (exact) {
      mapping[key] = exact.raw;
      return;
    }
    // Partial match second
    const partial = normalizedHeaders.find((h) =>
      aliases.some((alias) => h.norm.includes(alias) || alias.includes(h.norm))
    );
    if (partial) {
      mapping[key] = partial.raw;
    }
  });

  return mapping;
}

export async function readSpreadsheetWorkbook(
  file: File,
  preferredSheet?: string
): Promise<{ workbook: XLSX.WorkBook; data: ParsedSpreadsheetData }> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellDates: true,
    codepage: 65001,
  });

  if (workbook.SheetNames.length === 0) {
    throw new Error('A planilha não contém abas legíveis.');
  }

  const activeSheet =
    preferredSheet && workbook.SheetNames.includes(preferredSheet)
      ? preferredSheet
      : workbook.SheetNames[0];

  const data = extractSheetData(workbook, file.name, activeSheet);
  return { workbook, data };
}

export function extractSheetData(
  workbook: XLSX.WorkBook,
  fileName: string,
  sheetName: string
): ParsedSpreadsheetData {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Aba "${sheetName}" não encontrada na planilha.`);
  }

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: true,
  });

  const headerSet = new Set<string>();
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  if (Array.isArray(matrix[0])) {
    for (const cell of matrix[0]) {
      const text = String(cell ?? '').trim();
      if (text) headerSet.add(text);
    }
  }
  for (const row of rawRows) {
    for (const key of Object.keys(row)) {
      if (key.trim()) headerSet.add(key);
    }
  }

  const headers = Array.from(headerSet);
  const nonEmptyRows = rawRows.filter((row) =>
    Object.values(row).some((val) => String(val ?? '').trim() !== '')
  );

  return {
    fileName,
    sheetNames: workbook.SheetNames,
    activeSheet: sheetName,
    headers,
    rows: nonEmptyRows,
  };
}

function parseSpreadsheetDateValue(raw: unknown, isBirthDate = false): string | null {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, '0');
    const d = String(raw.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 100 && raw < 100000) {
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      return `${String(parsed.y).padStart(4, '0')}-${String(parsed.m).padStart(2, '0')}-${String(
        parsed.d
      ).padStart(2, '0')}`;
    }
  }

  const text = String(raw ?? '').trim();
  if (!text) return null;

  // YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    const monthNum = Number(m);
    const dayNum = Number(d);
    if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const brMatch = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (brMatch) {
    const [, d, m, yRaw] = brMatch;
    let y = yRaw;
    if (yRaw.length === 2) {
      const yy = Number(yRaw);
      const currentTwoDigitYear = new Date().getFullYear() % 100;
      y = isBirthDate && yy > currentTwoDigitYear ? `19${yRaw}` : `20${yRaw}`;
    }
    const monthNum = Number(m);
    const dayNum = Number(d);
    if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
      return `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }

  return null;
}

function parseActiveValue(raw: unknown): boolean {
  const text = normalizeHeaderText(String(raw ?? ''));
  if (!text) return true;
  if (['nao', 'n', 'false', '0', 'inativo', 'desligado', 'demitido'].includes(text)) {
    return false;
  }
  return true;
}

export function normalizeEmployeeRows(params: {
  rows: Record<string, unknown>[];
  mapping: ColumnMapping;
  schedules: Schedule[];
  defaultScheduleId: string;
  existingEmployees: Employee[];
}): NormalizedEmployeeRow[] {
  const { rows, mapping, schedules, defaultScheduleId, existingEmployees } = params;

  const scheduleByNormName = new Map<string, Schedule>();
  for (const s of schedules) {
    scheduleByNormName.set(normalizeHeaderText(s.name), s);
  }
  const defaultSchedule =
    schedules.find((s) => s.id === defaultScheduleId) ?? schedules[0] ?? null;

  const existingByCpf = new Map<string, Employee>();
  const existingByReg = new Map<string, Employee>();
  for (const emp of existingEmployees) {
    const cpfDigits = emp.cpf.replace(/\D/g, '');
    if (cpfDigits.length === 11) existingByCpf.set(cpfDigits, emp);
    const regKey = emp.registrationNumber.trim().toLowerCase();
    if (regKey) existingByReg.set(regKey, emp);
  }

  return rows.map((row, idx) => {
    const errors: string[] = [];

    const rawName = mapping.name ? String(row[mapping.name] ?? '').trim() : '';
    const name = rawName.toUpperCase().slice(0, FIELD_LIMITS.employeeNameMax);
    if (name.length < 2) errors.push('Nome inválido');

    const rawRole = mapping.role ? String(row[mapping.role] ?? '').trim() : '';
    const role = (rawRole || '040 - TRABALHADOR RURAL')
      .toUpperCase()
      .slice(0, FIELD_LIMITS.employeeRoleMax);
    if (role.length < 2) errors.push('Cargo inválido');

    const rawCpf = mapping.cpf ? String(row[mapping.cpf] ?? '').trim() : '';
    let cpfDigits = rawCpf.replace(/\D/g, '');
    // Restore leading zeros if Excel stored CPF as a plain number
    if (cpfDigits.length >= 9 && cpfDigits.length < 11) {
      cpfDigits = cpfDigits.padStart(11, '0');
    }
    const cpf = cpfDigits.length === 11 ? formatCpfInput(cpfDigits) : '';
    if (cpfDigits.length !== 11) errors.push('CPF deve conter 11 dígitos');

    const rawReg = mapping.registrationNumber
      ? String(row[mapping.registrationNumber] ?? '').trim()
      : '';
    const registrationNumber = (rawReg || String(idx + 1)).slice(
      0,
      FIELD_LIMITS.registrationMax
    );
    if (registrationNumber.length < 1) errors.push('Registro obrigatório');

    const rawAdmission = mapping.admissionDate ? row[mapping.admissionDate] : '';
    const parsedDate = parseSpreadsheetDateValue(rawAdmission, false);
    const admissionDate = parsedDate ?? new Date().toISOString().slice(0, 10);
    if (mapping.admissionDate && String(rawAdmission ?? '').trim() !== '' && !parsedDate) {
      errors.push('Data de admissão inválida');
    }

    const rawBirth = mapping.birthDate ? row[mapping.birthDate] : '';
    const parsedBirthDate = parseSpreadsheetDateValue(rawBirth, true);
    const birthDate = parsedBirthDate ?? '';
    if (mapping.birthDate && String(rawBirth ?? '').trim() !== '' && !parsedBirthDate) {
      errors.push('Data de nascimento inválida');
    }

    const rawSchedule = mapping.scheduleName
      ? String(row[mapping.scheduleName] ?? '').trim()
      : '';
    const matchedSchedule = rawSchedule
      ? scheduleByNormName.get(normalizeHeaderText(rawSchedule)) ?? defaultSchedule
      : defaultSchedule;

    if (!matchedSchedule) {
      errors.push('Nenhuma jornada disponível');
    }

    const active = mapping.active ? parseActiveValue(row[mapping.active]) : true;

    const existingMatch =
      (cpfDigits.length === 11 ? existingByCpf.get(cpfDigits) : undefined) ??
      existingByReg.get(registrationNumber.toLowerCase());

    return {
      rowIndex: idx + 2,
      name,
      cpf,
      cpfDigits,
      role,
      registrationNumber,
      admissionDate,
      birthDate,
      scheduleId: matchedSchedule?.id ?? '',
      scheduleLabel: matchedSchedule?.name ?? 'Sem jornada',
      active,
      existingEmployeeId: existingMatch?.id,
      errors,
    };
  });
}

const TEMPLATE_SAMPLE_ROWS = [
  {
    Registro: '1001',
    Nome: 'JOÃO DA SILVA SANTOS',
    CPF: '123.456.789-01',
    Cargo: '040 - TRABALHADOR RURAL',
    Nascimento: '15/05/1990',
    Admissão: '10/01/2026',
    Jornada: 'Trabalhador Rural 44h',
    Situação: 'Ativo',
  },
  {
    Registro: '1002',
    Nome: 'MARIA OLIVEIRA SOUZA',
    CPF: '987.654.321-09',
    Cargo: '042 - OPERADOR DE MÁQUINAS',
    Nascimento: '22/11/1988',
    Admissão: '01/03/2026',
    Jornada: 'Trabalhador Rural 44h',
    Situação: 'Ativo',
  },
];

export function downloadEmployeeTemplateXlsx(): void {
  const ws = XLSX.utils.json_to_sheet(TEMPLATE_SAMPLE_ROWS);
  ws['!cols'] = [
    { wch: 12 },
    { wch: 32 },
    { wch: 18 },
    { wch: 28 },
    { wch: 14 },
    { wch: 14 },
    { wch: 26 },
    { wch: 12 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Funcionarios');
  XLSX.writeFile(wb, 'modelo_planilha_funcionarios.xlsx');
}

export function downloadEmployeeTemplateCsv(): void {
  const headers = [
    'Registro',
    'Nome',
    'CPF',
    'Cargo',
    'Nascimento',
    'Admissão',
    'Jornada',
    'Situação',
  ];
  const lines = [
    headers.join(';'),
    ...TEMPLATE_SAMPLE_ROWS.map((r) =>
      [r.Registro, r.Nome, r.CPF, r.Cargo, r.Nascimento, r.Admissão, r.Jornada, r.Situação].join(
        ';'
      )
    ),
  ];
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'modelo_planilha_funcionarios.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
