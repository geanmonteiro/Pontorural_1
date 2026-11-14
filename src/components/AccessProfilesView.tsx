import React, { useMemo, useState } from 'react';
import { Check, Copy, Loader2, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import {
  ALL_PERMISSION_KEYS,
  PERMISSION_GROUPS,
  PRESET_PROFILES,
  PermissionKey,
  ScreenPermissionGroup,
} from '../constants/permissions';
import { AccessProfile, FIELD_LIMITS, TeamUser } from '../types/timesheet';

interface AccessProfilesViewProps {
  profiles: AccessProfile[];
  teamUsers: TeamUser[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onSaveProfile: (input: {
    id?: string;
    name: string;
    description: string;
    permissions: PermissionKey[];
  }) => Promise<string | undefined>;
  onDeleteProfile: (id: string) => Promise<void>;
}

export const AccessProfilesView: React.FC<AccessProfilesViewProps> = ({
  profiles,
  teamUsers,
  canCreate,
  canEdit,
  canDelete,
  onSaveProfile,
  onDeleteProfile,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<PermissionKey[]>([
    'studio.view',
    'studio.print',
    'studio.export_pdf',
    'companies.view',
  ]);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const usersCountByProfile = useMemo(() => {
    const map = new Map<string, number>();
    for (const u of teamUsers) {
      map.set(u.profileId, (map.get(u.profileId) ?? 0) + 1);
    }
    return map;
  }, [teamUsers]);

  const openNew = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setSelectedPermissions(['studio.view', 'studio.print', 'studio.export_pdf', 'companies.view']);
    setErrorMsg(null);
    setSuccessMsg(null);
    setShowForm(true);
  };

  const openEdit = (profile: AccessProfile) => {
    setEditingId(profile.id);
    setName(profile.name);
    setDescription(profile.description);
    setSelectedPermissions([...profile.permissions]);
    setErrorMsg(null);
    setSuccessMsg(null);
    setShowForm(true);
  };

  const duplicateProfile = (profile: AccessProfile) => {
    setEditingId(null);
    setName(`${profile.name} (Cópia)`.slice(0, FIELD_LIMITS.profileNameMax));
    setDescription(profile.description);
    setSelectedPermissions([...profile.permissions]);
    setErrorMsg(null);
    setSuccessMsg(null);
    setShowForm(true);
  };

  const toggleAction = (group: ScreenPermissionGroup, actionKey: PermissionKey) => {
    setSelectedPermissions((prev) => {
      const hasIt = prev.includes(actionKey);
      if (hasIt) {
        // Unchecking view removes all actions in that screen
        if (actionKey === group.viewKey) {
          const groupKeys = new Set(group.actions.map((a) => a.key));
          return prev.filter((k) => !groupKeys.has(k));
        }
        return prev.filter((k) => k !== actionKey);
      }
      // Checking any action inside a screen ensures viewKey is also enabled
      const next = new Set(prev);
      next.add(actionKey);
      next.add(group.viewKey);
      return Array.from(next);
    });
  };

  const toggleEntireGroup = (group: ScreenPermissionGroup) => {
    const groupKeys = group.actions.map((a) => a.key);
    const allEnabled = groupKeys.every((k) => selectedPermissions.includes(k));
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (allEnabled) {
        for (const k of groupKeys) next.delete(k);
      } else {
        for (const k of groupKeys) next.add(k);
      }
      return Array.from(next);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (name.trim().length < 2) {
      setErrorMsg('Informe um nome com ao menos 2 caracteres para o perfil.');
      return;
    }
    if (selectedPermissions.length === 0) {
      setErrorMsg('Habilite ao menos uma tela e ação para este perfil de acesso.');
      return;
    }

    setSaving(true);
    try {
      await onSaveProfile({
        id: editingId ?? undefined,
        name: name.trim(),
        description: description.trim(),
        permissions: selectedPermissions,
      });
      setSuccessMsg(
        editingId
          ? `Perfil "${name.trim()}" atualizado com sucesso.`
          : `Perfil "${name.trim()}" cadastrado com sucesso.`
      );
      setShowForm(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao salvar perfil de acesso.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            Perfis de Acesso e Ações das Telas
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Cadastre perfis personalizados e habilite exatamente quais telas e ações cada grupo de
            usuários pode executar.
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Novo Perfil de Acesso
          </button>
        )}
      </div>

      {successMsg && (
        <div className="flex items-center justify-between gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-xs text-emerald-800">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="font-semibold hover:underline cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Formulário de Criação / Edição */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-6"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900">
                {editingId ? 'Editar Perfil de Acesso' : 'Cadastrar Novo Perfil de Acesso'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Marque as telas e ações habilitadas para este perfil.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              Cancelar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-5">
              <label
                htmlFor="profile-name"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Nome do Perfil *
              </label>
              <input
                id="profile-name"
                type="text"
                required
                maxLength={FIELD_LIMITS.profileNameMax}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: RH Fazendas / Auxiliar Contábil"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              />
            </div>

            <div className="md:col-span-7">
              <label
                htmlFor="profile-desc"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Descrição do Perfil
              </label>
              <input
                id="profile-desc"
                type="text"
                maxLength={FIELD_LIMITS.profileDescMax}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Resumo das responsabilidades deste perfil"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              />
            </div>
          </div>

          {/* Modelos rápidos */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-medium text-slate-600">Aplicar base pronta:</span>
              {PRESET_PROFILES.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setSelectedPermissions([...preset.permissions])}
                  className="px-2.5 py-1.5 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium cursor-pointer"
                >
                  {preset.name}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="font-mono-tabular text-slate-500">
                {selectedPermissions.length}/{ALL_PERMISSION_KEYS.length} ações habilitadas
              </span>
              <button
                type="button"
                onClick={() => setSelectedPermissions([...ALL_PERMISSION_KEYS])}
                className="text-emerald-700 font-semibold hover:underline cursor-pointer"
              >
                Marcar tudo
              </button>
              <button
                type="button"
                onClick={() => setSelectedPermissions([])}
                className="text-slate-500 hover:underline cursor-pointer"
              >
                Desmarcar tudo
              </button>
            </div>
          </div>

          {/* Matriz de Telas e Ações */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {PERMISSION_GROUPS.map((group) => {
              const enabledInGroup = group.actions.filter((a) =>
                selectedPermissions.includes(a.key)
              ).length;
              const allInGroup = enabledInGroup === group.actions.length;
              const viewEnabled = selectedPermissions.includes(group.viewKey);

              return (
                <div
                  key={group.sectionId}
                  className={`border rounded-xl p-4 space-y-3 transition-colors ${
                    viewEnabled ? 'border-slate-300 bg-white' : 'border-slate-200 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-display text-sm font-bold text-slate-900">
                          {group.title}
                        </h4>
                        <span className="text-xs font-mono-tabular text-slate-500">
                          {enabledInGroup}/{group.actions.length}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{group.subtitle}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleEntireGroup(group)}
                      className="text-xs font-semibold text-emerald-700 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {allInGroup ? 'Desmarcar tela' : 'Habilitar tudo'}
                    </button>
                  </div>

                  <div className="space-y-2">
                    {group.actions.map((action) => {
                      const checked = selectedPermissions.includes(action.key);
                      const isView = action.key === group.viewKey;
                      return (
                        <label
                          key={action.key}
                          className="flex items-start gap-2.5 cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAction(group, action.key)}
                            className="mt-0.5 rounded border-slate-300 text-emerald-700 focus:ring-emerald-700 cursor-pointer"
                          />
                          <div className="min-w-0">
                            <div
                              className={`text-xs font-medium ${
                                isView ? 'text-slate-900 font-semibold' : 'text-slate-800'
                              }`}
                            >
                              {action.label}
                            </div>
                            <div className="text-[11px] text-slate-500">{action.description}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5"
            >
              {errorMsg}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
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
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold disabled:opacity-60 cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <span>{editingId ? 'Salvar Alterações' : 'Salvar Perfil'}</span>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Lista de Perfis Cadastrados */}
      {profiles.length === 0 && !showForm ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
          <ShieldCheck className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="font-display text-base font-semibold text-slate-900">
            Nenhum perfil de acesso cadastrado
          </h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Crie o primeiro perfil para definir quais telas e ações os usuários poderão utilizar.
          </p>
          {canCreate && (
            <button
              type="button"
              onClick={openNew}
              className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold cursor-pointer"
            >
              Cadastrar Primeiro Perfil
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {/* Cartões responsivos para Mobile (< md) */}
          <div className="md:hidden divide-y divide-slate-100">
            {profiles.map((profile) => {
              const enabledScreens = PERMISSION_GROUPS.filter((g) =>
                profile.permissions.includes(g.viewKey)
              );
              const linkedCount = usersCountByProfile.get(profile.id) ?? 0;

              return (
                <div key={profile.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-slate-900 break-words">
                        {profile.name}
                      </div>
                      {profile.description && (
                        <p className="text-xs text-slate-500 mt-0.5 break-words">
                          {profile.description}
                        </p>
                      )}
                    </div>
                    <span className="font-mono-tabular text-xs font-medium text-slate-700 shrink-0">
                      {linkedCount} {linkedCount === 1 ? 'usuário' : 'usuários'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1">
                    <div>
                      <span className="font-mono-tabular font-semibold text-slate-800">
                        {enabledScreens.length}/{PERMISSION_GROUPS.length} telas
                      </span>{' '}
                      ·{' '}
                      <span className="font-mono-tabular">
                        {profile.permissions.length}/{ALL_PERMISSION_KEYS.length} ações
                      </span>
                    </div>
                    <div className="text-slate-500">
                      {enabledScreens.map((s) => s.title.split(' (')[0]).join(' · ') || 'Nenhuma'}
                    </div>
                  </div>

                  {(canCreate || canEdit || canDelete) && (
                    <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      {canCreate && (
                        <button
                          type="button"
                          onClick={() => duplicateProfile(profile)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          Duplicar
                        </button>
                      )}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => openEdit(profile)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Editar
                        </button>
                      )}
                      {canDelete &&
                        (confirmDeleteId === profile.id ? (
                          <div className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-md px-2.5 py-1.5">
                            <span className="text-xs text-red-700">Excluir?</span>
                            <button
                              type="button"
                              onClick={async () => {
                                if (linkedCount > 0) {
                                  setErrorMsg(
                                    `O perfil "${profile.name}" está atribuído a ${linkedCount} usuário(s). Altere o perfil desses usuários antes de excluir.`
                                  );
                                  setShowForm(false);
                                  setConfirmDeleteId(null);
                                  return;
                                }
                                await onDeleteProfile(profile.id);
                                setConfirmDeleteId(null);
                              }}
                              className="text-xs font-semibold text-red-700 hover:underline cursor-pointer"
                            >
                              Sim
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-xs text-slate-500 hover:underline cursor-pointer"
                            >
                              Não
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(profile.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-red-600 hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Excluir
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Tabela Desktop (md+) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Perfil de Acesso</th>
                  <th className="py-3 px-4">Telas Habilitadas</th>
                  <th className="py-3 px-4">Ações Liberadas</th>
                  <th className="py-3 px-4">Usuários Vinculados</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {profiles.map((profile) => {
                  const enabledScreens = PERMISSION_GROUPS.filter((g) =>
                    profile.permissions.includes(g.viewKey)
                  );
                  const linkedCount = usersCountByProfile.get(profile.id) ?? 0;

                  return (
                    <tr key={profile.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{profile.name}</div>
                        {profile.description && (
                          <div className="text-xs text-slate-500 max-w-md truncate">
                            {profile.description}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700 max-w-xs">
                        <div className="font-mono-tabular text-slate-900 font-medium">
                          {enabledScreens.length}/{PERMISSION_GROUPS.length} telas
                        </div>
                        <div className="text-slate-500 truncate">
                          {enabledScreens.map((s) => s.title.split(' (')[0]).join(' · ') || 'Nenhuma'}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono-tabular text-slate-700 whitespace-nowrap">
                        {profile.permissions.length}/{ALL_PERMISSION_KEYS.length} ações
                      </td>
                      <td className="py-3 px-4 font-mono-tabular text-slate-700 whitespace-nowrap">
                        {linkedCount} {linkedCount === 1 ? 'usuário' : 'usuários'}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {canCreate && (
                            <button
                              type="button"
                              onClick={() => duplicateProfile(profile)}
                              title="Duplicar perfil"
                              className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          )}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => openEdit(profile)}
                              title="Editar permissões do perfil"
                              className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete &&
                            (confirmDeleteId === profile.id ? (
                              <div className="inline-flex items-center gap-1 bg-red-50 border border-red-200 rounded-md px-2 py-1">
                                <span className="text-xs text-red-700">Excluir?</span>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (linkedCount > 0) {
                                      setErrorMsg(
                                        `O perfil "${profile.name}" está atribuído a ${linkedCount} usuário(s). Altere o perfil desses usuários antes de excluir.`
                                      );
                                      setShowForm(false);
                                      setConfirmDeleteId(null);
                                      return;
                                    }
                                    await onDeleteProfile(profile.id);
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
                                onClick={() => setConfirmDeleteId(profile.id)}
                                title={
                                  linkedCount > 0
                                    ? 'Perfil em uso por usuários'
                                    : 'Excluir perfil'
                                }
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

      {errorMsg && !showForm && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700 flex items-center justify-between gap-3"
        >
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="font-semibold hover:underline cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}
    </div>
  );
};
