import React, { useMemo, useState } from 'react';
import { CalendarDays, Pencil, Plus, Trash2 } from 'lucide-react';
import { Company, CustomHoliday, FIELD_LIMITS } from '../types/timesheet';
import { formatDateBr, getNationalHolidaysForYear } from '../utils/holidays';

interface HolidaysViewProps {
  activeCompany: Company | null;
  customHolidays: CustomHoliday[];
  includeFacultativos: boolean;
  onToggleFacultativos: (val: boolean) => void;
  onSaveCustomHoliday: (input: {
    id?: string;
    companyId: string;
    name: string;
    dateKey: string;
    recurringYearly: boolean;
  }) => Promise<string | undefined>;
  onDeleteCustomHoliday: (id: string) => Promise<void>;
  onGoToCompanies: () => void;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

export const HolidaysView: React.FC<HolidaysViewProps> = ({
  activeCompany,
  customHolidays,
  includeFacultativos,
  onToggleFacultativos,
  onSaveCustomHoliday,
  onDeleteCustomHoliday,
  onGoToCompanies,
  canCreate = true,
  canEdit = true,
  canDelete = true,
}) => {
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [dateValue, setDateValue] = useState(`${new Date().getFullYear()}-06-24`);
  const [recurringYearly, setRecurringYearly] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canShowForm = editingId ? canEdit : canCreate;

  const nationalHolidays = useMemo(
    () => getNationalHolidaysForYear(selectedYear, true),
    [selectedYear]
  );

  if (!activeCompany) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
        <CalendarDays className="w-8 h-8 text-slate-400 mx-auto" />
        <h3 className="font-display text-base font-semibold text-slate-900">
          Selecione ou cadastre uma empresa primeiro
        </h3>
        <p className="text-sm text-slate-600">
          Os feriados municipais e estaduais são configurados por empresa.
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

  const startEdit = (ch: CustomHoliday) => {
    if (!canEdit) return;
    setEditingId(ch.id);
    setName(ch.name);
    setRecurringYearly(ch.recurringYearly);
    setDateValue(
      ch.recurringYearly && ch.dateKey.length === 5
        ? `${selectedYear}-${ch.dateKey}`
        : ch.dateKey
    );
    setErrorMsg(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setName('');
    setDateValue(`${selectedYear}-06-24`);
    setRecurringYearly(true);
    setErrorMsg(null);
  };

  const handleSaveHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canShowForm) return;
    setErrorMsg(null);
    if (name.trim().length < 2) {
      setErrorMsg('Informe o nome do feriado.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      setErrorMsg('Informe uma data válida.');
      return;
    }

    setSaving(true);
    try {
      const dateKey = recurringYearly ? dateValue.slice(5) : dateValue;
      await onSaveCustomHoliday({
        id: editingId ?? undefined,
        companyId: activeCompany.id,
        name: name.trim(),
        dateKey,
        recurringYearly,
      });
      setEditingId(null);
      setName('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao salvar feriado.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            Feriados Nacionais e Locais
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Feriados nacionais são aplicados automaticamente em qualquer ano. Adicione abaixo
            feriados municipais, estaduais ou datas específicas da{' '}
            <span className="font-medium text-slate-900">{activeCompany.name}</span>.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor="holiday-year" className="text-xs font-medium text-slate-600">
            Ano:
          </label>
          <select
            id="holiday-year"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono-tabular text-slate-900"
          >
            {Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Feriados Personalizados da Empresa */}
        <div className="lg:col-span-6 space-y-4">
          {canShowForm && (
            <form
              onSubmit={handleSaveHoliday}
              className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-semibold text-slate-900">
                  {editingId ? 'Editar Feriado Local / Estadual' : 'Adicionar Feriado Local / Estadual'}
                </h3>
                {editingId && (
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
                  >
                    Cancelar edição
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nome do Feriado *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={FIELD_LIMITS.holidayNameMax}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex.: São João / Aniversário da Cidade"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Data *</label>
                  <input
                    type="date"
                    required
                    value={dateValue}
                    onChange={(e) => setDateValue(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono-tabular text-slate-900"
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={recurringYearly}
                      onChange={(e) => setRecurringYearly(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-700"
                    />
                    Repetir todo ano nesta data
                  </label>
                </div>
              </div>

              {errorMsg && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold disabled:opacity-60 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                {saving
                  ? 'Salvando...'
                  : editingId
                  ? 'Salvar Alterações'
                  : 'Adicionar Feriado'}
              </button>
            </form>
          )}

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              Feriados Personalizados da Empresa ({customHolidays.length})
            </div>
            {customHolidays.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                Nenhum feriado municipal ou estadual cadastrado ainda.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {customHolidays.map((ch) => {
                  const displayDate = ch.recurringYearly
                    ? `${ch.dateKey.split('-').reverse().join('/')} (Anual)`
                    : formatDateBr(ch.dateKey);
                  return (
                    <li
                      key={ch.id}
                      className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50"
                    >
                      <div>
                        <div className="font-medium text-slate-900">{ch.name}</div>
                        <div className="text-xs font-mono-tabular text-slate-500">
                          {displayDate}
                        </div>
                      </div>
                      {(canEdit || canDelete) && (
                        <div className="inline-flex items-center gap-1">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => startEdit(ch)}
                              title="Editar feriado"
                              className="p-1.5 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => onDeleteCustomHoliday(ch.id)}
                              title="Remover feriado"
                              className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Feriados Nacionais Calculados */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-600">
              Feriados Nacionais — {selectedYear}
            </span>
            <label
              className={`inline-flex items-center gap-2 text-xs text-slate-700 ${
                canCreate || canEdit ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'
              }`}
            >
              <input
                type="checkbox"
                checked={includeFacultativos}
                disabled={!canCreate && !canEdit}
                onChange={(e) => onToggleFacultativos(e.target.checked)}
                className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-700"
              />
              Aplicar Carnaval e Corpus Christi automaticamente
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <tbody className="divide-y divide-slate-100">
                {nationalHolidays.map((h) => {
                  const active = includeFacultativos || !h.isFacultativo;
                  return (
                    <tr key={h.isoDate} className={active ? '' : 'opacity-50'}>
                      <td className="py-2.5 px-3 sm:px-4 font-mono-tabular text-slate-700 whitespace-nowrap">
                        {formatDateBr(h.isoDate)}
                      </td>
                      <td className="py-2.5 px-3 sm:px-4 font-medium text-slate-900">{h.name}</td>
                      <td className="py-2.5 px-3 sm:px-4 text-right text-xs text-slate-500 whitespace-nowrap">
                        {h.isFacultativo ? 'Facultativo' : 'Nacional'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
