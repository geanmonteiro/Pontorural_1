import React from 'react';
import { User } from 'firebase/auth';
import {
  Building2,
  CalendarDays,
  Clock,
  Download,
  FileSpreadsheet,
  LogOut,
  Upload,
  UserPlus,
  Users,
} from 'lucide-react';
import { Company } from '../types/timesheet';

export type AppSection =
  | 'studio'
  | 'employees'
  | 'importEmployees'
  | 'companies'
  | 'schedules'
  | 'holidays'
  | 'users';

interface SidebarProps {
  activeSection: AppSection;
  onSelectSection: (section: AppSection) => void;
  companies: Company[];
  activeCompany: Company | null;
  onSelectCompany: (companyId: string) => void;
  user: User;
  onLogout: () => void;
  employeeCount: number;
  onExportActiveCompanyBackup: (company: Company) => void;
  planLabel?: string;
  onOpenPlanModal: () => void;
}

const NAV_ITEMS: { id: AppSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'studio', label: 'Gerar Folhas', icon: FileSpreadsheet },
  { id: 'employees', label: 'Funcionários', icon: Users },
  { id: 'importEmployees', label: 'Importar Planilha', icon: Upload },
  { id: 'schedules', label: 'Jornadas', icon: Clock },
  { id: 'holidays', label: 'Feriados', icon: CalendarDays },
  { id: 'companies', label: 'Empresas', icon: Building2 },
  { id: 'users', label: 'Usuários', icon: UserPlus },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  companies,
  activeCompany,
  onSelectCompany,
  user,
  onLogout,
  employeeCount,
  onExportActiveCompanyBackup,
  planLabel,
  onOpenPlanModal,
}) => {
  return (
    <aside className="no-print w-full lg:w-[260px] shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col justify-between">
      <div>
        <div className="px-5 py-4 border-b border-slate-200">
          <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap block">
            PontoRural & Empresarial
          </span>
        </div>

        {/* Seletor de Empresa Ativa */}
        <div className="p-4 border-b border-slate-200">
          <label
            htmlFor="company-switcher"
            className="block text-xs font-medium text-slate-500 mb-1.5"
          >
            Empresa ativa
          </label>
          {companies.length > 0 ? (
            <select
              id="company-switcher"
              value={activeCompany?.id ?? ''}
              onChange={(e) => onSelectCompany(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
            >
              {companies.map((comp) => (
                <option key={comp.id} value={comp.id}>
                  {comp.name}
                </option>
              ))}
            </select>
          ) : (
            <button
              type="button"
              onClick={() => onSelectSection('companies')}
              className="w-full text-left rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-600 hover:border-emerald-700 hover:text-emerald-700 transition-colors cursor-pointer"
            >
              + Cadastrar primeira empresa
            </button>
          )}
          {activeCompany && (
            <div className="mt-2 space-y-2">
              <div className="text-xs text-slate-500 font-mono-tabular truncate">
                {activeCompany.cnpj} · {employeeCount} colab.
              </div>
              <button
                type="button"
                onClick={() => onExportActiveCompanyBackup(activeCompany)}
                className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Exportar Backup JSON</span>
              </button>
            </div>
          )}
        </div>

        {/* Navegação */}
        <nav className="p-3 space-y-1" aria-label="Navegação principal">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectSection(item.id)}
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
      <div className="p-4 border-t border-slate-200 hidden lg:block space-y-2.5">
        {planLabel && (
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 text-xs">
            <span className="text-slate-600 font-medium truncate">{planLabel}</span>
            <button
              type="button"
              onClick={onOpenPlanModal}
              className="text-emerald-700 font-semibold hover:underline shrink-0 cursor-pointer"
            >
              Alterar
            </button>
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
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:text-red-700 hover:border-red-200 hover:bg-red-50 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sair da conta</span>
        </button>
      </div>
    </aside>
  );
};
