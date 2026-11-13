import React, { useState } from 'react';
import { User } from 'firebase/auth';
import {
  ArrowLeft,
  CalendarCheck2,
  Check,
  Eye,
  EyeOff,
  Lock,
  MailCheck,
  Printer,
  ShieldCheck,
} from 'lucide-react';
import {
  BillingCycle,
  PlanId,
  SUBSCRIPTION_PLANS,
  SubscriptionPlan,
} from '../constants/plans';

interface AuthScreenProps {
  pendingUser: User | null;
  loading: boolean;
  error: string | null;
  message: string | null;
  onSignIn: (email: string, password: string, keepSignedIn: boolean) => Promise<void>;
  onRegister: (
    displayName: string,
    email: string,
    password: string,
    keepSignedIn: boolean,
    planId: PlanId,
    billingCycle: BillingCycle
  ) => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
  onResendVerification: () => Promise<void>;
  onRefreshVerification: () => Promise<void>;
  onLogout: () => Promise<void>;
  onClearFeedback: () => void;
}

type AuthScreenView = 'login' | 'plans' | 'register' | 'reset';

export const AuthScreen: React.FC<AuthScreenProps> = ({
  pendingUser,
  loading,
  error,
  message,
  onSignIn,
  onRegister,
  onResetPassword,
  onResendVerification,
  onRefreshVerification,
  onLogout,
  onClearFeedback,
}) => {
  const [view, setView] = useState<AuthScreenView>('login');
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);

  const navigateTo = (nextView: AuthScreenView) => {
    // Regra comercial: criar conta só após escolher um plano
    if (nextView === 'register' && !selectedPlan) {
      setView('plans');
    } else {
      setView(nextView);
    }
    setLocalError(null);
    onClearFeedback();
  };

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setLocalError(null);
    onClearFeedback();
    setView('register');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!email.trim()) {
      setLocalError('Informe seu e-mail de acesso.');
      return;
    }

    if (view === 'reset') {
      await onResetPassword(email);
      return;
    }

    if (password.length < 6) {
      setLocalError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (view === 'register') {
      if (!selectedPlan) {
        setView('plans');
        return;
      }
      if (displayName.trim().length < 2) {
        setLocalError('Informe seu nome completo ou nome do responsável.');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('As senhas digitadas não coincidem.');
        return;
      }
      await onRegister(
        displayName,
        email,
        password,
        keepSignedIn,
        selectedPlan.id,
        billingCycle
      );
      return;
    }

    await onSignIn(email, password, keepSignedIn);
  };

  const activeError = localError || error;

  // Tela de confirmação de e-mail pendente
  if (pendingUser && !pendingUser.emailVerified) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between px-6 py-8">
        <header className="max-w-5xl w-full mx-auto flex items-center justify-between gap-8 border-b border-slate-200 pb-4">
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            PontoRural & Empresarial
          </span>
          <span className="text-xs text-slate-500 whitespace-nowrap">
            Confirmação de Conta
          </span>
        </header>

        <main className="max-w-md w-full mx-auto py-12">
          <div className="bg-white border border-slate-200 rounded-xl p-7 sm:p-9 shadow-sm space-y-5">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-xs font-medium text-emerald-800">
                <MailCheck className="w-4 h-4" />
                <span>Confirmação de E-mail Pendente</span>
              </div>
              <h1 className="font-display text-2xl font-bold text-slate-900">
                Verifique sua caixa de entrada
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed">
                Enviamos um link de confirmação para{' '}
                <strong className="text-slate-900">{pendingUser.email}</strong>. Confirme o
                endereço para ativar sua assinatura e acessar o sistema.
              </p>
            </div>

            {message && (
              <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-xs text-emerald-800">
                {message}
              </div>
            )}

            {activeError && (
              <div
                role="alert"
                className="p-3 rounded-lg border border-red-200 bg-red-50 text-xs text-red-700"
              >
                {activeError}
              </div>
            )}

            <div className="space-y-2.5">
              <button
                type="button"
                disabled={loading}
                onClick={onRefreshVerification}
                className="w-full px-5 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition-colors disabled:opacity-60 cursor-pointer"
              >
                {loading ? 'Verificando...' : 'Já confirmei meu e-mail — Entrar'}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={onResendVerification}
                className="w-full px-5 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors disabled:opacity-60 cursor-pointer"
              >
                Reenviar e-mail de confirmação
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={onLogout}
                className="w-full px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                Sair e entrar com outro usuário
              </button>
            </div>
          </div>
        </main>

        <footer className="max-w-5xl w-full mx-auto border-t border-slate-200 pt-4 text-xs text-slate-500 flex items-center justify-between">
          <span>PontoRural & Empresarial</span>
          <span>Compatível com qualquer empresa ou propriedade rural</span>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between px-6 py-8">
      {/* Top Bar de 3 zonas */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between gap-8 border-b border-slate-200 pb-4">
        <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          PontoRural & Empresarial
        </span>

        <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            type="button"
            onClick={() => navigateTo('login')}
            className={`whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
              view === 'login' ? 'text-slate-900 underline underline-offset-4' : 'hover:text-slate-900'
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => navigateTo('plans')}
            className={`whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
              view === 'plans' || view === 'register'
                ? 'text-slate-900 underline underline-offset-4'
                : 'hover:text-slate-900'
            }`}
          >
            Planos e Preços
          </button>
        </nav>

        <div className="shrink-0">
          {view === 'plans' || view === 'register' ? (
            <button
              type="button"
              onClick={() => navigateTo('login')}
              className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-900 whitespace-nowrap cursor-pointer"
            >
              Já sou cliente
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigateTo('plans')}
              className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
            >
              Contratar Plano
            </button>
          )}
        </div>
      </header>

      {/* Conteúdo Principal: Escolha de Planos OU Login / Cadastro */}
      <main className="max-w-6xl w-full mx-auto py-10">
        {view === 'plans' ? (
          <section className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="space-y-2 max-w-2xl">
                <span className="text-xs font-medium text-emerald-800">
                  Passo 1 de 2 · Escolha seu plano
                </span>
                <h1
                  className="font-display text-3xl font-bold text-slate-900"
                  style={{ textWrap: 'balance' }}
                >
                  Escolha o plano ideal antes de criar sua conta
                </h1>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Selecione o plano compatível com o tamanho da sua fazenda, empresa ou carteira
                  de clientes. Na próxima etapa você criará seu usuário e senha de acesso.
                </p>
              </div>

              {/* Controle de periodicidade */}
              <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start shrink-0">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    billingCycle === 'monthly'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Mensal
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('yearly')}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    billingCycle === 'yearly'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Anual (20% off)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
              {SUBSCRIPTION_PLANS.map((plan) => {
                const price =
                  billingCycle === 'monthly'
                    ? plan.monthlyPrice
                    : plan.yearlyMonthlyEquivalent;
                return (
                  <div
                    key={plan.id}
                    className={`bg-white rounded-xl p-6 flex flex-col justify-between transition-colors ${
                      plan.recommended
                        ? 'border-2 border-emerald-700 shadow-sm'
                        : 'border border-slate-200'
                    }`}
                  >
                    <div className="space-y-5">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <h2 className="font-display text-lg font-bold text-slate-900">
                            {plan.name}
                          </h2>
                          {plan.recommended && (
                            <span className="text-xs font-semibold text-emerald-700">
                              Mais escolhido
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">{plan.audience}</p>
                      </div>

                      <div className="pb-4 border-b border-slate-100">
                        <div className="flex items-baseline gap-1">
                          <span className="text-xs font-medium text-slate-500">R$</span>
                          <span className="font-display text-3xl font-bold font-mono-tabular text-slate-900">
                            {price}
                          </span>
                          <span className="text-xs text-slate-500">/ mês</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1 font-mono-tabular">
                          {billingCycle === 'yearly'
                            ? `Cobrança anual de R$ ${plan.yearlyTotal}/ano`
                            : 'Cobrança mensal sem fidelidade'}
                        </div>
                      </div>

                      <ul className="space-y-2.5 text-sm text-slate-700">
                        {plan.features.map((feat) => (
                          <li key={feat} className="flex items-start gap-2.5">
                            <Check className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="pt-6">
                      <button
                        type="button"
                        onClick={() => handleSelectPlan(plan)}
                        className={`w-full py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                          plan.recommended
                            ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                            : 'bg-slate-900 hover:bg-slate-800 text-white'
                        }`}
                      >
                        Escolher {plan.name} e Criar Conta
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-center text-xs text-slate-600">
              Já possui uma conta ativa?{' '}
              <button
                type="button"
                onClick={() => navigateTo('login')}
                className="font-semibold text-emerald-700 hover:underline cursor-pointer"
              >
                Entrar com usuário e senha
              </button>
            </div>
          </section>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Formulário de Login / Criar Conta / Redefinir Senha */}
            <div className="lg:col-span-6">
              <div className="bg-white border border-slate-200 rounded-xl p-7 sm:p-9 shadow-sm max-w-md w-full mx-auto lg:mx-0 space-y-6">
                {view === 'register' && selectedPlan && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs text-emerald-800 font-medium">
                        Passo 2 de 2 · Plano {selectedPlan.name}
                      </div>
                      <div className="text-xs font-mono-tabular text-slate-700 mt-0.5">
                        R${' '}
                        {billingCycle === 'monthly'
                          ? selectedPlan.monthlyPrice
                          : selectedPlan.yearlyMonthlyEquivalent}
                        /mês ({billingCycle === 'monthly' ? 'Mensal' : 'Anual'})
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigateTo('plans')}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:underline shrink-0 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Alterar
                    </button>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 text-xs font-medium text-emerald-800">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Acesso com Usuário e Senha</span>
                  </div>
                  <h1
                    className="font-display text-2xl font-bold text-slate-900"
                    style={{ textWrap: 'balance' }}
                  >
                    {view === 'login' && 'Entrar no sistema'}
                    {view === 'register' && 'Criar sua conta'}
                    {view === 'reset' && 'Recuperar senha'}
                  </h1>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {view === 'login' &&
                      'Informe seu usuário (e-mail) e senha para acessar suas empresas e gerar folhas A4.'}
                    {view === 'register' &&
                      'Preencha seus dados de acesso para concluir a contratação do plano selecionado.'}
                    {view === 'reset' &&
                      'Informe seu e-mail cadastrado para receber o link de redefinição de senha.'}
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {view === 'register' && (
                    <div>
                      <label
                        htmlFor="auth-name"
                        className="block text-xs font-medium text-slate-700 mb-1"
                      >
                        Nome do Responsável *
                      </label>
                      <input
                        id="auth-name"
                        type="text"
                        required
                        autoComplete="name"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Ex.: Gean Monteiro"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                      />
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="auth-email"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Usuário (E-mail) *
                    </label>
                    <input
                      id="auth-email"
                      type="email"
                      required
                      autoComplete="username"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="usuario@empresa.com.br"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                    />
                  </div>

                  {view !== 'reset' && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label
                          htmlFor="auth-password"
                          className="block text-xs font-medium text-slate-700"
                        >
                          Senha *
                        </label>
                        {view === 'login' && (
                          <button
                            type="button"
                            onClick={() => navigateTo('reset')}
                            className="text-xs text-emerald-700 hover:underline cursor-pointer"
                          >
                            Esqueci a senha
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          id="auth-password"
                          type={showPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          autoComplete={
                            view === 'login' ? 'current-password' : 'new-password'
                          }
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Mínimo 6 caracteres"
                          className="w-full rounded-lg border border-slate-200 pl-3 pr-10 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {view === 'register' && (
                    <div>
                      <label
                        htmlFor="auth-confirm-password"
                        className="block text-xs font-medium text-slate-700 mb-1"
                      >
                        Confirmar Senha *
                      </label>
                      <input
                        id="auth-confirm-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repita a senha"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                      />
                    </div>
                  )}

                  {view !== 'reset' && (
                    <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={keepSignedIn}
                        onChange={(e) => setKeepSignedIn(e.target.checked)}
                        className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-700 cursor-pointer"
                      />
                      <span>Manter conectado neste computador</span>
                    </label>
                  )}

                  {message && (
                    <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-xs text-emerald-800 leading-relaxed">
                      {message}
                    </div>
                  )}

                  {activeError && (
                    <div
                      role="alert"
                      className="p-3 rounded-lg border border-red-200 bg-red-50 text-xs text-red-700 leading-relaxed"
                    >
                      {activeError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full px-5 py-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition-colors disabled:opacity-60 cursor-pointer"
                  >
                    {loading
                      ? 'Aguarde...'
                      : view === 'login'
                      ? 'Entrar'
                      : view === 'register'
                      ? 'Criar Conta e Começar'
                      : 'Enviar Link de Redefinição'}
                  </button>

                  {view === 'login' && (
                    <div className="pt-2 text-center text-xs text-slate-600">
                      Ainda não tem acesso?{' '}
                      <button
                        type="button"
                        onClick={() => navigateTo('plans')}
                        className="font-semibold text-emerald-700 hover:underline cursor-pointer"
                      >
                        Escolha um plano para criar conta
                      </button>
                    </div>
                  )}

                  {(view === 'register' || view === 'reset') && (
                    <button
                      type="button"
                      onClick={() => navigateTo('login')}
                      className="w-full text-center text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                    >
                      Já tenho conta — Voltar para o login
                    </button>
                  )}
                </form>

                <div className="pt-4 border-t border-slate-100 space-y-1.5 text-xs text-slate-500">
                  <div className="flex items-center gap-2 text-slate-600 font-medium">
                    <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>Dados salvos na nuvem com backup JSON</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Resumo Visual do Sistema */}
            <div className="lg:col-span-6 space-y-5">
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <div className="flex items-center justify-between text-xs text-slate-500 pb-3 border-b border-slate-100 mb-4">
                  <span>Modelo A4 Replicado com Fidelidade</span>
                  <span className="font-mono-tabular">210 × 297 mm</span>
                </div>
                <div className="border border-slate-900 text-[10px] font-sans text-slate-900 bg-white">
                  <div className="border-b border-slate-900 px-2 py-1 font-bold">
                    EMPREGADOR: RAZÃO SOCIAL DA EMPRESA - 00.000.000/0001-00
                  </div>
                  <div className="border-b border-slate-900 px-2 py-1">
                    Endereço: Sede, Zona Rural / Endereço Comercial
                  </div>
                  <div className="border-b border-slate-900 px-2 py-1 font-bold">
                    Nome do Empregado: NOME COMPLETO DO COLABORADOR
                  </div>
                  <div className="grid grid-cols-2 border-b border-slate-900">
                    <div className="px-2 py-1 border-r border-slate-900">Cargo: 040 - FUNÇÃO</div>
                    <div className="px-2 py-1 font-mono-tabular">CPF: 000.000.000-00</div>
                  </div>
                  <div className="border-b border-slate-900 px-2 py-1 font-bold">
                    MÊS E ANO: Novembro / 2026
                  </div>
                  <div className="grid grid-cols-8 text-center border-b border-slate-900 bg-slate-50 font-medium">
                    <div className="p-1 border-r border-slate-900">Dia</div>
                    <div className="p-1 border-r border-slate-900">Sem</div>
                    <div className="col-span-2 p-1 border-r border-slate-900">MANHÃ</div>
                    <div className="col-span-2 p-1 border-r border-slate-900">TARDE</div>
                    <div className="p-1 border-r border-slate-900">Extras</div>
                    <div className="p-1">Assinatura</div>
                  </div>
                  {[
                    { d: '01', s: 'Dom', c1: 'Folga', c2: '', shade: true },
                    { d: '02', s: 'Seg', c1: '', c2: 'Feriado', shade: true },
                    { d: '03', s: 'Ter', c1: '12:00', c2: '13:00', shade: false },
                    { d: '04', s: 'Qua', c1: '12:00', c2: '13:00', shade: false },
                    { d: '05', s: 'Qui', c1: '12:00', c2: '13:00', shade: false },
                  ].map((r) => (
                    <div
                      key={r.d}
                      className={`grid grid-cols-8 text-center border-b border-slate-900 font-mono-tabular ${
                        r.shade ? 'bg-[#bfbfbf]' : 'bg-white'
                      }`}
                    >
                      <div className="p-1 border-r border-slate-900">{r.d}</div>
                      <div className="p-1 border-r border-slate-900">{r.s}</div>
                      <div className="p-1 border-r border-slate-900">
                        {r.c1 === 'Folga' ? 'Folga' : ''}
                      </div>
                      <div className="p-1 border-r border-slate-900">
                        {r.c1 === '12:00' ? '12:00' : r.c2 === 'Feriado' ? 'Feriado' : ''}
                      </div>
                      <div className="p-1 border-r border-slate-900">
                        {r.c2 === '13:00' ? '13:00' : ''}
                      </div>
                      <div className="p-1 border-r border-slate-900" />
                      <div className="p-1 border-r border-slate-900" />
                      <div className="p-1" />
                    </div>
                  ))}
                  <div className="px-4 pt-4 pb-2 text-center">
                    <div className="w-1/2 mx-auto border-t border-slate-900 pt-1 font-bold">
                      ASSINATURA DO EMPREGADO
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarCheck2 className="w-3.5 h-3.5 text-emerald-700" />
                    Feriados e folgas automáticos
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Printer className="w-3.5 h-3.5 text-emerald-700" />
                    Exportação em lote para PDF A4
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-6xl w-full mx-auto border-t border-slate-200 pt-4 text-xs text-slate-500 flex items-center justify-between">
        <span>PontoRural & Empresarial</span>
        <span>Compatível com qualquer empresa ou propriedade rural</span>
      </footer>
    </div>
  );
};
