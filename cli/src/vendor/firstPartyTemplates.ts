import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { READING_ONLY_EXAMPLES } from './exampleSources.js';

/**
 * Os `extension-templates/*.json` cujo backend é DESTE repositório — a única porta para essa pergunta.
 *
 * `extension-templates/` guarda duas coisas com a mesma forma e donos diferentes: as extensões de
 * primeira parte, que viajam no bundle e cujas Cloud Functions o kernel compila e deploya, e os
 * exemplos, que viajam como fonte para serem lidos e cujo backend pertence a quem os instalar. A conta
 * do `pack` — baseline = todas as functions menos as reivindicadas — só faz sentido sobre as primeiras.
 *
 * A porta é única porque a pergunta já estava em dois lugares: o `pack` e o teste que guarda o `pack`.
 * Dois leitores do mesmo diretório com filtros diferentes é como um portão passa a aprovar o que ele
 * existe para reprovar — aqui, o exemplo que ensina Cloud Functions abortando toda publicação, ou uma
 * function saindo da baseline do kernel porque um MOLDE a reivindicou.
 */
export const firstPartyTemplates = <T>(root: string): T[] => {
  const dir = join(root, 'extension-templates');
  return readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .filter((file) => !READING_ONLY_EXAMPLES.has(basename(file, '.json')))
    .map((file) => JSON.parse(readFileSync(join(dir, file), 'utf8')) as T);
};
