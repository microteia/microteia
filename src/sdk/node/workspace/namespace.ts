import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isValidPluginId } from '../../../domain/schema/plugin/artifactRef';
import {
  ARTIFACT_PREFIX_MAX_LENGTH,
  generateArtifactPrefix,
  isArtifactPrefix,
} from '../../../domain/schema/plugin/artifactPrefix';

/**
 * O NAMESPACE do diretório de extensões — `com.acme` —, de onde nasce o id de toda extensão escrita nele.
 *
 * Sem ele, o id era o que o autor (ou a IA) digitasse na hora. O padrão do `create` era
 * `com.example.hello`, e um agente que lia os exemplos de primeira parte copiava o prefixo DELES: um
 * escritório inteiro publicando `com.microteia.*`, que não é dele, e que não se troca depois — o id é
 * permanente, é por ele que uma atualização acha o que atualizar.
 *
 * Mora em `package.json`, sob `microteia.namespace`, e não num arquivo próprio: a chave `microteia` já
 * é nossa (o `sync` carimba ali o `kernelVersion` e preserva o resto), o arquivo é conciliado — nenhum
 * `sync` o apaga — e é o primeiro que alguém abre no diretório. O `name` do npm ficou de fora de
 * propósito: é a identidade do pacote npm, e o `sync` deduz dele o nome do escritório.
 */

export const NAMESPACE_KEY = 'namespace';

/** Mesmo padrão do id de extensão: um namespace é um id ao qual ainda falta o último segmento. */
export const isValidNamespace = (value: unknown): value is string => isValidPluginId(value);

const readPackage = (root: string): Record<string, unknown> | null => {
  const path = join(root, 'package.json');
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const microteiaSection = (pkg: Record<string, unknown> | null): Record<string, unknown> => {
  const section = pkg?.microteia;
  return typeof section === 'object' && section !== null ? section as Record<string, unknown> : {};
};

/** O que está gravado, válido ou não — quem decide o que fazer com um valor inválido é quem lê. */
export const storedNamespace = (root: string): string | null => {
  const value = microteiaSection(readPackage(root))[NAMESPACE_KEY];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
};

/** O namespace utilizável, ou `null` quando falta ou está fora do formato. */
export const workspaceNamespace = (root: string): string | null => {
  const stored = storedNamespace(root);
  return isValidNamespace(stored) ? stored : null;
};

export const invalidNamespaceMessage = (value: string): string =>
  `"${value}" is not a valid namespace. Use reverse-DNS, lowercase, from a domain you control: com.acme`;

/** Grava o namespace sem tocar em mais nada do `package.json`. */
export const recordNamespace = (root: string, namespace: string): void => {
  if (!isValidNamespace(namespace)) throw new Error(invalidNamespaceMessage(namespace));
  const path = join(root, 'package.json');
  const pkg = readPackage(root);
  if (pkg === null) {
    throw new Error('No readable package.json here. Run "microteia plugin-init" to create this directory.');
  }
  pkg.microteia = { ...microteiaSection(pkg), [NAMESPACE_KEY]: namespace };
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
};

export const belongsToNamespace = (id: string, namespace: string): boolean =>
  id.startsWith(`${namespace}.`);

/**
 * A resposta do `create`, completada: `billing` vira `com.acme.billing`. Um id inteiro passa como veio
 * — e é recusado adiante se não estiver no namespace.
 */
export const qualifyPluginId = (answer: string, namespace: string): string => {
  const trimmed = answer.trim();
  return trimmed.includes('.') ? trimmed : `${namespace}.${trimmed}`;
};

export const outsideNamespaceMessage = (id: string, namespace: string): string =>
  `"${id}" is outside this directory's namespace (${namespace}). Every extension written here is `
  + `${namespace}.<name> — set in package.json, under microteia.namespace.`;

const PUBLISHER_KEY = 'publisher';
const PREFIX_KEY = 'prefix';
const KEEP_IDS_KEY = 'keepIds';

const recordInSection = (root: string, key: string, value: unknown): void => {
  const path = join(root, 'package.json');
  const pkg = readPackage(root);
  if (pkg === null) {
    throw new Error('No readable package.json here. Run "microteia plugin-init" to create this directory.');
  }
  pkg.microteia = { ...microteiaSection(pkg), [key]: value };
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
};

/**
 * Quem publica as extensões deste diretório. Perguntado UMA vez, como o namespace: antes, cada `create`
 * perguntava de novo, e quem só apertava Enter ficava com "Your organization" no manifest.
 */
export const storedPublisher = (root: string): string | null => {
  const value = microteiaSection(readPackage(root))[PUBLISHER_KEY];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
};

export const recordPublisher = (root: string, publisher: string): void => recordInSection(root, PUBLISHER_KEY, publisher.trim());

/**
 * O prefixo de todo nome que as extensões deste diretório criam — um por diretório, como o namespace,
 * porque é de quem PUBLICA. O `create` o escreve no manifest (`prefix`) e nos nomes que gera; o gate
 * cobra os demais. Ver `artifactPrefix.ts`.
 */
export const storedPrefix = (root: string): string | null => {
  const value = microteiaSection(readPackage(root))[PREFIX_KEY];
  return isArtifactPrefix(value) ? value : null;
};

export const recordPrefix = (root: string, prefix: string): void => {
  if (!isArtifactPrefix(prefix)) throw new Error(invalidPrefixMessage(prefix));
  recordInSection(root, PREFIX_KEY, prefix);
};

export const invalidPrefixMessage = (value: string): string =>
  `"${value}" is not a valid prefix. Use 2 to 8 lowercase letters or digits, starting with a letter: acme`;

/**
 * O prefixo sugerido para um namespace: o último segmento, se ele já serve (`com.acme` → `acme`), senão
 * os primeiros caracteres que servem, senão um sorteado.
 */
export const suggestedPrefix = (namespace: string, random: () => number = Math.random): string => {
  const last = (namespace.split('.').pop() ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const candidate = last.replace(/^[0-9]+/, '').slice(0, ARTIFACT_PREFIX_MAX_LENGTH);
  return isArtifactPrefix(candidate) ? candidate : generateArtifactPrefix(random);
};

/**
 * Os ids que nasceram FORA do namespace e não podem mudar — o id é permanente, e é por ele que uma
 * atualização acha o que atualizar. Fora desta lista, o build recusa o id fora do namespace: é o que pega
 * a cópia distraída de uma extensão de outro autor.
 */
export const storedKeepIds = (root: string): string[] => {
  const value = microteiaSection(readPackage(root))[KEEP_IDS_KEY];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
};
