import { Company, CustomHoliday, Employee, MonthOverride, Schedule } from '../types/timesheet';
import { sanitizeFilename } from './pdfExport';

function serializeTimestamp(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) {
    if ('toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
      return (value as { toDate: () => Date }).toDate().toISOString();
    }
    if ('seconds' in value && typeof (value as { seconds: number }).seconds === 'number') {
      return new Date((value as { seconds: number }).seconds * 1000).toISOString();
    }
  }
  return null;
}

export interface CompanyBackupBundle {
  company: Omit<Company, 'createdAt' | 'updatedAt'> & {
    createdAt: string | null;
    updatedAt: string | null;
  };
  summary: {
    schedulesCount: number;
    employeesCount: number;
    customHolidaysCount: number;
    monthOverridesCount: number;
  };
  schedules: Array<
    Omit<Schedule, 'createdAt' | 'updatedAt'> & {
      createdAt: string | null;
      updatedAt: string | null;
    }
  >;
  employees: Array<
    Omit<Employee, 'createdAt' | 'updatedAt'> & {
      createdAt: string | null;
      updatedAt: string | null;
    }
  >;
  customHolidays: Array<
    Omit<CustomHoliday, 'createdAt' | 'updatedAt'> & {
      createdAt: string | null;
      updatedAt: string | null;
    }
  >;
  monthOverrides: Array<
    Omit<MonthOverride, 'createdAt' | 'updatedAt'> & {
      createdAt: string | null;
      updatedAt: string | null;
    }
  >;
}

function buildCompanyBundle(
  company: Company,
  schedules: Schedule[],
  employees: Employee[],
  customHolidays: CustomHoliday[],
  monthOverrides: MonthOverride[]
): CompanyBackupBundle {
  const companySchedules = schedules.filter((s) => s.companyId === company.id);
  const companyEmployees = employees.filter((e) => e.companyId === company.id);
  const companyHolidays = customHolidays.filter((h) => h.companyId === company.id);
  const companyOverrides = monthOverrides.filter((o) => o.companyId === company.id);

  return {
    company: {
      id: company.id,
      ownerId: company.ownerId,
      name: company.name,
      cnpj: company.cnpj,
      address: company.address,
      createdAt: serializeTimestamp(company.createdAt),
      updatedAt: serializeTimestamp(company.updatedAt),
    },
    summary: {
      schedulesCount: companySchedules.length,
      employeesCount: companyEmployees.length,
      customHolidaysCount: companyHolidays.length,
      monthOverridesCount: companyOverrides.length,
    },
    schedules: companySchedules.map((s) => ({
      ...s,
      createdAt: serializeTimestamp(s.createdAt),
      updatedAt: serializeTimestamp(s.updatedAt),
    })),
    employees: companyEmployees.map((e) => ({
      ...e,
      createdAt: serializeTimestamp(e.createdAt),
      updatedAt: serializeTimestamp(e.updatedAt),
    })),
    customHolidays: companyHolidays.map((h) => ({
      ...h,
      createdAt: serializeTimestamp(h.createdAt),
      updatedAt: serializeTimestamp(h.updatedAt),
    })),
    monthOverrides: companyOverrides.map((o) => ({
      ...o,
      createdAt: serializeTimestamp(o.createdAt),
      updatedAt: serializeTimestamp(o.updatedAt),
    })),
  };
}

function triggerJsonDownload(data: unknown, filename: string): void {
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadCompanyBackupJson(params: {
  company: Company;
  schedules: Schedule[];
  employees: Employee[];
  customHolidays: CustomHoliday[];
  monthOverrides: MonthOverride[];
}): string {
  const { company, schedules, employees, customHolidays, monthOverrides } = params;
  const bundle = buildCompanyBundle(
    company,
    schedules,
    employees,
    customHolidays,
    monthOverrides
  );
  const payload = {
    schemaVersion: '1.0',
    application: 'PontoRural & Empresarial',
    exportedAt: new Date().toISOString(),
    ...bundle,
  };
  const dateStamp = new Date().toISOString().slice(0, 10);
  const filename = `Backup_${sanitizeFilename(company.name)}_${dateStamp}.json`;
  triggerJsonDownload(payload, filename);
  return filename;
}

export function downloadAllCompaniesBackupJson(params: {
  companies: Company[];
  schedules: Schedule[];
  employees: Employee[];
  customHolidays: CustomHoliday[];
  monthOverrides: MonthOverride[];
}): string {
  const { companies, schedules, employees, customHolidays, monthOverrides } = params;
  const payload = {
    schemaVersion: '1.0',
    application: 'PontoRural & Empresarial',
    exportedAt: new Date().toISOString(),
    companiesCount: companies.length,
    companies: companies.map((company) =>
      buildCompanyBundle(company, schedules, employees, customHolidays, monthOverrides)
    ),
  };
  const dateStamp = new Date().toISOString().slice(0, 10);
  const filename = `Backup_Completo_Todas_Empresas_${dateStamp}.json`;
  triggerJsonDownload(payload, filename);
  return filename;
}
