import type {
  LookupModuleTemplate,
  MarketplacePlugin,
  ScreenModuleTemplate,
  TemplateField,
} from '../../domain/entities/MarketplacePlugin';
import type { CustomFieldOption } from '../../domain/entities';
import { nav, page } from '../contributionBuilders';
import { themeTokensContribution } from '../../domain/schema/theme';

/** As cores do vocabulário de Contrato — ver a nota equivalente em `processo.ts`. */
const CONTRACT_COLORS: Record<string, string> = {
  contractStatusDraft: '#94a3b8',
  contractStatusReview: '#f59e0b',
  contractStatusAwaitingSignature: '#38bdf8',
  contractStatusActive: '#22c55e',
  contractStatusSuspended: '#eab308',
  contractStatusClosed: '#6b7280',
  contractStatusCancelled: '#ef4444',
  contractStatusTerminated: '#dc2626',
};

const CONTRACT_COLORS_BY_THEME: Record<string, Record<string, string>> = {
  themis: {
    contractStatusDraft: '#A29383',
    contractStatusReview: '#B07D2B',
    contractStatusAwaitingSignature: '#3E6B8C',
    contractStatusActive: '#2F6B4F',
    contractStatusSuspended: '#B08D3E',
    contractStatusClosed: '#8C7F6F',
    contractStatusCancelled: '#C03B2D',
    contractStatusTerminated: '#96382B',
  },
  'themis-night': {
    contractStatusDraft: '#9A8C7E',
    contractStatusReview: '#D2A455',
    contractStatusAwaitingSignature: '#7BA7C9',
    contractStatusActive: '#5FA37F',
    contractStatusSuspended: '#C9A24B',
    contractStatusClosed: '#9A8C7E',
    contractStatusCancelled: '#D96A5B',
    contractStatusTerminated: '#C25445',
  },
};

/**
 * **Contrato** — a entidade de contrato do escritório, inteira, declarada por extensão: os campos e
 * as seções, as dez listas de opções (com as de partida), as sete relações com Pessoa, as etiquetas,
 * o cartão da listagem, os filtros, o prefixo dos eventos e o número gerado. O kernel não conhece
 * nada disso.
 *
 * `dataCollection: 'contracts'` aponta para a coleção onde os contratos já estão: a entidade muda de
 * dono sem que um registro se mova, e sem renomear os eventos (`contract.saved`) que as automações
 * do escritório escutam.
 *
 * Contrato fica no MEIO da cadeia: aponta para Pessoa (cliente, contratantes, contratados,
 * testemunhas, advogados) e é apontado por Processo. Cada elo é uma dependência declarada, e o que
 * viaja entre elas é o nome GLOBAL da coleção — `persons`, `contracts` —, nunca a chave de tela.
 */
const SOURCE_ID = 'microteia:contrato';

const IDENTIFICACAO = 'Identificação';
const PARTES = 'Partes envolvidas';
const VIGENCIA = 'Datas e vigência';
const FINANCEIRO = 'Condições financeiras';
const BANCARIO = 'Dados bancários';

/**
 * As sete relações com Pessoa. `refDenormKey` é o nome de NAVEGAÇÃO do registro apontado: é o que
 * mantém `event.contract.client.name` resolvendo nas automações que o escritório já tem — a chave do
 * campo (`clientId`) não serve para isso.
 */
const parte = (
  key: string,
  label: string,
  denormKey: string,
  order: number,
  multi: boolean,
): TemplateField => ({
  key,
  label,
  type: 'reference',
  required: false,
  order,
  section: PARTES,
  refEntity: 'persons',
  refDenormKey: denormKey,
  multi,
  placeholder: 'Selecione...',
});

const FIELDS: TemplateField[] = [
  // O número é sugerido pelo padrão e continua editável — duas letras e quatro dígitos, como a tela
  // fixa sorteava em código.
  { key: 'number', label: 'Número', type: 'text', required: true, order: 0, section: IDENTIFICACAO, autoValue: { pattern: 'AA0000' } },
  { key: 'title', label: 'Título', type: 'text', required: true, order: 1, section: IDENTIFICACAO },
  { key: 'type', label: 'Tipo', type: 'select', required: true, order: 2, section: IDENTIFICACAO, lookupCollection: 'contractTypes', optionsAllowUserAdd: true, filterable: true },
  { key: 'category', label: 'Categoria', type: 'select', required: true, order: 3, section: IDENTIFICACAO, lookupCollection: 'contractCategories', optionsAllowUserAdd: true, filterable: true },
  { key: 'status', label: 'Status', type: 'select', required: true, order: 4, section: IDENTIFICACAO, lookupCollection: 'contractStatuses', optionsAllowUserAdd: true, optionsColored: true, filterable: true },
  { key: 'object', label: 'Objeto', type: 'select', required: false, order: 5, section: IDENTIFICACAO, lookupCollection: 'contractObjects', optionsAllowUserAdd: true },
  parte('contractorIds', 'Contratantes', 'contractor', 6, true),
  parte('contracteeIds', 'Contratados', 'contractee', 7, true),
  parte('witnessIds', 'Testemunhas', 'witness', 8, true),
  parte('contractorLawyerIds', 'Advogados dos contratantes', 'contractorLawyer', 9, true),
  parte('contracteeLawyerIds', 'Advogados dos contratados', 'contracteeLawyer', 10, true),
  { ...parte('clientId', 'Cliente', 'client', 11, false), placeholder: 'Selecione o cliente...', filterable: true },
  { ...parte('responsibleId', 'Responsável', 'responsible', 12, false), placeholder: 'Selecione o responsável...' },
  { key: 'draftedAt', label: 'Data de elaboração', type: 'date', required: false, order: 13, section: VIGENCIA },
  { key: 'signedAt', label: 'Data de assinatura', type: 'date', required: false, order: 14, section: VIGENCIA },
  { key: 'effectiveStart', label: 'Início de vigência', type: 'date', required: false, order: 15, section: VIGENCIA },
  { key: 'effectiveEnd', label: 'Fim de vigência', type: 'date', required: false, order: 16, section: VIGENCIA },
  { key: 'autoRenewal', label: 'Renovação automática', type: 'checkbox', required: false, order: 17, section: VIGENCIA, placeholder: 'Renova automaticamente' },
  { key: 'renewalDate', label: 'Data de renovação', type: 'date', required: false, order: 18, section: VIGENCIA },
  { key: 'terminationDate', label: 'Data de rescisão', type: 'date', required: false, order: 19, section: VIGENCIA },
  { key: 'initialValue', label: 'Valor inicial', type: 'currency', required: false, order: 20, section: FINANCEIRO },
  { key: 'monthlyValue', label: 'Valor mensal', type: 'currency', required: false, order: 21, section: FINANCEIRO },
  { key: 'totalValue', label: 'Valor total', type: 'currency', required: false, order: 22, section: FINANCEIRO, showInList: true, listIcon: 'moneyDollar', listOrder: 1 },
  { key: 'adjustmentIndex', label: 'Índice de reajuste', type: 'select', required: false, order: 23, section: FINANCEIRO, lookupCollection: 'contractAdjustmentIndexes', optionsAllowUserAdd: true },
  { key: 'adjustmentPeriodicity', label: 'Periodicidade de reajuste', type: 'select', required: false, order: 24, section: FINANCEIRO, lookupCollection: 'contractAdjustmentPeriodicities', optionsAllowUserAdd: true },
  { key: 'currency', label: 'Moeda', type: 'select', required: false, order: 25, section: FINANCEIRO, lookupCollection: 'contractCurrencies', optionsAllowUserAdd: true },
  { key: 'paymentMethod', label: 'Forma de pagamento', type: 'select', required: false, order: 26, section: FINANCEIRO, lookupCollection: 'contractPaymentMethods', optionsAllowUserAdd: true },
  { key: 'dueDay', label: 'Dia de vencimento', type: 'number', required: false, order: 27, section: FINANCEIRO },
  { key: 'installments', label: 'Parcelas', type: 'number', required: false, order: 28, section: FINANCEIRO },
  { key: 'bank', label: 'Banco', type: 'select', required: false, order: 29, section: BANCARIO, lookupCollection: 'contractBanks', optionsAllowUserAdd: true },
  { key: 'bankAccount', label: 'Conta bancária', type: 'text', required: false, order: 30, section: BANCARIO, placeholder: 'Agência / número' },
  { key: 'pixKey', label: 'Chave PIX', type: 'text', required: false, order: 31, section: BANCARIO },
  { key: 'costCenter', label: 'Centro de custo', type: 'select', required: false, order: 32, section: BANCARIO, lookupCollection: 'contractCostCenters', optionsAllowUserAdd: true },
];

const opts = (labels: string[]): CustomFieldOption[] => labels.map((label) => ({ key: label, label }));

const colored = (entries: [string, string][]): CustomFieldOption[] =>
  entries.map(([label, color]) => ({ key: label, label, color }));

/**
 * As listas de opções que os campos referenciam, com as opções de PARTIDA — semeadas só quando a
 * lista está vazia no escritório. Dali em diante as opções são dele: acrescentar, renomear e remover
 * valem, e nem a atualização nem a remoção da extensão as toca. As cores são nomes de token do tema,
 * resolvidos pela aplicação.
 */
const LOOKUPS: LookupModuleTemplate[] = [
  {
    collection: 'contractTypes',
    label: 'Contrato: Tipo',
    options: opts([
      'Prestação de serviços', 'Compra e venda', 'Locação', 'Confissão de dívida', 'Parceria',
      'Fornecimento', 'Licenciamento', 'NDA', 'Trabalho', 'Honorários advocatícios', 'Procuração',
      'Distrato', 'Acordo',
    ]),
  },
  {
    collection: 'contractCategories',
    label: 'Contrato: Categoria',
    options: opts([
      'Cível', 'Empresarial', 'Trabalhista', 'Imobiliário', 'Societário', 'Propriedade Intelectual',
      'Tecnologia (TI)', 'Financeiro', 'Consumidor', 'Administrativo', 'Tributário', 'Público',
      'Agronegócio', 'Família e Sucessões', 'Outros',
    ]),
  },
  {
    collection: 'contractStatuses',
    label: 'Contrato: Status',
    options: colored([
      ['Em elaboração', 'contractStatusDraft'],
      ['Em revisão', 'contractStatusReview'],
      ['Aguardando assinatura', 'contractStatusAwaitingSignature'],
      ['Vigente', 'contractStatusActive'],
      ['Suspenso', 'contractStatusSuspended'],
      ['Encerrado', 'contractStatusClosed'],
      ['Cancelado', 'contractStatusCancelled'],
      ['Rescindido', 'contractStatusTerminated'],
    ]),
  },
  {
    collection: 'contractAdjustmentIndexes',
    label: 'Contrato: Índice de Reajuste',
    options: opts(['INPC', 'IPCA']),
  },
  {
    collection: 'contractAdjustmentPeriodicities',
    label: 'Contrato: Periodicidade de Reajuste',
    options: opts(['Anual']),
  },
  {
    collection: 'contractCurrencies',
    label: 'Contrato: Moeda',
    options: opts(['Real']),
  },
  {
    collection: 'contractPaymentMethods',
    label: 'Contrato: Forma de Pagamento',
    options: opts(['À vista', 'À prazo', 'Boleto', 'Cartão de Crédito']),
  },
  { collection: 'contractObjects', label: 'Contrato: Objeto' },
  { collection: 'contractBanks', label: 'Contrato: Banco' },
  { collection: 'contractCostCenters', label: 'Contrato: Centro de Custo' },
];

const CONTRATO_SCREEN: ScreenModuleTemplate = {
  key: 'contratos',
  sourceId: SOURCE_ID,
  sourceRev: 3,
  titleSingular: 'Contrato',
  titlePlural: 'Contratos',
  icon: 'fileText',
  dataCollection: 'contracts',
  fields: FIELDS,
  titleFieldKey: 'title',
  // O número é o subtítulo: sob o título no cabeçalho do detalhe e na linha sob o título do
  // cartão. O rótulo da ABA é o título, como em toda tela.
  subtitleFieldKey: 'number',
  hasNotes: true,
  hasDocuments: true,
  hasTags: true,
  tagCollection: 'contractTags',
  // Os eventos que as automações escutam continuam sendo `contract.saved`/`contract.deleted`.
  eventPrefix: 'contract',
  // Sem `recordTabPrefix`: o detalhe é o GENÉRICO (`view-dyn:contratos:{id}`), pelo mesmo motivo de
  // Processo — o formulário do schema já é o mesmo que a extensão desenharia. O que sobra de
  // exclusivo é o CARTÃO da listagem.
  // A mesma permissão que a regra nomeada de `contracts` dava: secretária lê, advogado e admin
  // gravam. Declarada na tela, é o `firestore.rules` que a lê do documento dela.
  writeRoles: ['admin', 'lawyer'],
  listActions: ['copyLink', 'clone', 'manageTags', 'delete'],
  // O menu e as páginas vêm das contribuições da extensão, que apontam para as views próprias.
  sidebarOrder: 0,
  hideFromSidebar: true,
};

/**
 * A listagem. `RecordListSurface` + `useEntityList` trazem título, filtros, meta-linhas do cartão,
 * etiquetas e ações da CONFIGURAÇÃO da tela; a view injeta pelos slots só o que é exclusivo do
 * Contrato: os badges de Status/Tipo, o quadro Contratante/Contratado e a linha de vigência — que é
 * uma composição de dois campos e como duas linhas separadas ficaria ambígua.
 */
const CONTRATO_SOURCE = `
import { useMemo } from 'react';
import { styled, useTheme } from 'styled-components';
import { RecordListSurface, Badge, Icon, InfoBanner } from '@microteia/ui';
import { useCollection, useEntityList, useLookup } from '@microteia/data';
import { getConfigColor } from '@microteia/theme';
import { formatDate } from '@microteia/format';

const SOURCE_ID = 'microteia:contrato';

const Badges = styled.div\`
  display: flex;
  flex-wrap: wrap;
  gap: \${({ theme }) => theme.spacing.xs};
  align-items: center;
\`;

const PartesRow = styled.div\`
  display: grid;
  grid-template-columns: 1fr 1fr;
  border: 1px solid \${({ theme }) => theme.colors.border};
  border-radius: \${({ theme }) => theme.borderRadius.md};
  overflow: hidden;
  font-size: \${({ theme }) => theme.fontSizes.xs};
\`;

const PoleColumn = styled.div\`
  padding: \${({ theme }) => theme.spacing.xs + ' ' + theme.spacing.sm};
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-right: \${({ $side, theme }) => $side === 'left' ? '1px solid ' + theme.colors.border : 'none'};
  min-width: 0;
\`;

const PoleLabel = styled.div\`
  font-size: 10px;
  font-weight: 600;
  color: \${({ theme }) => theme.colors.textMuted};
  letter-spacing: 0.05em;
  margin-bottom: 1px;
\`;

const PoleName = styled.div\`
  color: \${({ theme }) => theme.colors.text};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: \${({ theme }) => theme.fontSizes.xs};
\`;

const PoleEmpty = styled.div\`
  color: \${({ theme }) => theme.colors.textMuted};
  font-style: italic;
  font-size: \${({ theme }) => theme.fontSizes.xs};
\`;

const asArray = (v) => Array.isArray(v) ? v : (v == null || v === '' ? [] : [v]);

export default function ContratosView() {
  const theme = useTheme();
  const list = useEntityList(SOURCE_ID);
  const persons = useCollection('persons');
  const statusOptions = useLookup('contractStatuses');

  const personById = useMemo(() => {
    const map = {};
    for (const p of persons) map[p.id] = p;
    return map;
  }, [persons]);

  if (!list.definition) {
    return <div style={{ padding: '24px' }}><InfoBanner message='Tela "Contratos" não encontrada. Instale a extensão para ativá-la.' variant="warning" /></div>;
  }

  const namesOf = (ids) => asArray(ids).map((id) => personById[id] ? personById[id].name : '').filter(Boolean);

  const renderPole = (label, names, side) => (
    <PoleColumn $side={side}>
      <PoleLabel>{label}</PoleLabel>
      {names.length > 0
        ? names.map((n, i) => <PoleName key={i}>{n}</PoleName>)
        : <PoleEmpty>—</PoleEmpty>}
    </PoleColumn>
  );

  const renderBelowHeader = (record) => {
    const contractors = namesOf(record.contractorIds);
    const contractees = namesOf(record.contracteeIds);
    return (
      <>
        <Badges>
          {record.status ? <Badge color={getConfigColor(statusOptions, record.status, theme)}>{record.status}</Badge> : null}
          {record.type ? <Badge>{record.type}</Badge> : null}
        </Badges>
        {contractors.length > 0 || contractees.length > 0 ? (
          <PartesRow>
            {renderPole('Contratante', contractors, 'left')}
            {renderPole('Contratado', contractees, 'right')}
          </PartesRow>
        ) : null}
      </>
    );
  };

  // A vigência é início – fim numa linha só: separadas, as duas datas ficariam sem sentido no cartão.
  const renderMetaRows = (record) => {
    if (!record.effectiveStart && !record.effectiveEnd) return [];
    const from = record.effectiveStart ? formatDate(record.effectiveStart) : '—';
    const to = record.effectiveEnd ? formatDate(record.effectiveEnd) : '—';
    return [{ key: 'vigencia', icon: <Icon name="calendar" size={12} />, value: from + ' – ' + to }];
  };

  return (
    <RecordListSurface
      vm={list}
      definition={list.definition}
      renderBelowHeader={renderBelowHeader}
      renderMetaRows={renderMetaRows}
      emptyTitle="Nenhum contrato encontrado"
      emptyActionLabel="Cadastrar primeiro contrato"
    />
  );
}
`;

/**
 * O STARTUP: roda ao carregar o escritório e registra no host os comandos de ⌘K e a menção
 * `@contrato` das anotações — o que era um provider e um modal do kernel. A tela é resolvida pelo
 * `sourceId`, então a chave instalada pode variar sem quebrar o link.
 */
const STARTUP_SOURCE = `
import { Icon } from '@microteia/ui';

const SOURCE_ID = 'microteia:contrato';
const LIST_KEY = 'contratos';
const GROUP = 'Contratos';

const viewKey = (screen, id) => 'view-dyn:' + screen.id + ':' + id;

const screenOf = (ctx) => ctx.screenDefinitions.find((s) => (s.sourceId || s.id) === SOURCE_ID);
const textOf = (record, key) => (key && typeof record[key] === 'string' ? record[key] : '');

/**
 * A busca casa o TÍTULO **e o SUBTÍTULO**: o subtítulo do contrato é o NÚMERO, e procurar um
 * contrato por ele é tão comum quanto pelo título — o mesmo de Processos. Onde o subtítulo é
 * classificação (o tipo da pessoa, o do lançamento), a extensão casa só o título, senão devolveria
 * o cadastro inteiro a quem digitasse "fis".
 */
const matches = (record, screen, q) => {
  if (!q) return true;
  const haystack = (textOf(record, screen.titleFieldKey) + ' ' + textOf(record, screen.subtitleFieldKey)).toLowerCase();
  return haystack.indexOf(q) !== -1;
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
      const icon = <Icon name="fileText" size={16} />;
      const items = [];
      if ('novo contrato'.indexOf(q) !== -1) {
        items.push({ id: 'contrato:new', title: 'Novo contrato', group: GROUP, icon, onSelect: () => { ctx.openTab('new-dyn:' + screen.id); ctx.close(); } });
      }
      if ('abrir contratos'.indexOf(q) !== -1) {
        items.push({ id: 'contrato:list', title: 'Abrir Contratos', group: GROUP, icon, onSelect: () => { ctx.openTab(LIST_KEY); ctx.close(); } });
      }
      for (const r of recordsOf(ctx, screen)) {
        if (!matches(r, screen, q)) continue;
        items.push({
          id: 'contrato:' + r.id,
          title: textOf(r, screen.titleFieldKey),
          subtitle: textOf(r, screen.subtitleFieldKey) || 'Contrato',
          group: GROUP,
          icon,
          onSelect: () => { ctx.openTab(viewKey(screen, r.id)); ctx.close(); },
        });
      }
      return items.slice(0, 9);
    },
  });

  host.mentions.register({
    key: 'contrato',
    label: 'Contrato',
    description: 'Inserir link para um contrato',
    icon: 'fileText',
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
          subtitle: textOf(record, screen.subtitleFieldKey) || 'Contrato',
          tabKey: viewKey(screen, record.id),
        }));
    },
  });
}
`;

export const contratoPlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.contrato',
    version: '1.3.1',
    kernel: '^1.0.0',
    name: 'Contratos',
    description: 'A tela de Contratos recriada como extensão, sobre os MESMOS contratos do escritório — cadastro, partes, vigência, condições financeiras e dados bancários.',
    publisher: { name: 'Microteia' },
    // Todas as sete relações do Contrato apontam para pessoas: a coleção `persons` vem da extensão
    // de Pessoas, e `collections` é o que liga o nome global de uma coleção a quem a instala.
    dependencies: {
      'core.ui': '^1.0.0',
      'core.theme': '^1.0.0',
      'com.microteia.pessoa': { version: '^1.0.0', collections: ['persons'] },
    },
    contributes: [
      themeTokensContribution('contract-colors', { light: CONTRACT_COLORS, dark: CONTRACT_COLORS, themes: CONTRACT_COLORS_BY_THEME }),
      nav({ key: 'contratos', label: 'Contratos', icon: 'fileText', order: 110 }),
      page({ key: 'contratos', title: 'Contratos', icon: 'fileText' }, 'contratos'),
    ],
  },
  summary:
    'A tela de Contratos do escritório: número gerado, tipo, categoria, status, objeto, contratantes, contratados, testemunhas e advogados, vigência, valores, reajuste e dados bancários — com etiquetas, anotações e documentos por contrato.',
  overview: {
    type: 'stack',
    gap: 'lg',
    children: [
      {
        type: 'markdown',
        content:
          'A extensão **Contratos** traz o controle dos contratos do escritório: cada contrato com as partes envolvidas, o período de vigência, as condições financeiras e os dados de pagamento, além de etiquetas, anotações e documentos.\n\nO **número** é sugerido automaticamente ao criar — duas letras e quatro dígitos, sem repetir um já usado — e continua editável.\n\nAs listas de Tipo, Categoria, Status, Objeto, Índice de Reajuste, Periodicidade, Moeda, Forma de Pagamento, Banco e Centro de Custo já vêm preenchidas e são suas: acrescente, renomeie ou remova opções à vontade — elas ficam no escritório mesmo que a extensão seja removida.',
      },
      {
        type: 'keyValue',
        items: [
          { label: 'Adiciona', value: 'Item "Contratos" no menu' },
          { label: 'Cadastro', value: '33 campos, em 5 seções' },
          { label: 'Por contrato', value: 'Etiquetas, anotações e documentos' },
          { label: 'No editor', value: 'Menção @contrato nas anotações' },
        ],
      },
      {
        type: 'banner',
        message: 'As partes do contrato vêm do cadastro de Pessoas, que precisa estar instalado. Com a extensão de Processos, cada contrato mostra também os processos ligados a ele. Remover a extensão remove a tela, nunca os contratos: os registros, as listas de opções e as etiquetas continuam no escritório.',
        variant: 'warning',
      },
    ],
  },
  workflows: [],
  screens: [CONTRATO_SCREEN],
  lookups: LOOKUPS,
  tagLists: [{ collection: 'contractTags', label: 'Etiquetas: Contratos' }],
  startup: STARTUP_SOURCE,
  views: [
    {
      key: 'contratos',
      title: 'Contratos',
      icon: 'fileText',
      source: CONTRATO_SOURCE,
    },
  ],
};
