import { describe, it, expect } from 'vitest';
import { reportExpressionVariables } from './reportExpressionVariables';
import type { ReportPathOption } from './useReportPathOptions';
import type { FieldDefinition } from '../../../domain/entities/entitySchemas';

const field = (over: Partial<FieldDefinition>): FieldDefinition => ({
  key: 'situacao',
  label: 'Situação',
  type: 'text',
  required: false,
  order: 0,
  origin: 'design',
  ...over,
} as FieldDefinition);

const option = (over: Partial<ReportPathOption>): ReportPathOption => ({
  value: 'situacao',
  label: 'Situação',
  isDate: false,
  isNumeric: false,
  field: field({}),
  ...over,
});

const names = (options: ReportPathOption[]): string[] =>
  reportExpressionVariables(options, 'Identificador do registro').map((one) => one.name);

describe('reportExpressionVariables', () => {
  it('oferece o id do registro, que não é campo de tela nenhuma', () => {
    expect(names([])).toEqual(['id']);
  });

  it('oferece o campo pelo caminho que os seletores já mostram', () => {
    expect(names([option({ value: 'valor', label: 'Valor' })])).toEqual(['id', 'valor']);
  });

  /*
   * A decisão que evita um relatório vazio sem explicação.
   *
   * A hidratação troca o id pelo REGISTRO apontado, então `clienteId == "c1"` compara um objeto com
   * um texto e nunca acha nada. O caminho que responde é o do apontado.
   */
  it('um campo de referência entra pelo apontado, nunca pelo caminho cru', () => {
    const reference = option({
      value: 'clienteId',
      label: 'Cliente',
      field: field({ key: 'clienteId', label: 'Cliente', type: 'reference', refEntity: 'persons', refDenormKey: 'cliente' }),
    });

    expect(names([reference])).toEqual(['id', 'cliente.id']);
  });

  it('sem `refDenormKey`, o apontado é navegado pela própria chave do campo', () => {
    const reference = option({
      value: 'clienteId',
      label: 'Cliente',
      field: field({ key: 'clienteId', label: 'Cliente', type: 'reference', refEntity: 'persons' }),
    });

    expect(names([reference])).toEqual(['id', 'clienteId.id']);
  });

  it('não repete o mesmo nome — duas sugestões iguais dizem que existem duas coisas', () => {
    const nested = option({ value: 'cliente.id', label: 'Cliente › Identificador' });
    const reference = option({
      value: 'clienteId',
      label: 'Cliente',
      field: field({ key: 'clienteId', label: 'Cliente', type: 'reference', refEntity: 'persons', refDenormKey: 'cliente' }),
    });

    expect(names([reference, nested])).toEqual(['id', 'cliente.id']);
  });

  it('o rótulo do caminho vira a explicação da variável', () => {
    const [, valor] = reportExpressionVariables(
      [option({ value: 'cliente.cidade', label: 'Cliente › Cidade' })],
      'Identificador do registro',
    );

    expect(valor).toEqual({ name: 'cliente.cidade', definedBy: 'Cliente › Cidade' });
  });
});
