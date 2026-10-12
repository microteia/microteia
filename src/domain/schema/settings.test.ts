import { describe, it, expect } from 'vitest';
import {
  emptySettingsValues,
  parseSettingsJson,
  resolveSetting,
  resolveWidgetLayout,
  validateSettingValue,
  type SettingsProperty,
  type SettingsSection,
} from './settings';

const booleanProperty: SettingsProperty = {
  key: 'agenda.compacta',
  label: 'Agenda compacta',
  type: 'boolean',
  default: false,
  scopes: ['tenant', 'user'],
};

const tenantOnly: SettingsProperty = {
  key: 'escritorio.horario',
  label: 'Horário',
  type: 'text',
  default: '09:00',
  scopes: ['tenant'],
};

const sections = (properties: SettingsProperty[]): SettingsSection[] => [
  { key: 'x', title: 'Seção', properties },
];

describe('resolveSetting — usuário vence escritório, que vence o padrão', () => {
  it('sem nada gravado, vale o padrão declarado', () => {
    expect(resolveSetting(booleanProperty, emptySettingsValues())).toEqual({ value: false, scope: null });
  });

  it('o valor do escritório vale quando o usuário não tem o seu', () => {
    const values = { tenant: { 'agenda.compacta': true }, user: {} };
    expect(resolveSetting(booleanProperty, values)).toEqual({ value: true, scope: 'tenant' });
  });

  it('a preferência do usuário vence a do escritório', () => {
    const values = { tenant: { 'agenda.compacta': true }, user: { 'agenda.compacta': false } };
    expect(resolveSetting(booleanProperty, values)).toEqual({ value: false, scope: 'user' });
  });

  /** Resíduo no banco de um escopo que a declaração não aceita mais não pode voltar a valer. */
  it('ignora o escopo que a propriedade não aceita', () => {
    const values = { tenant: {}, user: { 'escritorio.horario': '23:00' } };
    expect(resolveSetting(tenantOnly, values)).toEqual({ value: '09:00', scope: null });
  });

  /** Valor inválido gravado cai para o próximo nível em vez de quebrar quem o consome. */
  it('valor gravado inválido cai para o padrão', () => {
    const values = { tenant: { 'agenda.compacta': 'sim' }, user: {} };
    expect(resolveSetting(booleanProperty, values)).toEqual({ value: false, scope: null });
  });
});

describe('validateSettingValue', () => {
  it('cobra o tipo de cada declaração', () => {
    expect(validateSettingValue(booleanProperty, true)).toBeNull();
    expect(validateSettingValue(booleanProperty, 'sim')).not.toBeNull();
  });

  it('respeita mínimo e máximo do número', () => {
    const property: SettingsProperty = {
      key: 'n', label: 'N', type: 'number', default: 1, min: 1, max: 3, scopes: ['user'],
    };
    expect(validateSettingValue(property, 2)).toBeNull();
    expect(validateSettingValue(property, 0)).not.toBeNull();
    expect(validateSettingValue(property, 4)).not.toBeNull();
  });

  it('só aceita uma das opções declaradas no select', () => {
    const property: SettingsProperty = {
      key: 's', label: 'S', type: 'select', default: 'a', scopes: ['user'],
      options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
    };
    expect(validateSettingValue(property, 'b')).toBeNull();
    expect(validateSettingValue(property, 'c')).not.toBeNull();
  });

  it('a lista de widgets exige chave e largura dentro da grade', () => {
    const property: SettingsProperty = {
      key: 'w', label: 'W', type: 'widgets', default: [], scopes: ['user'], surface: 'dashboard',
    };
    expect(validateSettingValue(property, [{ key: 'a', enabled: true, span: 2 }])).toBeNull();
    expect(validateSettingValue(property, [{ key: 'a', span: 9 }])).not.toBeNull();
    expect(validateSettingValue(property, 'nada')).not.toBeNull();
  });
});

describe('resolveWidgetLayout — o que sumiu não deixa buraco, o que chegou entra no fim', () => {
  const available = [
    { key: 'a', defaultSpan: 1, order: 10 },
    { key: 'b', defaultSpan: 2, order: 20 },
    { key: 'novo', defaultSpan: 3, defaultEnabled: false, order: 30 },
  ];

  it('preserva a ordem escolhida e acrescenta o que apareceu depois', () => {
    const stored = [{ key: 'b', enabled: true, span: 1 }, { key: 'a', enabled: false, span: 3 }];
    expect(resolveWidgetLayout(stored, available)).toEqual([
      { key: 'b', enabled: true, span: 1 },
      { key: 'a', enabled: false, span: 3 },
      { key: 'novo', enabled: false, span: 3 },
    ]);
  });

  it('descarta a entrada de um widget que não existe mais', () => {
    const stored = [{ key: 'sumiu', enabled: true, span: 2 }, { key: 'a', enabled: true, span: 1 }];
    expect(resolveWidgetLayout(stored, available).map((entry) => entry.key)).toEqual(['a', 'b', 'novo']);
  });

  it('sem nada gravado, vale o padrão de cada widget, na ordem declarada', () => {
    expect(resolveWidgetLayout(undefined, available)).toEqual([
      { key: 'a', enabled: true, span: 1 },
      { key: 'b', enabled: true, span: 2 },
      { key: 'novo', enabled: false, span: 3 },
    ]);
  });
});

describe('parseSettingsJson — o documento escrito à mão', () => {
  it('erro de sintaxe não aproveita nada', () => {
    const parsed = parseSettingsJson(sections([booleanProperty]), '{ isto não é json', 'user');
    expect(parsed.syntaxError).not.toBeNull();
    expect(parsed.values).toEqual({});
  });

  /**
   * O problema de sintaxe é CHAVE, e não frase. Aqui morava um `'O documento precisa ser um objeto
   * JSON.'` que chegava à tela sem passar por catálogo nenhum: quem não tem tradução instalada lia
   * português no meio de uma interface em inglês, e ninguém percebia porque só aparece quando alguém
   * cola um documento errado.
   */
  it('o problema de sintaxe é uma referência de mensagem, nunca a frase pronta', () => {
    for (const text of ['{ isto não é json', '[1, 2, 3]', '"só um texto"']) {
      const issue = parseSettingsJson(sections([booleanProperty]), text, 'user').syntaxError;
      expect(issue, text).not.toBeNull();
      expect(issue?.message, text).toMatch(/^[a-z][a-z0-9.-]*$/);
    }
  });

  it('o documento que não é objeto é recusado pela chave própria', () => {
    const parsed = parseSettingsJson(sections([booleanProperty]), '[1, 2, 3]', 'user');
    expect(parsed.syntaxError).toEqual({ message: 'settings.json.not-object' });
  });

  /** O texto do motor de JSON entra como PARÂMETRO, não no lugar da chave. */
  it('a falha de leitura carrega o detalhe do motor sem virar o texto todo', () => {
    const parsed = parseSettingsJson(sections([booleanProperty]), '{ isto não é json', 'user');
    expect(parsed.syntaxError?.message).toBe('settings.json.invalid');
    expect(parsed.syntaxError?.messageParams?.detail).toBeTruthy();
  });

  it('recusa a chave conhecida com valor inválido e mantém as demais', () => {
    const text = JSON.stringify({ 'agenda.compacta': 'sim', outra: 1 });
    const parsed = parseSettingsJson(sections([booleanProperty]), text, 'user');
    expect(parsed.errors.map((issue) => issue.key)).toEqual(['agenda.compacta']);
    expect(parsed.values).toEqual({ outra: 1 });
  });

  /** A extensão dona da chave pode estar desativada agora — apagá-la perderia a configuração dela. */
  it('preserva chave desconhecida', () => {
    const parsed = parseSettingsJson(sections([booleanProperty]), '{"de.outra.extensao": 42}', 'user');
    expect(parsed.errors).toEqual([]);
    expect(parsed.values).toEqual({ 'de.outra.extensao': 42 });
  });

  it('recusa gravar no escopo que a propriedade não aceita', () => {
    const parsed = parseSettingsJson(sections([tenantOnly]), '{"escritorio.horario": "10:00"}', 'user');
    expect(parsed.errors.map((issue) => issue.key)).toEqual(['escritorio.horario']);
  });
});

const statusChoice: SettingsProperty = {
  key: 'processo.recentes.status',
  label: 'Status',
  type: 'select',
  multi: true,
  optionsFrom: { kind: 'lookup', collection: 'caseStatuses' },
  default: ['Em Andamento'],
  scopes: ['user', 'tenant'],
};

const ownerChoice: SettingsProperty = {
  key: 'agenda.responsavel',
  label: 'Responsável',
  type: 'select',
  optionsFrom: { kind: 'entity', collection: 'persons' },
  default: '',
  scopes: ['tenant'],
};

const closedMulti: SettingsProperty = {
  key: 'agenda.dias',
  label: 'Dias',
  type: 'select',
  multi: true,
  options: [{ value: 'seg', label: 'Seg' }, { value: 'ter', label: 'Ter' }],
  default: [],
  scopes: ['tenant'],
};

describe('select com opções de uma coleção do escritório (optionsFrom)', () => {
  it('multi aceita a lista de valores, inclusive vazia', () => {
    expect(validateSettingValue(statusChoice, ['Em Andamento', 'Suspenso'])).toBeNull();
    expect(validateSettingValue(statusChoice, [])).toBeNull();
  });

  it('multi recusa o valor escalar e o item que não é texto', () => {
    expect(validateSettingValue(statusChoice, 'Em Andamento')).toEqual({ message: 'setting.select.multi' });
    expect(validateSettingValue(statusChoice, ['Em Andamento', 3])).toEqual({ message: 'setting.select.multi' });
  });

  it('multi recusa a mesma opção duas vezes', () => {
    expect(validateSettingValue(statusChoice, ['Suspenso', 'Suspenso']))
      .toEqual({ message: 'setting.select.duplicate' });
  });

  /**
   * A validação é síncrona e roda no backend: não conhece os registros. Recusar o valor que não está
   * mais na lista faria a escolha voltar sozinha ao padrão no dia em que a opção fosse excluída.
   */
  it('confere a forma, nunca a existência — o valor que sumiu da lista continua válido', () => {
    expect(validateSettingValue(statusChoice, ['Opção que foi excluída'])).toBeNull();
    expect(validateSettingValue(ownerChoice, 'id-de-um-registro-excluido')).toBeNull();
  });

  it('o select simples de coleção exige um texto não vazio', () => {
    expect(validateSettingValue(ownerChoice, '')).toEqual({ message: 'setting.select' });
    expect(validateSettingValue(ownerChoice, ['a'])).toEqual({ message: 'setting.select' });
  });

  it('multi de opções fechadas confere cada item contra a lista', () => {
    expect(validateSettingValue(closedMulti, ['seg', 'ter'])).toBeNull();
    expect(validateSettingValue(closedMulti, ['seg', 'dom'])).toEqual({ message: 'setting.select' });
  });

  it('a resolução devolve o array do usuário, senão o do escritório, senão o padrão', () => {
    expect(resolveSetting(statusChoice, emptySettingsValues()))
      .toEqual({ value: ['Em Andamento'], scope: null });

    const tenantOnlyValue = { tenant: { [statusChoice.key]: ['Suspenso'] }, user: {} };
    expect(resolveSetting(statusChoice, tenantOnlyValue)).toEqual({ value: ['Suspenso'], scope: 'tenant' });

    const both = { tenant: { [statusChoice.key]: ['Suspenso'] }, user: { [statusChoice.key]: ['Em Andamento', 'Suspenso'] } };
    expect(resolveSetting(statusChoice, both)).toEqual({ value: ['Em Andamento', 'Suspenso'], scope: 'user' });
  });

  it('o JSON aceita o array e recusa o escalar, com a mensagem da propriedade', () => {
    const ok = parseSettingsJson(sections([statusChoice]), JSON.stringify({ [statusChoice.key]: ['Suspenso'] }), 'user');
    expect(ok.errors).toEqual([]);
    expect(ok.values).toEqual({ [statusChoice.key]: ['Suspenso'] });

    const wrong = parseSettingsJson(sections([statusChoice]), JSON.stringify({ [statusChoice.key]: 'Suspenso' }), 'user');
    expect(wrong.errors).toEqual([{ key: statusChoice.key, message: 'setting.select.multi' }]);
  });

  it('o select simples de opções fechadas continua como era', () => {
    const closed: SettingsProperty = { ...closedMulti, multi: undefined, default: 'seg' };
    expect(validateSettingValue(closed, 'ter')).toBeNull();
    expect(validateSettingValue(closed, 'dom')).toEqual({ message: 'setting.select' });
  });
});

describe('validateSettingValue — timezone', () => {
  const timeZone: SettingsProperty = {
    key: 'i18n.timezone',
    label: 'Fuso',
    type: 'timezone',
    default: '',
    scopes: ['tenant', 'user'],
  };

  it('aceita fuso IANA e o vazio, que é o automático', () => {
    expect(validateSettingValue(timeZone, 'America/Sao_Paulo')).toBeNull();
    expect(validateSettingValue(timeZone, '')).toBeNull();
  });

  it('recusa deslocamento solto e nome inventado', () => {
    expect(validateSettingValue(timeZone, '-03:00')).toEqual({ message: 'setting.timezone' });
    expect(validateSettingValue(timeZone, 'Brasilia')).toEqual({ message: 'setting.timezone' });
  });

  it('valor gravado inválido não resolve: cai no padrão', () => {
    expect(resolveSetting(timeZone, { tenant: { 'i18n.timezone': 'GMT-3' }, user: {} }).value).toBe('');
  });
});
