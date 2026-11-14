import React, { useState } from 'react';
import { Clock, Pencil, Plus, Trash2 } from 'lucide-react';
import { Company, FIELD_LIMITS, Schedule } from '../types/timesheet';
import { WEEKDAY_SHORT_PT } from '../utils/holidays';

interface SchedulesViewProps {
  activeCompany: Company | null;
  schedules: Schedule[];
  onSaveSchedule: (input: {
    id?: string;
    companyId: string;
    name: string;
    descriptionText: string;
    restDays: number[];
    defaultMorningEnd: string;
    defaultAfternoonStart: string;
    showPreFilledInterval: boolean;
  }) => Promise<string | undefined>;
  onDeleteSchedule: (id: string) => Promise<void>;
  onGoToCompanies: () => void;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

export const SchedulesView: React.FC<SchedulesViewProps> = ({
  activeCompany,
  schedules,
  onSaveSchedule,
  onDeleteSchedule,
  onGoToCompanies,
  canCreate = true,
  canEdit = true,
  canDelete = true,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [descriptionText, setDescriptionText] = useState('');
  const [restDays, setRestDays] = useState<number[]>([0, 6]);
  const [defaultMorningEnd, setDefaultMorningEnd] = useState('12:00');
  const [defaultAfternoonStart, setDefaultAfternoonStart] = useState('13:00');
  const [showPreFilledInterval, setShowPreFilledInterval] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!activeCompany) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
        <Clock className="w-8 h-8 text-slate-400 mx-auto" />
        <h3 className="font-display text-base font-semibold text-slate-900">
          Selecione ou cadastre uma empresa primeiro
        </h3>
        <p className="text-sm text-slate-600">
          As jornadas de trabalho são vinculadas a cada empresa ou fazenda.
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

  const openNew = () => {
    setEditingId(null);
    setName('');
    setDescriptionText(
      '07:00 AS 12:00/13:00 AS 17:00- QUI 07:00 AS 12:00/13:00 AS 16:00 - Sábado: 00:00 as : / : as 00:'
    );
    setRestDays([0, 6]);
    setDefaultMorningEnd('12:00');
    setDefaultAfternoonStart('13:00');
    setShowPreFilledInterval(true);
    setErrorMsg(null);
    setShowForm(true);
  };

  const openEdit = (sch: Schedule) => {
    setEditingId(sch.id);
    setName(sch.name);
    setDescriptionText(sch.descriptionText);
    setRestDays(sch.restDays);
    setDefaultMorningEnd(sch.defaultMorningEnd);
    setDefaultAfternoonStart(sch.defaultAfternoonStart);
    setShowPreFilledInterval(sch.showPreFilledInterval);
    setErrorMsg(null);
    setShowForm(true);
  };

  const toggleRestDay = (dayIdx: number) => {
    setRestDays((prev) =>
      prev.includes(dayIdx) ? prev.filter((d) => d !== dayIdx) : [...prev, dayIdx].sort()
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (name.trim().length < 2) {
      setErrorMsg('Informe um nome curto para identificar a jornada.');
      return;
    }
    if (descriptionText.trim().length < 2) {
      setErrorMsg('Informe o texto da jornada que aparecerá na folha.');
      return;
    }

    setSaving(true);
    try {
      await onSaveSchedule({
        id: editingId ?? undefined,
        companyId: activeCompany.id,
        name: name.trim(),
        descriptionText: descriptionText.trim(),
        restDays,
        defaultMorningEnd: defaultMorningEnd.trim(),
        defaultAfternoonStart: defaultAfternoonStart.trim(),
        showPreFilledInterval,
      });
      setShowForm(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao salvar jornada.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">Jornadas de Trabalho</h2>
          <p className="text-sm text-slate-600 mt-1">
            Configure os horários contratuais, dias de folga semanal e intervalo pré-assinalado
            para <span className="font-medium text-slate-900">{activeCompany.name}</span>.
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nova Jornada
          </button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-display text-base font-semibold text-slate-900">
              {editingId ? 'Editar Jornada' : 'Cadastrar Nova Jornada'}
            </h3>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              Cancelar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nome do Modelo de Jornada *
              </label>
              <input
                type="text"
                required
                maxLength={FIELD_LIMITS.scheduleNameMax}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Trabalhador Rural 44h"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Dias de Folga Semanal (marcados como &quot;Folga&quot; e sombreados)
              </label>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {WEEKDAY_SHORT_PT.map((label, idx) => {
                  const selected = restDays.includes(idx);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleRestDay(idx)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                        selected
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-700">
                  Texto da Jornada na Folha (linha &quot;Jornada de Trabalho:&quot;) *
                </label>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      setDescriptionText(
                        '07:00 AS 12:00/13:00 AS 17:00- QUI 07:00 AS 12:00/13:00 AS 16:00 - Sábado: 00:00 as : / : as 00:'
                      )
                    }
                    className="text-emerald-700 hover:underline cursor-pointer"
                  >
                    Padrão Rural 44h
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() =>
                      setDescriptionText(
                        '08:00 AS 12:00 / 13:00 AS 17:48 - Sábado: Compensado / Domingo: Folga'
                      )
                    }
                    className="text-emerald-700 hover:underline cursor-pointer"
                  >
                    Comercial Seg–Sex
                  </button>
                </div>
              </div>
              <input
                type="text"
                required
                maxLength={FIELD_LIMITS.scheduleDescMax}
                value={descriptionText}
                onChange={(e) => setDescriptionText(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              />
            </div>

            <div className="md:col-span-2 bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
              <label className="inline-flex items-center gap-2.5 text-sm font-medium text-slate-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPreFilledInterval}
                  onChange={(e) => setShowPreFilledInterval(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-700"
                />
                Pré-assinalar horário de intervalo nos dias úteis (como 12:00 / 13:00 no PDF modelo)
              </label>

              {showPreFilledInterval && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Saída Manhã (Início do intervalo)
                    </label>
                    <input
                      type="text"
                      maxLength={FIELD_LIMITS.timeMax}
                      value={defaultMorningEnd}
                      onChange={(e) => setDefaultMorningEnd(e.target.value)}
                      placeholder="12:00"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono-tabular text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Entrada Tarde (Retorno do intervalo)
                    </label>
                    <input
                      type="text"
                      maxLength={FIELD_LIMITS.timeMax}
                      value={defaultAfternoonStart}
                      onChange={(e) => setDefaultAfternoonStart(e.target.value)}
                      placeholder="13:00"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono-tabular text-slate-900"
                    />
                  </div>
                </div>
              )}
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
              {saving ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Salvar Jornada'}
            </button>
          </div>
        </form>
      )}

      {schedules.length === 0 && !showForm ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
          <Clock className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="font-display text-base font-semibold text-slate-900">
            Nenhuma jornada cadastrada nesta empresa
          </h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Crie ao menos uma jornada de trabalho para vincular aos funcionários admitidos.
          </p>
          {canCreate && (
            <button
              type="button"
              onClick={openNew}
              className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold cursor-pointer"
            >
              Criar Primeira Jornada
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Nome</th>
                  <th className="py-3 px-4">Descrição na Folha</th>
                  <th className="py-3 px-4">Folgas</th>
                  <th className="py-3 px-4">Intervalo</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {schedules.map((sch) => (
                  <tr key={sch.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                      {sch.name}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-md truncate">
                      {sch.descriptionText}
                    </td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                      {sch.restDays.length > 0
                        ? sch.restDays.map((d) => WEEKDAY_SHORT_PT[d]).join(', ')
                        : 'Nenhuma'}
                    </td>
                    <td className="py-3 px-4 font-mono-tabular text-slate-700 whitespace-nowrap">
                      {sch.showPreFilledInterval
                        ? `${sch.defaultMorningEnd} / ${sch.defaultAfternoonStart}`
                        : 'Em branco'}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => openEdit(sch)}
                            title="Editar jornada"
                            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete &&
                          (confirmDeleteId === sch.id ? (
                            <div className="inline-flex items-center gap-1 bg-red-50 border border-red-200 rounded-md px-2 py-1">
                              <span className="text-xs text-red-700">Excluir?</span>
                              <button
                                type="button"
                                onClick={async () => {
                                  await onDeleteSchedule(sch.id);
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
                              onClick={() => setConfirmDeleteId(sch.id)}
                              title="Excluir jornada"
                              className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
