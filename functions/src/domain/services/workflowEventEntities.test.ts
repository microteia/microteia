import { describe, expect, it } from 'vitest';
import type { SchemaScreen } from '../schema/screenEntity';
import {
  declaredEventPrefix,
  getWorkflowEventPrefix,
  hasRegistryEventPrefix,
} from './workflowEventEntities';

const screen = (id: string, extra: Partial<SchemaScreen> = {}): SchemaScreen => ({
  id,
  titleSingular: id,
  titleFieldKey: 'nome',
  fields: [],
  ...extra,
});

describe('getWorkflowEventPrefix', () => {
  /** Pessoa saiu do registro: a convenção devolve o nome da coleção, e a TELA declara `person`. */
  it('entidade que saiu do kernel cai na convenção, à espera da declaração', () => {
    expect(getWorkflowEventPrefix('persons')).toBe('persons');
    expect(declaredEventPrefix([screen('pessoas', { collection: 'persons', eventPrefix: 'person' })], 'persons'))
      .toBe('person');
    expect(getWorkflowEventPrefix('contracts')).toBe('contracts');
    expect(declaredEventPrefix([screen('contratos', { collection: 'contracts', eventPrefix: 'contract' })], 'contracts'))
      .toBe('contract');
    expect(getWorkflowEventPrefix('deadlines')).toBe('deadlines');
    expect(declaredEventPrefix([screen('prazos', { collection: 'deadlines', eventPrefix: 'deadline' })], 'deadlines'))
      .toBe('deadline');
  });

  it('lista de opções do kernel emite pelo prefixo comum', () => {
    expect(getWorkflowEventPrefix('documentTypes')).toBe('lookup');
  });

  it('tela do escritório emite pelo próprio nome', () => {
    expect(getWorkflowEventPrefix('medico')).toBe('medico');
  });

  it('coleção do sistema não emite evento nenhum', () => {
    expect(getWorkflowEventPrefix('workflow_events')).toBeUndefined();
  });
});

/**
 * O prefixo declarado é o que permite uma entidade sair do kernel e passar a ser descrita por uma
 * extensão sem renomear os eventos que as automações do escritório já escutam: a coleção continua
 * `cases` e o evento continua `case.saved`.
 */
describe('declaredEventPrefix', () => {
  const screens = [
    screen('processos', { collection: 'cases', eventPrefix: 'case' }),
    screen('medico'),
  ];

  it('acha pela COLEÇÃO que a tela descreve, não pela chave dela', () => {
    expect(declaredEventPrefix(screens, 'cases')).toBe('case');
    expect(declaredEventPrefix(screens, 'processos')).toBeUndefined();
  });

  it('tela sem prefixo declarado não força nada', () => {
    expect(declaredEventPrefix(screens, 'medico')).toBeUndefined();
  });

  /**
   * A tela que leva o nome da coleção existe só para as rules lerem a permissão e nada declara sobre
   * eventos — e vem primeiro na ordem alfabética dos documentos. Se ela respondesse, o escritório
   * veria os eventos trocarem de nome sozinhos ao instalar a extensão.
   */
  it('a tela de permissão não cala o prefixo declarado pela extensão', () => {
    const withBaseline = [screen('cases'), ...screens];
    expect(declaredEventPrefix(withBaseline, 'cases')).toBe('case');
  });

  it('prefixo em branco não conta como declaração', () => {
    expect(declaredEventPrefix([screen('cases', { eventPrefix: '  ' })], 'cases')).toBeUndefined();
  });

  /**
   * Ninguém mais está no registro com prefixo próprio: `pushes` era o último, e saiu levando o
   * prefixo para a declaração da tela. O caminho rápido continua existindo — e continua sabendo
   * responder que não — porque é ele que evita uma leitura de telas a cada escrita de documento.
   */
  it('o caminho rápido responde que ninguém mais está no registro', () => {
    expect(hasRegistryEventPrefix('pushes')).toBe(false);
    expect(hasRegistryEventPrefix('medico')).toBe(false);
  });
});
