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
  it('entidade do registro mantém o prefixo declarado em código', () => {
    expect(getWorkflowEventPrefix('persons')).toBe('person');
  });

  it('lista de opções do kernel emite pelo prefixo comum', () => {
    expect(getWorkflowEventPrefix('contractTypes')).toBe('lookup');
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

  it('o caminho rápido responde por quem ainda está no registro', () => {
    expect(hasRegistryEventPrefix('persons')).toBe(true);
    expect(hasRegistryEventPrefix('medico')).toBe(false);
  });
});
