import React, { useMemo, useState } from 'react';
import { AccessProfilesView } from './components/AccessProfilesView';
import { AuthScreen } from './components/AuthScreen';
import { BirthdaysView } from './components/BirthdaysView';
import { CompaniesView } from './components/CompaniesView';
import { EmployeesView } from './components/EmployeesView';
import { HolidaysView } from './components/HolidaysView';
import { ImportEmployeesView } from './components/ImportEmployeesView';
import { SchedulesView } from './components/SchedulesView';
import { AppSection, Sidebar } from './components/Sidebar';
import { TimesheetStudio } from './components/TimesheetStudio';
import { UsersView } from './components/UsersView';
import { getSectionViewKey } from './constants/permissions';
import { useTimesheetStore } from './hooks/useTimesheetStore';
import {
  downloadAllCompaniesBackupJson,
  downloadCompanyBackupJson,
} from './utils/backupExport';
import {
  BillingCycle,
  PlanId,
  SUBSCRIPTION_PLANS,
  formatBrlPrice,
  getPlanById,
} from './constants/plans';
import { Check, LogOut, ShieldAlert, ShieldCheck, X } from 'lucide-react';

const ALL_SECTIONS: AppSection[] = [
  'studio',
  'employees',
  'importEmployees',
  'birthdays',
  'schedules',
  'holidays',
  'companies',
  'users',
  'profiles',
];

const SECTION_TITLES: Record<AppSection, string> = {
  studio: 'Estúdio de Folhas A4',
  employees: 'Cadastro de Funcionários',
  importEmployees: 'Importar Planilha de Funcionários',
  birthdays: 'Aniversariantes do Mês',
  schedules: 'Jornadas de Trabalho',
  holidays: 'Feriados Nacionais e Locais',
  companies: 'Empresas e Fazendas',
  users: 'Criação de Usuários',
  profiles: 'Perfis de Acesso',
};

export default function App() {
  const store = useTimesheetStore();
  const [activeSection, setActiveSection] = useState<AppSection>('studio');
  const [focusedEmployeeId, setFocusedEmployeeId] = useState<string | null>(null);
  const [includeFacultativos, setIncludeFacultativos] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [modalCycle, setModalCycle] = useState<BillingCycle>(
    store.subscription?.billingCycle ?? 'monthly'
  );
  const [savingPlan, setSavingPlan] = useState(false);

  const visibleSections = useMemo(
    () => ALL_SECTIONS.filter((sec) => store.can(getSectionViewKey(sec))),
    [store]
  );

  const effectiveSection: AppSection = visibleSections.includes(activeSection)
    ? activeSection
    : visibleSections[0] ?? 'studio';

  const currentPlan = getPlanById(store.subscription?.planId);
  const planLabel = store.subscription
    ? `Plano ${currentPlan.name} · ${
        store.subscription.billingCycle === 'yearly' ? 'Anual' : 'Mensal'
      }`
    : 'Selecionar plano';

  if (!store.authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm text-slate-600">Carregando sessão...</div>
      </div>
    );
  }

  if (!store.user || !store.emailVerified) {
    return (
      <AuthScreen
        pendingUser={store.user}
        loading={store.authLoading}
        error={store.authError}
        message={store.authMessage}
        onSignIn={store.signInWithEmail}
        onRegister={store.registerWithEmail}
        onResetPassword={store.sendResetPassword}
        onResendVerification={store.resendVerificationEmail}
        onRefreshVerification={store.refreshEmailVerification}
        onLogout={store.logout}
        onClearFeedback={store.clearAuthFeedback}
      />
    );
  }

  if (store.accessDeniedInactive) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6 text-red-600" />
          </div>
          <div className="space-y-1.5">
            <h1 className="font-display text-lg font-bold text-slate-900">
              Acesso Desativado
            </h1>
            <p className="text-sm text-slate-600">
              Seu usuário ({store.user.email}) está inativo ou teve o vínculo removido pelo
              administrador da conta. Entre em contato com o responsável para reativar seu
              acesso.
            </p>
          </div>
          <button
            type="button"
            onClick={store.logout}
            className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-800 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sair da conta
          </button>
        </div>
      </div>
    );
  }

  const canCreateCompany = store.can('companies.create') && store.isWorkspaceOwner;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row print:block print:bg-white print:min-h-0">
      <Sidebar
        activeSection={effectiveSection}
        onSelectSection={setActiveSection}
        visibleSections={visibleSections}
        companies={store.companies}
        activeCompany={store.activeCompany}
        onSelectCompany={store.selectCompany}
        user={store.user}
        onLogout={store.logout}
        employeeCount={store.companyEmployees.length}
        onExportActiveCompanyBackup={(company) =>
          downloadCompanyBackupJson({
            company,
            schedules: store.schedules,
            employees: store.employees,
            customHolidays: store.customHolidays,
            monthOverrides: store.monthOverrides,
          })
        }
        canExportBackup={store.can('companies.backup')}
        canCreateCompany={canCreateCompany}
        isWorkspaceOwner={store.isWorkspaceOwner}
        profileLabel={store.assignedProfile?.name}
        planLabel={planLabel}
        onOpenPlanModal={() => {
          setModalCycle(store.subscription?.billingCycle ?? 'monthly');
          setShowPlanModal(true);
        }}
      />

      <div className="flex-1 min-w-0 flex flex-col print:block">
        {/* Top Bar enxuta */}
        <header className="no-print bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between gap-6">
          <div className="flex items-center gap-2 text-sm min-w-0">
            <span className="text-slate-400 truncate">
              {store.activeCompany?.name ?? 'Sem empresa selecionada'}
            </span>
            <span className="text-slate-300" aria-hidden="true">
              /
            </span>
            <h1 className="font-display font-semibold text-slate-900 whitespace-nowrap truncate">
              {visibleSections.length > 0
                ? SECTION_TITLES[effectiveSection]
                : 'Acesso Restrito'}
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {store.connectionWarning && (
              <span className="text-xs text-amber-700 whitespace-nowrap">
                Conexão instável com o banco
              </span>
            )}
            <button
              type="button"
              onClick={store.logout}
              className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto print:p-0 print:m-0 print:max-w-none">
          {store.dataLoading ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-4">
              <div className="h-5 w-48 bg-slate-100 rounded animate-pulse" />
              <div className="h-10 w-full bg-slate-100 rounded animate-pulse" />
              <div className="h-10 w-full bg-slate-100 rounded animate-pulse" />
              <div className="h-10 w-3/4 bg-slate-100 rounded animate-pulse" />
            </div>
          ) : visibleSections.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
              <ShieldCheck className="w-8 h-8 text-slate-400 mx-auto" />
              <h2 className="font-display text-base font-semibold text-slate-900">
                Nenhuma tela habilitada para o seu perfil
              </h2>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                O perfil de acesso vinculado ao seu usuário não possui telas habilitadas no
                momento. Solicite ao administrador que ative as permissões desejadas.
              </p>
            </div>
          ) : (
            <>
              {effectiveSection === 'studio' && (
                <TimesheetStudio
                  activeCompany={store.activeCompany}
                  schedules={store.companySchedules}
                  employees={store.companyEmployees}
                  customHolidays={store.companyHolidays}
                  monthOverrides={store.monthOverrides}
                  includeFacultativos={includeFacultativos}
                  onToggleFacultativos={setIncludeFacultativos}
                  initialFocusEmployeeId={focusedEmployeeId}
                  onSaveDayOverride={store.saveDayOverride}
                  onClearMonthOverrides={store.clearMonthOverrides}
                  onGoToCompanies={() => setActiveSection('companies')}
                  onGoToEmployees={() => setActiveSection('employees')}
                  onSeedExample={canCreateCompany ? store.seedExampleCompany : undefined}
                  canEditDay={store.can('studio.edit_day')}
                  canCalibrate={store.can('studio.calibrate')}
                  canPrint={store.can('studio.print')}
                  canExportPdf={store.can('studio.export_pdf')}
                  canGoToCompanies={canCreateCompany && store.can('companies.view')}
                  canGoToEmployees={store.can('employees.view') && store.can('employees.create')}
                />
              )}

              {effectiveSection === 'employees' && (
                <EmployeesView
                  activeCompany={store.activeCompany}
                  schedules={store.companySchedules}
                  employees={store.companyEmployees}
                  onSaveEmployee={store.saveEmployee}
                  onDeleteEmployee={store.deleteEmployee}
                  onGenerateForEmployee={(empId) => {
                    setFocusedEmployeeId(empId);
                    setActiveSection('studio');
                  }}
                  onGoToCompanies={() => setActiveSection('companies')}
                  onGoToSchedules={() => setActiveSection('schedules')}
                  onOpenImport={() => setActiveSection('importEmployees')}
                  canCreate={store.can('employees.create')}
                  canEdit={store.can('employees.edit')}
                  canDelete={store.can('employees.delete')}
                  canGenerateSheet={store.can('studio.view')}
                  canImport={store.can('importEmployees.view') && store.can('importEmployees.import')}
                />
              )}

              {effectiveSection === 'importEmployees' && (
                <ImportEmployeesView
                  activeCompany={store.activeCompany}
                  schedules={store.companySchedules}
                  employees={store.companyEmployees}
                  onImportEmployees={store.importEmployeesBatch}
                  onGoToCompanies={() => setActiveSection('companies')}
                  onGoToSchedules={() => setActiveSection('schedules')}
                  onGoToEmployees={() => setActiveSection('employees')}
                  canImport={store.can('importEmployees.import')}
                />
              )}

              {effectiveSection === 'birthdays' && (
                <BirthdaysView
                  activeCompany={store.activeCompany}
                  companies={store.companies}
                  employees={store.employees}
                  canGoToEmployees={store.can('employees.view')}
                  canGoToImport={store.can('importEmployees.view')}
                  canGoToCompanies={canCreateCompany && store.can('companies.view')}
                  onGoToEmployees={() => setActiveSection('employees')}
                  onGoToImport={() => setActiveSection('importEmployees')}
                  onGoToCompanies={() => setActiveSection('companies')}
                />
              )}

              {effectiveSection === 'schedules' && (
                <SchedulesView
                  activeCompany={store.activeCompany}
                  schedules={store.companySchedules}
                  onSaveSchedule={store.saveSchedule}
                  onDeleteSchedule={store.deleteSchedule}
                  onGoToCompanies={() => setActiveSection('companies')}
                  canCreate={store.can('schedules.create')}
                  canEdit={store.can('schedules.edit')}
                  canDelete={store.can('schedules.delete')}
                />
              )}

              {effectiveSection === 'holidays' && (
                <HolidaysView
                  activeCompany={store.activeCompany}
                  customHolidays={store.companyHolidays}
                  includeFacultativos={includeFacultativos}
                  onToggleFacultativos={setIncludeFacultativos}
                  onSaveCustomHoliday={store.saveCustomHoliday}
                  onDeleteCustomHoliday={store.deleteCustomHoliday}
                  onGoToCompanies={() => setActiveSection('companies')}
                  canCreate={store.can('holidays.create')}
                  canEdit={store.can('holidays.edit')}
                  canDelete={store.can('holidays.delete')}
                />
              )}

              {effectiveSection === 'companies' && (
                <CompaniesView
                  companies={store.companies}
                  activeCompanyId={store.activeCompany?.id ?? ''}
                  onSelectCompany={store.selectCompany}
                  onSaveCompany={store.saveCompany}
                  onDeleteCompany={store.deleteCompany}
                  onSeedExample={store.seedExampleCompany}
                  onExportCompanyBackup={(company) =>
                    downloadCompanyBackupJson({
                      company,
                      schedules: store.schedules,
                      employees: store.employees,
                      customHolidays: store.customHolidays,
                      monthOverrides: store.monthOverrides,
                    })
                  }
                  onExportAllBackup={() =>
                    downloadAllCompaniesBackupJson({
                      companies: store.companies,
                      schedules: store.schedules,
                      employees: store.employees,
                      customHolidays: store.customHolidays,
                      monthOverrides: store.monthOverrides,
                    })
                  }
                  onImportBackupJson={store.importBackupJson}
                  canCreate={store.can('companies.create')}
                  canEdit={store.can('companies.edit')}
                  canDelete={store.can('companies.delete')}
                  canBackup={store.can('companies.backup')}
                  isWorkspaceOwner={store.isWorkspaceOwner}
                />
              )}

              {effectiveSection === 'users' && (
                <UsersView
                  currentUserEmail={store.user.email ?? ''}
                  currentUserName={store.user.displayName ?? ''}
                  teamUsers={store.teamUsers}
                  accessProfiles={store.accessProfiles}
                  companies={store.companies}
                  canCreate={store.can('users.create')}
                  canEdit={store.can('users.edit')}
                  canDelete={store.can('users.delete')}
                  canViewProfiles={store.can('profiles.view')}
                  onOpenProfiles={() => setActiveSection('profiles')}
                  onCreateUser={store.createTeamUser}
                  onUpdateUser={store.updateTeamUser}
                  onDeleteUser={store.deleteTeamUser}
                />
              )}

              {effectiveSection === 'profiles' && (
                <AccessProfilesView
                  profiles={store.accessProfiles}
                  teamUsers={store.teamUsers}
                  canCreate={store.can('profiles.create')}
                  canEdit={store.can('profiles.edit')}
                  canDelete={store.can('profiles.delete')}
                  onSaveProfile={store.saveAccessProfile}
                  onDeleteProfile={store.deleteAccessProfile}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Modal de alteração de plano dentro do painel */}
      {showPlanModal && (
        <div className="no-print fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Gerenciar Plano da Conta
                </h2>
                <p className="text-xs text-slate-500">
                  Uso atual: {store.companies.length} empresa(s) · {store.employees.length}{' '}
                  funcionário(s)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPlanModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setModalCycle('monthly')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                  modalCycle === 'monthly'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600'
                }`}
              >
                Mensal
              </button>
              <button
                type="button"
                onClick={() => setModalCycle('yearly')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                  modalCycle === 'yearly'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600'
                }`}
              >
                Anual (20% off)
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {SUBSCRIPTION_PLANS.map((plan) => {
                const isCurrent =
                  store.subscription?.planId === plan.id &&
                  store.subscription?.billingCycle === modalCycle;
                const price =
                  modalCycle === 'monthly'
                    ? plan.monthlyPrice
                    : plan.yearlyMonthlyEquivalent;
                return (
                  <div
                    key={plan.id}
                    className={`rounded-xl p-4 flex flex-col justify-between ${
                      isCurrent
                        ? 'border-2 border-emerald-700 bg-emerald-50/30'
                        : 'border border-slate-200 bg-white'
                    }`}
                  >
                    <div className="space-y-3">
                      <div>
                        <div className="font-display font-bold text-slate-900">{plan.name}</div>
                        <div className="text-xs text-slate-500">{plan.audience}</div>
                      </div>
                      <div className="font-display text-2xl font-bold font-mono-tabular text-slate-900">
                        R$ {formatBrlPrice(price)}
                        <span className="text-xs font-normal text-slate-500"> /mês</span>
                      </div>
                      <ul className="space-y-1.5 text-xs text-slate-700">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-start gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <button
                      type="button"
                      disabled={savingPlan || isCurrent}
                      onClick={async () => {
                        setSavingPlan(true);
                        try {
                          await store.saveSubscriptionPlan(plan.id as PlanId, modalCycle);
                          setShowPlanModal(false);
                        } finally {
                          setSavingPlan(false);
                        }
                      }}
                      className={`mt-4 w-full py-2 px-3 rounded-lg text-xs font-semibold cursor-pointer ${
                        isCurrent
                          ? 'bg-emerald-100 text-emerald-800 cursor-default'
                          : 'bg-slate-900 hover:bg-slate-800 text-white'
                      }`}
                    >
                      {isCurrent ? 'Plano Atual' : `Selecionar ${plan.name}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
