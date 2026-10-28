import { describe, expect, it } from 'vitest';
import { buildReferenceOptions } from './buildReferenceOptions';
import type { ReferenceOptionSources } from './buildReferenceOptions';
import type { EntityRecord, FieldDefinition, LookupOption, ScreenDefinition } from '../../domain/entities';

const field = (overrides: Partial<FieldDefinition>): FieldDefinition => ({
  key: 'nome',
  label: 'Nome',
  type: 'text',
  required: false,
  order: 0,
  origin: 'design',
  ...overrides,
});

const screen = (overrides: Partial<ScreenDefinition>): ScreenDefinition => ({
  id: 'domicilios',
  titleFieldKey: 'titularNome',
  fields: [],
  ...overrides,
}) as ScreenDefinition;

const record = (id: string, values: Record<string, unknown>): EntityRecord =>
  ({ id, ...values }) as EntityRecord;

const LOOKUPS: Record<string, LookupOption[]> = {
  situacoes: [{ key: 'em_analise', label: 'Em análise' }],
};

const optionsOf = (overrides: Partial<ReferenceOptionSources>) =>
  buildReferenceOptions({
    recordsByCollection: {},
    dynamicScreens: [],
    members: [],
    getOptions: (collection) => LOOKUPS[collection] ?? [],
    label: (value) => (value.startsWith('@') ? `«${value}»` : value),
    untitled: 'Sem título',
    ...overrides,
  });

const SITUACAO = field({
  key: 'situacao',
  type: 'select',
  options: [{ key: 'nao_habilitado', label: '@dte.cad/situacao.nao-habilitado' }],
  lookupCollection: 'situacoes',
});

/**
 * O seletor de um campo `reference` deve ler o registro como o cartão o lê: o título e o subtítulo
 * pelo VALOR EXIBIDO. Ele mostrava `@core.records/record.untitled` e a chave da opção (`nao_habilitado`)
 * onde o cartão mostrava "Sem título" e o rótulo.
 */
describe('buildReferenceOptions', () => {
  it('o registro sem título recebe o "sem título" já traduzido, nunca a referência do catálogo', () => {
    const options = optionsOf({
      dynamicScreens: [screen({ fields: [field({ key: 'titularNome' })] })],
      recordsByCollection: { domicilios: [record('d1', {})] },
    });

    expect(options.domicilios).toEqual([{ value: 'd1', label: 'Sem título', meta: undefined }]);
  });

  it('o subtítulo de SELEÇÃO sai pelo rótulo da opção declarada, resolvido no idioma', () => {
    const options = optionsOf({
      dynamicScreens: [screen({ subtitleFieldKey: 'situacao', fields: [SITUACAO] })],
      recordsByCollection: { domicilios: [record('d1', { titularNome: 'Ana', situacao: 'nao_habilitado' })] },
    });

    expect(options.domicilios[0]).toEqual({
      value: 'd1',
      label: 'Ana',
      meta: '«@dte.cad/situacao.nao-habilitado»',
    });
  });

  it('a opção que só existe na lista do escritório também sai pelo rótulo', () => {
    const options = optionsOf({
      dynamicScreens: [screen({ subtitleFieldKey: 'situacao', fields: [SITUACAO] })],
      recordsByCollection: { domicilios: [record('d1', { titularNome: 'Ana', situacao: 'em_analise' })] },
    });

    expect(options.domicilios[0].meta).toBe('Em análise');
  });

  it('a chave sem opção correspondente continua aparecendo, como no cartão', () => {
    const options = optionsOf({
      dynamicScreens: [screen({ subtitleFieldKey: 'situacao', fields: [SITUACAO] })],
      recordsByCollection: { domicilios: [record('d1', { titularNome: 'Ana', situacao: 'removida' })] },
    });

    expect(options.domicilios[0].meta).toBe('removida');
  });

  it('a seleção MÚLTIPLA junta os rótulos', () => {
    const multi = { ...SITUACAO, multi: true };
    const options = optionsOf({
      dynamicScreens: [screen({ subtitleFieldKey: 'situacao', fields: [multi] })],
      recordsByCollection: {
        domicilios: [record('d1', { titularNome: 'Ana', situacao: ['nao_habilitado', 'em_analise'] })],
      },
    });

    expect(options.domicilios[0].meta).toBe('«@dte.cad/situacao.nao-habilitado», Em análise');
  });

  describe('subtítulo e título de RELAÇÃO', () => {
    const empresas = screen({ id: 'empresas', titleFieldKey: 'razao', fields: [field({ key: 'razao' })] });
    const domicilios = screen({
      subtitleFieldKey: 'empresa',
      fields: [field({ key: 'empresa', type: 'reference', refEntity: 'empresas' })],
    });

    it('sai pelo nome do registro apontado, não pelo id', () => {
      const options = optionsOf({
        dynamicScreens: [empresas, domicilios],
        recordsByCollection: {
          empresas: [record('e1', { razao: 'ACME Ltda' })],
          domicilios: [record('d1', { titularNome: 'Ana', empresa: 'e1' })],
        },
      });

      expect(options.domicilios[0].meta).toBe('ACME Ltda');
    });

    it('o apontado que não está carregado deixa o subtítulo vazio, em vez de mostrar o id', () => {
      const options = optionsOf({
        dynamicScreens: [empresas, domicilios],
        recordsByCollection: { empresas: [], domicilios: [record('d1', { titularNome: 'Ana', empresa: 'e9' })] },
      });

      expect(options.domicilios[0].meta).toBeUndefined();
    });

    it('o apontado carregado e sem título aparece como "sem título"', () => {
      const options = optionsOf({
        dynamicScreens: [empresas, domicilios],
        recordsByCollection: {
          empresas: [record('e1', {})],
          domicilios: [record('d1', { titularNome: 'Ana', empresa: 'e1' })],
        },
      });

      expect(options.domicilios[0].meta).toBe('Sem título');
    });

    it('aponta para um membro pelo nome dele', () => {
      const options = optionsOf({
        members: [{ userId: 'u1', displayName: 'Bruno', email: 'b@x.com' }],
        dynamicScreens: [screen({
          subtitleFieldKey: 'responsavel',
          fields: [field({ key: 'responsavel', type: 'reference', refEntity: 'members' })],
        })],
        recordsByCollection: { domicilios: [record('d1', { titularNome: 'Ana', responsavel: 'u1' })] },
      });

      expect(options.domicilios[0].meta).toBe('Bruno');
    });

    it('a relação declarada pela CHAVE da tela acha os registros da coleção dela', () => {
      const processos = screen({ id: 'processos', dataCollection: 'cases', titleFieldKey: 'numero', fields: [] });
      const options = optionsOf({
        dynamicScreens: [processos, screen({
          subtitleFieldKey: 'processo',
          fields: [field({ key: 'processo', type: 'reference', refEntity: 'processos' })],
        })],
        recordsByCollection: {
          cases: [record('c1', { numero: '0001' })],
          domicilios: [record('d1', { titularNome: 'Ana', processo: 'c1' })],
        },
      });

      expect(options.domicilios[0].meta).toBe('0001');
    });

    it('o TÍTULO que é relação segue a mesma regra, como no cartão', () => {
      const options = optionsOf({
        dynamicScreens: [empresas, screen({
          titleFieldKey: 'empresa',
          fields: [field({ key: 'empresa', type: 'reference', refEntity: 'empresas' })],
        })],
        recordsByCollection: {
          empresas: [record('e1', { razao: 'ACME Ltda' })],
          domicilios: [record('d1', { empresa: 'e1' })],
        },
      });

      expect(options.domicilios[0].label).toBe('ACME Ltda');
    });

    it('títulos que apontam um para o outro não giram para sempre: o ciclo cai em "sem título"', () => {
      const a = screen({
        id: 'a',
        titleFieldKey: 'b',
        fields: [field({ key: 'b', type: 'reference', refEntity: 'b' })],
      });
      const b = screen({
        id: 'b',
        titleFieldKey: 'a',
        fields: [field({ key: 'a', type: 'reference', refEntity: 'a' })],
      });
      const options = optionsOf({
        dynamicScreens: [a, b],
        recordsByCollection: { a: [record('a1', { b: 'b1' })], b: [record('b1', { a: 'a1' })] },
      });

      expect(options.a[0].label).toBe('Sem título');
      expect(options.b[0].label).toBe('Sem título');
    });
  });

  describe('o que já funcionava continua igual', () => {
    it('título e subtítulo de texto saem como estão gravados, sem espaços nas pontas', () => {
      const options = optionsOf({
        dynamicScreens: [screen({ subtitleFieldKey: 'cpf' })],
        recordsByCollection: { domicilios: [record('d1', { titularNome: '  Ana ', cpf: '123' })] },
      });

      expect(options.domicilios).toEqual([{ value: 'd1', label: 'Ana', meta: '123' }]);
    });

    it('o campo que a tela não declara é lido como texto', () => {
      const options = optionsOf({
        dynamicScreens: [screen({ subtitleFieldKey: 'situacao', fields: [] })],
        recordsByCollection: { domicilios: [record('d1', { titularNome: 'Ana', situacao: 'nao_habilitado' })] },
      });

      expect(options.domicilios[0].meta).toBe('nao_habilitado');
    });

    it('a coleção sem tela tem só o "sem título" como rótulo', () => {
      const options = optionsOf({ recordsByCollection: { soltos: [record('s1', { titularNome: 'Ana' })] } });

      expect(options.soltos).toEqual([{ value: 's1', label: 'Sem título', meta: undefined }]);
    });

    it('ordena pelo rótulo resolvido', () => {
      const options = optionsOf({
        dynamicScreens: [screen({})],
        recordsByCollection: {
          domicilios: [record('d1', { titularNome: 'Bruno' }), record('d2', {}), record('d3', { titularNome: 'Ana' })],
        },
      });

      expect(options.domicilios.map((option) => option.label)).toEqual(['Ana', 'Bruno', 'Sem título']);
    });

    it('a chave da tela responde ao lado da coleção', () => {
      const options = optionsOf({
        dynamicScreens: [screen({ id: 'processos', dataCollection: 'cases', titleFieldKey: 'numero' })],
        recordsByCollection: { cases: [record('c1', { numero: '0001' })] },
      });

      expect(options.processos).toBe(options.cases);
    });
  });
});
