import { afterEach, describe, expect, it } from 'vitest';
import { configuredInstant, configuredTimeZone, resetAmbientInstant, setAmbientTimeZone } from './clockGate';
import { resetAmbientLocale, setAmbientLocale } from './i18n/localeGate';
import {
  evaluateFieldBoolean,
  evaluateFieldExpression,
  evaluateFieldValidation,
  extractFieldExpressionDependencies,
  extractFieldExpressionPaths,
  fieldExpressionSyntaxError,
} from './fieldExpression';

describe('evaluateFieldExpression — escopo e literais', () => {
  it('acessa campos por chave e o valor do próprio campo', () => {
    const ctx = { value: 'abc', data: { status: 'ativo', total: 10 } };
    expect(evaluateFieldExpression('status', ctx)).toBe('ativo');
    expect(evaluateFieldExpression('total + 5', ctx)).toBe(15);
    expect(evaluateFieldExpression('value', ctx)).toBe('abc');
    expect(evaluateFieldExpression('self', ctx)).toBe('abc');
  });

  it('resolve os literais null, true e false (expr-eval não os tem nativamente)', () => {
    const ctx = { value: null, data: {} };
    expect(evaluateFieldExpression('null', ctx)).toBe(null);
    expect(evaluateFieldExpression('true', ctx)).toBe(true);
    expect(evaluateFieldExpression('if(true, "sim", null)', ctx)).toBe('sim');
    expect(evaluateFieldExpression('if(false, "sim", null)', ctx)).toBe(null);
  });

  it('operadores lógicos and/or e comparação', () => {
    const ctx = { value: '', data: { a: 1, b: 2 } };
    expect(evaluateFieldExpression('a == 1 and b == 2', ctx)).toBe(true);
    expect(evaluateFieldExpression('a == 9 or b == 2', ctx)).toBe(true);
  });
});

describe('evaluateFieldBoolean', () => {
  it('vazio ou ausente → false', () => {
    expect(evaluateFieldBoolean('', { value: null, data: {} })).toBe(false);
    expect(evaluateFieldBoolean(null, { value: null, data: {} })).toBe(false);
    expect(evaluateFieldBoolean(undefined, { value: null, data: {} })).toBe(false);
  });

  it('avalia a condição sobre os campos', () => {
    const ctx = { value: null, data: { eletrico: true } };
    expect(evaluateFieldBoolean('eletrico == true', ctx)).toBe(true);
    expect(evaluateFieldBoolean('eletrico == false', ctx)).toBe(false);
  });

  it('expressão que referencia campo ausente não quebra → false', () => {
    expect(evaluateFieldBoolean('naoExiste == 1', { value: null, data: {} })).toBe(false);
  });
});

describe('evaluateFieldValidation', () => {
  it('string não-vazia é a mensagem de erro; null/vazio/false é ok', () => {
    const ctx = { value: '', data: {} };
    expect(evaluateFieldValidation('"Erro fixo"', ctx)).toBe('Erro fixo');
    expect(evaluateFieldValidation('null', ctx)).toBe(null);
    expect(evaluateFieldValidation('""', ctx)).toBe(null);
    expect(evaluateFieldValidation('false', ctx)).toBe(null);
  });

  it('não é sim/não: true reprova com o erro genérico, e só texto vazio, null ou false aprovam', () => {
    const ctx = { value: 'x', data: {} };
    expect(evaluateFieldValidation('true', ctx)).toBe('@core.records/field.invalid-value');
    expect(evaluateFieldValidation('""', ctx)).toBe(null);
    expect(evaluateFieldValidation('"Valor recusado"', ctx)).toBe('Valor recusado');
  });

  it('padrão obrigatório-condicional', () => {
    const expr = 'if(isEmpty(value) and status == "ativo", "Obrigatório para ativos", null)';
    expect(evaluateFieldValidation(expr, { value: '', data: { status: 'ativo' } })).toBe('Obrigatório para ativos');
    expect(evaluateFieldValidation(expr, { value: 'x', data: { status: 'ativo' } })).toBe(null);
    expect(evaluateFieldValidation(expr, { value: '', data: { status: 'inativo' } })).toBe(null);
  });

  it('funções puras do catálogo', () => {
    expect(evaluateFieldValidation('if(isCPF(value), null, "CPF inválido")', { value: '52998224725', data: {} })).toBe(null);
    expect(evaluateFieldValidation('if(isCPF(value), null, "CPF inválido")', { value: '11111111111', data: {} })).toBe('CPF inválido');
    expect(evaluateFieldExpression('onlyNumber("a1b2")', { value: '', data: {} })).toBe('12');
    expect(evaluateFieldExpression('upper("ab")', { value: '', data: {} })).toBe('AB');
  });

  it('expressão inválida não bloqueia (retorna null)', () => {
    expect(evaluateFieldValidation('funcaoInexistente(1)', { value: '', data: {} })).toBe(null);
  });
});

describe('map', () => {
  const ctx = {
    value: null,
    data: {
      partes: [
        { pessoa: { nome: 'Ana' }, papel: 'autor' },
        { pessoa: { nome: 'Bruno' }, papel: 'reu' },
      ],
      vazios: [{ nome: 'Ana' }, { nome: '' }, { nome: null }, {}],
      naoArray: 'texto',
    },
  };

  it('extrai caminho simples e aninhado', () => {
    expect(evaluateFieldExpression('map(partes, "papel")', ctx)).toEqual(['autor', 'reu']);
    expect(evaluateFieldExpression('map(partes, "pessoa.nome")', ctx)).toEqual(['Ana', 'Bruno']);
  });

  it('caminho ausente vira undefined, sem quebrar', () => {
    expect(evaluateFieldExpression('map(partes, "pessoa.idade")', ctx)).toEqual([undefined, undefined]);
    expect(evaluateFieldExpression('map(partes, "a.b.c")', ctx)).toEqual([undefined, undefined]);
  });

  it('compact descarta vazios (mas preserva 0 e false)', () => {
    expect(evaluateFieldExpression('map(vazios, "nome")', ctx)).toEqual(['Ana', '', null, undefined]);
    expect(evaluateFieldExpression('map(vazios, "nome", true)', ctx)).toEqual(['Ana']);
    const zeros = { value: null, data: { itens: [{ n: 0 }, { n: false }, { n: null }] } };
    expect(evaluateFieldExpression('map(itens, "n", true)', zeros)).toEqual([0, false]);
  });

  it('caminho vazio devolve os próprios itens', () => {
    expect(evaluateFieldExpression('map(partes, "")', ctx)).toEqual(ctx.data.partes);
  });

  it('não-array devolve lista vazia', () => {
    expect(evaluateFieldExpression('map(naoArray, "x")', ctx)).toEqual([]);
    expect(evaluateFieldExpression('map(null, "x")', ctx)).toEqual([]);
    expect(evaluateFieldValidation('if(length(map(naoArray, "x")) > 0, "erro", null)', ctx)).toBe(null);
  });

  it('não expõe chaves internas do protótipo', () => {
    expect(evaluateFieldExpression('map(partes, "constructor.name")', ctx)).toEqual([undefined, undefined]);
    expect(evaluateFieldExpression('map(partes, "__proto__")', ctx)).toEqual([undefined, undefined]);
  });

  it('contains e indexOf aceitam array e texto (paridade com o catálogo do Workflow)', () => {
    expect(evaluateFieldExpression('contains(map(partes, "papel"), "autor")', ctx)).toBe(true);
    expect(evaluateFieldExpression('contains(map(partes, "papel"), "perito")', ctx)).toBe(false);
    expect(evaluateFieldExpression('indexOf(map(partes, "papel"), "reu")', ctx)).toBe(1);
    expect(evaluateFieldExpression('indexOf(map(partes, "papel"), "perito")', ctx)).toBe(-1);
    expect(evaluateFieldExpression('contains("abcdef", "cde")', ctx)).toBe(true);
    expect(evaluateFieldExpression('indexOf("abcdef", "cde")', ctx)).toBe(2);
  });

  it('combina com length e contains nas validações', () => {
    const expr = 'if(length(map(partes, "pessoa.nome", true)) < 2, "Informe ao menos 2 partes", null)';
    expect(evaluateFieldValidation(expr, ctx)).toBe(null);
  });
});

describe('extractFieldExpressionDependencies', () => {
  it('devolve as chaves de campo referenciadas', () => {
    expect(extractFieldExpressionDependencies("concat(nome, ' ', sobrenome)").sort())
      .toEqual(['nome', 'sobrenome']);
    expect(extractFieldExpressionDependencies('quantidade * precoUnitario').sort())
      .toEqual(['precoUnitario', 'quantidade']);
  });

  it('descarta os nomes reservados do escopo', () => {
    expect(extractFieldExpressionDependencies("if(isEmpty(value), status, self)").sort())
      .toEqual(['status']);
    expect(extractFieldExpressionDependencies('if(true, 1, null)')).toEqual([]);
  });

  it('devolve vazio para expressão ausente ou inválida', () => {
    expect(extractFieldExpressionDependencies(null)).toEqual([]);
    expect(extractFieldExpressionDependencies('')).toEqual([]);
    expect(extractFieldExpressionDependencies('concat(')).toEqual([]);
  });
});

describe('extractFieldExpressionPaths', () => {
  it('devolve o CAMINHO inteiro, e não só o primeiro segmento', () => {
    // É a diferença que importa: `dependencies` responde de que CHAVE do escopo a expressão depende;
    // isto responde que DADO ela alcança, e é o caminho inteiro que a hidratação traz.
    expect(extractFieldExpressionPaths('cliente.cidade == "Recife" and valor > 0').sort())
      .toEqual(['cliente.cidade', 'valor']);
    expect(extractFieldExpressionDependencies('cliente.cidade == "Recife" and valor > 0').sort())
      .toEqual(['cliente', 'valor']);
  });

  it('não devolve nome de FUNÇÃO', () => {
    // Num parser sem as funções registradas, `today` e `isCPF` saem daqui com a cara de um campo — e
    // cada um viraria um caminho a hidratar e uma coleção a cobrar de quem lê.
    expect(extractFieldExpressionPaths('isEmpty(situacao) or vencimento < today()').sort())
      .toEqual(['situacao', 'vencimento']);
  });

  it('descarta os nomes reservados do escopo, inclusive quando são o início de um caminho', () => {
    expect(extractFieldExpressionPaths('if(isEmpty(value), status, self)')).toEqual(['status']);
    expect(extractFieldExpressionPaths('value.nome == "Ana"')).toEqual([]);
  });

  it('devolve vazio para expressão ausente ou inválida', () => {
    expect(extractFieldExpressionPaths(null)).toEqual([]);
    expect(extractFieldExpressionPaths('concat(')).toEqual([]);
  });
});

describe('fieldExpressionSyntaxError', () => {
  it('a expressão correta não tem erro — e a ausente também não', () => {
    expect(fieldExpressionSyntaxError('situacao == "pago"')).toBeNull();
    expect(fieldExpressionSyntaxError(null)).toBeNull();
    expect(fieldExpressionSyntaxError('   ')).toBeNull();
  });

  it('devolve a mensagem do parser, e não um booleano', () => {
    // Quem escreveu a expressão precisa saber ONDE ela quebrou: "expressão inválida" não ensina nada.
    expect(fieldExpressionSyntaxError('situacao == ')).toBeTruthy();
    expect(fieldExpressionSyntaxError('valor > (')).toBeTruthy();
  });
});

describe('object — construção de objeto por pares', () => {
  const ctx = { value: null, data: { preco: 10, nome: 'Ana' } };

  it('monta o objeto a partir de pares chave/valor', () => {
    expect(evaluateFieldExpression("object('preco', preco, 'nome', nome)", ctx))
      .toEqual({ preco: 10, nome: 'Ana' });
  });

  it('ignora uma chave sem valor no fim', () => {
    expect(evaluateFieldExpression("object('a', 1, 'b')", ctx)).toEqual({ a: 1 });
  });

  it('descarta chave vazia', () => {
    expect(evaluateFieldExpression("object('', 1, 'b', 2)", ctx)).toEqual({ b: 2 });
  });

  it('bloqueia chaves internas do protótipo', () => {
    expect(evaluateFieldExpression("object('__proto__', 1, 'ok', 2)", ctx)).toEqual({ ok: 2 });
    expect(evaluateFieldExpression("object('constructor', 1, 'ok', 2)", ctx)).toEqual({ ok: 2 });
  });

  it('sem argumentos devolve objeto vazio', () => {
    expect(evaluateFieldExpression('object()', ctx)).toEqual({});
  });
});

describe('contains/indexOf com referências hidratadas', () => {
  const ctx = {
    value: null,
    data: {
      ids: ['p1', 'p2'],
      registros: [{ id: 'p1', nome: 'Teclado' }, { id: 'p2', nome: 'Mouse' }],
    },
  };

  it('casa por id quando os itens são registros hidratados', () => {
    expect(evaluateFieldExpression("contains(registros, 'p1')", ctx)).toBe(true);
    expect(evaluateFieldExpression("contains(registros, 'p9')", ctx)).toBe(false);
    expect(evaluateFieldExpression("indexOf(registros, 'p2')", ctx)).toBe(1);
  });

  it('segue funcionando com array de ids crus', () => {
    expect(evaluateFieldExpression("contains(ids, 'p2')", ctx)).toBe(true);
    expect(evaluateFieldExpression("indexOf(ids, 'p1')", ctx)).toBe(0);
    expect(evaluateFieldExpression("indexOf(ids, 'p9')", ctx)).toBe(-1);
  });
});

describe('funções de data', () => {
  const ctx = { value: null, data: { type: 'Embargos de Declaração', vencimento: '2026-08-12' } };

  it('addDays devolve DIA quando recebe dia — a forma que um campo de data guarda', () => {
    expect(evaluateFieldExpression("addDays('2026-08-12', 15)", ctx)).toBe('2026-08-27');
    expect(evaluateFieldExpression('addDays(vencimento, 5)', ctx)).toBe('2026-08-17');
    expect(evaluateFieldExpression('addDays(today(), 0)', ctx)).toBe(evaluateFieldExpression('today()', ctx));
  });

  it('addDays atravessa a virada do mês e aceita dias negativos', () => {
    expect(evaluateFieldExpression("addDays('2026-08-28', 5)", ctx)).toBe('2026-09-02');
    expect(evaluateFieldExpression("addDays('2026-03-01', -1)", ctx)).toBe('2026-02-28');
  });

  /** O caso relatado: o prazo do Workflow, calculado pela expressão do parâmetro da ação. */
  it('compõe com if para o prazo que depende do tipo', () => {
    const expr = 'addDays(vencimento, if(type == "Embargos de Declaração", 5, 15))';
    expect(evaluateFieldExpression(expr, ctx)).toBe('2026-08-17');
    expect(evaluateFieldExpression(expr, { value: null, data: { ...ctx.data, type: 'Recurso' } }))
      .toBe('2026-08-27');
  });

  it('addDays com data inválida ou dias não-numéricos devolve null, sem estourar', () => {
    expect(evaluateFieldExpression("addDays('', 5)", ctx)).toBe(null);
    expect(evaluateFieldExpression("addDays('2026-08-12', 'muitos')", ctx)).toBe(null);
  });

  it('aceita Date e Timestamp do Firestore, não só texto', () => {
    const anchored = new Date(Date.UTC(2026, 7, 12, 12));
    const data = { asDate: anchored, asTimestamp: { toDate: () => anchored } };
    expect(evaluateFieldExpression("formatDate(asDate, 'DD/MM/YYYY')", { value: null, data })).toBe('12/08/2026');
    expect(evaluateFieldExpression("formatDate(asTimestamp, 'DD/MM/YYYY')", { value: null, data })).toBe('12/08/2026');
  });

  it('formatDate, year, month, day, dayOfWeek e isWeekend', () => {
    expect(evaluateFieldExpression("formatDate(vencimento, 'DD/MM/YYYY')", ctx)).toBe('12/08/2026');
    expect(evaluateFieldExpression('year(vencimento)', ctx)).toBe(2026);
    expect(evaluateFieldExpression('month(vencimento)', ctx)).toBe(8);
    expect(evaluateFieldExpression('day(vencimento)', ctx)).toBe(12);
    expect(evaluateFieldExpression('dayOfWeek(vencimento)', ctx)).toBe(3);
    expect(evaluateFieldExpression('isWeekend(vencimento)', ctx)).toBe(false);
    expect(evaluateFieldExpression("isWeekend('2026-08-15')", ctx)).toBe(true);
  });

  it('dateDiff em dias e em horas', () => {
    expect(evaluateFieldExpression("dateDiff('2026-08-20', vencimento, 'days')", ctx)).toBe(8);
    expect(evaluateFieldExpression("dateDiff('2026-08-20', vencimento, 'dias')", ctx)).toBe(8);
    expect(evaluateFieldExpression("dateDiff(vencimento, '2026-08-20', 'days')", ctx)).toBe(-8);
    expect(evaluateFieldExpression("dateDiff('2026-08-13', vencimento, 'horas')", ctx)).toBe(24);
    expect(evaluateFieldExpression("dateDiff('2026-08-13', vencimento, 'anos')", ctx)).toBe(null);
  });
});

describe('demais funções trazidas do catálogo do Workflow', () => {
  const ctx = { value: null, data: { nome: 'Ana', valores: [10, 20, 30], cpf: '12345678910' } };

  it('split, join e interpolate', () => {
    expect(evaluateFieldExpression("join(split('a,b,c', ','), ' | ')", ctx)).toEqual('a | b | c');
    expect(evaluateFieldExpression("interpolate('Olá {0}, tudo bem?', nome)", ctx)).toBe('Olá Ana, tudo bem?');
    expect(evaluateFieldExpression("interpolate('Olá {quem}', object('quem', nome))", ctx)).toBe('Olá Ana');
  });

  it('sum, avg, first e last', () => {
    expect(evaluateFieldExpression('sum(valores)', ctx)).toBe(60);
    expect(evaluateFieldExpression('avg(valores)', ctx)).toBe(20);
    expect(evaluateFieldExpression('first(valores)', ctx)).toBe(10);
    expect(evaluateFieldExpression('last(valores)', ctx)).toBe(30);
    expect(evaluateFieldExpression('sum(nome)', ctx)).toBe(0);
  });

  it('round passa a aceitar as casas decimais que o catálogo anuncia', () => {
    expect(evaluateFieldExpression('round(3.14159, 2)', ctx)).toBe(3.14);
    expect(evaluateFieldExpression('round(3.7)', ctx)).toBe(4);
    expect(evaluateFieldExpression('round(1234.567, 1)', ctx)).toBe(1234.6);
    expect(evaluateFieldExpression("round('nao e numero')", ctx)).toBe(null);
  });

  it('length conta campo vazio como 0, e não como as 4 letras de "null"', () => {
    expect(evaluateFieldExpression("length('texto')", ctx)).toBe(5);
    expect(evaluateFieldExpression('length(valores)', ctx)).toBe(3);
    expect(evaluateFieldExpression('length(nulo)', { value: null, data: { nulo: null } })).toBe(0);
    expect(evaluateFieldExpression("length('')", ctx)).toBe(0);
    expect(evaluateFieldExpression('length(12345)', ctx)).toBe(5);
  });

  /** Resolvidos pelos OPERADORES do expr-eval — seguem funcionando sem função registrada. */
  it('not, abs, floor e ceil continuam valendo pelo operador', () => {
    expect(evaluateFieldExpression('not(1 == 2)', ctx)).toBe(true);
    expect(evaluateFieldExpression('abs(0 - 5)', ctx)).toBe(5);
    expect(evaluateFieldExpression('floor(3.7)', ctx)).toBe(3);
    expect(evaluateFieldExpression('ceil(3.2)', ctx)).toBe(4);
    expect(evaluateFieldExpression('1 == 1 and 2 == 2', ctx)).toBe(true);
    expect(evaluateFieldExpression('1 == 9 or 2 == 2', ctx)).toBe(true);
  });

  it('delete e os formatadores de documento', () => {
    expect(evaluateFieldExpression("delete('b', object('a', 1, 'b', 2))", ctx)).toEqual({ a: 1 });
    expect(evaluateFieldExpression('formatCPF(cpf)', ctx)).toBe('123.456.789-10');
    expect(evaluateFieldExpression("formatCNPJ('12345678000190')", ctx)).toBe('12.345.678/0001-90');
  });

  it('mod97 calcula o resto ISO 7064 sobre o texto, sem perder dígito acima de 2^53', () => {
    expect(evaluateFieldExpression("mod97('00000012023805000164')", ctx)).toBe(1);
    expect(evaluateFieldExpression("mod97('00000012023805000165')", ctx)).toBe(2);
    expect(evaluateFieldExpression("98 - mod97('00000012023805000100')", ctx)).toBe(64);
    expect(evaluateFieldExpression("mod97('WEST12345698765432GB82')", ctx)).toBe(1);
    expect(evaluateFieldExpression("mod97('west12345698765432gb82')", ctx)).toBe(1);
  });

  it('mod97 é null para texto vazio ou com caractere fora de 0-9 e A-Z', () => {
    expect(evaluateFieldExpression("mod97('')", ctx)).toBe(null);
    expect(evaluateFieldExpression("mod97('0000001-64.2023')", ctx)).toBe(null);
    expect(evaluateFieldExpression('mod97(nulo)', { value: null, data: { nulo: null } })).toBe(null);
  });

  /**
   * `formatMoney` sem argumento de idioma segue o AMBIENTE. O teste passa a montar esse ambiente em
   * vez de presumi-lo: antes ele afirmava o formato brasileiro sem configurar idioma nenhum, e só
   * passava porque o gate tinha uma âncora `pt-BR` embutida. Com a âncora removida — o idioma agora
   * é negociado com o navegador —, presumir o ambiente deixou de ser correto.
   */
  it('formatMoney segue o idioma em vigor', () => {
    setAmbientLocale('pt-BR');
    expect(evaluateFieldExpression('formatMoney(1234.5)', ctx)).toBe('R$ 1.234,50');

    setAmbientLocale('en-US');
    expect(evaluateFieldExpression('formatMoney(1234.5)', ctx)).toBe('$1,234.50');

    resetAmbientLocale();
    expect(evaluateFieldExpression('formatMoney(1234.5)', ctx)).toBe('$1,234.50');
  });

  it('formatMoney com idioma explícito ignora o ambiente', () => {
    setAmbientLocale('en-US');
    expect(evaluateFieldExpression("formatMoney(1234.5, 'pt-BR')", ctx)).toBe('R$ 1.234,50');
    resetAmbientLocale();
  });
});

describe('instante da avaliação — o relógio como contexto', () => {
  const dia = new Date('2026-08-01T09:00:00.000Z');

  it('today() e now() respondem sobre o instante recebido', () => {
    const ctx = { value: null, data: {}, at: dia };
    expect(evaluateFieldExpression('today()', ctx)).toBe('2026-08-01');
    expect(evaluateFieldExpression('now()', ctx)).toBe('2026-08-01T09:00:00.000Z');
  });

  it('sem instante no contexto, vale o relógio — que é o que a gravação sempre fez', () => {
    const hoje = new Date().toISOString().slice(0, 10);
    expect(evaluateFieldExpression('today()', { value: null, data: {} })).toBe(hoje);
  });

  /**
   * O gate volta ao estado anterior, e "anterior" aqui é NENHUM instante. Restaurar o relógio lido
   * na entrada o prenderia: a partir da primeira derivação, toda expressão do processo passaria a
   * responder sobre aquele momento — e um valor de leitura envelheceria exatamente como o campo
   * gravado que ele veio substituir.
   */
  it('devolve o gate ao estado anterior, sem prender o relógio', () => {
    resetAmbientInstant();
    evaluateFieldExpression('today()', { value: null, data: {}, at: dia });
    expect(configuredInstant()).toBeNull();
  });
});

describe('today() — o dia do escritório', () => {
  const evening = new Date('2026-03-31T01:00:00.000Z');

  afterEach(() => resetAmbientInstant());

  it('responde o dia no fuso do contexto, e não em UTC', () => {
    expect(evaluateFieldExpression('today()', { value: null, data: {}, at: evening, timeZone: 'America/Sao_Paulo' }))
      .toBe('2026-03-30');
  });

  it('sem fuso no contexto, vale o que o provedor empurrou', () => {
    setAmbientTimeZone('America/Sao_Paulo');
    expect(evaluateFieldExpression('today()', { value: null, data: {}, at: evening })).toBe('2026-03-30');
  });

  it('sem fuso nenhum, UTC', () => {
    expect(evaluateFieldExpression('today()', { value: null, data: {}, at: evening })).toBe('2026-03-31');
  });

  it('now() continua sendo o instante, sem fuso', () => {
    expect(evaluateFieldExpression('now()', { value: null, data: {}, at: evening, timeZone: 'America/Sao_Paulo' }))
      .toBe('2026-03-31T01:00:00.000Z');
  });

  it('devolve o fuso ao anterior ao terminar', () => {
    evaluateFieldExpression('today()', { value: null, data: {}, at: evening, timeZone: 'Asia/Tokyo' });
    expect(configuredTimeZone()).toBeNull();
  });
});
