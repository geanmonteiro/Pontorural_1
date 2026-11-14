export interface Company {
  id: string;
  ownerId: string;
  name: string;
  cnpj: string;
  address: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Schedule {
  id: string;
  ownerId: string;
  companyId: string;
  name: string;
  descriptionText: string;
  restDays: number[]; // 0 = Dom .. 6 = Sab
  defaultMorningEnd: string;
  defaultAfternoonStart: string;
  showPreFilledInterval: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Employee {
  id: string;
  ownerId: string;
  companyId: string;
  scheduleId: string;
  name: string;
  role: string;
  cpf: string;
  registrationNumber: string;
  admissionDate: string; // YYYY-MM-DD
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CustomHoliday {
  id: string;
  ownerId: string;
  companyId: string;
  name: string;
  dateKey: string; // MM-DD (recurring) or YYYY-MM-DD (single year)
  recurringYearly: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type DayOverrideStatus = 'auto' | 'work' | 'rest' | 'holiday' | 'rest_holiday' | 'blank';

export interface DayOverrideEntry {
  status: Exclude<DayOverrideStatus, 'auto'>;
  morningEnd?: string;
  afternoonStart?: string;
  note?: string;
}

export interface MonthOverride {
  id: string;
  ownerId: string;
  companyId: string;
  yearMonth: string; // YYYY-MM
  targetId: string; // 'ALL' or employeeId
  dayOverrides: Record<string, DayOverrideEntry>; // key "01".."31"
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PrintCalibration {
  marginTopMm: number;
  marginBottomMm: number;
  marginSideMm: number;
  headerFontPt: number;
  tableFontPt: number;
  rowHeightMm: number;
}

export const DEFAULT_PRINT_CALIBRATION: PrintCalibration = {
  marginTopMm: 8,
  marginBottomMm: 8,
  marginSideMm: 8,
  headerFontPt: 8.5,
  tableFontPt: 8,
  rowHeightMm: 6.3,
};

export interface GeneratedDayRow {
  dayKey: string; // "01".."31"
  weekdayIndex: number; // 0..6
  weekdayShort: string; // Dom..Sab
  isoDate: string; // YYYY-MM-DD
  isRest: boolean;
  isHoliday: boolean;
  holidayName?: string;
  isBlank: boolean;
  isOverridden: boolean;
  shaded: boolean;
  col5Text: string; // "Folga" or ""
  col6Text: string; // "12:00", "Feriado", or ""
  col7Text: string; // "13:00" or ""
}

export type TeamUserRole = 'admin' | 'rh' | 'operador';

export interface TeamUser {
  id: string;
  ownerId: string;
  authUid: string;
  displayName: string;
  email: string;
  role: TeamUserRole;
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export const FIELD_LIMITS = {
  companyNameMax: 160,
  cnpjMax: 24,
  addressMax: 240,
  scheduleNameMax: 100,
  scheduleDescMax: 240,
  timeMax: 10,
  employeeNameMax: 140,
  employeeRoleMax: 120,
  cpfMax: 20,
  registrationMax: 32,
  holidayNameMax: 100,
  teamUserNameMax: 120,
  teamUserEmailMax: 160,
} as const;
