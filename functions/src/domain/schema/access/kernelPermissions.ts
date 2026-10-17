// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/access/kernelPermissions.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

import type { AccessPermission } from './permission';
import type { PermissionResource } from './resolvePermissions';

/**
 * As capacidades do NÚCLEO, e nada além delas.
 *
 * Não há nome de negócio nesta lista, e não pode haver: o kernel só sabe administrar a si mesmo —
 * perfis, membros, telas, automações, extensões, configurações, auditoria. O que uma tela de
 * Financeiro ou de Processos permite é derivado da COLEÇÃO que a declara, ou declarado pela
 * extensão dona dela.
 *
 * Os identificadores são constantes porque são citados em código (o `can()` de cada ViewModel, o
 * `requirePermission` de cada callable): um literal digitado errado num deles não seria recusado
 * por nada — a permissão simplesmente nunca casaria, e a tela ficaria escondida sem explicação.
 */
export const PERMISSION_ROLES_MANAGE = 'roles.manage';
export const PERMISSION_MEMBERS_MANAGE = 'members.manage';
export const PERMISSION_TENANT_UPDATE = 'tenant.update';
export const PERMISSION_SCREENS_MANAGE = 'screens.manage';
export const PERMISSION_AUTOMATION_MANAGE = 'automation.manage';
export const PERMISSION_AUTOMATION_RUN = 'automation.run';
export const PERMISSION_EXTENSIONS_MANAGE = 'extensions.manage';
export const PERMISSION_SETTINGS_MANAGE = 'settings.manage';
export const PERMISSION_AUDIT_READ = 'audit.read';
export const PERMISSION_AI_MANAGE = 'ai.manage';
export const PERMISSION_AGENT_MANAGE = 'agent.manage';
export const PERMISSION_TRANSLATIONS_MANAGE = 'translations.manage';
export const PERMISSION_DATA_PROCESSOR_USE = 'data-processor.use';
export const PERMISSION_DOCUMENT_TYPES_MANAGE = 'document-types.manage';
export const PERMISSION_REPORTS_MANAGE = 'reports.manage';
export const PERMISSION_DOCUMENT_TEMPLATES_MANAGE = 'document-templates.manage';
export const PERMISSION_DOWNLOADS_MANAGE = 'downloads.manage';
export const PERMISSION_DOCUMENTS_GENERATE = 'documents.generate';

/**
 * O nome e a descrição vão por extenso, e não montados a partir do `id`. Uma referência composta em
 * tempo de execução é invisível para `verify-messages`: a chave poderia não existir, e o que
 * apareceria na tela seria a própria referência crua.
 */
export const KERNEL_PERMISSIONS: AccessPermission[] = [
  {
    // Quem monta um perfil precisa ver a quem atribuí-lo — a dependência é real, e é ela que o
    // administrador nunca precisa saber que existe.
    id: PERMISSION_ROLES_MANAGE,
    name: '@core.access/permission.roles.manage',
    description: '@core.access/permission.roles.manage.description',
    requires: [PERMISSION_MEMBERS_MANAGE],
  },
  {
    id: PERMISSION_MEMBERS_MANAGE,
    name: '@core.access/permission.members.manage',
    description: '@core.access/permission.members.manage.description',
  },
  {
    id: PERMISSION_TENANT_UPDATE,
    name: '@core.access/permission.tenant.update',
    description: '@core.access/permission.tenant.update.description',
  },
  {
    id: PERMISSION_SCREENS_MANAGE,
    name: '@core.access/permission.screens.manage',
    description: '@core.access/permission.screens.manage.description',
  },
  {
    id: PERMISSION_AUTOMATION_MANAGE,
    name: '@core.access/permission.automation.manage',
    description: '@core.access/permission.automation.manage.description',
  },
  {
    id: PERMISSION_AUTOMATION_RUN,
    name: '@core.access/permission.automation.run',
    description: '@core.access/permission.automation.run.description',
  },
  {
    id: PERMISSION_EXTENSIONS_MANAGE,
    name: '@core.access/permission.extensions.manage',
    description: '@core.access/permission.extensions.manage.description',
  },
  {
    id: PERMISSION_SETTINGS_MANAGE,
    name: '@core.access/permission.settings.manage',
    description: '@core.access/permission.settings.manage.description',
  },
  {
    id: PERMISSION_AUDIT_READ,
    name: '@core.access/permission.audit.read',
    description: '@core.access/permission.audit.read.description',
  },
  {
    id: PERMISSION_AI_MANAGE,
    name: '@core.access/permission.ai.manage',
    description: '@core.access/permission.ai.manage.description',
  },
  {
    id: PERMISSION_AGENT_MANAGE,
    name: '@core.access/permission.agent.manage',
    description: '@core.access/permission.agent.manage.description',
  },
  {
    id: PERMISSION_TRANSLATIONS_MANAGE,
    name: '@core.access/permission.translations.manage',
    description: '@core.access/permission.translations.manage.description',
  },
  {
    id: PERMISSION_DATA_PROCESSOR_USE,
    name: '@core.access/permission.data-processor.use',
    description: '@core.access/permission.data-processor.use.description',
  },
  {
    id: PERMISSION_DOCUMENT_TYPES_MANAGE,
    name: '@core.access/permission.document-types.manage',
    description: '@core.access/permission.document-types.manage.description',
  },
  {
    // Quem monta um relatório precisa poder ESCOLHER a coleção-fonte, e para isso precisa vê-la.
    // A leitura de cada coleção que o relatório toca é cobrada na EXECUÇÃO, não aqui: esta permissão
    // é sobre autoria, e ela nunca concede acesso a dado nenhum.
    id: PERMISSION_REPORTS_MANAGE,
    name: '@core.access/permission.reports.manage',
    description: '@core.access/permission.reports.manage.description',
  },
  {
    // Autoria, e só autoria: GERAR um documento é anexar, e anexar cobra `<coleção>.update` do
    // registro — quem escreve o modelo não ganha com isso acesso a registro nenhum.
    id: PERMISSION_DOCUMENT_TEMPLATES_MANAGE,
    name: '@core.access/permission.document-templates.manage',
    description: '@core.access/permission.document-templates.manage.description',
  },
  {
    // Ver e apagar TODO item de Downloads, inclusive o de outra pessoa e o da automação restrito a
    // quem gerencia. Gerar não depende dela: Downloads cobra a leitura do registro de origem.
    id: PERMISSION_DOWNLOADS_MANAGE,
    name: '@core.access/permission.downloads.manage',
    description: '@core.access/permission.downloads.manage.description',
  },
  {
    // Gerar a partir de DADOS entregues (modelo `payload`), sem registro por trás. Não dá acesso a
    // registro nenhum: o que o payload aponta continua cobrando `<coleção>.read` de quem gera.
    id: PERMISSION_DOCUMENTS_GENERATE,
    name: '@core.access/permission.documents.generate',
    description: '@core.access/permission.documents.generate.description',
  },
];

export const KERNEL_PERMISSION_RESOURCES: PermissionResource[] = [
  { id: 'roles', name: '@core.access/resource.roles' },
  { id: 'members', name: '@core.access/resource.members' },
  { id: 'tenant', name: '@core.access/resource.tenant' },
  { id: 'screens', name: '@core.access/resource.screens' },
  { id: 'automation', name: '@core.access/resource.automation' },
  { id: 'extensions', name: '@core.access/resource.extensions' },
  { id: 'settings', name: '@core.access/resource.settings' },
  { id: 'audit', name: '@core.access/resource.audit' },
  { id: 'agent', name: '@core.access/resource.agent' },
  { id: 'ai', name: '@core.access/resource.ai' },
  { id: 'translations', name: '@core.access/resource.translations' },
  { id: 'data-processor', name: '@core.access/resource.data-processor' },
  { id: 'document-types', name: '@core.access/resource.document-types' },
  { id: 'reports', name: '@core.access/resource.reports' },
  { id: 'document-templates', name: '@core.access/resource.document-templates' },
  { id: 'downloads', name: '@core.access/resource.downloads' },
  { id: 'documents', name: '@core.access/resource.documents' },
];
