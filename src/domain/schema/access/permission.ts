import type { PluginDiagnostic } from '../plugin/diagnostics';
import { error } from '../plugin/diagnostics';

/**
 * Uma CAPACIDADE do sistema — o que alguém pode fazer, declarado por quem implementa a capacidade.
 *
 * Não confundir com `schema/plugin/permission.ts`: aquela é o grant de SANDBOX (`data:cases:read`),
 * o que o CÓDIGO de uma extensão pode fazer, e é decidida na instalação. Esta é o RBAC de USUÁRIO,
 * agrupada em Roles pelo escritório e resolvida a cada gesto. Os dois eixos nunca se cruzam, e é por
 * isso que moram em arquivos diferentes com formatos de identificador diferentes.
 *
 * `resource` e `action` não são campos: derivam do `id` (`parseAccessPermission`). Declará-los
 * separadamente criaria duas fontes para a mesma verdade, e a primeira divergência entre elas seria
 * silenciosa.
 *
 * `requires` é a dependência da PERMISSÃO, e o ponto que faz a Role não precisar conhecê-la: quem
 * declara `finance.write` diz de que ela depende, e nenhuma Role gravada precisa mudar no dia em que
 * essa lista mudar.
 */
export interface AccessPermission {
  id: string;
  /** Texto do escritório OU referência de mensagem (`@namespace/chave`); `useLabel` resolve os dois. */
  name: string;
  description?: string;
  requires?: string[];
}

export interface ParsedAccessPermission {
  resource: string;
  action: string;
}

/**
 * `recurso.acao`, exatamente dois segmentos. O recurso admite maiúscula e sublinhado porque ele é,
 * no caso derivado, o NOME DA COLEÇÃO da tela — que já tem forma própria (`COLLECTION_NAME_PATTERN`)
 * e não pode ser reescrita aqui sem deixar de casar com o dado. A ação é sempre minúscula: ela é
 * vocabulário nosso, não do escritório.
 */
const ACCESS_PERMISSION_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*\.[a-z][a-z0-9-]*$/;

export const parseAccessPermission = (id: string): ParsedAccessPermission | null => {
  if (typeof id !== 'string' || !ACCESS_PERMISSION_PATTERN.test(id)) return null;
  const separator = id.indexOf('.');
  return { resource: id.slice(0, separator), action: id.slice(separator + 1) };
};

export const isValidAccessPermissionId = (id: string): boolean =>
  parseAccessPermission(id) !== null;

/** As quatro ações que toda coleção de tela oferece, e das quais o catálogo deriva sozinho. */
export const CRUD_ACTIONS = ['read', 'create', 'update', 'delete'] as const;

export type CrudAction = (typeof CRUD_ACTIONS)[number];

export const collectionPermissionId = (collection: string, action: CrudAction): string =>
  `${collection}.${action}`;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export interface ValidateAccessPermissionOptions {
  pluginId?: string;
  path?: string;
}

/**
 * Nunca lança: uma permissão malformada de terceiro precisa ser recusada com explicação, e não
 * derrubar o catálogo inteiro — o mesmo molde de `validatePluginManifest`.
 */
export const validateAccessPermission = (
  permission: AccessPermission,
  options: ValidateAccessPermissionOptions = {},
): PluginDiagnostic[] => {
  const { pluginId, path } = options;
  const at = (field: string) => (path ? `${path}.${field}` : field);

  if (!isPlainObject(permission)) {
    return [
      error({
        code: 'access.permission.invalid',
        message: '@core.access/diagnostic.permission.not-object',
        pluginId,
        path,
      }),
    ];
  }

  const diagnostics: PluginDiagnostic[] = [];

  if (!isValidAccessPermissionId(permission.id)) {
    diagnostics.push(
      error({
        code: 'access.permission.invalid',
        message: '@core.access/diagnostic.permission.id.invalid',
        messageParams: { id: String(permission.id) },
        pluginId,
        path: at('id'),
      }),
    );
  }

  if (typeof permission.name !== 'string' || !permission.name.trim()) {
    diagnostics.push(
      error({
        code: 'access.permission.invalid',
        message: '@core.access/diagnostic.permission.name.missing',
        messageParams: { id: String(permission.id) },
        pluginId,
        path: at('name'),
      }),
    );
  }

  const requires = permission.requires;
  if (requires !== undefined && !Array.isArray(requires)) {
    diagnostics.push(
      error({
        code: 'access.permission.invalid',
        message: '@core.access/diagnostic.permission.requires.invalid',
        messageParams: { id: String(permission.id) },
        pluginId,
        path: at('requires'),
      }),
    );
    return diagnostics;
  }

  (requires ?? []).forEach((required, index) => {
    if (isValidAccessPermissionId(required) && required !== permission.id) return;
    diagnostics.push(
      error({
        code: 'access.permission.invalid',
        message:
          required === permission.id
            ? '@core.access/diagnostic.permission.requires.self'
            : '@core.access/diagnostic.permission.requires.malformed',
        messageParams: { id: String(permission.id), required: String(required) },
        pluginId,
        path: at(`requires[${index}]`),
      }),
    );
  });

  return diagnostics;
};

/**
 * O que uma extensão ACRESCENTA ao fecho de uma permissão que não é dela.
 *
 * Existe porque `requires` só pode ser dito por quem DECLARA a permissão, e a permissão de uma
 * coleção normalmente não é declarada por ninguém — o catálogo a deriva da tela. Um pacote que
 * complementa a tela de outro (um `screenPatch` que acrescenta uma relação ao registro) precisava
 * substituir a derivada para dizer de que ela passou a depender, e substituir é privilégio de um
 * plugin só: o segundo a tentar era recusado como declaração duplicada, e o campo acrescentado
 * ficava em branco para quem lê a tela hospedeira sem ler a coleção referenciada.
 *
 * É ADITIVO por natureza, e é isso que o separa de uma declaração: não tem nome nem descrição, não
 * substitui nada, e vários pacotes somam ao mesmo `id` sem se atropelarem — o fecho é a união.
 */
export interface AccessRequirement {
  /** A permissão cujo fecho cresce. Pode ser declarada por outro pacote ou derivada de uma tela. */
  id: string;
  requires: string[];
}

/** Nunca lança, pelo mesmo motivo de `validateAccessPermission`: metadata de terceiro. */
export const validateAccessRequirement = (
  requirement: AccessRequirement,
  options: ValidateAccessPermissionOptions = {},
): PluginDiagnostic[] => {
  const { pluginId, path } = options;
  const at = (field: string) => (path ? `${path}.${field}` : field);

  if (!isPlainObject(requirement)) {
    return [
      error({
        code: 'access.requirement.invalid',
        message: '@core.access/diagnostic.requirement.not-object',
        pluginId,
        path,
      }),
    ];
  }

  const diagnostics: PluginDiagnostic[] = [];

  if (!isValidAccessPermissionId(requirement.id)) {
    diagnostics.push(
      error({
        code: 'access.requirement.invalid',
        message: '@core.access/diagnostic.requirement.id.invalid',
        messageParams: { id: String(requirement.id) },
        pluginId,
        path: at('id'),
      }),
    );
  }

  if (!Array.isArray(requirement.requires) || requirement.requires.length === 0) {
    diagnostics.push(
      error({
        code: 'access.requirement.invalid',
        message: '@core.access/diagnostic.requirement.requires.invalid',
        messageParams: { id: String(requirement.id) },
        pluginId,
        path: at('requires'),
      }),
    );
    return diagnostics;
  }

  requirement.requires.forEach((required, index) => {
    if (isValidAccessPermissionId(required) && required !== requirement.id) return;
    diagnostics.push(
      error({
        code: 'access.requirement.invalid',
        message:
          required === requirement.id
            ? '@core.access/diagnostic.requirement.requires.self'
            : '@core.access/diagnostic.requirement.requires.malformed',
        messageParams: { id: String(requirement.id), required: String(required) },
        pluginId,
        path: at(`requires[${index}]`),
      }),
    );
  });

  return diagnostics;
};
