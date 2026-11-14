import React, { useEffect } from 'react';
import { User } from 'firebase/auth';
import {
  Building2,
  Cake,
  CalendarDays,
  Clock,
  Download,
  FileSpreadsheet,
  LogOut,
  ShieldCheck,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { Company } from '../types/timesheet';

export type AppSection =
  | 'studio'
  | 'employees'
  | 'importEmployees'
  | 'birthdays'
  | 'schedules'
  | 'holidays'
  | 'companies'
  | 'users'
  | 'profiles';

interface SidebarProps {
  activeSection: AppSection;
  onSelectSection: (section: AppSection) => void;
  visibleSections: AppSection[];
  companies: Company[];
  activeCompany: Company | null;
  onSelectCompany: (companyId: string) => void;
  user: User;
  onLogout: () => void;
  employeeCount: number;
  onExportActiveCompanyBackup: (company: Company) => void;
  canExportBackup: boolean;
  canCreateCompany: boolean;
  isWorkspaceOwner: boolean;
  profileLabel?: string;
  planLabel?: string;
  onOpenPlanModal: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: { id: AppSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'studio', label: 'Gerar Folhas', icon: FileSpreadsheet },
  { id: 'employees', label: 'Funcionários', icon: Users },
  { id: 'importEmployees', label: 'Importar Planilha', icon: Upload },
  { id: 'birthdays', label: 'Aniversariantes', icon: Cake },
  { id: 'schedules', label: 'Jornadas', icon: Clock },
  { id: 'holidays', label: 'Feriados', icon: CalendarDays },
  { id: 'companies', label: 'Empresas', icon: Building2 },
  { id: 'users', label: 'Usuários', icon: UserPlus },
  { id: 'profiles', label: 'Perfis de Acesso', icon: ShieldCheck },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  visibleSections,
  companies,
  activeCompany,
  onSelectCompany,
  user,
  onLogout,
  employeeCount,
  onExportActiveCompanyBackup,
  canExportBackup,
  canCreateCompany,
  isWorkspaceOwner,
  profileLabel,
  planLabel,
  onOpenPlanModal,
  mobileOpen,
  onCloseMobile,
}) => {
  const navItems = NAV_ITEMS.filter((item) => visibleSections.includes(item.id));

  useEffect(() => {
    if (!mobileOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseMobile();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [mobileOpen, onCloseMobile]);

  const handleNavClick = (section: AppSection) => {
    onSelectSection(section);
    onCloseMobile();
  };

  const handleCompanySelect = (companyId: string) => {
    onSelectCompany(companyId);
  };

  const sidebarContent = (isDrawer: boolean) => (
    <div className="flex flex-col justify-between h-full">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
          <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap truncate">
            PontoRural & Empresarial
          </span>
          {isDrawer && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Fechar menu"
              className="p-1.5 -mr-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Seletor de Empresa Ativa */}
        <div className="p-4 border-b border-slate-200">
          <label
            htmlFor={isDrawer ? 'company-switcher-mobile' : 'company-switcher'}
            className="block text-xs font-medium text-slate-500 mb-1.5"
          >
            Empresa ativa
          </label>
          {companies.length > 0 ? (
            <select
              id={isDrawer ? 'company-switcher-mobile' : 'company-switcher'}
              value={activeCompany?.id ?? ''}
              onChange={(e) => handleCompanySelect(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
            >
              {companies.map((comp) => (
                <option key={comp.id} value={comp.id}>
                  {comp.name}
                </option>
              ))}
            </select>
          ) : canCreateCompany ? (
            <button
              type="button"
              onClick={() => handleNavClick('companies')}
              className="w-full text-left rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-600 hover:border-emerald-700 hover:text-emerald-700 transition-colors cursor-pointer"
            >
              + Cadastrar primeira empresa
            </button>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500">
              Nenhuma empresa habilitada
            </div>
          )}
          {activeCompany && (
            <div className="mt-2 space-y-2">
              <div className="text-xs text-slate-500 font-mono-tabular truncate">
                {activeCompany.cnpj} · {employeeCount} colab.
              </div>
              {canExportBackup && (
                <button
                  type="button"
                  onClick={() => onExportActiveCompanyBackup(activeCompany)}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>Exportar Backup JSON</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Navegação */}
        <nav className="p-3 space-y-1" aria-label="Navegação principal">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-emerald-700' : 'text-slate-400'
                  }`}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Conta do Usuário e Plano */}
      <div className="p-4 border-t border-slate-200 space-y-2.5 shrink-0">
        {isWorkspaceOwner && planLabel && (
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 text-xs">
            <span className="text-slate-600 font-medium truncate">{planLabel}</span>
            <button
              type="button"
              onClick={() => {
                onCloseMobile();
                onOpenPlanModal();
              }}
              className="text-emerald-700 font-semibold hover:underline shrink-0 cursor-pointer"
            >
              Alterar
            </button>
          </div>
        )}
        {!isWorkspaceOwner && profileLabel && (
          <div className="pb-2 border-b border-slate-100 text-xs text-slate-600 truncate">
            Perfil: <strong className="text-slate-800">{profileLabel}</strong>
          </div>
        )}
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-900 truncate">
            {user.displayName || 'Usuário'}
          </div>
          <div className="text-xs text-slate-500 truncate">{user.email}</div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:text-red-700 hover:border-red-200 hover:bg-red-50 transition-colors whitespace-nowrap cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5 shrink-0" />
          <span>Sair da conta</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Sidebar fixa no Desktop (lg+) */}
      <aside className="no-print hidden lg:flex lg:w-[260px] lg:sticky lg:top-0 lg:h-screen shrink-0 bg-white border-r border-slate-200 flex-col">
        {sidebarContent(false)}
      </aside>

      {/* Drawer deslizante no Mobile/Tablet (< lg) */}
      {mobileOpen && (
        <div
          className="no-print fixed inset-0 z-50 lg:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navegação"
        >
          <div
            onClick={onCloseMobile}
            className="fixed inset-0 bg-slate-900/45 transition-opacity"
            aria-hidden="true"
          />
          <aside className="relative z-10 w-[min(86vw,300px)] max-w-full h-full bg-white border-r border-slate-200 shadow-xl flex flex-col">
            {sidebarContent(true)}
          </aside>
        </div>
      )}
    </>
  );
};
