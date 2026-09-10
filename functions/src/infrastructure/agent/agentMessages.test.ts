import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { KERNEL_MESSAGE_NAMESPACES, agentCatalog, agentText } from './agentMessages';
import { DEFAULT_LOCALE } from '../../domain/schema/i18n/localeNegotiation';

const BACKEND_ROOT = join(__dirname, '..', '..');

const arquivosTs = (raiz: string): string[] =>
  readdirSync(raiz).flatMap((nome) => {
    const caminho = join(raiz, nome);
    if (statSync(caminho).isDirectory()) return arquivosTs(caminho);
    return nome.endsWith('.ts') ? [caminho] : [];
  });

/** Toda referência `@ns/chave` que o backend escreve, com o namespace separado. */
const referenciasDoBackend = (): { ref: string; namespace: string }[] => {
  const encontradas = new Map<string, string>();
  for (const arquivo of arquivosTs(BACKEND_ROOT)) {
    if (arquivo.endsWith('.test.ts')) continue;
    const fonte = readFileSync(arquivo, 'utf8');
    for (const casamento of fonte.matchAll(/@(core\.[a-z-]+)\/([a-z0-9.-]+)/g)) {
      encontradas.set(`@${casamento[1]}/${casamento[2]}`, casamento[1]);
    }
  }
  return [...encontradas].map(([ref, namespace]) => ({ ref, namespace }));
};

describe('catálogo do gateway de agente', () => {
  // Esta é a guarda que mantém `KERNEL_MESSAGE_NAMESPACES` DERIVADO em vez de mantido à mão. Sem
  // ela, uma referência nova de um namespace ausente resolveria para a chave crua — e um modelo que
  // recebe `@core.theme/algo` como frase não tem como saber que houve defeito.
  it('cobre todo namespace que o backend cita', () => {
    const citados = [...new Set(referenciasDoBackend().map((uma) => uma.namespace))].sort();
    const cobertos = Object.keys(KERNEL_MESSAGE_NAMESPACES);
    expect(citados.filter((namespace) => !cobertos.includes(namespace))).toEqual([]);
  });

  // A outra ponta: um namespace sincronizado que ninguém cita é texto de tela carregado em toda
  // partida a frio, sem ninguém para lê-lo.
  it('não carrega namespace que o backend não cita', () => {
    const citados = new Set(referenciasDoBackend().map((uma) => uma.namespace));
    expect(Object.keys(KERNEL_MESSAGE_NAMESPACES).filter((um) => !citados.has(um))).toEqual([]);
  });

  it('resolve toda referência que o backend emite', () => {
    const catalogo = agentCatalog([], DEFAULT_LOCALE);
    const cruas = referenciasDoBackend()
      .filter(({ namespace }) => namespace in KERNEL_MESSAGE_NAMESPACES)
      .filter(({ ref }) => agentText(catalogo, ref).text === ref)
      .map(({ ref }) => ref);
    expect(cruas).toEqual([]);
  });
});

describe('resolução de uma frase', () => {
  const catalogo = agentCatalog([], DEFAULT_LOCALE);

  it('devolve o texto e a referência que o originou', () => {
    const resolvido = agentText(catalogo, '@core.access/permission.denied', { permission: 'a.read' });
    expect(resolvido.ref).toBe('@core.access/permission.denied');
    expect(resolvido.text).not.toBe('@core.access/permission.denied');
  });

  // O que o escritório escreveu numa regra de campo já está pronto, e não se traduz. É a mesma
  // porta, sem decisão no ponto de emissão.
  it('deixa passar intacto o que não é referência', () => {
    const resolvido = agentText(catalogo, 'Telefone deve ter DDD + 8 ou 9 dígitos');
    expect(resolvido).toEqual({ text: 'Telefone deve ter DDD + 8 ou 9 dígitos', ref: null });
  });

  // Sem mecanismo novo: o pacote de idioma é uma extensão contribuindo `i18n.messages`, e o agente
  // passa a responder em português pela mesma via que a tela usa.
  it('responde no idioma que uma extensão instalada contribui', () => {
    const traduzido = agentCatalog(
      [{ locale: 'pt-BR', namespace: 'core.access', messages: { 'action.read': 'Visualizar' } }],
      'pt-BR',
    );
    expect(agentText(traduzido, '@core.access/action.read').text).toBe('Visualizar');
    expect(agentText(catalogo, '@core.access/action.read').text).toBe('View');
  });
});
