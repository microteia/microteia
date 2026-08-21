import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import instalada from './FirebaseInstalledExtensionRepository.ts?raw';
import doTenant from './FirebaseTenantExtensionRepository.ts?raw';
import instalacao from './FirebasePluginInstallationRepository.ts?raw';
import publica from './publicExtensionMapping.ts?raw';
import registro from './pluginRegistryMapping.ts?raw';

import { toDateValueOrNow } from '../utils/toDateValue';

const FONTES: Record<string, string> = {
  FirebaseInstalledExtensionRepository: instalada,
  FirebaseTenantExtensionRepository: doTenant,
  FirebasePluginInstallationRepository: instalacao,
  publicExtensionMapping: publica,
  pluginRegistryMapping: registro,
};

const CAST_A_MAO = /instanceof Timestamp \? [\w.]+\.toDate\(\) : \(?\w+ as Date/;

/**
 * O cast à mão para `Date` não volta ao caminho do marketplace.
 *
 * Ele não falha na leitura: devolve o que estava gravado com o TIPO de `Date` e nenhum dos métodos
 * dela. Quando o valor vinha do Microteia Console (string ISO, gravada pela REST), o defeito só
 * aparecia na gravação seguinte — `t.getTime is not a function` dentro de `Timestamp.fromDate`, sem
 * campo, sem origem, e só reproduzível em quem já havia provisionado o backend uma vez.
 *
 * `toDateValueOrNow` existia desde antes, testado, escrito para exatamente este caso — e o caminho
 * inteiro do marketplace o ignorava em favor de cinco cópias idênticas do cast.
 */
describe('as datas do caminho do marketplace passam pela conversão canônica', () => {
  const arquivos = Object.keys(FONTES);

  it.each(arquivos)('%s não reescreve a conversão à mão', (arquivo) => {
    expect(FONTES[arquivo]).not.toMatch(CAST_A_MAO);
  });

  it.each(arquivos)('%s usa toDateValueOrNow', (arquivo) => {
    expect(FONTES[arquivo]).toContain("from '../utils/toDateValue'");
  });
});

/**
 * O formato exato que o Microteia Console grava, e o caminho de volta que estourava.
 *
 * O `provision` carimba `backendState` com `new Date().toISOString()` pela REST do Firestore
 * (`stringValue`) — então o valor que o front relê é uma string, não um `Timestamp`. O `upsert` a
 * devolve ao banco com `Timestamp.fromDate`, e era ali que o comando morria.
 */
describe('o carimbo que volta do Microteia Console', () => {
  const comoOConsoleGrava = new Date('2026-08-21T11:04:07.412Z').toISOString();

  it('atravessa a conversão e a gravação sem estourar', () => {
    const convertido = toDateValueOrNow(comoOConsoleGrava);
    expect(convertido).toBeInstanceOf(Date);
    expect(() => Timestamp.fromDate(convertido)).not.toThrow();
    expect(Timestamp.fromDate(convertido).toDate().toISOString()).toBe(comoOConsoleGrava);
  });

  /** O que acontecia antes, para que o teste registre o defeito e não só a correção. */
  it('e o cast à mão que existia ali devolvia a string, com o tipo de Date', () => {
    const comoEra = (v: unknown): Date => (v instanceof Timestamp ? v.toDate() : (v as Date) ?? new Date());
    const enganoso = comoEra(comoOConsoleGrava);
    expect(enganoso).not.toBeInstanceOf(Date);
    expect(() => Timestamp.fromDate(enganoso)).toThrow(/getTime is not a function/);
  });
});
