import { describe, it, expect } from 'vitest';
import { createSchemaContext, type PathRoot } from '../../../../domain/schema/pathResolver';
import { buildPathAutocompleteItems, extractActiveEventPath, findInvalidEventPath } from './pathAutocomplete';

// Processo é declarado por extensão: é a tela que descreve a coleção, os campos e a navegação.
const ctx = createSchemaContext([
  {
    id: 'processos',
    collection: 'cases',
    eventPrefix: 'case',
    titleSingular: 'Processo',
    titleFieldKey: 'title',
    fields: [
      { key: 'caseNumber', label: 'Número', type: 'text', required: true, order: 0, origin: 'plugin' },
      {
        key: 'contractId', label: 'Contrato', type: 'reference', refEntity: 'contracts',
        refDenormKey: 'contract', required: false, order: 1, origin: 'plugin',
      },
    ],
  },
  // Contrato também vem de extensão: é a tela dele que dá o segundo salto da navegação.
  {
    id: 'contratos',
    collection: 'contracts',
    eventPrefix: 'contract',
    titleSingular: 'Contrato',
    titleFieldKey: 'title',
    fields: [
      { key: 'number', label: 'Número', type: 'text', required: true, order: 0, origin: 'plugin' },
      {
        key: 'clientId', label: 'Cliente', type: 'reference', refEntity: 'persons',
        refDenormKey: 'client', required: false, order: 1, origin: 'plugin',
      },
    ],
  },
]);
const casesRoot: PathRoot = { kind: 'entity', entityKey: 'cases', hasOld: true };

describe('extractActiveEventPath', () => {
  it('extrai cadeia completa e segmento parcial', () => {
    expect(extractActiveEventPath('concat(event.contract.cli')).toStrictEqual({
      completedPath: 'contract',
      query: 'cli',
      queryStart: 'concat(event.contract.'.length,
    });
  });

  it('trata event. e cadeias profundas', () => {
    expect(extractActiveEventPath('event.')).toMatchObject({ completedPath: '', query: '' });
    expect(extractActiveEventPath('x + event.customValues.tarefa.')).toMatchObject({
      completedPath: 'customValues.tarefa',
      query: '',
    });
  });

  it('ignora texto sem event. ativo e identificadores colados', () => {
    expect(extractActiveEventPath('concat(foo')).toBeNull();
    expect(extractActiveEventPath('xevent.campo')).toBeNull();
    expect(extractActiveEventPath('event.contract.number + 1')).toBeNull();
  });
});

/**
 * O catálogo do teste responde em INGLÊS de propósito. Com 'Campo' aqui, a asserção passava tanto com
 * a chave resolvida quanto com o literal que ela veio substituir — o teste não distinguia as duas
 * formas, que é o mesmo que não testar.
 */
const CATALOGO: Record<string, string> = {
  '@core.ui/expression.category.field': 'Field',
  '@com.acme.docs/screen.contract': 'Contract',
};

// Mesma tolerância do `translate` real: chave sem catálogo devolve a PRÓPRIA chave — sem o `@`.
const label = (value: string | null | undefined): string =>
  CATALOGO[value ?? ''] ?? (value ?? '').replace(/^@/, '');

describe('buildPathAutocompleteItems', () => {
  it('sugere segmentos com ponto para nós navegáveis', () => {
    const items = buildPathAutocompleteItems(ctx, casesRoot, { completedPath: '', query: 'contr', queryStart: 0 }, label);
    // A relação aparece pelos dois nomes: o do registro apontado (navegável) e a chave que guarda
    // o id — esta também navegável, por ser um campo de referência.
    expect(items.find((i) => i.value === 'contract.')).toBeDefined();
    expect(items.find((i) => i.value === 'contractId.')).toBeDefined();
  });

  it('navega FK e filtra por query', () => {
    const items = buildPathAutocompleteItems(ctx, casesRoot, { completedPath: 'contract', query: 'num', queryStart: 0 }, label);
    expect(items[0]?.value).toBe('number');
  });

  /**
   * O grupo era o único literal entre os sete do editor de expressão — "Campo", em português, no
   * código. Nenhuma regra o via: não é JSX e a palavra não tem acento.
   */
  it('o grupo da sugestão vem do catálogo, não do código', () => {
    const items = buildPathAutocompleteItems(ctx, casesRoot, { completedPath: '', query: 'contr', queryStart: 0 }, label);

    expect(items.length).toBeGreaterThan(0);
    items.forEach((item) => expect(item.category).toBe('Field'));
  });

  it('nada que a sugestão mostra chega com a referência crua', () => {
    const items = buildPathAutocompleteItems(ctx, casesRoot, { completedPath: '', query: '', queryStart: 0 }, label);

    expect(items.length).toBeGreaterThan(0);
    items.forEach((item) => {
      expect(item.category?.startsWith('@'), item.value).toBe(false);
      expect(item.description?.includes('@'), item.value).toBe(false);
    });
  });
});

describe('findInvalidEventPath', () => {
  it('aceita caminhos válidos e desconhecidos permissivos', () => {
    expect(findInvalidEventPath(ctx, casesRoot, 'concat(event.contract.number, event.qualquerCoisa)')).toBeNull();
  });

  it('aponta navegação inválida em valor simples', () => {
    const issue = findInvalidEventPath(ctx, casesRoot, 'event.caseNumber.x');
    expect(issue?.path).toBe('event.caseNumber.x');
    expect(issue?.error).toBe('@core.automation/path.scalar-has-no-field');
  });
});
