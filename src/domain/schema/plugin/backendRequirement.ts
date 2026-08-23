import type { PluginDiagnostic } from './diagnostics';
import { error } from './diagnostics';

/**
 * O que uma extensão exige do PROJETO FIREBASE, e que nenhuma declaração de dados alcança: Cloud
 * Function, índice composto, parâmetro de backend e passo manual no painel do Google.
 *
 * Por que isto existe: empacotar não é deployar. O pacote leva o código de todas as extensões, mas
 * instalar a Microteia não pode instalar as cinco functions do Gmail em um escritório que nunca vai
 * receber intimação por e-mail. O que é de uma extensão é declarado por ela e aplicado quando ela é
 * instalada.
 *
 * Por que NÃO há campo de rules: o `firestore.rules` já autoriza coleção de extensão pelo curinga
 * `match /{screenCollection}/{recordId}`, que exige a permissão derivada da própria coleção. Um
 * fragmento de texto mais frouxo que um bloco nomeado alargaria acesso em silêncio, porque o Firestore
 * UNE todas as regras que casam. Extensão que venha a precisar de regra nomeada é de primeira parte, e
 * a regra fica na baseline do kernel até a necessidade ser real.
 *
 * O nome é `backend`, e não `provisioning`, porque `provision` já é vocabulário de
 * `CapabilityProvision` — dois conceitos com o mesmo nome custam mais que um nome menos bonito.
 */
export interface FirestoreIndexField {
  fieldPath: string;
  order?: 'ASCENDING' | 'DESCENDING';
  arrayConfig?: 'CONTAINS';
}

export interface FirestoreIndexSpec {
  collectionGroup: string;
  queryScope: 'COLLECTION' | 'COLLECTION_GROUP';
  fields: FirestoreIndexField[];
}

/** Passo que só existe no painel do Google — nenhum comando o executa. */
export interface BackendPrerequisite {
  id: string;
  title: string;
  detail: string;
}

export interface PluginBackendRequirement {
  functions?: string[];
  indexes?: FirestoreIndexSpec[];
  parameters?: string[];
  prerequisites?: BackendPrerequisite[];
}

export const hasBackendRequirement = (backend?: PluginBackendRequirement): boolean =>
  (backend?.functions?.length ?? 0) > 0
  || (backend?.indexes?.length ?? 0) > 0
  || (backend?.parameters?.length ?? 0) > 0;

const canonicalIndex = (index: FirestoreIndexSpec): string => JSON.stringify([
  index.collectionGroup,
  index.queryScope,
  index.fields.map((field) => [field.fieldPath, field.order ?? '', field.arrayConfig ?? '']),
]);

/**
 * Identidade do que a extensão exige, para comparar o DECLARADO com o APLICADO.
 *
 * É JSON canônico e não um hash: síncrono nos dois lados (o gate do boot não pode esperar
 * `crypto.subtle`), e legível quando não bate — ver por que uma extensão voltou a ficar pendente vale
 * mais que economizar bytes num campo que ninguém consulta em volume.
 *
 * `prerequisites` fica FORA de propósito: é prosa para quem instala, não muda um artefato do projeto,
 * e incluí-la faria uma correção de texto re-pendurar uma instalação que funciona.
 *
 * O vínculo é por CONTEÚDO, não por versão — mesma razão do `codeTrust`: uma extensão que passe a
 * exigir uma function nova volta a ficar pendente sozinha, sem código de migração.
 */
export const backendFingerprint = (backend?: PluginBackendRequirement): string => JSON.stringify({
  functions: [...(backend?.functions ?? [])].sort(),
  indexes: [...(backend?.indexes ?? [])].map(canonicalIndex).sort(),
  parameters: [...(backend?.parameters ?? [])].sort(),
});

const FUNCTION_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/;
const PARAMETER_NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const invalid = (pluginId: string, path: string, message: string): PluginDiagnostic =>
  error({ code: 'manifest.invalid', message, pluginId, path });

const validateIndex = (
  index: FirestoreIndexSpec,
  pluginId: string,
  position: number,
): PluginDiagnostic[] => {
  const path = `backend.indexes[${position}]`;
  if (typeof index?.collectionGroup !== 'string' || index.collectionGroup.trim() === '') {
    return [invalid(pluginId, path, '@core.marketplace/diagnostic.backend.index.collection-missing')];
  }
  if (index.queryScope !== 'COLLECTION' && index.queryScope !== 'COLLECTION_GROUP') {
    return [invalid(pluginId, path, '@core.marketplace/diagnostic.backend.index.scope-invalid')];
  }
  if (!Array.isArray(index.fields) || index.fields.length < 2) {
    return [invalid(pluginId, path, '@core.marketplace/diagnostic.backend.index.fields-missing')];
  }
  return index.fields.some((field) => typeof field?.fieldPath !== 'string' || field.fieldPath === '')
    ? [invalid(pluginId, path, '@core.marketplace/diagnostic.backend.index.field-invalid')]
    : [];
};

/**
 * Nunca lança: exigência malformada vira diagnóstico e descarta a extensão, como todo o resto da
 * validação de manifest. A conferência de que uma function EXISTE não é feita aqui — ela é do lado de
 * quem aplica, contra a lista do pacote, porque o kernel do navegador não sabe o que foi empacotado.
 */
export const validateBackendRequirement = (
  backend: PluginBackendRequirement | undefined,
  pluginId: string,
): PluginDiagnostic[] => {
  if (backend === undefined) return [];
  if (typeof backend !== 'object' || backend === null || Array.isArray(backend)) {
    return [invalid(pluginId, 'backend', '@core.marketplace/diagnostic.backend.not-object')];
  }

  const diagnostics: PluginDiagnostic[] = [];

  if (backend.functions !== undefined && !isStringArray(backend.functions)) {
    diagnostics.push(invalid(pluginId, 'backend.functions', '@core.marketplace/diagnostic.backend.functions-invalid'));
  } else if (backend.functions?.some((name) => !FUNCTION_NAME_PATTERN.test(name))) {
    diagnostics.push(invalid(pluginId, 'backend.functions', '@core.marketplace/diagnostic.backend.function-name-invalid'));
  }

  if (backend.parameters !== undefined && !isStringArray(backend.parameters)) {
    diagnostics.push(invalid(pluginId, 'backend.parameters', '@core.marketplace/diagnostic.backend.parameters-invalid'));
  } else if (backend.parameters?.some((name) => !PARAMETER_NAME_PATTERN.test(name))) {
    diagnostics.push(invalid(pluginId, 'backend.parameters', '@core.marketplace/diagnostic.backend.parameter-name-invalid'));
  }

  if (backend.indexes !== undefined && !Array.isArray(backend.indexes)) {
    diagnostics.push(invalid(pluginId, 'backend.indexes', '@core.marketplace/diagnostic.backend.indexes-invalid'));
  } else {
    (backend.indexes ?? []).forEach((index, position) => {
      diagnostics.push(...validateIndex(index, pluginId, position));
    });
  }

  return diagnostics;
};
