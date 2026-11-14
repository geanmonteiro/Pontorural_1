import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, Pencil, Plus, Search, Trash2, Upload, Users } from 'lucide-react';
import { Company, Employee, FIELD_LIMITS, Schedule } from '../types/timesheet';
import { formatCpfInput, formatDateBr } from '../utils/holidays';

interface EmployeesViewProps {
  activeCompany: Company | null;
  schedules: Schedule[];
  employees: Employee[];
  onSaveEmployee: (input: {
    id?: string;
    companyId: string;
    scheduleId: string;
    name: string;
    role: string;
    cpf: string;
    registrationNumber: string;
    admissionDate: string;
    active: boolean;
  }) => Promise<string | undefined>;
  onDeleteEmployee: (id: string) => Promise<void>;
  onGenerateForEmployee: (employeeId: string) => void;
  onGoToCompanies: () => void;
  onGoToSchedules: () => void;
  onOpenImport?: () => void;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canGenerateSheet?: boolean;
  canImport?: boolean;
}

export const EmployeesView: React.FC<EmployeesViewProps> = ({
  activeCompany,
  schedules,
  employees,
  onSaveEmployee,
  onDeleteEmployee,
  onGenerateForEmployee,
  onGoToCompanies,
  onGoToSchedules,
  onOpenImport,
  canCreate = true,
  canEdit = true,
  canDelete = true,
  canGenerateSheet = true,
  canImport = true,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [cpf, setCpf] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [admissionDate, setAdmissionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [scheduleId, setScheduleId] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const scheduleMap = useMemo(() => {
    const map = new Map<string, Schedule>();
    for (const s of schedules) map.set(s.id, s);
    return map;
  }, [schedules]);

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((emp) => {
      if (statusFilter === 'active' && !emp.active) return false;
      if (statusFilter === 'inactive' && emp.active) return false;
      if (!q) return true;
      return (
        emp.name.toLowerCase().includes(q) ||
        emp.cpf.toLowerCase().includes(q) ||
        emp.registrationNumber.toLowerCase().includes(q) ||
        emp.role.toLowerCase().includes(q)
      );
    });
  }, [employees, search, statusFilter]);

  if (!activeCompany) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
        <Users className="w-8 h-8 text-slate-400 mx-auto" />
        <h3 className="font-display text-base font-semibold text-slate-900">
          Selecione ou cadastre uma empresa primeiro
        </h3>
        <p className="text-sm text-slate-600">
          Os funcionários são vinculados a uma empresa empregadora.
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
          Cadastre uma jornada antes de admitir funcionários
        </h3>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Todo funcionário precisa de uma jornada de trabalho vinculada para definir os dias de
          folga e horários da folha.
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

  const openNew = () => {
    setEditingId(null);
    setName('');
    setRole('040 - TRABALHADOR RURAL');
    setCpf('');
    setRegistrationNumber('');
    setAdmissionDate(new Date().toISOString().slice(0, 10));
    setScheduleId(schedules[0]?.id ?? '');
    setActive(true);
    setErrorMsg(null);
    setShowForm(true);
  };

  const openEdit = (emp: Employee) => {
    setEditingId(emp.id);
    setName(emp.name);
    setRole(emp.role);
    setCpf(emp.cpf);
    setRegistrationNumber(emp.registrationNumber);
    setAdmissionDate(emp.admissionDate);
    setScheduleId(emp.scheduleId);
    setActive(emp.active);
    setErrorMsg(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (name.trim().length < 2) {
      setErrorMsg('Informe o nome completo do empregado.');
      return;
    }
    if (role.trim().length < 2) {
      setErrorMsg('Informe o cargo do empregado.');
      return;
    }
    if (cpf.trim().length < 11) {
      setErrorMsg('Informe o CPF completo do empregado.');
      return;
    }
    if (registrationNumber.trim().length < 1) {
      setErrorMsg('Informe o número de registro.');
      return;
    }
    if (!scheduleId) {
      setErrorMsg('Selecione uma jornada de trabalho.');
      return;
    }

    setSaving(true);
    try {
      await onSaveEmployee({
        id: editingId ?? undefined,
        companyId: activeCompany.id,
        scheduleId,
        name: name.trim(),
        role: role.trim(),
        cpf: cpf.trim(),
        registrationNumber: registrationNumber.trim(),
        admissionDate,
        active,
      });
      setShowForm(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao salvar funcionário.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            Funcionários — {activeCompany.name}
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Gerencie os colaboradores admitidos e gere a folha de ponto individual ou em lote.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onOpenImport && canImport && (
            <button
              type="button"
              onClick={onOpenImport}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
            >
              <Upload className="w-4 h-4 text-slate-500" />
              Importar Planilha
            </button>
          )}
          {canCreate && (
            <button
              type="button"
              onClick={openNew}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Admitir Funcionário
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-display text-base font-semibold text-slate-900">
              {editingId ? 'Editar Funcionário' : 'Cadastrar Novo Funcionário'}
            </h3>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              Cancelar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="md:col-span-4">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nome Completo do Empregado *
              </label>
              <input
                type="text"
                required
                maxLength={FIELD_LIMITS.employeeNameMax}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: SAVIO JESUS DA CRUZ"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">CPF *</label>
              <input
                type="text"
                required
                maxLength={FIELD_LIMITS.cpfMax}
                value={cpf}
                onChange={(e) => setCpf(formatCpfInput(e.target.value))}
                placeholder="000.000.000-00"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono-tabular text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Cargo (Código e Descrição) *
              </label>
              <input
                type="text"
                required
                maxLength={FIELD_LIMITS.employeeRoleMax}
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Ex.: 040 - TRABALHADOR RURAL"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              />
            </div>

            <div className="md:col-span-1">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nº Registro *
              </label>
              <input
                type="text"
                required
                maxLength={FIELD_LIMITS.registrationMax}
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                placeholder="2183"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono-tabular text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Data de Admissão *
              </label>
              <input
                type="date"
                required
                value={admissionDate}
                onChange={(e) => setAdmissionDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono-tabular text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              />
            </div>

            <div className="md:col-span-4">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Jornada de Trabalho *
              </label>
              <select
                required
                value={scheduleId}
                onChange={(e) => setScheduleId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              >
                {schedules.map((sch) => (
                  <option key={sch.id} value={sch.id}>
                    {sch.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2 flex items-end pb-2">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-700"
                />
                Funcionário ativo na folha
              </label>
            </div>
          </div>

          {errorMsg && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {errorMsg}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold disabled:opacity-60 cursor-pointer"
            >
              {saving ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Salvar Funcionário'}
            </button>
          </div>
        </form>
      )}

      {/* Barra de busca e filtro */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, CPF, cargo ou registro..."
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
          {(
            [
              { id: 'all', label: 'Todos' },
              { id: 'active', label: 'Ativos' },
              { id: 'inactive', label: 'Inativos' },
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
      </div>

      {employees.length === 0 && !showForm ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
          <Users className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="font-display text-base font-semibold text-slate-900">
            Nenhum funcionário cadastrado
          </h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Cadastre o primeiro trabalhador admitido para emitir sua folha de ponto em segundos.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {canCreate && (
              <button
                type="button"
                onClick={openNew}
                className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold cursor-pointer"
              >
                Admitir Primeiro Funcionário
              </button>
            )}
            {onOpenImport && canImport && (
              <button
                type="button"
                onClick={onOpenImport}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold cursor-pointer"
              >
                <Upload className="w-4 h-4 text-slate-500" />
                Importar Planilha
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Registro</th>
                  <th className="py-2.5 px-4">Nome do Empregado</th>
                  <th className="py-2.5 px-4">Cargo</th>
                  <th className="py-2.5 px-4">CPF</th>
                  <th className="py-2.5 px-4">Admissão</th>
                  <th className="py-2.5 px-4">Situação</th>
                  <th className="py-2.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredEmployees.map((emp) => {
                  const sch = scheduleMap.get(emp.scheduleId);
                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4 font-mono-tabular text-slate-700 whitespace-nowrap">
                        {emp.registrationNumber}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-900">
                        <div>{emp.name}</div>
                        <div className="text-xs text-slate-500 truncate max-w-xs">
                          {sch?.name ?? 'Jornada não vinculada'}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-slate-700 whitespace-nowrap">{emp.role}</td>
                      <td className="py-2.5 px-4 font-mono-tabular text-slate-700 whitespace-nowrap">
                        {emp.cpf}
                      </td>
                      <td className="py-2.5 px-4 font-mono-tabular text-slate-700 whitespace-nowrap">
                        {formatDateBr(emp.admissionDate)}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span
                          className={`text-xs font-medium ${
                            emp.active ? 'text-emerald-700' : 'text-slate-400'
                          }`}
                        >
                          {emp.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {canGenerateSheet && (
                            <button
                              type="button"
                              onClick={() => onGenerateForEmployee(emp.id)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-700 hover:border-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 transition-colors cursor-pointer"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5" />
                              Gerar Folha
                            </button>
                          )}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => openEdit(emp)}
                              title="Editar funcionário"
                              className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete &&
                            (confirmDeleteId === emp.id ? (
                              <div className="inline-flex items-center gap-1 bg-red-50 border border-red-200 rounded-md px-2 py-1">
                                <span className="text-xs text-red-700">Excluir?</span>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await onDeleteEmployee(emp.id);
                                    setConfirmDeleteId(null);
                                  }}
                                  className="text-xs font-semibold text-red-700 hover:underline cursor-pointer"
                                >
                                  Sim
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="text-xs text-slate-500 hover:underline cursor-pointer ml-1"
                                >
                                  Não
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(emp.id)}
                                title="Excluir funcionário"
                                className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredEmployees.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-sm text-slate-500">
                      Nenhum funcionário encontrado para o filtro aplicado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
