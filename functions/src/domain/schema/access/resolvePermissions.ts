// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/access/resolvePermissions.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

import type { PluginDiagnostic } from '../plugin/diagnostics';
import { error } from '../plugin/diagnostics';
import type { AccessPermission, CrudAction } from './permission';
import {
  CRUD_ACTIONS,
  collectionPermissionId,
  parseAccessPermission,
  validateAccessPermission,
} from './permission';

/** Uma permissão do catálogo já resolvida: o que foi declarado mais o que se deriva do `id`. */
export interface CatalogPermission {
  id: string;
  name: string;
  description?: string;
  requires: string[];
  resource: string;
  action: string;
  /** `pluginId` de quem a declarou. Vazio quando ninguém a declarou e o kernel a derivou de uma tela. */
  source: string;
  derived: boolean;
}

export interface PermissionCatalog {
  byId: ReadonlyMap<string, CatalogPermission>;
  /** Ordem determinística: recurso, depois a ordem canônica das ações. Não a de carregamento. */
  list: readonly CatalogPermission[];
  /** O nome de cada recurso, para a tela agrupar por ele sem repetir o rótulo em cada permissão. */
  resourceNames: ReadonlyMap<string, string>;
  diagnostics: readonly PluginDiagnostic[];
}

export interface DeclaredPermission {
  permission: AccessPermission;
  /** `pluginId` de quem declarou — não é campo da permissão, é de onde ela veio. */
  source: string;
}

/**
 * O RECURSO sobre o qual as permissões falam — e o rótulo pelo qual a tela de Roles as agrupa.
 *
 * `deriveCrud` é o que separa os dois casos. Uma COLEÇÃO DE TELA o traz ligado, e daí saem as quatro
 * permissões de CRUD sem ninguém declarar nada: é o que faz o RBAC valer para a tela que o
 * escritório criou sozinho, cinco minutos atrás, sem plugin nenhum por trás. Um recurso que não é
 * coleção (`roles`, `automation`) o traz desligado, e existe só para dar nome ao grupo — as
 * permissões dele são declaradas uma a uma, porque as capacidades dele não são quatro nem se chamam
 * ler, criar, alterar e excluir.
 */
export interface PermissionResource {
  id: string;
  /** Rótulo do recurso: o título da tela, texto cru ou referência de mensagem. */
  name: string;
  deriveCrud?: boolean;
  source?: string;
}

const ACTION_ORDER = new Map<string, number>(CRUD_ACTIONS.map((action, index) => [action, index]));

const compareCatalog = (a: CatalogPermission, b: CatalogPermission): number => {
  if (a.resource !== b.resource) return a.resource < b.resource ? -1 : 1;
  const orderA = ACTION_ORDER.get(a.action) ?? CRUD_ACTIONS.length;
  const orderB = ACTION_ORDER.get(b.action) ?? CRUD_ACTIONS.length;
  if (orderA !== orderB) return orderA - orderB;
  if (a.action !== b.action) return a.action < b.action ? -1 : 1;
  return 0;
};

const DERIVED_ACTION_NAMES: Record<CrudAction, string> = {
  read: '@core.access/action.read',
  create: '@core.access/action.create',
  update: '@core.access/action.update',
  delete: '@core.access/action.delete',
};

/**
 * O catálogo unificado: o que as telas dão de graça mais o que os plugins declaram.
 *
 * A declaração SOBREPÕE a derivada de mesmo id — é assim que `finance.write` ganha
 * `requires: ['finance.read', 'person.read']` sem o plugin ter de repetir as outras três, e é a
 * única forma de uma dependência entrar no catálogo (a derivação nunca inventa dependência).
 */
export const buildPermissionCatalog = (
  declared: DeclaredPermission[],
  resources: PermissionResource[],
): PermissionCatalog => {
  const diagnostics: PluginDiagnostic[] = [];
  const byId = new Map<string, CatalogPermission>();
  const resourceNames = new Map<string, string>();

  for (const resource of resources) {
    if (!parseAccessPermission(collectionPermissionId(resource.id, 'read'))) continue;
    resourceNames.set(resource.id, resource.name);
    if (resource.deriveCrud !== true) continue;
    // Criar, editar e excluir EXIGEM ver. Não é conveniência: quem grava num registro que não pode
    // ler grava às cegas, e a tela que ele abriria para isso não tem como carregar. A dependência é
    // da PERMISSÃO, então o administrador nunca precisa saber que ela existe — marcar "Criar" traz
    // "Visualizar" junto, travado, como qualquer outra dependência.
    const readId = collectionPermissionId(resource.id, 'read');
    for (const action of CRUD_ACTIONS) {
      const id = collectionPermissionId(resource.id, action);
      byId.set(id, {
        id,
        name: DERIVED_ACTION_NAMES[action],
        requires: action === 'read' ? [] : [readId],
        resource: resource.id,
        action,
        source: resource.source ?? '',
        derived: true,
      });
    }
  }

  const claimed = new Set<string>();
  for (const { permission, source } of declared) {
    const issues = validateAccessPermission(permission, { pluginId: source });
    if (issues.length > 0) {
      diagnostics.push(...issues);
      continue;
    }
    if (claimed.has(permission.id)) {
      diagnostics.push(
        error({
          code: 'access.permission.duplicate',
          message: '@core.access/diagnostic.permission.duplicate',
          messageParams: { id: permission.id, source },
          pluginId: source,
        }),
      );
      continue;
    }
    claimed.add(permission.id);

    const parsed = parseAccessPermission(permission.id);
    if (!parsed) continue;
    byId.set(permission.id, {
      id: permission.id,
      name: permission.name,
      ...(permission.description === undefined ? {} : { description: permission.description }),
      requires: [...new Set(permission.requires ?? [])],
      resource: parsed.resource,
      action: parsed.action,
      source,
      derived: false,
    });
    if (!resourceNames.has(parsed.resource)) resourceNames.set(parsed.resource, parsed.resource);
  }

  const list = [...byId.values()].sort(compareCatalog);
  diagnostics.push(...catalogIntegrityDiagnostics(byId));

  return { byId, list, resourceNames, diagnostics };
};

const unknownDependency = (id: string, required: string, source: string): PluginDiagnostic =>
  error({
    code: 'access.permission.unknown',
    message: '@core.access/diagnostic.permission.requires.unknown',
    messageParams: { id, required },
    ...(source ? { pluginId: source } : {}),
  });

const cycleDiagnostic = (path: string[], source: string): PluginDiagnostic =>
  error({
    code: 'access.permission.cycle',
    message: '@core.access/diagnostic.permission.cycle',
    messageParams: { path: path.join(' → ') },
    ...(source ? { pluginId: source } : {}),
  });

type ClosureMemo = Map<string, string[] | null>;

/**
 * O fecho transitivo de UMA permissão, ou `null` quando ele não pôde ser fechado.
 *
 * Fail-closed é a decisão central: uma permissão cuja dependência não existe, ou que entra num
 * ciclo, NÃO é concedida. Conceder o que se conseguiu resolver daria acesso parcial a partir de uma
 * declaração que ninguém consegue explicar — e o erro apareceria como privilégio, não como falha.
 */
const closureOf = (
  id: string,
  byId: ReadonlyMap<string, CatalogPermission>,
  memo: ClosureMemo,
  stack: string[],
  onStack: Set<string>,
  diagnostics: PluginDiagnostic[],
): string[] | null => {
  const cached = memo.get(id);
  if (cached !== undefined) return cached;

  const permission = byId.get(id);
  if (!permission) {
    memo.set(id, null);
    return null;
  }

  if (onStack.has(id)) {
    diagnostics.push(cycleDiagnostic([...stack.slice(stack.indexOf(id)), id], permission.source));
    return null;
  }

  stack.push(id);
  onStack.add(id);

  const closure = new Set<string>([id]);
  let resolved = true;

  for (const required of permission.requires) {
    if (!byId.has(required)) {
      diagnostics.push(unknownDependency(id, required, permission.source));
      resolved = false;
      continue;
    }
    const nested = closureOf(required, byId, memo, stack, onStack, diagnostics);
    if (nested === null) {
      resolved = false;
      continue;
    }
    for (const entry of nested) closure.add(entry);
  }

  stack.pop();
  onStack.delete(id);

  const result = resolved ? [...closure] : null;
  memo.set(id, result);
  return result;
};

export interface ResolvedPermissions {
  effective: string[];
  diagnostics: PluginDiagnostic[];
}

/**
 * As permissões EFETIVAS de um conjunto de explícitas — o coração do modelo.
 *
 * A Role guarda só o que o administrador marcou; isto é recalculado a cada leitura. É o que permite
 * `finance.write` passar a exigir `company.read` amanhã sem que nenhuma Role gravada mude.
 */
export const resolveEffective = (
  catalog: PermissionCatalog,
  explicit: readonly string[],
): ResolvedPermissions => {
  const diagnostics: PluginDiagnostic[] = [];
  const memo: ClosureMemo = new Map();
  const effective = new Set<string>();

  for (const id of [...new Set(explicit)]) {
    if (!catalog.byId.has(id)) {
      diagnostics.push(
        error({
          code: 'access.permission.unknown',
          message: '@core.access/diagnostic.permission.unknown',
          messageParams: { id },
        }),
      );
      continue;
    }
    const closure = closureOf(id, catalog.byId, memo, [], new Set(), diagnostics);
    if (closure === null) continue;
    for (const entry of closure) effective.add(entry);
  }

  return { effective: [...effective].sort(), diagnostics };
};

/**
 * O que uma permissão ARRASTA consigo — o que a tela mostra como "inclui automaticamente" e trava.
 * Vazio quando ela não resolve; quem resolve a Role inteira já terá o diagnóstico.
 */
export const dependenciesOf = (catalog: PermissionCatalog, id: string): string[] => {
  const closure = closureOf(id, catalog.byId, new Map(), [], new Set(), []);
  return (closure ?? []).filter((entry) => entry !== id).sort();
};

const catalogIntegrityDiagnostics = (
  byId: ReadonlyMap<string, CatalogPermission>,
): PluginDiagnostic[] => {
  const diagnostics: PluginDiagnostic[] = [];
  const memo: ClosureMemo = new Map();
  for (const id of byId.keys()) closureOf(id, byId, memo, [], new Set(), diagnostics);
  return diagnostics;
};
