import { ENTITY_REGISTRY_LIST } from '../schema/entityRegistry';
import { isLookupCollection } from '../schema/lookupRegistry';
import type { SchemaScreen } from '../schema/screenEntity';
import { RESERVED_COLLECTIONS } from '../schema/screenEntity';

export type WorkflowEventPrefix = string;

const FLAT_ENTITY_PREFIXES: Record<string, WorkflowEventPrefix> = Object.fromEntries(
  ENTITY_REGISTRY_LIST.filter((entity) => entity.eventPrefix).map((entity) => [
    entity.collection,
    entity.eventPrefix as WorkflowEventPrefix,
  ]),
);

/**
 * Mapeia uma coleção flat de tenant (`tenants/{tenantId}/{collection}/{docId}`) para o prefixo
 * de evento do Workflow Engine (`<prefixo>.saved` / `<prefixo>.deleted`).
 *
 * As entidades fixas mantêm o prefixo declarado no registro, o que preserva os workflows já
 * existentes. Qualquer outra coleção que não seja reservada pelo sistema é uma tela
 * do tenant e emite pelo PRÓPRIO nome (`medico` → `medico.saved`). `undefined` = coleção fora do
 * escopo de eventos (etiquetas, membros, conexões) — o gatilho ignora rapidamente.
 *
 * A checagem é por denylist e não consulta o cache de telas: o gatilho roda em TODA escrita do
 * tenant, e uma leitura extra por escrita sairia cara. Um evento publicado para uma coleção sem
 * automação simplesmente não encontra assinante.
 */
export const getWorkflowEventPrefix = (collection: string): WorkflowEventPrefix | undefined => {
  if (FLAT_ENTITY_PREFIXES[collection]) return FLAT_ENTITY_PREFIXES[collection];
  if (isLookupCollection(collection)) return 'lookup';
  if (RESERVED_COLLECTIONS.has(collection)) return undefined;
  return collection;
};

/**
 * O prefixo que a TELA declara para a coleção, quando declara. É o que permite uma entidade sair do
 * kernel e passar a ser descrita por uma extensão sem renomear os eventos que as automações já
 * escutam (`orders` continua emitindo `order.saved`).
 *
 * Só é consultado quando o registro não responde pela coleção — as entidades ainda fixas seguem no
 * caminho rápido, sem leitura nenhuma.
 *
 * A busca é por quem DECLARA, não pela primeira tela da coleção: a mesma coleção costuma ser
 * descrita por duas telas — a da extensão, que declara o prefixo, e a que leva o nome da coleção,
 * criada só para as Security Rules enxergarem a permissão. A segunda vem antes na ordem alfabética
 * dos documentos e calaria a declaração da primeira.
 */
export const declaredEventPrefix = (
  screens: SchemaScreen[],
  collection: string,
): WorkflowEventPrefix | undefined =>
  screens
    .filter((screen) => (screen.collection ?? screen.id) === collection)
    .map((screen) => screen.eventPrefix?.trim())
    .find((prefix): prefix is string => !!prefix);

/** A coleção tem prefixo declarado no REGISTRO? Se sim, nem vale consultar as telas. */
export const hasRegistryEventPrefix = (collection: string): boolean =>
  FLAT_ENTITY_PREFIXES[collection] !== undefined;
