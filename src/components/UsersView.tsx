import React, { useMemo, useState } from 'react';
import {
  Check,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Search,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { FIELD_LIMITS, TeamUser, TeamUserRole } from '../types/timesheet';

interface UsersViewProps {
  currentUserEmail: string;
  currentUserName: string;
  teamUsers: TeamUser[];
  onCreateUser: (input: {
    displayName: string;
    email: string;
    password: string;
    role: TeamUserRole;
    active: boolean;
  }) => Promise<string | undefined>;
  onUpdateUser: (input: {
    id: string;
    displayName: string;
    role: TeamUserRole;
    active: boolean;
  }) => Promise<void>;
  onDeleteUser: (id: string) => Promise<void>;
}

const ROLE_LABELS: Record<TeamUserRole, string> = {
  admin: 'Administrador',
  rh: 'Gestor de RH',
  operador: 'Operador',
};

const ROLE_DESCRIPTIONS: Record<TeamUserRole, string> = {
  admin: 'Acesso completo a empresas, jornadas, usuários e folhas A4.',
  rh: 'Cadastro de funcionários, importação de planilhas e emissão de folhas.',
  operador: 'Geração de folhas de ponto e ajustes diários.',
};

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
  onCreateUser,
  onUpdateUser,
  onDeleteUser,
}) => {
  const [showForm, setShowForm] = useState(true);
  const [editingUser, setEditingUser] = useState<TeamUser | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<TeamUserRole>('rh');
  const [active, setActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teamUsers.filter((u) => {
      if (statusFilter === 'active' && !u.active) return false;
      if (statusFilter === 'inactive' && u.active) return false;
      if (!q) return true;
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        ROLE_LABELS[u.role].toLowerCase().includes(q)
      );
    });
  }, [teamUsers, search, statusFilter]);

  const openCreate = () => {
    setEditingUser(null);
    setDisplayName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setRole('rh');
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
    setRole(userItem.role);
    setActive(userItem.active);
    setErrorMsg(null);
    setSuccessMsg(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (displayName.trim().length < 2) {
      setErrorMsg('Informe o nome completo do usuário.');
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
          displayName: displayName.trim(),
          role,
          active,
        });
        setSuccessMsg(`Dados do usuário ${displayName.trim()} atualizados com sucesso.`);
        setEditingUser(null);
        setDisplayName('');
        setEmail('');
      } else {
        await onCreateUser({
          displayName: displayName.trim(),
          email: email.trim().toLowerCase(),
          password,
          role,
          active,
        });
        setSuccessMsg(
          `Usuário ${displayName.trim()} criado no Firebase Authentication. Enviamos um e-mail de verificação para ${email.trim().toLowerCase()}.`
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

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            Criação e Gestão de Usuários
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Crie novas contas de acesso (e-mail e senha) no Firebase Authentication e controle os
            perfis da equipe.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          Novo Usuário
        </button>
      </div>

      {/* Formulário de Criação / Edição de Usuário */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900">
                {editingUser ? `Editar Usuário — ${editingUser.email}` : 'Criar Novo Usuário'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {editingUser
                  ? 'Atualize o nome, perfil de acesso ou situação cadastral.'
                  : 'O novo usuário receberá um link de confirmação de e-mail do Firebase sem desconectar sua sessão atual.'}
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
              <label
                htmlFor="team-user-role"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Perfil de Permissão *
              </label>
              <select
                id="team-user-role"
                value={role}
                onChange={(e) => setRole(e.target.value as TeamUserRole)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              >
                <option value="admin">Administrador — Acesso total ao painel</option>
                <option value="rh">Gestor de RH — Funcionários, planilhas e folhas</option>
                <option value="operador">Operador — Emissão e impressão de folhas A4</option>
              </select>
              <p className="text-xs text-slate-500 mt-1">{ROLE_DESCRIPTIONS[role]}</p>
            </div>

            <div className="md:col-span-2 flex items-center pt-4">
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

      {/* Conta Principal + Filtros */}
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

      {/* Tabela de Usuários Cadastrados */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <div>
            Conta principal conectada:{' '}
            <strong className="text-slate-900">{currentUserName || 'Titular'}</strong> ·{' '}
            <span className="font-mono-tabular">{currentUserEmail}</span>
          </div>
          <div className="font-mono-tabular text-slate-500">
            {teamUsers.length} usuário(s) adicional(is)
          </div>
        </div>

        {teamUsers.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Users className="w-8 h-8 text-slate-400 mx-auto" />
            <h3 className="font-display text-base font-semibold text-slate-900">
              Nenhum usuário adicional cadastrado
            </h3>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              Use o formulário acima para criar novos acessos com e-mail e senha no Firebase.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Nome</th>
                  <th className="py-2.5 px-4">E-mail de Acesso</th>
                  <th className="py-2.5 px-4">Perfil</th>
                  <th className="py-2.5 px-4">Situação</th>
                  <th className="py-2.5 px-4">Criado em</th>
                  <th className="py-2.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-4 font-medium text-slate-900">{u.displayName}</td>
                    <td className="py-2.5 px-4 font-mono-tabular text-slate-700 whitespace-nowrap">
                      {u.email}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 whitespace-nowrap">
                      {ROLE_LABELS[u.role]}
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
                        <button
                          type="button"
                          onClick={() => openEdit(u)}
                          title="Editar usuário"
                          className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {confirmDeleteId === u.id ? (
                          <div className="inline-flex items-center gap-1 bg-red-50 border border-red-200 rounded-md px-2 py-1">
                            <span className="text-xs text-red-700">Remover?</span>
                            <button
                              type="button"
                              onClick={async () => {
                                await onDeleteUser(u.id);
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
                            title="Remover usuário da lista"
                            className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-sm text-slate-500">
                      Nenhum usuário encontrado para o filtro aplicado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
