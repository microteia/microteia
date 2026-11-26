import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import type { LocalizedIssue } from './pluginReferences';
import { RESERVED_COLLECTIONS } from '../../schema/screenEntity';
import { isLookupCollection } from '../../schema/lookupRegistry';
import { declaredScreenKey, ownerSet, templateSourceId } from './screenModule';

interface InstalledField {
  key: string;
  origin?: string | null;
  ownerPluginId?: string | null;
}

interface InstalledScreen {
  id: string;
  sourceId?: string | null;
  ownerPluginId?: string | null;
  ownerPluginIds?: string[] | null;
  fields?: readonly InstalledField[];
}

interface InstalledList {
  collection: string;
  ownerPluginId?: string | null;
  ownerPluginIds?: string[] | null;
}

export interface InstallNamespace {
  screens: readonly InstalledScreen[];
  lookups: readonly InstalledList[];
  tagLists: readonly InstalledList[];
}

/**
 * O que a instalação RECUSA em vez de desempatar ou fundir — antes de gravar qualquer coisa.
 *
 * **Tela.** A chave é a coleção, e as coleções do escritório são um espaço único. A tela com o mesmo
 * `sourceId` de uma que já existe é a MESMA tela (reinstalação, atualização, adoção) e passa. Outra tela
 * com o nome já tomado — por uma tela, lista ou conjunto de etiquetas do escritório, ou por um nome do
 * sistema — é recusa. Antes ela virava `nome_2`, e quem dependesse do nome declarado (outra extensão, um
 * modelo, uma configuração) passava a ler a coleção de outro dono sem erro nenhum.
 *
 * **Lista de opções e etiquetas.** O pacote declara a lista que as telas dele usam, e declarar uma que
 * já existe é COMPARTILHAR — legítimo quando o dono é ele mesmo, uma dependência declarada, ou o próprio
 * escritório (lista sem dono). Uma lista de outra extensão, sem relação nenhuma com esta, passaria a ter
 * dois donos e opções misturadas: é recusa.
 *
 * **Campo.** Ver `fieldCollisionIssues`.
 */
export const installCollisionIssues = (pkg: MarketplacePlugin, current: InstallNamespace): LocalizedIssue[] => {
  const pluginId = pkg.manifest.id;
  const related = new Set([pluginId, ...Object.keys(pkg.manifest.dependencies ?? {})]);
  const bySourceId = new Set(current.screens.map((screen) => screen.sourceId ?? screen.id));
  const screenKeys = new Set(current.screens.map((screen) => screen.id));
  const listsByCollection = new Map(
    [...current.lookups, ...current.tagLists].map((list) => [list.collection, list] as const),
  );
  const taken = new Set([...screenKeys, ...listsByCollection.keys(), ...RESERVED_COLLECTIONS]);

  const issues: LocalizedIssue[] = [];
  for (const screen of pkg.screens ?? []) {
    if (bySourceId.has(templateSourceId(screen))) continue;
    const key = declaredScreenKey(screen.key);
    if (taken.has(key)) {
      issues.push({ message: '@core.marketplace/install.collision.screen', messageParams: { name: key } });
    }
  }

  for (const list of [...(pkg.lookups ?? []), ...(pkg.tagLists ?? [])]) {
    if (isLookupCollection(list.collection)) continue;
    if (screenKeys.has(list.collection)) {
      issues.push({ message: '@core.marketplace/install.collision.list', messageParams: { name: list.collection } });
      continue;
    }
    const existing = listsByCollection.get(list.collection);
    if (!existing) continue;
    const owners = ownerSet(existing);
    if (owners.length > 0 && !owners.some((owner) => related.has(owner))) {
      issues.push({ message: '@core.marketplace/install.collision.list', messageParams: { name: list.collection } });
    }
  }
  return [...issues, ...fieldCollisionIssues(pkg, current.screens)];
};

/**
 * O campo que TERCEIROS puseram na tela: o escritório, no Form Design (sem dono), ou outra extensão, por
 * complemento (com o dono dela). Os donos da tela não são terceiros — dois pacotes que declaram a mesma
 * tela declaram os mesmos campos. O campo `plugin` sem dono é de um pacote antigo, de antes do carimbo, e
 * não de uma pessoa.
 */
const isThirdPartyField = (field: InstalledField, screenOwners: ReadonlySet<string>): boolean =>
  field.ownerPluginId ? !screenOwners.has(field.ownerPluginId) : field.origin !== 'plugin';

/**
 * **Campo.** A atualização reescreve os campos da extensão e PRESERVA os que terceiros acrescentaram
 * (`preservedUserFields`) — mas só quando as chaves não se cruzam. Na mesma chave, a declaração do pacote
 * substituía a de terceiros sem aviso: o rótulo, o tipo, as opções e as regras que o escritório escreveu
 * sumiam, e o mesmo valendo para o complemento que caía sobre o campo de outra extensão. A chave é o nome
 * do dado no registro, então não há como as duas declarações conviverem; a escolha é de quem administra.
 *
 * A tela da própria extensão só é conferida quando ela JÁ É dona — atualização ou reinstalação. Na
 * primeira instalação sobre uma tela do escritório (adoção), assumir os campos de mesma chave é o
 * propósito: o escritório modelou a entidade que a extensão passa a trazer.
 */
export const fieldCollisionIssues = (pkg: MarketplacePlugin, screens: readonly InstalledScreen[]): LocalizedIssue[] => {
  const pluginId = pkg.manifest.id;
  const issues: LocalizedIssue[] = [];

  const collide = (screen: InstalledScreen, declared: readonly { key: string }[], screenOwners: ReadonlySet<string>) => {
    const thirdParty = new Map(
      (screen.fields ?? []).filter((field) => isThirdPartyField(field, screenOwners)).map((field) => [field.key, field] as const),
    );
    for (const field of declared) {
      const taken = thirdParty.get(field.key);
      if (!taken) continue;
      issues.push(taken.ownerPluginId
        ? {
            message: '@core.marketplace/install.collision.field.extension',
            messageParams: { screen: screen.id, field: field.key, extension: taken.ownerPluginId },
          }
        : { message: '@core.marketplace/install.collision.field', messageParams: { screen: screen.id, field: field.key } });
    }
  };

  for (const template of pkg.screens ?? []) {
    const installed = screens.find((screen) => (screen.sourceId ?? screen.id) === templateSourceId(template));
    if (!installed || !ownerSet(installed).includes(pluginId)) continue;
    collide(installed, template.fields ?? [], new Set(ownerSet(installed)));
  }

  for (const patch of pkg.screenPatches ?? []) {
    const installed = (patch.targetKind ?? 'collection') === 'sourceId'
      ? screens.find((screen) => (screen.sourceId ?? screen.id) === patch.target)
      : screens.find((screen) => screen.id === patch.target);
    // Complemento sobre a tela do próprio pacote é ignorado na aplicação (`applyScreenPatches`).
    if (!installed || ownerSet(installed).includes(pluginId)) continue;
    collide(installed, patch.fields, new Set([pluginId]));
  }

  return issues;
};

/**
 * O prefixo não muda entre versões: trocá-lo trocaria o nome de tudo o que a extensão cria, e o que já
 * está instalado ficaria para trás sob o prefixo antigo. Acrescentar um prefixo a uma extensão que não
 * tinha passa — as telas que já existem são reconhecidas pelo `sourceId` e ficam onde estão.
 */
export const prefixChangeIssue = (
  incoming: MarketplacePlugin,
  installed: MarketplacePlugin | undefined,
): LocalizedIssue | null => {
  const before = installed?.manifest.prefix;
  if (before === undefined || before === incoming.manifest.prefix) return null;
  return {
    message: '@core.marketplace/install.prefix-changed',
    messageParams: { from: before, to: incoming.manifest.prefix ?? '' },
  };
};
