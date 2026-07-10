import { describe, it, expect } from 'vitest';
import type { FieldDefinition } from '../entities/entitySchemas';
import {
  createSchemaContext,
  getValueAtPath,
  joinSegments,
  parsePath,
  resolvePath,
  stripEventPrefix,
  suggestNextSegments,
  type PathRoot,
} from './pathResolver';
import { extractExpressionPaths } from './expressionPaths';

const field = (partial: Partial<FieldDefinition> & Pick<FieldDefinition, 'key' | 'label' | 'type'>): FieldDefinition => ({
  required: false,
  order: 0,
  ...partial,
});

const ctx = createSchemaContext([
  {
    id: 'cases',
    titleSingular: 'Processo',
    titleFieldKey: 'title',
    fields: [
      field({ key: 'tarefa', label: 'Tarefa Principal', type: 'reference', refEntity: 'tarefas' }),
      field({ key: 'observacao', label: 'Observação', type: 'text' }),
      field({ key: 'urgente', label: 'Urgente', type: 'checkbox' }),
    ],
  },
  {
    id: 'tarefas',
    titleSingular: 'Tarefa',
    titleFieldKey: 'nome',
    fields: [
      field({ key: 'nome', label: 'Nome', type: 'text' }),
      field({ key: 'prazo', label: 'Prazo', type: 'date' }),
      field({ key: 'processo', label: 'Processo', type: 'reference', refEntity: 'cases' }),
      field({ key: 'etapas', label: 'Etapas', type: 'reference', refEntity: 'etapas', multi: true }),
    ],
  },
  {
    id: 'etapas',
    titleSingular: 'Etapa',
    titleFieldKey: 'nome',
    fields: [field({ key: 'nome', label: 'Nome', type: 'text' })],
  },
]);

const casesRoot: PathRoot = { kind: 'entity', entityKey: 'cases', hasOld: true };

describe('parsePath / stripEventPrefix / joinSegments', () => {
  it('normaliza índices em colchetes e numéricos', () => {
    expect(parsePath('a.b[0].c')).toStrictEqual(parsePath('a.b.0.c'));
    expect(joinSegments(parsePath('a.b[0].c'))).toBe('a.b.0.c');
  });

  it('normaliza as três convenções de prefixo', () => {
    expect(stripEventPrefix('event.payload.status')).toStrictEqual(parsePath('status'));
    expect(stripEventPrefix('event.status')).toStrictEqual(parsePath('status'));
    expect(stripEventPrefix('event')).toStrictEqual([]);
    expect(stripEventPrefix('event.payload')).toStrictEqual([]);
    expect(stripEventPrefix('event.old.status')).toStrictEqual(parsePath('old.status'));
    expect(stripEventPrefix('input.valor')).toBeNull();
  });
});

describe('getValueAtPath — equivalência com os resolvedores antigos', () => {
  const context = {
    event: { payload: { status: 'Ativo', contract: { number: '001' }, customValues: { tarefa: { nome: 'X' } } } },
  };

  it('navega caminho absoluto de condição', () => {
    expect(getValueAtPath(context, parsePath('event.payload.status'))).toBe('Ativo');
    expect(getValueAtPath(context, parsePath('event.payload.contract.number'))).toBe('001');
  });

  it('navega caminho relativo de mapping', () => {
    expect(getValueAtPath(context.event.payload, parsePath('customValues.tarefa.nome'))).toBe('X');
  });

  it('retorna undefined para caminho inexistente ou intermediário nulo', () => {
    expect(getValueAtPath(context, parsePath('event.payload.inexistente.x'))).toBeUndefined();
    expect(getValueAtPath(null, parsePath('a'))).toBeUndefined();
  });

  it('navega arrays por índice', () => {
    const payload = { activePole: [{ name: 'Maria' }, { name: 'João' }] };
    expect(getValueAtPath(payload, parsePath('activePole.0.name'))).toBe('Maria');
    expect(getValueAtPath(payload, parsePath('activePole[1].name'))).toBe('João');
    expect(getValueAtPath(payload, parsePath('activePole.5.name'))).toBeUndefined();
  });
});

describe('resolvePath — FKs fixas', () => {
  it('resolve FK de 1 salto com plano de materialização legado', () => {
    const resolution = resolvePath(ctx, casesRoot, parsePath('contract.number'));
    expect(resolution.valid).toBe(true);
    expect(resolution.node).toStrictEqual({ kind: 'scalar', type: 'string', lookupCollection: undefined });
    expect(resolution.depth).toBe(1);
    expect(resolution.hops).toStrictEqual([
      {
        atPath: 'contractId',
        targetCollection: 'contracts',
        materializeAt: 'contract',
        mode: 'denormKey',
        multi: false,
        fields: ['number', 'title', 'type', 'status'],
        bagKeys: ['customValues'],
      },
    ]);
  });

  it('resolve FK de 2 saltos (contract.client.name)', () => {
    const resolution = resolvePath(ctx, casesRoot, parsePath('contract.client.name'));
    expect(resolution.valid).toBe(true);
    expect(resolution.depth).toBe(2);
    expect(resolution.hops[1]).toStrictEqual({
      atPath: 'contract.clientId',
      targetCollection: 'persons',
      materializeAt: 'contract.client',
      mode: 'denormKey',
      multi: false,
      fields: ['name', 'type', 'email'],
      bagKeys: ['customValues'],
    });
  });

  it('respeita o limite de profundidade configurável', () => {
    const resolution = resolvePath(ctx, casesRoot, parsePath('contract.client.name'), { maxFkDepth: 1 });
    expect(resolution.valid).toBe(false);
    expect(resolution.error).toContain('Profundidade máxima');
  });

  it('resolve FK múltipla com índice', () => {
    const list = resolvePath(ctx, casesRoot, parsePath('activePole'));
    expect(list.node.kind).toBe('entityList');
    expect(list.hops[0]).toMatchObject({ atPath: 'activePoleIds', materializeAt: 'activePole', multi: true, fields: 'all' });

    const item = resolvePath(ctx, casesRoot, parsePath('activePole.0.name'));
    expect(item.valid).toBe(true);
    expect(item.node).toMatchObject({ kind: 'scalar', type: 'string' });
  });

  it('exige índice para navegar em lista', () => {
    const resolution = resolvePath(ctx, casesRoot, parsePath('activePole.name'));
    expect(resolution.valid).toBe(false);
    expect(resolution.error).toContain('lista');
  });

  it('mantém o campo FK cru como escalar', () => {
    expect(resolvePath(ctx, casesRoot, parsePath('contractId')).node).toMatchObject({ kind: 'scalar', type: 'string' });
    expect(resolvePath(ctx, casesRoot, parsePath('activePoleIds')).node).toMatchObject({ kind: 'scalar', type: 'stringArray' });
  });

  it('resolve changeType como string em evento com old', () => {
    expect(resolvePath(ctx, casesRoot, parsePath('changeType')).node).toMatchObject({ kind: 'scalar', type: 'string' });
  });

  it('não expõe changeType em evento sem old (.deleted)', () => {
    const deletedRoot: PathRoot = { kind: 'entity', entityKey: 'cases', hasOld: false };
    expect(resolvePath(ctx, deletedRoot, parsePath('changeType')).node).toMatchObject({ kind: 'unknown' });
  });
});

describe('resolvePath — campos customizados e telas dinâmicas', () => {
  it('resolve reference em customValues com substituição de valor', () => {
    const resolution = resolvePath(ctx, casesRoot, parsePath('customValues.tarefa.nome'));
    expect(resolution.valid).toBe(true);
    expect(resolution.node).toMatchObject({ kind: 'scalar', type: 'string' });
    expect(resolution.hops).toStrictEqual([
      {
        atPath: 'customValues.tarefa',
        targetCollection: 'customRecords',
        materializeAt: 'customValues.tarefa',
        mode: 'replaceValue',
        multi: false,
        fields: 'all',
      },
    ]);
  });

  it('resolve reference custom → builtin (tarefa.processo.title)', () => {
    const resolution = resolvePath(ctx, casesRoot, parsePath('customValues.tarefa.processo.title'));
    expect(resolution.valid).toBe(true);
    expect(resolution.depth).toBe(2);
    expect(resolution.hops[1]).toMatchObject({
      atPath: 'customValues.tarefa.processo',
      targetCollection: 'cases',
      mode: 'replaceValue',
      fields: ['caseNumber', 'title', 'area'],
    });
  });

  it('resolve reference custom → custom múltipla com índice', () => {
    const resolution = resolvePath(ctx, casesRoot, parsePath('customValues.tarefa.etapas.0.nome'));
    expect(resolution.valid).toBe(true);
    expect(resolution.depth).toBe(2);
    expect(resolution.hops[1]).toMatchObject({ targetCollection: 'customRecords', multi: true, mode: 'replaceValue' });
  });

  it('campo custom escalar vira folha tipada', () => {
    expect(resolvePath(ctx, casesRoot, parsePath('customValues.urgente')).node).toMatchObject({
      kind: 'scalar',
      type: 'boolean',
    });
  });

  it('customValues sem screen no contexto vira unknown navegável', () => {
    const emptyCtx = createSchemaContext();
    const resolution = resolvePath(emptyCtx, casesRoot, parsePath('customValues.qualquer.coisa'));
    expect(resolution.valid).toBe(true);
    expect(resolution.node.kind).toBe('unknown');
    expect(resolution.hops).toHaveLength(0);
  });

  it('registro de tela dinâmica na raiz navega por values', () => {
    const root: PathRoot = { kind: 'entity', entityKey: 'customRecords', screenKey: 'tarefas', hasOld: true };
    const resolution = resolvePath(ctx, root, parsePath('values.processo.caseNumber'));
    expect(resolution.valid).toBe(true);
    expect(resolution.hops[0]).toMatchObject({ atPath: 'values.processo', targetCollection: 'cases', mode: 'replaceValue' });
  });
});

describe('resolvePath — lookups, old e casos de borda', () => {
  it('campo de lookup é folha com a coleção anotada', () => {
    expect(resolvePath(ctx, casesRoot, parsePath('area')).node).toStrictEqual({
      kind: 'scalar',
      type: 'string',
      lookupCollection: 'caseAreas',
    });
  });

  it('old navega o mesmo schema com prefixo nos hops', () => {
    const resolution = resolvePath(ctx, casesRoot, parsePath('old.contract.number'));
    expect(resolution.valid).toBe(true);
    expect(resolution.hops[0]).toMatchObject({ atPath: 'old.contractId', materializeAt: 'old.contract' });
  });

  it('old sem hasOld cai em unknown', () => {
    const root: PathRoot = { kind: 'entity', entityKey: 'cases', hasOld: false };
    expect(resolvePath(ctx, root, parsePath('old.contract')).node.kind).toBe('unknown');
  });

  it('objeto aninhado nativo (address.city) com lookup', () => {
    const personsRoot: PathRoot = { kind: 'entity', entityKey: 'persons', hasOld: true };
    expect(resolvePath(ctx, personsRoot, parsePath('address.city')).node).toStrictEqual({
      kind: 'scalar',
      type: 'string',
      lookupCollection: 'personCities',
    });
  });

  it('escalar não possui propriedades', () => {
    const resolution = resolvePath(ctx, casesRoot, parsePath('caseNumber.x'));
    expect(resolution.valid).toBe(false);
    expect(resolution.error).toContain('valor simples');
  });

  it('raiz de campos declarados (eventos de sistema)', () => {
    const root: PathRoot = {
      kind: 'fields',
      hasOld: true,
      fields: [
        { key: 'content', label: 'Conteúdo', type: 'string' },
        {
          key: 'parent',
          label: 'Entidade pai',
          type: 'object',
          objectFields: [{ key: 'caseNumber', label: 'Número', type: 'string' }],
        },
      ],
    };
    expect(resolvePath(ctx, root, parsePath('parent.caseNumber')).node).toMatchObject({ kind: 'scalar' });
    expect(resolvePath(ctx, root, parsePath('old.content')).node).toMatchObject({ kind: 'scalar' });
    expect(resolvePath(ctx, root, parsePath('id')).node).toMatchObject({ kind: 'scalar' });
  });
});

describe('suggestNextSegments', () => {
  it('sugere campos, FKs navegáveis, customValues e old na raiz', () => {
    const suggestions = suggestNextSegments(ctx, casesRoot, []);
    const byText = Object.fromEntries(suggestions.map((s) => [s.insertText, s]));
    expect(byText.caseNumber).toMatchObject({ isLeaf: true, kind: 'field' });
    expect(byText.contract).toMatchObject({ isLeaf: false, kind: 'fk', detail: 'Contrato' });
    expect(byText.activePole).toMatchObject({ isLeaf: false, kind: 'fkList' });
    expect(byText.contractId).toMatchObject({ isLeaf: true });
    expect(byText.customValues).toMatchObject({ isLeaf: false });
    expect(byText.old).toMatchObject({ isLeaf: false });
    expect(byText.area.detail).toContain('Área do Direito');
  });

  it('navega para os campos da entidade alvo da FK', () => {
    const suggestions = suggestNextSegments(ctx, casesRoot, parsePath('contract'));
    const texts = suggestions.map((s) => s.insertText);
    expect(texts).toContain('number');
    expect(texts).toContain('client');
    expect(texts).toContain('customValues');
  });

  it('sugere índice para listas', () => {
    expect(suggestNextSegments(ctx, casesRoot, parsePath('activePole'))).toStrictEqual([
      { insertText: '0', label: 'Primeiro item da lista', kind: 'index', isLeaf: false },
    ]);
  });

  it('sugere campos da tela em customValues e do alvo da reference', () => {
    const bag = suggestNextSegments(ctx, casesRoot, parsePath('customValues'));
    expect(bag.find((s) => s.insertText === 'tarefa')).toMatchObject({ kind: 'reference', isLeaf: false, detail: 'Tarefa' });
    expect(bag.find((s) => s.insertText === 'observacao')).toMatchObject({ isLeaf: true });

    const target = suggestNextSegments(ctx, casesRoot, parsePath('customValues.tarefa'));
    const texts = target.map((s) => s.insertText);
    expect(texts).toEqual(expect.arrayContaining(['title', 'nome', 'prazo', 'processo']));
  });

  it('não sugere nada após erro ou em folha', () => {
    expect(suggestNextSegments(ctx, casesRoot, parsePath('caseNumber'))).toStrictEqual([]);
    expect(suggestNextSegments(ctx, casesRoot, parsePath('activePole.name'))).toStrictEqual([]);
  });
});

describe('extractExpressionPaths', () => {
  it('extrai apenas caminhos event.* com membros', () => {
    const paths = extractExpressionPaths('concat(event.customValues.tarefa.nome, " - ", upper(event.contract.number))');
    expect(paths.sort()).toStrictEqual(['event.contract.number', 'event.customValues.tarefa.nome'].sort());
  });

  it('retorna vazio para expressão inválida', () => {
    expect(extractExpressionPaths('concat(')).toStrictEqual([]);
  });
});
