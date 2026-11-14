export type PermissionKey =
  | 'studio.view'
  | 'studio.edit_day'
  | 'studio.calibrate'
  | 'studio.print'
  | 'studio.export_pdf'
  | 'employees.view'
  | 'employees.create'
  | 'employees.edit'
  | 'employees.delete'
  | 'importEmployees.view'
  | 'importEmployees.import'
  | 'schedules.view'
  | 'schedules.create'
  | 'schedules.edit'
  | 'schedules.delete'
  | 'holidays.view'
  | 'holidays.create'
  | 'holidays.edit'
  | 'holidays.delete'
  | 'companies.view'
  | 'companies.create'
  | 'companies.edit'
  | 'companies.delete'
  | 'companies.backup'
  | 'users.view'
  | 'users.create'
  | 'users.edit'
  | 'users.delete'
  | 'profiles.view'
  | 'profiles.create'
  | 'profiles.edit'
  | 'profiles.delete';

export type PermissionSectionId =
  | 'studio'
  | 'employees'
  | 'importEmployees'
  | 'schedules'
  | 'holidays'
  | 'companies'
  | 'users'
  | 'profiles';

export interface ScreenActionDef {
  key: PermissionKey;
  label: string;
  description: string;
}

export interface ScreenPermissionGroup {
  sectionId: PermissionSectionId;
  title: string;
  subtitle: string;
  viewKey: PermissionKey;
  actions: ScreenActionDef[];
}

export const PERMISSION_GROUPS: ScreenPermissionGroup[] = [
  {
    sectionId: 'studio',
    title: 'Gerar Folhas (Estúdio A4)',
    subtitle: 'Visualização, ajustes diários, impressão e exportação de PDF.',
    viewKey: 'studio.view',
    actions: [
      { key: 'studio.view', label: 'Visualizar tela e prévia A4', description: 'Permite abrir o estúdio e visualizar as folhas.' },
      { key: 'studio.edit_day', label: 'Ajustar dias manualmente', description: 'Alterar folga, feriado ou dia útil direto na grade.' },
      { key: 'studio.calibrate', label: 'Calibrar margens e fontes', description: 'Ajustar espaçamento milimétrico da folha A4.' },
      { key: 'studio.print', label: 'Imprimir folhas', description: 'Acionar impressão direta individual ou em lote.' },
      { key: 'studio.export_pdf', label: 'Exportar PDF', description: 'Gerar arquivos PDF A4 individuais ou em lote.' },
    ],
  },
  {
    sectionId: 'employees',
    title: 'Funcionários',
    subtitle: 'Cadastro e manutenção de colaboradores admitidos.',
    viewKey: 'employees.view',
    actions: [
      { key: 'employees.view', label: 'Visualizar funcionários', description: 'Listar e pesquisar colaboradores das empresas habilitadas.' },
      { key: 'employees.create', label: 'Admitir funcionários', description: 'Cadastrar novos colaboradores.' },
      { key: 'employees.edit', label: 'Editar funcionários', description: 'Atualizar cargo, CPF, jornada e situação.' },
      { key: 'employees.delete', label: 'Excluir funcionários', description: 'Remover cadastros de colaboradores.' },
    ],
  },
  {
    sectionId: 'importEmployees',
    title: 'Importar Planilha',
    subtitle: 'Importação em lote via Excel (.xlsx/.xls) ou CSV.',
    viewKey: 'importEmployees.view',
    actions: [
      { key: 'importEmployees.view', label: 'Acessar importador', description: 'Abrir a tela e baixar modelos de planilha.' },
      { key: 'importEmployees.import', label: 'Executar importação', description: 'Gravar e atualizar colaboradores no banco.' },
    ],
  },
  {
    sectionId: 'schedules',
    title: 'Jornadas de Trabalho',
    subtitle: 'Configuração de horários contratuais e dias de folga.',
    viewKey: 'schedules.view',
    actions: [
      { key: 'schedules.view', label: 'Visualizar jornadas', description: 'Consultar escalas cadastradas.' },
      { key: 'schedules.create', label: 'Criar jornadas', description: 'Cadastrar novos modelos de jornada.' },
      { key: 'schedules.edit', label: 'Editar jornadas', description: 'Alterar horários e folgas semanais.' },
      { key: 'schedules.delete', label: 'Excluir jornadas', description: 'Remover modelos de jornada.' },
    ],
  },
  {
    sectionId: 'holidays',
    title: 'Feriados',
    subtitle: 'Feriados nacionais, facultativos e datas municipais/estaduais.',
    viewKey: 'holidays.view',
    actions: [
      { key: 'holidays.view', label: 'Visualizar feriados', description: 'Consultar calendário de feriados.' },
      { key: 'holidays.create', label: 'Adicionar feriados locais', description: 'Cadastrar datas personalizadas e alternar facultativos.' },
      { key: 'holidays.edit', label: 'Editar feriados locais', description: 'Alterar feriados personalizados.' },
      { key: 'holidays.delete', label: 'Excluir feriados locais', description: 'Remover feriados cadastrados.' },
    ],
  },
  {
    sectionId: 'companies',
    title: 'Empresas',
    subtitle: 'Dados cadastrais das empresas/fazendas e backup JSON.',
    viewKey: 'companies.view',
    actions: [
      { key: 'companies.view', label: 'Visualizar empresas', description: 'Listar empresas habilitadas para o usuário.' },
      { key: 'companies.create', label: 'Cadastrar empresas', description: 'Adicionar novas empresas empregadoras.' },
      { key: 'companies.edit', label: 'Editar empresas', description: 'Alterar razão social, CNPJ e endereço.' },
      { key: 'companies.delete', label: 'Excluir empresas', description: 'Remover empresas e seus registros.' },
      { key: 'companies.backup', label: 'Exportar / Restaurar backup JSON', description: 'Baixar cópia de segurança ou restaurar arquivo JSON.' },
    ],
  },
  {
    sectionId: 'users',
    title: 'Usuários',
    subtitle: 'Criação de logins, perfis atribuídos e empresas liberadas.',
    viewKey: 'users.view',
    actions: [
      { key: 'users.view', label: 'Visualizar usuários', description: 'Consultar logins criados na conta.' },
      { key: 'users.create', label: 'Criar usuários', description: 'Cadastrar novos usuários e liberar empresas.' },
      { key: 'users.edit', label: 'Editar usuários', description: 'Alterar perfil, empresas habilitadas e status.' },
      { key: 'users.delete', label: 'Remover usuários', description: 'Revogar acesso e excluir usuário da equipe.' },
    ],
  },
  {
    sectionId: 'profiles',
    title: 'Perfis de Acesso',
    subtitle: 'Cadastro de perfis e habilitação de ações por tela.',
    viewKey: 'profiles.view',
    actions: [
      { key: 'profiles.view', label: 'Visualizar perfis', description: 'Consultar perfis de acesso cadastrados.' },
      { key: 'profiles.create', label: 'Cadastrar perfis', description: 'Criar novos perfis de permissão.' },
      { key: 'profiles.edit', label: 'Editar permissões', description: 'Habilitar ou desabilitar ações das telas.' },
      { key: 'profiles.delete', label: 'Excluir perfis', description: 'Remover perfis não utilizados.' },
    ],
  },
];

export const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSION_GROUPS.flatMap((g) =>
  g.actions.map((a) => a.key)
);

export interface PresetProfileTemplate {
  id: string;
  name: string;
  description: string;
  permissions: PermissionKey[];
}

export const PRESET_PROFILES: PresetProfileTemplate[] = [
  {
    id: 'preset_admin',
    name: 'Administrador Completo',
    description: 'Acesso total a todas as telas, empresas liberadas, usuários e perfis.',
    permissions: ALL_PERMISSION_KEYS,
  },
  {
    id: 'preset_rh',
    name: 'Gestor de RH',
    description: 'Gerencia funcionários, importação de planilhas, jornadas, feriados e emite folhas A4.',
    permissions: [
      'studio.view',
      'studio.edit_day',
      'studio.calibrate',
      'studio.print',
      'studio.export_pdf',
      'employees.view',
      'employees.create',
      'employees.edit',
      'importEmployees.view',
      'importEmployees.import',
      'schedules.view',
      'schedules.create',
      'schedules.edit',
      'holidays.view',
      'holidays.create',
      'holidays.edit',
      'companies.view',
    ],
  },
  {
    id: 'preset_operador',
    name: 'Operador de Folha',
    description: 'Visualiza cadastros e gera, imprime ou exporta as folhas de ponto A4 em PDF.',
    permissions: [
      'studio.view',
      'studio.print',
      'studio.export_pdf',
      'employees.view',
      'schedules.view',
      'holidays.view',
      'companies.view',
    ],
  },
];

export function hasPermission(
  permissions: readonly string[],
  key: PermissionKey
): boolean {
  return permissions.includes(key);
}

export function getSectionViewKey(sectionId: PermissionSectionId): PermissionKey {
  const found = PERMISSION_GROUPS.find((g) => g.sectionId === sectionId);
  return found ? found.viewKey : 'studio.view';
}
