export type PlanId = 'essencial' | 'profissional' | 'escritorio';
export type BillingCycle = 'monthly' | 'yearly';

export interface SubscriptionPlan {
  id: PlanId;
  name: string;
  audience: string;
  monthlyPrice: number;
  yearlyMonthlyEquivalent: number;
  yearlyTotal: number;
  recommended?: boolean;
  limits: {
    maxCompanies: number | null; // null = ilimitado
    maxEmployees: number | null;
    maxSchedulesPerCompany: number | null;
  };
  features: string[];
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'essencial',
    name: 'Essencial',
    audience: 'Para fazendas e pequenas empresas',
    monthlyPrice: 20,
    yearlyMonthlyEquivalent: 16,
    yearlyTotal: 192,
    limits: {
      maxCompanies: 1,
      maxEmployees: 20,
      maxSchedulesPerCompany: 3,
    },
    features: [
      '1 empresa ou fazenda cadastrada',
      'Até 20 funcionários ativos',
      'Até 3 modelos de jornada de trabalho',
      'Feriados nacionais automáticos + locais',
      'Exportação em lote para PDF A4 e Backup JSON',
    ],
  },
  {
    id: 'profissional',
    name: 'Profissional',
    audience: 'Para propriedades em expansão e RH interno',
    monthlyPrice: 49,
    yearlyMonthlyEquivalent: 39,
    yearlyTotal: 468,
    recommended: true,
    limits: {
      maxCompanies: 5,
      maxEmployees: 100,
      maxSchedulesPerCompany: null,
    },
    features: [
      'Até 5 empresas, fazendas ou filiais',
      'Até 100 funcionários ativos',
      'Modelos de jornada ilimitados',
      'Ajustes manuais por dia e por colaborador',
      'Exportação em lote para PDF A4 e Backup JSON',
    ],
  },
  {
    id: 'escritorio',
    name: 'Escritório Contábil',
    audience: 'Para contadores, BPO de RH e grupos empresariais',
    monthlyPrice: 89,
    yearlyMonthlyEquivalent: 71,
    yearlyTotal: 852,
    limits: {
      maxCompanies: null,
      maxEmployees: null,
      maxSchedulesPerCompany: null,
    },
    features: [
      'Empresas e fazendas ilimitadas',
      'Funcionários ilimitados em toda a conta',
      'Modelos de jornada e feriados ilimitados',
      'Impressão e exportação PDF em lote por cliente',
      'Backup completo multiempresa em JSON',
    ],
  },
];

export function getPlanById(planId: PlanId | string | undefined | null): SubscriptionPlan {
  return SUBSCRIPTION_PLANS.find((p) => p.id === planId) ?? SUBSCRIPTION_PLANS[0];
}

export function formatBrlPrice(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
