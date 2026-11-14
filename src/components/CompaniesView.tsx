import React, { useRef, useState } from 'react';
import { Building2, Check, Download, Pencil, Plus, Sparkles, Trash2, Upload } from 'lucide-react';
import { Company, FIELD_LIMITS } from '../types/timesheet';
import { formatCnpjInput } from '../utils/holidays';

interface CompaniesViewProps {
  companies: Company[];
  activeCompanyId: string;
  onSelectCompany: (id: string) => void;
  onSaveCompany: (input: {
    id?: string;
    name: string;
    cnpj: string;
    address: string;
  }) => Promise<string | undefined>;
  onDeleteCompany: (id: string) => Promise<void>;
  onSeedExample: () => Promise<void>;
  onExportCompanyBackup: (company: Company) => string;
  onExportAllBackup: () => string;
  onImportBackupJson: (
    rawJson: string
  ) => Promise<{ companies: number; schedules: number; employees: number; holidays: number }>;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canBackup?: boolean;
  isWorkspaceOwner?: boolean;
}

export const CompaniesView: React.FC<CompaniesViewProps> = ({
  companies,
  activeCompanyId,
  onSelectCompany,
  onSaveCompany,
  onDeleteCompany,
  onSeedExample,
  onExportCompanyBackup,
  onExportAllBackup,
  onImportBackupJson,
  canCreate = true,
  canEdit = true,
  canDelete = true,
  canBackup = true,
  isWorkspaceOwner = true,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setBackupNotice(null);
    setImporting(true);
    try {
      const text = await file.text();
      const res = await onImportBackupJson(text);
      setBackupNotice(
        `Importação concluída: ${res.companies} empresa(s), ${res.schedules} jornada(s), ${res.employees} funcionário(s) e ${res.holidays} feriado(s).`
      );
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Falha ao importar arquivo JSON.');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const openNew = () => {
    setEditingId(null);
    setName('');
    setCnpj('');
    setAddress('');
    setErrorMsg(null);
    setShowForm(true);
  };

  const openEdit = (company: Company) => {
    setEditingId(company.id);
    setName(company.name);
    setCnpj(company.cnpj);
    setAddress(company.address);
    setErrorMsg(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (name.trim().length < 2) {
      setErrorMsg('Informe o nome ou razão social da empresa.');
      return;
    }
    if (cnpj.trim().length < 11) {
      setErrorMsg('Informe o CNPJ ou CPF válido do empregador.');
      return;
    }
    if (address.trim().length < 4) {
      setErrorMsg('Informe o endereço completo que sairá no cabeçalho da folha.');
      return;
    }

    setSaving(true);
    try {
      await onSaveCompany({
        id: editingId ?? undefined,
        name: name.trim().toUpperCase(),
        cnpj: cnpj.trim(),
        address: address.trim(),
      });
      setShowForm(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao salvar empresa.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            Empresas e Fazendas Empregadoras
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Cada empresa cadastrada preenche automaticamente o cabeçalho de empregador, CNPJ e
            endereço das folhas de ponto.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {companies.length === 0 ? (
            canCreate && isWorkspaceOwner && (
              <button
                type="button"
                onClick={onSeedExample}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-emerald-700" />
                Carregar Modelo Exemplo
              </button>
            )
          ) : (
            canBackup && (
              <button
                type="button"
                onClick={() => {
                  const filename = onExportAllBackup();
                  setBackupNotice(`Backup completo salvo em ${filename}`);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer"
              >
                <Download className="w-4 h-4 text-slate-600" />
                Backup Completo (JSON)
              </button>
            )
          )}
          {canBackup && isWorkspaceOwner && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleImportFile}
                className="hidden"
              />
              <button
                type="button"
                disabled={importing}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors whitespace-nowrap disabled:opacity-60 cursor-pointer"
              >
                <Upload className="w-4 h-4 text-slate-600" />
                {importing ? 'Importando...' : 'Restaurar JSON'}
              </button>
            </>
          )}
          {canCreate && isWorkspaceOwner && (
            <button
              type="button"
              onClick={openNew}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Nova Empresa
            </button>
          )}
        </div>
      </div>

      {backupNotice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-xs text-emerald-800 flex items-center justify-between gap-3">
          <span>{backupNotice}</span>
          <button
            type="button"
            onClick={() => setBackupNotice(null)}
            className="font-semibold hover:underline cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {importError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700 flex items-center justify-between gap-3">
          <span>{importError}</span>
          <button
            type="button"
            onClick={() => setImportError(null)}
            className="font-semibold hover:underline cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-display text-base font-semibold text-slate-900">
              {editingId ? 'Editar Empresa' : 'Cadastrar Nova Empresa'}
            </h3>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              Cancelar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Razão Social / Nome do Empregador *
              </label>
              <input
                type="text"
                required
                maxLength={FIELD_LIMITS.companyNameMax}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: LEMBRANÇA EMPREENDIMENTOS AGROPECUÁRIOS"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                CNPJ / CPF *
              </label>
              <input
                type="text"
                required
                maxLength={FIELD_LIMITS.cnpjMax}
                value={cnpj}
                onChange={(e) => setCnpj(formatCnpjInput(e.target.value))}
                placeholder="00.000.000/0001-00"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono-tabular text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Endereço Completo *
              </label>
              <input
                type="text"
                required
                maxLength={FIELD_LIMITS.addressMax}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ex.: Fazenda Conjunto São Jorge Estrada Colônia Km 15, Sede, Zona Rural, Eunápolis - BA"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              />
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
              {saving ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Salvar Empresa'}
            </button>
          </div>
        </form>
      )}

      {companies.length === 0 && !showForm ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
          <Building2 className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="font-display text-base font-semibold text-slate-900">
            {canCreate && isWorkspaceOwner
              ? 'Nenhuma empresa cadastrada'
              : 'Nenhuma empresa habilitada para este usuário'}
          </h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            {canCreate && isWorkspaceOwner
              ? 'Cadastre a fazenda ou empresa empregadora para começar a vincular jornadas e gerar folhas de ponto automaticamente.'
              : 'Solicite ao administrador da conta a liberação de ao menos uma empresa no seu usuário.'}
          </p>
          {canCreate && isWorkspaceOwner && (
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={openNew}
                className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold cursor-pointer"
              >
                Cadastrar Empresa
              </button>
              <button
                type="button"
                onClick={onSeedExample}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium cursor-pointer"
              >
                Carregar Modelo Exemplo
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Empregador</th>
                  <th className="py-3 px-4">CNPJ</th>
                  <th className="py-3 px-4">Endereço</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {companies.map((company) => {
                  const isActive = company.id === activeCompanyId;
                  return (
                    <tr key={company.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-900">
                        <div>{company.name}</div>
                        {isActive && (
                          <div className="text-xs text-emerald-700 font-medium mt-0.5">
                            Selecionada no painel
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono-tabular text-slate-700 whitespace-nowrap">
                        {company.cnpj}
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-md truncate">
                        {company.address}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {!isActive && (
                            <button
                              type="button"
                              onClick={() => onSelectCompany(company.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Ativar
                            </button>
                          )}
                          {canBackup && (
                            <button
                              type="button"
                              onClick={() => {
                                const filename = onExportCompanyBackup(company);
                                setBackupNotice(`Backup da empresa salvo em ${filename}`);
                              }}
                              title="Exportar backup JSON desta empresa"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Backup JSON
                            </button>
                          )}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => openEdit(company)}
                              title="Editar empresa"
                              className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete &&
                            (confirmDeleteId === company.id ? (
                              <div className="inline-flex items-center gap-1 bg-red-50 border border-red-200 rounded-md px-2 py-1">
                                <span className="text-xs text-red-700">Excluir tudo?</span>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await onDeleteCompany(company.id);
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
                                onClick={() => setConfirmDeleteId(company.id)}
                                title="Excluir empresa"
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
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
