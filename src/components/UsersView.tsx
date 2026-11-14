import React, { useMemo, useState } from 'react';
import {
  Building2,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { PERMISSION_GROUPS } from '../constants/permissions';
import { AccessProfile, Company, FIELD_LIMITS, TeamUser } from '../types/timesheet';

interface UsersViewProps {
  currentUserEmail: string;
  currentUserName: string;
  teamUsers: TeamUser[];
  accessProfiles: AccessProfile[];
  companies: Company[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canViewProfiles: boolean;
  onOpenProfiles?: () => void;
  onCreateUser: (input: {
    displayName: string;
    email: string;
    password: string;
    profileId: string;
    allowedCompanyIds: string[];
    active: boolean;
  }) => Promise<string | undefined>;
  onUpdateUser: (input: {
    id: string;
    authUid: string;
    displayName: string;
    profileId: string;
    allowedCompanyIds: string[];
    active: boolean;
  }) => Promise<void>;
  onDeleteUser: (user: TeamUser) => Promise<void>;
}

function formatTimestampBr(ts: unknown): string {
  if (!ts) return '—';
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts) {
    const d = (ts as { toDate: () => Date }).toDate();
    return d.toLocaleDateString('pt-BR');
  }
  return '—';
}

export const UsersView: React.FC<UsersViewProps> = ({
  currentUserEmail,
  currentUserName,
  teamUsers,
  accessProfiles,
  companies,
  canCreate,
  canEdit,
  canDelete,
  canViewProfiles,
  onOpenProfiles,
  onCreateUser,
  onUpdateUser,
  onDeleteUser,
}) => {
  const [showForm, setShowForm] = useState(canCreate);
  const [editingUser, setEditingUser] = useState<TeamUser | null>(null);

  const defaultProfileId = accessProfiles[0]?.id ?? '';
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [profileId, setProfileId] = useState(defaultProfileId);
  const [allowedCompanyIds, setAllowedCompanyIds] = useState<string[]>(() =>
    companies.map((c) => c.id)
  );
  const [active, setActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const profileMap = useMemo(() => {
    const map = new Map<string, AccessProfile>();
    for (const p of accessProfiles) map.set(p.id, p);
    return map;
  }, [accessProfiles]);

  const companyMap = useMemo(() => {
    const map = new Map<string, Company>();
    for (const c of companies) map.set(c.id, c);
    return map;
  }, [companies]);

  const effectiveProfileId = useMemo(() => {
    if (profileId && profileMap.has(profileId)) return profileId;
    return accessProfiles[0]?.id ?? '';
  }, [profileId, profileMap, accessProfiles]);

  const selectedProfile = effectiveProfileId ? profileMap.get(effectiveProfileId) ?? null : null;

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teamUsers.filter((u) => {
      if (statusFilter === 'active' && !u.active) return false;
      if (statusFilter === 'inactive' && u.active) return false;
      if (!q) return true;
      const pName = profileMap.get(u.profileId)?.name ?? '';
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        pName.toLowerCase().includes(q)
      );
    });
  }, [teamUsers, search, statusFilter, profileMap]);

  const openCreate = () => {
    setEditingUser(null);
    setDisplayName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setProfileId(accessProfiles[0]?.id ?? '');
    setAllowedCompanyIds(companies.map((c) => c.id));
    setActive(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setShowForm(true);
  };

  const openEdit = (userItem: TeamUser) => {
    setEditingUser(userItem);
    setDisplayName(userItem.displayName);
    setEmail(userItem.email);
    setPassword('');
    setConfirmPassword('');
    setProfileId(userItem.profileId || accessProfiles[0]?.id || '');
    setAllowedCompanyIds(userItem.allowedCompanyIds ?? []);
    setActive(userItem.active);
    setErrorMsg(null);
    setSuccessMsg(null);
    setShowForm(true);
  };

  const toggleCompany = (cid: string) => {
    setAllowedCompanyIds((prev) =>
      prev.includes(cid) ? prev.filter((x) => x !== cid) : [...prev, cid]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (displayName.trim().length < 2) {
      setErrorMsg('Informe o nome completo do usuário.');
      return;
    }

    if (!effectiveProfileId) {
      setErrorMsg('Cadastre ou selecione um perfil de acesso antes de salvar o usuário.');
      return;
    }

    if (!editingUser) {
      if (!email.trim() || !email.includes('@')) {
        setErrorMsg('Informe um e-mail válido para o usuário.');
        return;
      }
      if (password.length < 6) {
        setErrorMsg('A senha deve ter no mínimo 6 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('As senhas digitadas não coincidem.');
        return;
      }
    }

    setSaving(true);
    try {
      if (editingUser) {
        await onUpdateUser({
          id: editingUser.id,
          authUid: editingUser.authUid,
          displayName: displayName.trim(),
          profileId: effectiveProfileId,
          allowedCompanyIds,
          active,
        });
        setSuccessMsg(`Permissões e empresas de ${displayName.trim()} atualizadas.`);
        setEditingUser(null);
        setDisplayName('');
        setEmail('');
        if (!canCreate) setShowForm(false);
      } else {
        await onCreateUser({
          displayName: displayName.trim(),
          email: email.trim().toLowerCase(),
          password,
          profileId: effectiveProfileId,
          allowedCompanyIds,
          active,
        });
        setSuccessMsg(
          `Usuário ${displayName.trim()} criado no Firebase Authentication com ${allowedCompanyIds.length} empresa(s) habilitada(s). Enviamos o link de verificação para ${email.trim().toLowerCase()}.`
        );
        setDisplayName('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao salvar usuário.');
    } finally {
      setSaving(false);
    }
  };

  const canShowForm = showForm && (editingUser ? canEdit : canCreate);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            Criação de Usuários e Empresas Habilitadas
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Crie logins no Firebase, atribua um perfil de acesso e escolha exatamente quais empresas
            o usuário poderá acessar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canViewProfiles && onOpenProfiles && (
            <button
              type="button"
              onClick={onOpenProfiles}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              Perfis de Acesso
            </button>
          )}
          {canCreate && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              Novo Usuário
            </button>
          )}
        </div>
      </div>

      {/* Formulário de Criação / Edição de Usuário */}
      {canShowForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900">
                {editingUser ? `Editar Usuário — ${editingUser.email}` : 'Criar Novo Usuário'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {editingUser
                  ? 'Altere o perfil de acesso, as empresas habilitadas ou a situação do usuário.'
                  : 'O usuário receberá um e-mail de verificação do Firebase e verá apenas as telas e empresas liberadas.'}
              </p>
            </div>
            {teamUsers.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingUser(null);
                  setErrorMsg(null);
                }}
                className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                Recolher
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="md:col-span-3">
              <label
                htmlFor="team-user-name"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Nome Completo *
              </label>
              <input
                id="team-user-name"
                type="text"
                required
                maxLength={FIELD_LIMITS.teamUserNameMax}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ex.: Mariana Souza"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              />
            </div>

            <div className="md:col-span-3">
              <label
                htmlFor="team-user-email"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                E-mail de Acesso *
              </label>
              <input
                id="team-user-email"
                type="email"
                required
                disabled={Boolean(editingUser)}
                maxLength={FIELD_LIMITS.teamUserEmailMax}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colaborador@empresa.com.br"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-50 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              />
            </div>

            {!editingUser && (
              <>
                <div className="md:col-span-3">
                  <label
                    htmlFor="team-user-password"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Senha Inicial *
                  </label>
                  <div className="relative">
                    <input
                      id="team-user-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full rounded-lg border border-slate-200 pl-3 pr-10 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="md:col-span-3">
                  <label
                    htmlFor="team-user-confirm-password"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Confirmar Senha *
                  </label>
                  <input
                    id="team-user-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a senha"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                  />
                </div>
              </>
            )}

            <div className="md:col-span-4">
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="team-user-profile"
                  className="block text-xs font-medium text-slate-700"
                >
                  Perfil de Acesso *
                </label>
                {canViewProfiles && onOpenProfiles && (
                  <button
                    type="button"
                    onClick={onOpenProfiles}
                    className="text-xs font-medium text-emerald-700 hover:underline cursor-pointer"
                  >
                    Configurar perfis
                  </button>
                )}
              </div>
              <select
                id="team-user-profile"
                required
                value={effectiveProfileId}
                onChange={(e) => setProfileId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              >
                {accessProfiles.length === 0 ? (
                  <option value="">Nenhum perfil cadastrado</option>
                ) : (
                  accessProfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.permissions.length} ações)
                    </option>
                  ))
                )}
              </select>
              {selectedProfile && (
                <p className="text-xs text-slate-500 mt-1">
                  Telas liberadas:{' '}
                  {PERMISSION_GROUPS.filter((g) =>
                    selectedProfile.permissions.includes(g.viewKey)
                  )
                    .map((g) => g.title.split(' (')[0])
                    .join(', ') || 'Nenhuma'}
                </p>
              )}
            </div>

            <div className="md:col-span-2 flex items-center pt-1 md:pt-4">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-700 cursor-pointer"
                />
                Usuário ativo
              </label>
            </div>
          </div>

          {/* Seletor de Empresas Habilitadas */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
              <div>
                <div className="text-xs font-semibold text-slate-900">
                  Empresas Habilitadas para este Usuário
                </div>
                <p className="text-xs text-slate-500">
                  O usuário só visualizará e operará nas empresas selecionadas abaixo.
                </p>
              </div>
              {companies.length > 0 && (
                <div className="flex items-center gap-3 text-xs shrink-0">
                  <span className="font-mono-tabular text-slate-600">
                    {allowedCompanyIds.length}/{companies.length} selecionada(s)
                  </span>
                  <button
                    type="button"
                    onClick={() => setAllowedCompanyIds(companies.map((c) => c.id))}
                    className="text-emerald-700 font-semibold hover:underline cursor-pointer"
                  >
                    Todas
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllowedCompanyIds([])}
                    className="text-slate-500 hover:underline cursor-pointer"
                  >
                    Limpar
                  </button>
                </div>
              )}
            </div>

            {companies.length === 0 ? (
              <div className="text-xs text-slate-500 py-2 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-400" />
                <span>
                  Nenhuma empresa cadastrada ainda. Cadastre uma empresa antes de liberar acesso.
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
                {companies.map((comp) => {
                  const checked = allowedCompanyIds.includes(comp.id);
                  return (
                    <label
                      key={comp.id}
                      className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                        checked
                          ? 'bg-white border-emerald-700/50 text-slate-900'
                          : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCompany(comp.id)}
                        className="mt-0.5 rounded border-slate-300 text-emerald-700 focus:ring-emerald-700 cursor-pointer"
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">{comp.name}</div>
                        <div className="font-mono-tabular text-[11px] text-slate-500">
                          {comp.cnpj}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {successMsg && (
            <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
              <Check className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5"
            >
              {errorMsg}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            {editingUser && (
              <button
                type="button"
                onClick={openCreate}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancelar Edição
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold disabled:opacity-60 cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{editingUser ? 'Salvando...' : 'Criando usuário...'}</span>
                </>
              ) : editingUser ? (
                <span>Salvar Alterações</span>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Criar Usuário</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar usuário por nome, e-mail ou perfil..."
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
          {(
            [
              { id: 'all', label: `Todos (${teamUsers.length})` },
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

      {/* Tabela de Usuários */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <div>
            Conta conectada:{' '}
            <strong className="text-slate-900">{currentUserName || 'Titular'}</strong> ·{' '}
            <span className="font-mono-tabular">{currentUserEmail}</span>
          </div>
          <div className="font-mono-tabular text-slate-500">
            {teamUsers.length} usuário(s) cadastrado(s)
          </div>
        </div>

        {teamUsers.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Users className="w-8 h-8 text-slate-400 mx-auto" />
            <h3 className="font-display text-base font-semibold text-slate-900">
              Nenhum usuário adicional cadastrado
            </h3>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              Use o formulário acima para criar novos usuários, escolher um perfil de acesso e
              habilitar as empresas permitidas.
            </p>
          </div>
        ) : (
          <>
            {/* Lista em cartões para Mobile (< md) */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredUsers.map((u) => {
                const profileName =
                  profileMap.get(u.profileId)?.name ?? 'Perfil não encontrado';
                const allowedIds = u.allowedCompanyIds ?? [];
                const enabledNames = allowedIds
                  .map((cid) => companyMap.get(cid)?.name)
                  .filter((n): n is string => Boolean(n));

                return (
                  <div key={u.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-slate-900 break-words">
                          {u.displayName}
                        </div>
                        <div className="font-mono-tabular text-xs text-slate-600 break-all">
                          {u.email}
                        </div>
                      </div>
                      <span
                        className={`text-xs font-semibold shrink-0 ${
                          u.active ? 'text-emerald-700' : 'text-slate-400'
                        }`}
                      >
                        {u.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-700 space-y-1">
                      <div>
                        <span className="text-slate-500">Perfil: </span>
                        <span className="font-medium text-slate-900">{profileName}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Empresas ({allowedIds.length}): </span>
                        <span className="text-slate-700">
                          {enabledNames.length > 0
                            ? enabledNames.join(' · ')
                            : 'Nenhuma empresa liberada'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Criado em: </span>
                        <span className="font-mono-tabular text-slate-700">
                          {formatTimestampBr(u.createdAt)}
                        </span>
                      </div>
                    </div>

                    {(canEdit || canDelete) && (
                      <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => openEdit(u)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Editar
                          </button>
                        )}
                        {canDelete &&
                          (confirmDeleteId === u.id ? (
                            <div className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-md px-2.5 py-1.5">
                              <span className="text-xs text-red-700">Remover?</span>
                              <button
                                type="button"
                                onClick={async () => {
                                  await onDeleteUser(u);
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
                              onClick={() => setConfirmDeleteId(u.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-red-600 hover:bg-red-50 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Remover
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredUsers.length === 0 && (
                <div className="py-8 px-4 text-center text-sm text-slate-500">
                  Nenhum usuário encontrado para o filtro aplicado.
                </div>
              )}
            </div>

            {/* Tabela Desktop (md+) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Nome</th>
                  <th className="py-2.5 px-4">E-mail de Acesso</th>
                  <th className="py-2.5 px-4">Perfil de Acesso</th>
                  <th className="py-2.5 px-4">Empresas Habilitadas</th>
                  <th className="py-2.5 px-4">Situação</th>
                  <th className="py-2.5 px-4">Criado em</th>
                  <th className="py-2.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredUsers.map((u) => {
                  const profileName =
                    profileMap.get(u.profileId)?.name ?? 'Perfil não encontrado';
                  const allowedIds = u.allowedCompanyIds ?? [];
                  const enabledNames = allowedIds
                    .map((cid) => companyMap.get(cid)?.name)
                    .filter((n): n is string => Boolean(n));

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4 font-medium text-slate-900">{u.displayName}</td>
                      <td className="py-2.5 px-4 font-mono-tabular text-slate-700 whitespace-nowrap">
                        {u.email}
                      </td>
                      <td className="py-2.5 px-4 text-slate-700 whitespace-nowrap">
                        {profileName}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-700 max-w-xs">
                        <div className="font-mono-tabular font-medium text-slate-900">
                          {allowedIds.length} empresa(s)
                        </div>
                        <div className="text-slate-500 truncate">
                          {enabledNames.length > 0
                            ? enabledNames.join(' · ')
                            : 'Nenhuma empresa liberada'}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span
                          className={`text-xs font-medium ${
                            u.active ? 'text-emerald-700' : 'text-slate-400'
                          }`}
                        >
                          {u.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono-tabular text-slate-600 whitespace-nowrap">
                        {formatTimestampBr(u.createdAt)}
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => openEdit(u)}
                              title="Editar usuário e empresas"
                              className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete &&
                            (confirmDeleteId === u.id ? (
                              <div className="inline-flex items-center gap-1 bg-red-50 border border-red-200 rounded-md px-2 py-1">
                                <span className="text-xs text-red-700">Remover?</span>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await onDeleteUser(u);
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
                                onClick={() => setConfirmDeleteId(u.id)}
                                title="Remover usuário"
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
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-sm text-slate-500">
                      Nenhum usuário encontrado para o filtro aplicado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    </div>
  );
};
