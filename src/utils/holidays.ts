import { CustomHoliday, DayOverrideEntry, GeneratedDayRow, Schedule } from '../types/timesheet';

export const MONTH_NAMES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

export const WEEKDAY_SHORT_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'] as const;
export const WEEKDAY_FULL_PT = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
] as const;

export interface NationalHoliday {
  isoDate: string; // YYYY-MM-DD
  name: string;
  isFacultativo: boolean;
}

/**
 * Anonymous Gregorian Easter algorithm
 */
function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=March, 4=April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() + days);
  return copy;
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getNationalHolidaysForYear(
  year: number,
  includeFacultativos = false
): NationalHoliday[] {
  const fixed: NationalHoliday[] = [
    { isoDate: `${year}-01-01`, name: 'Confraternização Universal', isFacultativo: false },
    { isoDate: `${year}-04-21`, name: 'Tiradentes', isFacultativo: false },
    { isoDate: `${year}-05-01`, name: 'Dia do Trabalho', isFacultativo: false },
    { isoDate: `${year}-09-07`, name: 'Independência do Brasil', isFacultativo: false },
    { isoDate: `${year}-10-12`, name: 'Nossa Senhora Aparecida', isFacultativo: false },
    { isoDate: `${year}-11-02`, name: 'Finados', isFacultativo: false },
    { isoDate: `${year}-11-15`, name: 'Proclamação da República', isFacultativo: false },
    {
      isoDate: `${year}-11-20`,
      name: 'Dia Nacional de Zumbi e da Consciência Negra',
      isFacultativo: false,
    },
    { isoDate: `${year}-12-25`, name: 'Natal', isFacultativo: false },
  ];

  const easter = getEasterDate(year);
  const movable: NationalHoliday[] = [
    { isoDate: toIsoDate(addDays(easter, -48)), name: 'Segunda-feira de Carnaval', isFacultativo: true },
    { isoDate: toIsoDate(addDays(easter, -47)), name: 'Terça-feira de Carnaval', isFacultativo: true },
    { isoDate: toIsoDate(addDays(easter, -2)), name: 'Sexta-feira Santa (Paixão de Cristo)', isFacultativo: false },
    { isoDate: toIsoDate(addDays(easter, 60)), name: 'Corpus Christi', isFacultativo: true },
  ];

  const all = [...fixed, ...movable].filter(
    (h) => includeFacultativos || !h.isFacultativo
  );

  return all.sort((a, b) => a.isoDate.localeCompare(b.isoDate));
}

export function getMonthCalendarRows(params: {
  year: number;
  month: number; // 1..12
  schedule?: Schedule;
  customHolidays: CustomHoliday[];
  companyOverrides?: Record<string, DayOverrideEntry>;
  employeeOverrides?: Record<string, DayOverrideEntry>;
  includeFacultativos?: boolean;
}): GeneratedDayRow[] {
  const {
    year,
    month,
    schedule,
    customHolidays,
    companyOverrides = {},
    employeeOverrides = {},
    includeFacultativos = false,
  } = params;

  const daysInMonth = new Date(year, month, 0).getDate();
  const restDays = schedule?.restDays ?? [0, 6];
  const showInterval = schedule?.showPreFilledInterval ?? true;
  const defaultMorningEnd = schedule?.defaultMorningEnd ?? '12:00';
  const defaultAfternoonStart = schedule?.defaultAfternoonStart ?? '13:00';

  const nationalMap = new Map<string, string>();
  for (const h of getNationalHolidaysForYear(year, includeFacultativos)) {
    nationalMap.set(h.isoDate, h.name);
  }

  const customMap = new Map<string, string>();
  for (const ch of customHolidays) {
    if (ch.recurringYearly) {
      // dateKey expected MM-DD
      const mmdd = ch.dateKey.length === 10 ? ch.dateKey.slice(5) : ch.dateKey;
      customMap.set(`${year}-${mmdd}`, ch.name);
    } else {
      customMap.set(ch.dateKey, ch.name);
    }
  }

  const rows: GeneratedDayRow[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(year, month - 1, day);
    const weekdayIndex = dateObj.getDay();
    const weekdayShort = WEEKDAY_SHORT_PT[weekdayIndex];
    const dayKey = String(day).padStart(2, '0');
    const monthKey = String(month).padStart(2, '0');
    const isoDate = `${year}-${monthKey}-${dayKey}`;

    const baseIsRest = restDays.includes(weekdayIndex);
    const holidayName = customMap.get(isoDate) ?? nationalMap.get(isoDate);
    const baseIsHoliday = Boolean(holidayName);

    const override = employeeOverrides[dayKey] ?? companyOverrides[dayKey];
    let isRest = baseIsRest;
    let isHoliday = baseIsHoliday;
    let isBlank = false;
    let morningEnd = defaultMorningEnd;
    let afternoonStart = defaultAfternoonStart;

    if (override) {
      if (override.status === 'work') {
        isRest = false;
        isHoliday = false;
      } else if (override.status === 'rest') {
        isRest = true;
        isHoliday = false;
      } else if (override.status === 'holiday') {
        isRest = false;
        isHoliday = true;
      } else if (override.status === 'rest_holiday') {
        isRest = true;
        isHoliday = true;
      } else if (override.status === 'blank') {
        isRest = false;
        isHoliday = false;
        isBlank = true;
      }
      if (override.morningEnd !== undefined) morningEnd = override.morningEnd;
      if (override.afternoonStart !== undefined) afternoonStart = override.afternoonStart;
    }

    const shaded = isRest || isHoliday;
    const col5Text = isRest ? 'Folga' : '';
    let col6Text = '';
    let col7Text = '';

    if (isBlank) {
      col6Text = '';
      col7Text = '';
    } else if (isHoliday) {
      col6Text = 'Feriado';
      col7Text = '';
    } else if (isRest) {
      col6Text = '';
      col7Text = '';
    } else if (showInterval) {
      col6Text = morningEnd;
      col7Text = afternoonStart;
    }

    rows.push({
      dayKey,
      weekdayIndex,
      weekdayShort,
      isoDate,
      isRest,
      isHoliday,
      holidayName: override?.note || holidayName,
      isBlank,
      isOverridden: Boolean(override),
      shaded,
      col5Text,
      col6Text,
      col7Text,
    });
  }

  return rows;
}

export function formatMonthYearPt(year: number, month: number): string {
  const monthName = MONTH_NAMES_PT[month - 1] ?? 'Mês';
  return `${monthName} / ${year}`;
}

export function formatYearMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function formatDateBr(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

export function formatCnpjInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12)
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export function formatCpfInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}
