import type {
  ActionModuleTemplate,
  LookupModuleTemplate,
  MarketplacePlugin,
  ScreenModuleTemplate,
  TemplateField,
  WorkflowModuleTemplate,
} from '../../domain/entities/MarketplacePlugin';
import type { CustomFieldOption } from '../../domain/entities';
import { surfaceWidget } from '../contributionBuilders';

/**
 * **Pessoa** — o cadastro de pessoas do escritório, inteiro, declarado por extensão: os campos e as
 * seções, as máscaras e as validações de CPF/CNPJ, as listas de opções (com as de partida), o
 * endereço com busca por CEP, as regras que escondem campo de Pessoa Jurídica, as etiquetas, o
 * cartão da listagem, os filtros e o prefixo dos eventos. O kernel não conhece nada disso.
 *
 * `dataCollection: 'persons'` aponta para a coleção onde as pessoas já estão: a entidade muda de
 * dono sem que um registro se mova, e sem renomear os eventos (`person.saved`) que as automações do
 * escritório escutam.
 *
 * Pessoa é a entidade mais REFERENCIADA do escritório — processos, contratos, prazos e lançamentos
 * apontam para ela. Nada disso muda de forma: uma relação aponta para a COLEÇÃO (`persons`), que é
 * um nome global, e não para a tela que a descreve.
 */
const SOURCE_ID = 'microteia:pessoa';

const ENDERECO = 'Endereço';

/** Só faz sentido em Pessoa Física; a expressão esconde o campo quando o tipo é outro. */
const APENAS_PF = 'type != "Pessoa Física"';
const APENAS_PJ = 'type != "Pessoa Jurídica"';

/**
 * As mesmas regras que o kernel declarava em código. `format` normaliza para o formato GRAVADO
 * (dígitos puros — a máscara existe só na tela) e `validate` recusa o que não confere; `check`
 * aponta um preset do catálogo, que sabe validar dígito verificador.
 */
const TELEFONE = {
  format: { preset: 'digits' },
  validate: { pattern: '^\\d{10,11}$', message: 'Telefone deve ter DDD + 8 ou 9 dígitos' },
};

const CEP = {
  format: { preset: 'digits' },
  validate: { pattern: '^\\d{8}$', message: 'CEP deve ter 8 dígitos' },
};

const EMAIL = {
  format: { preset: 'trim' },
  validate: { pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$', message: 'E-mail inválido' },
};

const UFS: CustomFieldOption[] = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB',
  'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
].map((uf) => ({ key: uf, label: uf }));

/**
 * `listIcon` + `listOrder` dizem quais campos viram linha do cartão e em que ordem; `filterable`,
 * quais entram no filtro composto da listagem. O endereço é declarado campo a campo em caminho
 * pontilhado (`address.city`) — é assim que um objeto aninhado se declara.
 */
const FIELDS: TemplateField[] = [
  { key: 'type', label: 'Tipo', type: 'select', required: true, order: 0, lookupCollection: 'personTypes', optionsAllowUserAdd: true, defaultValue: 'Pessoa Física', filterable: true, listIcon: 'user' },
  { key: 'name', label: 'Nome', type: 'text', required: true, order: 1 },
  { key: 'cpf', label: 'CPF', type: 'masked', required: false, order: 2, mask: 'cpf', rules: { format: { preset: 'digits' }, validate: { check: 'cpf' } }, logic: { hiddenWhen: APENAS_PF }, listIcon: 'contacts', listOrder: 0 },
  { key: 'cnpj', label: 'CNPJ', type: 'masked', required: false, order: 3, mask: 'cnpj', rules: { format: { preset: 'digits' }, validate: { check: 'cnpj' } }, logic: { hiddenWhen: APENAS_PJ }, listIcon: 'contacts', listOrder: 1 },
  { key: 'email', label: 'E-mail', type: 'text', required: false, order: 4, placeholder: 'email@exemplo.com', rules: EMAIL, listIcon: 'mail', listOrder: 2 },
  { key: 'phone', label: 'Telefone', type: 'masked', required: false, order: 5, mask: 'phone', rules: TELEFONE, listIcon: 'phone', listOrder: 3 },
  { key: 'secondaryPhone', label: 'Telefone Secundário', type: 'masked', required: false, order: 6, mask: 'phone', rules: TELEFONE },
  { key: 'relationship', label: 'Relacionamento', type: 'select', required: false, order: 7, lookupCollection: 'personRelationships', optionsAllowUserAdd: true, optionsColored: true, filterable: true },
  { key: 'occupation', label: 'Profissão', type: 'select', required: false, order: 8, lookupCollection: 'personOccupations', optionsAllowUserAdd: true, logic: { hiddenWhen: APENAS_PF }, filterable: true, listIcon: 'briefcase', listOrder: 4 },
  { key: 'nationality', label: 'Nacionalidade', type: 'select', required: false, order: 9, lookupCollection: 'personNationalities', optionsAllowUserAdd: true, logic: { hiddenWhen: APENAS_PF }, filterable: true },
  { key: 'maritalStatus', label: 'Estado Civil', type: 'select', required: false, order: 10, lookupCollection: 'personMaritalStatuses', optionsAllowUserAdd: true, logic: { hiddenWhen: APENAS_PF }, filterable: true },
  { key: 'birthDate', label: 'Data de Nascimento', type: 'date', required: false, order: 11, logic: { hiddenWhen: APENAS_PF } },
  { key: 'gender', label: 'Sexo', type: 'select', required: false, order: 12, lookupCollection: 'personGenders', optionsAllowUserAdd: true, logic: { hiddenWhen: APENAS_PF } },
  { key: 'address.zipCode', label: 'CEP', type: 'masked', required: false, order: 13, section: ENDERECO, mask: 'cep', rules: CEP, logic: { onChangeLookup: { provider: 'viacep', targetPrefix: 'address' } } },
  { key: 'address.street', label: 'Rua / Avenida', type: 'text', required: false, order: 14, section: ENDERECO },
  { key: 'address.number', label: 'Número', type: 'text', required: false, order: 15, section: ENDERECO },
  { key: 'address.complement', label: 'Complemento', type: 'text', required: false, order: 16, section: ENDERECO, placeholder: 'Apto, Sala...' },
  { key: 'address.neighborhood', label: 'Bairro', type: 'text', required: false, order: 17, section: ENDERECO },
  { key: 'address.city', label: 'Cidade', type: 'select', required: false, order: 18, section: ENDERECO, lookupCollection: 'personCities', optionsAllowUserAdd: true, filterable: true, listIcon: 'map', listOrder: 5 },
  { key: 'address.state', label: 'Estado', type: 'select', required: false, order: 19, section: ENDERECO, options: UFS },
  { key: 'notes', label: 'Observações', type: 'textarea', required: false, order: 20, placeholder: 'Informações adicionais sobre a pessoa' },
  { key: 'status', label: 'Status', type: 'select', required: false, order: 21, options: [{ key: 'Ativo', label: 'Ativo' }, { key: 'Inativo', label: 'Inativo' }], defaultValue: 'Ativo', filterable: true },
];

const opts = (labels: string[]): CustomFieldOption[] => labels.map((label) => ({ key: label, label }));

const colored = (entries: [string, string][]): CustomFieldOption[] =>
  entries.map(([label, color]) => ({ key: label, label, color }));

/**
 * As listas de opções que os campos referenciam, com as opções de PARTIDA — semeadas só quando a
 * lista está vazia no escritório. Dali em diante as opções são dele: acrescentar, renomear e
 * remover valem, e nem a atualização nem a remoção da extensão as toca. As cores são nomes de token
 * do tema, resolvidos pela aplicação.
 */
const LOOKUPS: LookupModuleTemplate[] = [
  {
    collection: 'personTypes',
    label: 'Pessoa: Tipo',
    options: opts(['Pessoa Física', 'Pessoa Jurídica']),
  },
  {
    collection: 'personRelationships',
    label: 'Pessoa: Relacionamento',
    options: colored([
      ['Cliente', 'relationshipCliente'],
      ['Parte', 'relationshipParte'],
      ['Contato', 'relationshipContato'],
      ['Fornecedor', 'relationshipFornecedor'],
      ['Sócio', 'relationshipSocio'],
    ]),
  },
  {
    collection: 'personMaritalStatuses',
    label: 'Pessoa: Estado Civil',
    options: opts(['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União estável']),
  },
  {
    collection: 'personGenders',
    label: 'Pessoa: Sexo',
    options: opts(['Masculino', 'Feminino', 'Não Informado']),
  },
  {
    collection: 'personNationalities',
    label: 'Pessoa: Nacionalidade',
    options: opts(['Brasileira']),
  },
  { collection: 'personOccupations', label: 'Pessoa: Profissão' },
  { collection: 'personCities', label: 'Pessoa: Cidade' },
];

/**
 * **Ativar/Inativar** — o interruptor do cabeçalho, que antes era um botão em código da tela fixa.
 *
 * O workflow lê o status atual do registro que a ação enviou (`event.context.status`), grava o
 * oposto e pede à tela que recarregue. Nada disso é específico do kernel: é o Step "Montar Objeto"
 * alimentando o Step "Gravar Registro", com a resposta no contrato das ações.
 */
const STATUS_WORKFLOW: WorkflowModuleTemplate = {
  templateId: 'wf-pessoa-status',
  name: 'Ativar/Inativar Pessoa',
  description: 'Alterna o status da pessoa entre Ativo e Inativo. Chamado pela ação do cabeçalho.',
  eventName: 'workflow.called',
  version: 1,
  condition: { kind: 'AlwaysTrue' },
  steps: [
    {
      id: 'montar',
      stepDefinitionId: 'map',
      type: 'Action',
      order: 0,
      enabled: true,
      configuration: {
        map: {
          kind: 'Literal',
          value: {
            name: 'pessoa',
            fields: [
              { name: 'id', value: { kind: 'Expression', expression: 'event.recordId' } },
              {
                name: 'status',
                value: {
                  kind: 'Expression',
                  expression: 'if(event.context.status == "Inativo", "Ativo", "Inativo")',
                },
              },
            ],
          },
        },
      },
    },
    {
      id: 'gravar',
      stepDefinitionId: 'upsert',
      type: 'Action',
      order: 1,
      enabled: true,
      configuration: {
        upsert: { kind: 'Literal', value: { table: 'persons', source: 'input', property: 'pessoa' } },
      },
    },
    {
      // Sem nome, os campos ficam na raiz — é de lá que a ação lê `status` e `actions`.
      id: 'responder',
      stepDefinitionId: 'map',
      type: 'Action',
      order: 2,
      enabled: true,
      configuration: {
        map: {
          kind: 'Literal',
          value: {
            name: '',
            fields: [
              {
                name: 'status',
                value: {
                  kind: 'Expression',
                  expression: 'if(event.context.status == "Inativo", "Pessoa ativada.", "Pessoa inativada.")',
                },
              },
              { name: 'actions', value: { kind: 'Literal', value: ['refresh'] } },
            ],
          },
        },
      },
    },
  ],
};

const STATUS_ACTION: ActionModuleTemplate = {
  templateId: 'act-pessoa-status',
  key: 'pessoa_status',
  title: 'Ativar/Inativar',
  icon: 'toggle',
  workflowId: 'wf-pessoa-status',
  // Registro novo nasce Ativo e ainda não existe para alternar — a ação só aparece depois de salvo.
  hiddenWhen: 'isNew',
  // O que faz o botão MOSTRAR o estado, em vez de só disparar: verde ativo, vermelho inativo.
  activeWhen: 'status != "Inativo"',
  danger: false,
  enabled: true,
  order: 0,
};

const PESSOA_SCREEN: ScreenModuleTemplate = {
  key: 'pessoas',
  sourceId: SOURCE_ID,
  sourceRev: 1,
  titleSingular: 'Pessoa',
  titlePlural: 'Pessoas',
  icon: 'team',
  dataCollection: 'persons',
  fields: FIELDS,
  titleFieldKey: 'name',
  // O tipo é o subtítulo: no cabeçalho do detalhe e na linha sob o nome no cartão.
  subtitleFieldKey: 'type',
  hasNotes: true,
  hasDocuments: true,
  hasTags: true,
  tagCollection: 'personTags',
  // Os eventos que as automações escutam continuam sendo `person.saved`/`person.deleted`.
  eventPrefix: 'person',
  listActions: ['copyLink', 'clone', 'manageTags', 'delete'],
  // O interruptor de status no cabeçalho do registro.
  viewActionIds: ['act-pessoa-status'],
  // A tela aparece no menu por si: sem contribuição de navegação, é o `sidebarOrder` que a ordena
  // junto das demais telas do escritório.
  sidebarOrder: 30,
};

/**
 * O STARTUP: roda ao carregar o escritório e registra no host os comandos de ⌘K ("Nova pessoa",
 * "Abrir Pessoas" e a busca dos registros) e a menção `@pessoa` das anotações — o que era um
 * provider e um modal do kernel. A tela é resolvida pelo `sourceId`, então a chave instalada pode
 * variar sem quebrar nada.
 *
 * Sem página própria, as abas são as genéricas do escritório: `dyn:` para a listagem, `new-dyn:`
 * para o cadastro e `view-dyn:` para o registro.
 */
const STARTUP_SOURCE = `
import { Icon } from '@microteia/ui';

const SOURCE_ID = 'microteia:pessoa';
const GROUP = 'Pessoas';

const screenOf = (ctx) => ctx.screenDefinitions.find((s) => (s.sourceId || s.id) === SOURCE_ID);
const textOf = (record, key) => (key && typeof record[key] === 'string' ? record[key] : '');

/**
 * A busca casa só o TÍTULO — o nome. O subtítulo de Pessoa é o TIPO ("Pessoa Física"), uma
 * classificação que todo registro repete: casá-la devolveria o cadastro inteiro para quem digitasse
 * "fis". Quem inclui o subtítulo é Processos, onde ele é o NÚMERO do processo.
 */
const matches = (record, screen, q) => {
  if (!q) return true;
  return textOf(record, screen.titleFieldKey).toLowerCase().indexOf(q) !== -1;
};

const recordsOf = (ctx, screen) => {
  const collection = screen.dataCollection || screen.id;
  return ctx.records.filter((r) => r.collection === collection && textOf(r, screen.titleFieldKey));
};

export default function startup(host) {
  host.commands.register({
    group: GROUP,
    getItems(query, ctx) {
      const q = String(query || '').toLowerCase().trim();
      if (!q) return [];
      const screen = screenOf(ctx);
      if (!screen) return [];
      const icon = <Icon name="team" size={16} />;
      const items = [];
      if ('nova pessoa'.indexOf(q) !== -1) {
        items.push({ id: 'pessoa:new', title: 'Nova pessoa', group: GROUP, icon, onSelect: () => { ctx.openTab('new-dyn:' + screen.id); ctx.close(); } });
      }
      if ('abrir pessoas'.indexOf(q) !== -1) {
        items.push({ id: 'pessoa:list', title: 'Abrir Pessoas', group: GROUP, icon, onSelect: () => { ctx.openTab('dyn:' + screen.id); ctx.close(); } });
      }
      for (const r of recordsOf(ctx, screen)) {
        if (!matches(r, screen, q)) continue;
        items.push({
          id: 'pessoa:' + r.id,
          title: textOf(r, screen.titleFieldKey),
          subtitle: textOf(r, screen.subtitleFieldKey) || 'Pessoa',
          group: GROUP,
          icon,
          onSelect: () => { ctx.openTab('view-dyn:' + screen.id + ':' + r.id); ctx.close(); },
        });
      }
      return items.slice(0, 9);
    },
  });

  host.mentions.register({
    key: 'pessoa',
    label: 'Pessoa',
    description: 'Inserir link para uma pessoa',
    icon: 'team',
    search(query, ctx) {
      const screen = screenOf(ctx);
      if (!screen) return [];
      const q = String(query || '').toLowerCase().trim();
      return recordsOf(ctx, screen)
        .filter((r) => matches(r, screen, q))
        .slice(0, 20)
        .map((record) => ({
          id: record.id,
          title: textOf(record, screen.titleFieldKey),
          subtitle: textOf(record, screen.subtitleFieldKey) || 'Pessoa',
          tabKey: 'view-dyn:' + screen.id + ':' + record.id,
        }));
    },
  });
}
`;


/**
 * O WIDGET do Dashboard: quantas pessoas estão ativas. O número era um dos quatro cartões escritos no
 * kernel; quem sabe o que é uma pessoa ativa é esta extensão, que declara o campo `status`.
 */
const PESSOAS_NUMEROS_SOURCE = `
import { useMemo } from 'react';
import { styled } from 'styled-components';
import { useCollection, useOpenScreenList } from '@microteia/data';

const Card = styled.div\`
  background: \${({ theme }) => theme.colors.surface};
  border: 1px solid \${({ theme }) => theme.colors.border};
  border-radius: \${({ theme }) => theme.borderRadius.lg};
  padding: \${({ theme }) => theme.spacing.lg};
  display: flex;
  flex-direction: column;
  gap: \${({ theme }) => theme.spacing.md};
  height: 100%;
\`;

const Title = styled.h3\`
  font-size: \${({ theme }) => theme.fontSizes.md};
  font-weight: 600;
  color: \${({ theme }) => theme.colors.text};
\`;

const Stat = styled.button\`
  background: none;
  border: none;
  padding: 0;
  text-align: left;
  cursor: pointer;
\`;

const Value = styled.div\`
  font-size: \${({ theme }) => theme.fontSizes['2xl']};
  font-weight: 700;
  line-height: 1.2;
  color: \${({ theme }) => theme.colors.text};
\`;

const Label = styled.div\`
  font-size: \${({ theme }) => theme.fontSizes.sm};
  color: \${({ theme }) => theme.colors.textMuted};
\`;

export default function PessoasNumerosWidget() {
  const persons = useCollection('persons');
  const openList = useOpenScreenList();
  const ativas = useMemo(() => persons.filter((p) => p.status !== 'Inativo').length, [persons]);

  return (
    <Card>
      <Title>Pessoas</Title>
      <Stat onClick={() => openList('persons', [{ key: 'status', values: ['Ativo'] }])}>
        <Value>{ativas}</Value>
        <Label>Ativas</Label>
      </Stat>
    </Card>
  );
}
`;

export const pessoaPlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.pessoa',
    version: '1.1.0',
    kernel: '^1.0.0',
    name: 'Pessoas',
    description: 'O cadastro de pessoas do escritório recriado como extensão, sobre as MESMAS pessoas já cadastradas — clientes, partes, contatos, fornecedores e sócios.',
    publisher: { name: 'Microteia' },
    // O CPF, o CNPJ, o telefone, o CEP e a busca de endereço são formatos do BRASIL: vêm da extensão
    // do país, não do kernel. Sem ela, os campos existem mas perdem máscara e conferência.
    dependencies: { 'com.microteia.brasil': '^1.0.0', 'core.ui': '^1.0.0' },
    contributes: [
      surfaceWidget({ surface: 'dashboard', key: 'pessoa.numeros', title: 'Pessoas em números', description: 'Quantas pessoas estão ativas no cadastro.', icon: 'team', defaultSpan: 1, order: 30 }, 'widget-pessoas-numeros'),
    ],
    // Nenhuma contribuição de UI: a tela instalada já produz o item de menu, a listagem e o
    // detalhe pelo caminho das telas do escritório. Código só entraria aqui se a tela precisasse
    // de algo que a declaração não alcança — não é o caso de um cadastro.
  },
  summary:
    'O cadastro de pessoas do escritório: pessoa física ou jurídica, com CPF/CNPJ validados, contatos, dados pessoais, endereço preenchido pelo CEP e relacionamento — com etiquetas, anotações e documentos por pessoa.',
  overview: {
    type: 'stack',
    gap: 'lg',
    children: [
      {
        type: 'markdown',
        content:
          'A extensão **Pessoas** traz o cadastro de todo mundo com quem o escritório se relaciona: clientes, partes, contatos, fornecedores e sócios.\n\nO formulário se adapta ao tipo: em **Pessoa Física** aparecem CPF, profissão, nacionalidade, estado civil, nascimento e sexo; em **Pessoa Jurídica**, o CNPJ. O CPF e o CNPJ são conferidos na digitação, e o endereço se preenche sozinho a partir do CEP.\n\nAs listas de Tipo, Relacionamento, Estado Civil, Sexo, Nacionalidade, Profissão e Cidade já vêm preenchidas e são suas: acrescente, renomeie ou remova opções à vontade — elas ficam no escritório mesmo que a extensão seja removida.',
      },
      {
        type: 'keyValue',
        items: [
          { label: 'Adiciona', value: 'Item "Pessoas" no menu' },
          { label: 'Cadastro', value: '22 campos, com endereço por CEP' },
          { label: 'Por pessoa', value: 'Etiquetas, anotações e documentos' },
          { label: 'No editor', value: 'Menção @pessoa nas anotações' },
        ],
      },
      {
        type: 'banner',
        message: 'Processos, Contratos, Prazos e Financeiro apontam para as pessoas deste cadastro — sem a extensão instalada, esses vínculos aparecem vazios. Remover a extensão remove a tela, nunca as pessoas: os registros, as listas de opções e as etiquetas continuam no escritório.',
        variant: 'warning',
      },
    ],
  },
  workflows: [STATUS_WORKFLOW],
  actions: [STATUS_ACTION],
  screens: [PESSOA_SCREEN],
  lookups: LOOKUPS,
  tagLists: [{ collection: 'personTags', label: 'Etiquetas: Pessoas' }],
  startup: STARTUP_SOURCE,
  views: [
    { key: 'widget-pessoas-numeros', title: 'Pessoas em números', icon: 'team', source: PESSOAS_NUMEROS_SOURCE },
  ],
};
