import React, { useMemo, useState } from 'react';
import {
  Cake,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  Upload,
  Users,
} from 'lucide-react';
import { Company, Employee } from '../types/timesheet';
import { MONTH_NAMES_PT, WEEKDAY_FULL_PT, formatDateBr } from '../utils/holidays';

interface BirthdaysViewProps {
  activeCompany: Company | null;
  companies: Company[];
  employees: Employee[];
  canGoToEmployees: boolean;
  canGoToImport: boolean;
  canGoToCompanies: boolean;
  onGoToEmployees: () => void;
  onGoToImport: () => void;
  onGoToCompanies: () => void;
}

interface BirthdayEntry {
  employee: Employee;
  companyName: string;
  birthYear: number;
  birthMonth: number; // 1..12
  birthDay: number; // 1..31
  turningAge: number;
  weekdayName: string;
  statusTag: 'today' | 'tomorrow' | 'upcoming' | 'past' | 'other_month';
  daysUntil: number | null;
}

function parseBirthDateParts(birthDate?: string): { year: number; month: number; day: number } | null {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const [yStr, mStr, dStr] = birthDate.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);
  if (!Number.isInteger(year) || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function getEffectiveDateInYear(year: number, month: number, day: number): Date {
  const daysInMonth = new Date(year, month, 0).getDate();
  const safeDay = Math.min(day, daysInMonth);
  return new Date(year, month - 1, safeDay);
}

export const BirthdaysView: React.FC<BirthdaysViewProps> = ({
  activeCompany,
  companies,
  employees,
  canGoToEmployees,
  canGoToImport,
  canGoToCompanies,
  onGoToEmployees,
  onGoToImport,
  onGoToCompanies,
}) => {
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();

  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [scope, setScope] = useState<'active' | 'all'>('active');
  const [onlyActiveEmployees, setOnlyActiveEmployees] = useState<boolean>(true);
  const [search, setSearch] = useState('');

  const companyMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of companies) map.set(c.id, c.name);
    return map;
  }, [companies]);

  const scopedEmployees = useMemo(() => {
    const base =
      scope === 'active' && activeCompany
        ? employees.filter((e) => e.companyId === activeCompany.id)
        : employees;
    return onlyActiveEmployees ? base.filter((e) => e.active) : base;
  }, [employees, scope, activeCompany, onlyActiveEmployees]);

  const missingBirthDateCount = useMemo(
    () => scopedEmployees.filter((e) => !parseBirthDateParts(e.birthDate)).length,
    [scopedEmployees]
  );

  const monthBirthdays = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list: BirthdayEntry[] = [];

    for (const emp of scopedEmployees) {
      const parts = parseBirthDateParts(emp.birthDate);
      if (!parts || parts.month !== selectedMonth) continue;

      if (q) {
        const compName = (companyMap.get(emp.companyId) ?? '').toLowerCase();
        const matches =
          emp.name.toLowerCase().includes(q) ||
          emp.role.toLowerCase().includes(q) ||
          emp.registrationNumber.toLowerCase().includes(q) ||
          compName.includes(q);
        if (!matches) continue;
      }

      const celebrationDate = getEffectiveDateInYear(currentYear, parts.month, parts.day);
      const weekdayName = WEEKDAY_FULL_PT[celebrationDate.getDay()] ?? '';
      const turningAge = Math.max(0, currentYear - parts.year);

      let statusTag: BirthdayEntry['statusTag'] = 'other_month';
      let daysUntil: number | null = null;

      if (selectedMonth === currentMonth) {
        const diffMs = celebrationDate.getTime() - today.getTime();
        const diffDays = Math.round(diffMs / 86400000);
        daysUntil = diffDays;
        if (diffDays === 0) {
          statusTag = 'today';
        } else if (diffDays === 1) {
          statusTag = 'tomorrow';
        } else if (diffDays > 1) {
          statusTag = 'upcoming';
        } else {
          statusTag = 'past';
        }
      }

      list.push({
        employee: emp,
        companyName: companyMap.get(emp.companyId) ?? 'Empresa',
        birthYear: parts.year,
        birthMonth: parts.month,
        birthDay: parts.day,
        turningAge,
        weekdayName,
        statusTag,
        daysUntil,
      });
    }

    return list.sort((a, b) => {
      if (a.birthDay !== b.birthDay) return a.birthDay - b.birthDay;
      return a.employee.name.localeCompare(b.employee.name, 'pt-BR');
    });
  }, [scopedEmployees, selectedMonth, search, companyMap, currentYear, currentMonth, today]);

  const todayBirthdays = useMemo(() => {
    if (selectedMonth !== currentMonth) {
      return scopedEmployees.filter((e) => {
        const parts = parseBirthDateParts(e.birthDate);
        return parts?.month === currentMonth && parts?.day === currentDay;
      });
    }
    return monthBirthdays.filter((b) => b.statusTag === 'today').map((b) => b.employee);
  }, [scopedEmployees, monthBirthdays, selectedMonth, currentMonth, currentDay]);

  const nextSevenDaysCount = useMemo(() => {
    if (selectedMonth !== currentMonth) return 0;
    return monthBirthdays.filter(
      (b) => b.daysUntil !== null && b.daysUntil >= 0 && b.daysUntil <= 7
    ).length;
  }, [monthBirthdays, selectedMonth, currentMonth]);

  const stepMonth = (delta: number) => {
    setSelectedMonth((prev) => ((prev - 1 + delta + 12) % 12) + 1);
  };

  const handleExportCsv = () => {
    if (monthBirthdays.length === 0) return;
    const monthLabel = MONTH_NAMES_PT[selectedMonth - 1] ?? 'Mes';
    const headers = ['Dia', 'Data Nascimento', 'Idade', 'Nome', 'Registro', 'Cargo', 'Empresa', 'Situação'];
    const lines = [
      headers.join(';'),
      ...monthBirthdays.map((item) =>
        [
          `${String(item.birthDay).padStart(2, '0')}/${String(item.birthMonth).padStart(2, '0')}`,
          formatDateBr(item.employee.birthDate ?? ''),
          `${item.turningAge} anos`,
          item.employee.name,
          item.employee.registrationNumber,
          item.employee.role,
          item.companyName,
          item.employee.active ? 'Ativo' : 'Inativo',
        ].join(';')
      ),
    ];
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Aniversariantes_${monthLabel}_${currentYear}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (companies.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
        <Cake className="w-8 h-8 text-slate-400 mx-auto" />
        <h3 className="font-display text-base font-semibold text-slate-900">
          {canGoToCompanies
            ? 'Cadastre ou selecione uma empresa primeiro'
            : 'Nenhuma empresa habilitada para este usuário'}
        </h3>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          {canGoToCompanies
            ? 'Os lembretes de aniversariantes são exibidos a partir dos funcionários das empresas cadastradas.'
            : 'Solicite ao administrador a liberação de ao menos uma empresa para visualizar os aniversariantes.'}
        </p>
        {canGoToCompanies && (
          <button
            type="button"
            onClick={onGoToCompanies}
            className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold cursor-pointer"
          >
            Ir para Empresas
          </button>
        )}
      </div>
    );
  }

  const selectedMonthName = MONTH_NAMES_PT[selectedMonth - 1] ?? '';

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            Aniversariantes de {selectedMonthName}
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Acompanhe os aniversários do mês e antecipe lembretes para a equipe.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="inline-flex items-center border border-slate-200 rounded-lg bg-white">
            <button
              type="button"
              onClick={() => stepMonth(-1)}
              title="Mês anterior"
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-l-lg cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <select
              aria-label="Mês dos aniversariantes"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-transparent px-2.5 py-1.5 text-sm font-semibold text-slate-900 focus:outline-none cursor-pointer"
            >
              {MONTH_NAMES_PT.map((name, idx) => (
                <option key={name} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => stepMonth(1)}
              title="Próximo mês"
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-r-lg cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {selectedMonth !== currentMonth && (
            <button
              type="button"
              onClick={() => setSelectedMonth(currentMonth)}
              className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 whitespace-nowrap cursor-pointer"
            >
              Mês atual
            </button>
          )}

          <button
            type="button"
            disabled={monthBirthdays.length === 0}
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 disabled:opacity-50 whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Lembrete de aniversariantes do dia */}
      {todayBirthdays.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Cake className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="text-sm font-semibold text-emerald-950">
                Lembrete de hoje ({String(currentDay).padStart(2, '0')}/
                {String(currentMonth).padStart(2, '0')}): {todayBirthdays.length}{' '}
                {todayBirthdays.length === 1 ? 'aniversariante' : 'aniversariantes'}
              </div>
              <div className="text-xs text-emerald-900">
                {todayBirthdays.map((e) => e.name).join(' · ')}
              </div>
            </div>
          </div>
          {selectedMonth !== currentMonth && (
            <button
              type="button"
              onClick={() => setSelectedMonth(currentMonth)}
              className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold whitespace-nowrap cursor-pointer self-start sm:self-center"
            >
              Ver mês atual
            </button>
          )}
        </div>
      )}

      {/* Métricas do mês */}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <div className="text-xs font-medium text-slate-500">Em {selectedMonthName}</div>
          <div className="font-display text-2xl font-bold font-mono-tabular text-slate-900">
            {monthBirthdays.length}
          </div>
          <div className="text-xs text-slate-500">aniversariante(s) listado(s)</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <div className="text-xs font-medium text-slate-500">Aniversariando hoje</div>
          <div className="font-display text-2xl font-bold font-mono-tabular text-emerald-700">
            {todayBirthdays.length}
          </div>
          <div className="text-xs text-slate-500 font-mono-tabular">
            {String(currentDay).padStart(2, '0')}/{String(currentMonth).padStart(2, '0')}/
            {currentYear}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <div className="text-xs font-medium text-slate-500">Próximos 7 dias</div>
          <div className="font-display text-2xl font-bold font-mono-tabular text-slate-900">
            {selectedMonth === currentMonth ? nextSevenDaysCount : '—'}
          </div>
          <div className="text-xs text-slate-500">
            {selectedMonth === currentMonth
              ? 'celebrações na semana'
              : 'disponível no mês atual'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
          <div className="text-xs font-medium text-slate-500">Sem data cadastrada</div>
          <div className="font-display text-2xl font-bold font-mono-tabular text-amber-700">
            {missingBirthDateCount}
          </div>
          <div className="text-xs text-slate-500">
            {missingBirthDateCount > 0 && canGoToEmployees ? (
              <button
                type="button"
                onClick={onGoToEmployees}
                className="text-emerald-700 font-semibold hover:underline cursor-pointer"
              >
                Completar em Funcionários
              </button>
            ) : (
              'cadastros sem nascimento'
            )}
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, cargo, registro ou empresa..."
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {companies.length > 1 && (
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setScope('active')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  scope === 'active'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Empresa ativa
              </button>
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  scope === 'all'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todas habilitadas ({companies.length})
              </button>
            </div>
          )}

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setOnlyActiveEmployees(true)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                onlyActiveEmployees
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Somente ativos
            </button>
            <button
              type="button"
              onClick={() => setOnlyActiveEmployees(false)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                !onlyActiveEmployees
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Incluir inativos
            </button>
          </div>
        </div>
      </div>

      {/* Lista / Tabela de Aniversariantes */}
      {monthBirthdays.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
          <Cake className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="font-display text-base font-semibold text-slate-900">
            Nenhum aniversariante encontrado em {selectedMonthName}
          </h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            {missingBirthDateCount > 0
              ? `Existem ${missingBirthDateCount} colaborador(es) sem data de nascimento cadastrada. Preencha no cadastro ou atualize pela planilha de importação.`
              : 'Não há colaboradores fazendo aniversário no mês e filtro selecionados.'}
          </p>
          {(canGoToEmployees || canGoToImport) && (
            <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
              {canGoToEmployees && (
                <button
                  type="button"
                  onClick={onGoToEmployees}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold cursor-pointer"
                >
                  <Users className="w-4 h-4" />
                  Ir para Funcionários
                </button>
              )}
              {canGoToImport && (
                <button
                  type="button"
                  onClick={onGoToImport}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-slate-500" />
                  Atualizar via Planilha
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {/* Lista em cartões para Mobile (< md) */}
          <div className="md:hidden divide-y divide-slate-100">
            {monthBirthdays.map((item) => {
              const isToday = item.statusTag === 'today';
              const reminderLabel =
                item.statusTag === 'today'
                  ? 'Aniversaria hoje'
                  : item.statusTag === 'tomorrow'
                  ? 'Amanhã'
                  : item.statusTag === 'upcoming'
                  ? `Em ${item.daysUntil} dias`
                  : item.statusTag === 'past'
                  ? 'Já comemorado'
                  : item.weekdayName;

              return (
                <div
                  key={item.employee.id}
                  className={`p-4 space-y-2 ${isToday ? 'bg-emerald-50/70' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-slate-900 break-words">
                        {item.employee.name}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {item.employee.role} · Reg.{' '}
                        <span className="font-mono-tabular">{item.employee.registrationNumber}</span>
                        {!item.employee.active ? ' · Inativo' : ''}
                      </div>
                      {scope === 'all' && (
                        <div className="text-xs text-slate-600 mt-0.5 truncate">
                          {item.companyName}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono-tabular text-sm font-bold text-slate-900">
                        {String(item.birthDay).padStart(2, '0')}/
                        {String(item.birthMonth).padStart(2, '0')}
                      </div>
                      <div className="text-xs text-slate-500 font-mono-tabular">
                        {item.turningAge} anos
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                    <span
                      className={`font-semibold ${
                        isToday
                          ? 'text-emerald-800'
                          : item.statusTag === 'tomorrow' ||
                            (item.daysUntil !== null && item.daysUntil > 1 && item.daysUntil <= 7)
                          ? 'text-amber-700'
                          : 'text-slate-500 font-medium'
                      }`}
                    >
                      {reminderLabel}
                    </span>
                    <span className="font-mono-tabular text-slate-500">
                      Nasc.: {formatDateBr(item.employee.birthDate ?? '')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tabela Desktop (md+) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Dia</th>
                  <th className="py-2.5 px-4">Lembrete</th>
                  <th className="py-2.5 px-4">Colaborador</th>
                  <th className="py-2.5 px-4">Cargo</th>
                  {scope === 'all' && <th className="py-2.5 px-4">Empresa</th>}
                  <th className="py-2.5 px-4">Nascimento</th>
                  <th className="py-2.5 px-4 text-right">Idade em {currentYear}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {monthBirthdays.map((item) => {
                  const isToday = item.statusTag === 'today';
                  const reminderLabel =
                    item.statusTag === 'today'
                      ? 'Aniversaria hoje'
                      : item.statusTag === 'tomorrow'
                      ? 'Amanhã'
                      : item.statusTag === 'upcoming'
                      ? `Em ${item.daysUntil} dias`
                      : item.statusTag === 'past'
                      ? 'Já comemorado'
                      : item.weekdayName;

                  return (
                    <tr
                      key={item.employee.id}
                      className={
                        isToday
                          ? 'bg-emerald-50/70 hover:bg-emerald-50 transition-colors'
                          : 'hover:bg-slate-50/80 transition-colors'
                      }
                    >
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-mono-tabular font-semibold text-slate-900">
                          {String(item.birthDay).padStart(2, '0')}/
                          {String(item.birthMonth).padStart(2, '0')}
                        </div>
                        <div className="text-xs text-slate-500">{item.weekdayName}</div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`text-xs font-semibold ${
                            isToday
                              ? 'text-emerald-800'
                              : item.statusTag === 'tomorrow' ||
                                (item.daysUntil !== null && item.daysUntil > 1 && item.daysUntil <= 7)
                              ? 'text-amber-700'
                              : 'text-slate-500 font-medium'
                          }`}
                        >
                          {reminderLabel}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{item.employee.name}</div>
                        <div className="text-xs text-slate-500 font-mono-tabular">
                          Reg. {item.employee.registrationNumber}
                          {!item.employee.active ? ' · Inativo' : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                        {item.employee.role}
                      </td>
                      {scope === 'all' && (
                        <td className="py-3 px-4 text-slate-600 max-w-[220px] truncate">
                          {item.companyName}
                        </td>
                      )}
                      <td className="py-3 px-4 font-mono-tabular text-slate-700 whitespace-nowrap">
                        {formatDateBr(item.employee.birthDate ?? '')}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-slate-800 whitespace-nowrap">
                        {item.turningAge} anos
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
