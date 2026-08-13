import type {
  ActionModuleTemplate,
  LookupModuleTemplate,
  MarketplacePlugin,
  ScreenModuleTemplate,
  TemplateField,
  WorkflowModuleTemplate,
} from '../../domain/entities/MarketplacePlugin';
import type { CustomFieldOption } from '../../domain/entities';
import { nav, page, surfaceWidget } from '../contributionBuilders';

/**
 * **Financeiro** — os lançamentos do escritório, inteiros, declarados por extensão: campos, listas
 * de opções, etiquetas, o cartão da listagem, os filtros, o prefixo dos eventos e quem pode gravar.
 *
 * `dataCollection: 'financials'` aponta para a coleção onde os lançamentos já estão — nada se move,
 * e os eventos (`financial.saved`) que as automações escutam seguem com o mesmo nome.
 *
 * O que ANTES era código do kernel e agora é declaração: os três botões de fluxo (registrar
 * pagamento, estornar, registrar cancelamento) viraram **Actions** sobre workflows, com as
 * expressões que decidem quando cada uma aparece; e o filtro de período do vencimento virou o
 * filtro de intervalo que todo campo de data passou a ter.
 */
const SOURCE_ID = 'microteia:financeiro';

const LANCAMENTO = 'Lançamento';
const DATAS = 'Datas';
const PAGAMENTO = 'Pagamento';
const VINCULOS = 'Vínculos e Observações';

const FIELDS: TemplateField[] = [
  { key: 'type', label: 'Tipo', type: 'select', required: true, order: 0, section: LANCAMENTO, lookupCollection: 'financialTypes', optionsColored: true, filterable: true, placeholder: 'Selecione o tipo...' },
  { key: 'category', label: 'Categoria', type: 'select', required: true, order: 1, section: LANCAMENTO, lookupCollection: 'financialCategories', optionsAllowUserAdd: true, filterable: true, placeholder: 'Selecione a categoria...' },
  { key: 'amount', label: 'Valor', type: 'currency', required: true, order: 2, section: LANCAMENTO },
  { key: 'status', label: 'Status', type: 'select', required: true, order: 3, section: LANCAMENTO, lookupCollection: 'financialStatuses', optionsAllowUserAdd: true, optionsColored: true, filterable: true, placeholder: 'Selecione o status...' },
  { key: 'dueDate', label: 'Vencimento', type: 'date', required: true, order: 4, section: DATAS, filterable: true },
  { key: 'paymentDate', label: 'Data de pagamento', type: 'date', required: false, order: 5, section: DATAS, filterable: true },
  { key: 'cancelDate', label: 'Data de cancelamento', type: 'date', required: false, order: 6, section: DATAS },
  { key: 'paymentMethod', label: 'Forma de pagamento', type: 'select', required: false, order: 7, section: PAGAMENTO, lookupCollection: 'financialPaymentMethods', optionsAllowUserAdd: true, filterable: true, placeholder: 'Selecione a forma...' },
  { key: 'costCenter', label: 'Centro de custo', type: 'select', required: false, order: 8, section: PAGAMENTO, lookupCollection: 'contractCostCenters', optionsAllowUserAdd: true, filterable: true, showInList: true, listIcon: 'wallet', listOrder: 3 },
  { key: 'invoiceNumber', label: 'Número da nota', type: 'text', required: false, order: 9, section: PAGAMENTO },
  { key: 'personId', label: 'Pessoa', type: 'reference', required: false, order: 10, section: VINCULOS, refEntity: 'persons', placeholder: 'Selecione a pessoa...', filterable: true, showInList: true, listIcon: 'team', listOrder: 0 },
  { key: 'caseId', label: 'Processo', type: 'reference', required: false, order: 11, section: VINCULOS, refEntity: 'cases', placeholder: 'Selecione o processo...', filterable: true, showInList: true, listIcon: 'folder', listOrder: 1 },
  { key: 'contractId', label: 'Contrato', type: 'reference', required: false, order: 12, section: VINCULOS, refEntity: 'contracts', placeholder: 'Selecione o contrato...', filterable: true, showInList: true, listIcon: 'fileText', listOrder: 2 },
  { key: 'notes', label: 'Observações', type: 'textarea', required: false, order: 13, section: VINCULOS },
];

const opts = (labels: string[]): CustomFieldOption[] => labels.map((label) => ({ key: label, label }));

const colored = (entries: [string, string][]): CustomFieldOption[] =>
  entries.map(([label, color]) => ({ key: label, label, color }));

/**
 * As listas com as opções de PARTIDA — semeadas só quando a lista está vazia no escritório; dali em
 * diante são dele. `contractCostCenters` NÃO é declarada aqui: ela vem da extensão de Contratos, e é
 * de propósito que as duas telas compartilhem o mesmo centro de custo.
 */
const LOOKUPS: LookupModuleTemplate[] = [
  {
    collection: 'financialTypes',
    label: 'Financeiro: Tipo',
    options: colored([['Receita', 'revenue'], ['Despesa', 'expense']]),
  },
  {
    collection: 'financialCategories',
    label: 'Financeiro: Categoria',
    options: opts([
      'Honorários', 'Êxito', 'Mensalidade', 'Custas Judiciais', 'Perícia',
      'Deslocamento', 'Escritório', 'Impostos', 'Outros',
    ]),
  },
  {
    collection: 'financialStatuses',
    label: 'Financeiro: Status',
    options: colored([['Aberto', 'warning'], ['Pago', 'success'], ['Cancelado', 'textSecondary']]),
  },
  {
    collection: 'financialPaymentMethods',
    label: 'Financeiro: Forma de Pagamento',
    options: opts(['PIX', 'Transferência', 'Dinheiro', 'Cartão', 'Cheque', 'Outro']),
  },
];

/**
 * Os três gestos do fluxo do lançamento, que eram botões em código da tela fixa. Cada um é um
 * workflow de três passos — Montar Objeto com os campos a gravar → Gravar Registro → resposta com a
 * mensagem e `actions: ['refresh']` — e uma Action que diz QUANDO aparece, por expressão sobre o
 * próprio registro. Nada aqui é específico do kernel.
 */
const flowWorkflow = (
  templateId: string,
  name: string,
  description: string,
  fields: { name: string; expression?: string; value?: unknown }[],
  message: string,
): WorkflowModuleTemplate => ({
  templateId,
  name,
  description,
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
            name: 'lancamento',
            fields: [
              { name: 'id', value: { kind: 'Expression', expression: 'event.recordId' } },
              ...fields.map((field) => ({
                name: field.name,
                value: field.expression
                  ? { kind: 'Expression', expression: field.expression }
                  : { kind: 'Literal', value: field.value },
              })),
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
        upsert: { kind: 'Literal', value: { table: 'financials', source: 'input', property: 'lancamento' } },
      },
    },
    {
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
              { name: 'status', value: { kind: 'Literal', value: message } },
              { name: 'actions', value: { kind: 'Literal', value: ['refresh'] } },
            ],
          },
        },
      },
    },
  ],
});

const PAGAR_WORKFLOW = flowWorkflow(
  'wf-financeiro-pagar',
  'Registrar pagamento',
  'Marca o lançamento como Pago e carimba a data de pagamento de hoje.',
  [
    { name: 'status', value: 'Pago' },
    { name: 'paymentDate', expression: 'today()' },
  ],
  'Pagamento registrado.',
);

const ESTORNAR_WORKFLOW = flowWorkflow(
  'wf-financeiro-estornar',
  'Estornar pagamento',
  'Devolve o lançamento para Aberto e limpa a data de pagamento.',
  [
    { name: 'status', value: 'Aberto' },
    { name: 'paymentDate', value: null },
  ],
  'Pagamento estornado.',
);

const CANCELAR_WORKFLOW = flowWorkflow(
  'wf-financeiro-cancelar',
  'Registrar cancelamento',
  'Marca o lançamento como Cancelado e carimba a data de cancelamento de hoje.',
  [
    { name: 'status', value: 'Cancelado' },
    { name: 'cancelDate', expression: 'today()' },
  ],
  'Cancelamento registrado.',
);

const ACTIONS: ActionModuleTemplate[] = [
  {
    templateId: 'act-financeiro-pagar',
    key: 'financeiro_pagar',
    title: 'Registrar pagamento',
    icon: 'checkboxCircle',
    workflowId: 'wf-financeiro-pagar',
    // O gesto só existe enquanto há o que pagar — registro novo ainda não tem status gravado.
    hiddenWhen: 'isNew or status != "Aberto"',
    danger: false,
    enabled: true,
    order: 0,
  },
  {
    templateId: 'act-financeiro-estornar',
    key: 'financeiro_estornar',
    title: 'Estornar pagamento',
    icon: 'history',
    workflowId: 'wf-financeiro-estornar',
    hiddenWhen: 'isNew or status != "Pago"',
    danger: false,
    enabled: true,
    order: 1,
  },
  {
    templateId: 'act-financeiro-cancelar',
    key: 'financeiro_cancelar',
    title: 'Registrar cancelamento',
    icon: 'closeCircle',
    workflowId: 'wf-financeiro-cancelar',
    hiddenWhen: 'isNew or status == "Cancelado"',
    danger: true,
    enabled: true,
    order: 2,
  },
];

const FINANCEIRO_SCREEN: ScreenModuleTemplate = {
  key: 'financeiro',
  sourceId: SOURCE_ID,
  sourceRev: 2,
  titleSingular: 'Lançamento',
  titlePlural: 'Financeiro',
  icon: 'moneyDollar',
  dataCollection: 'financials',
  fields: FIELDS,
  titleFieldKey: 'category',
  subtitleFieldKey: 'type',
  hasNotes: false,
  hasDocuments: true,
  hasTags: true,
  tagCollection: 'financialTags',
  // Os eventos que as automações escutam continuam sendo `financial.saved`/`financial.deleted`.
  eventPrefix: 'financial',
  // A mesma permissão da regra nomeada que `financials` tinha: secretária lê, advogado e admin gravam.
  writeRoles: ['admin', 'lawyer'],
  listActions: ['copyLink', 'clone', 'manageTags', 'delete'],
  viewActionIds: ['act-financeiro-pagar', 'act-financeiro-estornar', 'act-financeiro-cancelar'],
  cardActionIds: ['act-financeiro-pagar', 'act-financeiro-estornar', 'act-financeiro-cancelar'],
  // O menu e a página vêm das contribuições da extensão, que apontam para a view própria.
  sidebarOrder: 0,
  hideFromSidebar: true,
};

/**
 * A listagem. Do padrão vêm filtros (inclusive o período de vencimento, que agora é um filtro de
 * data como outro qualquer), etiquetas, ações do cartão e os modais; a view injeta o que é do
 * Financeiro: a faixa de totais sobre os registros FILTRADOS, o valor com sinal e cor no cartão e a
 * linha que compõe as três datas.
 */
const FINANCEIRO_SOURCE = `
import { useMemo, useState } from 'react';
import { styled, useTheme } from 'styled-components';
import { RecordListSurface, Badge, Button, InfoBanner } from '@microteia/ui';
import { useEntityList, useLookup } from '@microteia/data';
import { getConfigColor } from '@microteia/theme';
import { formatCurrencyBRL, formatDate } from '@microteia/format';

const SOURCE_ID = 'microteia:financeiro';

const Header = styled.div\`
  display: flex;
  align-items: center;
  gap: \${({ theme }) => theme.spacing.xs};
\`;

const Totals = styled.div\`
  display: flex;
  flex-wrap: wrap;
  gap: \${({ theme }) => theme.spacing.lg};
  padding: \${({ theme }) => theme.spacing.sm + ' ' + theme.spacing.xl};
  border-bottom: 1px solid \${({ theme }) => theme.colors.border};
  background: \${({ theme }) => theme.colors.surface};
\`;

const Total = styled.div\`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
\`;

const TotalLabel = styled.span\`
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: \${({ theme }) => theme.colors.textMuted};
\`;

const TotalValue = styled.span\`
  font-size: \${({ theme }) => theme.fontSizes.md};
  font-weight: 700;
  font-family: \${({ theme }) => theme.fonts.mono};
  color: \${({ $color, theme }) => $color || theme.colors.text};
\`;

const CardRow = styled.div\`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: \${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
\`;

const Amount = styled.span\`
  font-size: \${({ theme }) => theme.fontSizes.md};
  font-weight: 700;
  font-family: \${({ theme }) => theme.fonts.mono};
  color: \${({ $color }) => $color};
  white-space: nowrap;
\`;

const startOfMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

const endOfMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0);
};

const iso = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
};

// O mês corrente é a visão útil de quem abre o Financeiro: sem isso, a primeira tela é o histórico
// inteiro do escritório.
const MES_CORRENTE = [
  { key: 'dueDate', values: [iso(startOfMonth())] },
  { key: 'dueDate:ate', values: [iso(endOfMonth())] },
];

const sum = (records, type, status) => records
  .filter((r) => r.type === type && r.status === status)
  .reduce((total, r) => total + (Number(r.amount) || 0), 0);

export default function FinanceiroView() {
  const theme = useTheme();
  const list = useEntityList(SOURCE_ID, { defaultFilterTokens: MES_CORRENTE });
  const statusOptions = useLookup('financialStatuses');
  const typeOptions = useLookup('financialTypes');
  const [showTotals, setShowTotals] = useState(true);

  const totals = useMemo(() => {
    const records = list.filteredRecords;
    const recebido = sum(records, 'Receita', 'Pago');
    const pago = sum(records, 'Despesa', 'Pago');
    const aReceber = sum(records, 'Receita', 'Aberto');
    const aPagar = sum(records, 'Despesa', 'Aberto');
    return { recebido, pago, saldo: recebido - pago, aReceber, aPagar, previsto: recebido - pago - aReceber - aPagar };
  }, [list.filteredRecords]);

  if (!list.definition) {
    return <div style={{ padding: '24px' }}><InfoBanner message='Tela "Financeiro" não encontrada. Instale a extensão para ativá-la.' variant="warning" /></div>;
  }

  const amountColor = (record) => record.type === 'Despesa' ? theme.colors.expense : theme.colors.revenue;

  const statusColor = (record) => {
    // A data chega como Date (o store converte o Timestamp): comparar pelo DIA, no fuso do
    // escritório. Comparar como texto não funciona: String(new Date()) é "Wed Aug 12 2026".
    const vencido = record.status === 'Aberto' && record.dueDate && iso(new Date(record.dueDate)) < iso(new Date());
    return vencido ? theme.colors.danger : getConfigColor(statusOptions, record.status, theme);
  };

  const renderBelowHeader = (record) => (
    <CardRow>
      <Badge color={statusColor(record)}>{record.status}</Badge>
      <Amount $color={amountColor(record)}>
        {record.type === 'Despesa' ? '-' : '+'} {formatCurrencyBRL(Number(record.amount) || 0)}
      </Amount>
    </CardRow>
  );

  // As três datas numa linha só: separadas, "12/08 · 15/08" vira duas linhas que não se explicam.
  const renderMetaRows = (record) => {
    const parts = [formatDate(record.dueDate)];
    if (record.paymentDate) parts.push('pago em ' + formatDate(record.paymentDate));
    if (record.cancelDate) parts.push('cancelado em ' + formatDate(record.cancelDate));
    return [{ key: 'datas', value: parts.filter(Boolean).join(' · ') }];
  };

  const total = (label, value, color) => (
    <Total>
      <TotalLabel>{label}</TotalLabel>
      <TotalValue $color={color}>{formatCurrencyBRL(value)}</TotalValue>
    </Total>
  );

  const summary = showTotals ? (
    <Totals>
      {total('Recebido', totals.recebido, theme.colors.revenue)}
      {total('Pago', totals.pago, theme.colors.expense)}
      {total('Saldo', totals.saldo, totals.saldo < 0 ? theme.colors.expense : theme.colors.revenue)}
      {total('A receber', totals.aReceber, theme.colors.textSecondary)}
      {total('A pagar', totals.aPagar, theme.colors.textSecondary)}
      {total('Previsto', totals.previsto, totals.previsto < 0 ? theme.colors.expense : theme.colors.revenue)}
    </Totals>
  ) : null;

  const headerActions = (
    <Header>
      <Button variant="ghost" onClick={() => setShowTotals((prev) => !prev)}>
        {showTotals ? 'Ocultar totais' : 'Mostrar totais'}
      </Button>
    </Header>
  );

  return (
    <RecordListSurface
      vm={list}
      definition={list.definition}
      renderBelowHeader={renderBelowHeader}
      renderMetaRows={renderMetaRows}
      headerActions={headerActions}
      summary={summary}
      emptyTitle="Nenhum lançamento encontrado"
      emptyActionLabel="Cadastrar primeiro lançamento"
    />
  );
}
`;

/**
 * O STARTUP: comandos de ⌘K e a menção `@lancamento` das anotações — o que era um provider do
 * kernel. A tela é resolvida pelo `sourceId`, então acompanha a chave instalada.
 */
const STARTUP_SOURCE = `
import { Icon } from '@microteia/ui';

const SOURCE_ID = 'microteia:financeiro';
const LIST_KEY = 'financeiro';
const GROUP = 'Financeiro';

const viewKey = (screen, id) => 'view-dyn:' + screen.id + ':' + id;

const screenOf = (ctx) => ctx.screenDefinitions.find((s) => (s.sourceId || s.id) === SOURCE_ID);
const textOf = (record, key) => (key && typeof record[key] === 'string' ? record[key] : '');

/**
 * A busca casa só o TÍTULO (a categoria). O subtítulo do lançamento é o TIPO ("Receita"/"Despesa"),
 * uma classificação que todo registro repete: casá-la devolveria metade do financeiro para quem
 * digitasse "rec". Quem inclui o subtítulo é Processos, onde ele é o NÚMERO do processo.
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
      const icon = <Icon name="moneyDollar" size={16} />;
      const items = [];
      if ('novo lancamento'.indexOf(q) !== -1 || 'novo lançamento'.indexOf(q) !== -1) {
        items.push({ id: 'financeiro:new', title: 'Novo lançamento', group: GROUP, icon, onSelect: () => { ctx.openTab('new-dyn:' + screen.id); ctx.close(); } });
      }
      if ('abrir financeiro'.indexOf(q) !== -1) {
        items.push({ id: 'financeiro:list', title: 'Abrir Financeiro', group: GROUP, icon, onSelect: () => { ctx.openTab(LIST_KEY); ctx.close(); } });
      }
      for (const r of recordsOf(ctx, screen)) {
        if (!matches(r, screen, q)) continue;
        items.push({
          id: 'financeiro:' + r.id,
          title: textOf(r, screen.titleFieldKey),
          subtitle: textOf(r, screen.subtitleFieldKey) || 'Lançamento',
          group: GROUP,
          icon,
          onSelect: () => { ctx.openTab(viewKey(screen, r.id)); ctx.close(); },
        });
      }
      return items.slice(0, 9);
    },
  });

  host.mentions.register({
    key: 'lancamento',
    label: 'Lançamento',
    description: 'Inserir link para um lançamento financeiro',
    icon: 'moneyDollar',
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
          subtitle: textOf(record, screen.subtitleFieldKey) || 'Lançamento',
          tabKey: viewKey(screen, record.id),
        }));
    },
  });
}
`;


/**
 * O WIDGET do Dashboard: o que há para receber e para pagar dentro de um horizonte de dias. Era o
 * cartão "Financeiro" do painel escrito no kernel — inclusive o seletor de 7/15/30 dias —, e agora é
 * desta extensão, a única que sabe o que é uma receita em aberto.
 */
const FINANCEIRO_RESUMO_SOURCE = `
import { useMemo, useState } from 'react';
import { styled, useTheme } from 'styled-components';
import { Button } from '@microteia/ui';
import { useCollection, useOpenScreenList } from '@microteia/data';
import { formatCurrencyBRL } from '@microteia/format';

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

const Head = styled.div\`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: \${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
\`;

const Title = styled.h3\`
  font-size: \${({ theme }) => theme.fontSizes.md};
  font-weight: 600;
  color: \${({ theme }) => theme.colors.text};
\`;

const Periods = styled.div\`
  display: flex;
  gap: 2px;
  border: 1px solid \${({ theme }) => theme.colors.border};
  border-radius: \${({ theme }) => theme.borderRadius.md};
  padding: 2px;
\`;

const Period = styled.button\`
  border: none;
  border-radius: \${({ theme }) => theme.borderRadius.sm};
  padding: \${({ theme }) => theme.spacing.xs} \${({ theme }) => theme.spacing.sm};
  font-size: \${({ theme }) => theme.fontSizes.xs};
  font-weight: 600;
  cursor: pointer;
  background: \${({ $active, theme }) => ($active ? theme.colors.primary : 'transparent')};
  color: \${({ $active, theme }) => ($active ? theme.colors.white : theme.colors.textSecondary)};
\`;

const Row = styled.div\`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: \${({ theme }) => theme.spacing.sm} 0;
  border-bottom: 1px solid \${({ theme }) => theme.colors.border};
  &:last-child { border-bottom: none; }
\`;

const RowLabel = styled.span\`
  font-size: \${({ theme }) => theme.fontSizes.sm};
  color: \${({ theme }) => theme.colors.textMuted};
\`;

const RowValue = styled.span\`
  font-size: \${({ theme }) => theme.fontSizes.md};
  font-weight: 700;
  font-family: \${({ theme }) => theme.fonts.mono};
  color: \${({ $color }) => $color};
\`;

const PERIODS = [7, 15, 30];
const DAY = 86400000;

const dayTime = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

const isoOf = (time) => {
  const date = new Date(time);
  const pad = (n) => String(n).padStart(2, '0');
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
};

export default function FinanceiroResumoWidget() {
  const theme = useTheme();
  const financials = useCollection('financials');
  const openList = useOpenScreenList();
  const [days, setDays] = useState(30);

  const totals = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const limit = today + days * DAY;
    const open = financials.filter((f) => {
      const due = dayTime(f.dueDate);
      return f.status === 'Aberto' && due !== null && due <= limit;
    });
    const sum = (type) => open
      .filter((f) => f.type === type)
      .reduce((total, f) => total + (Number(f.amount) || 0), 0);
    const receber = sum('Receita');
    const pagar = sum('Despesa');
    return { receber, pagar, saldo: receber - pagar, limit };
  }, [financials, days]);

  return (
    <Card>
      <Head>
        <Title>Financeiro</Title>
        <Head>
          <Periods>
            {PERIODS.map((option) => (
              <Period key={option} $active={days === option} onClick={() => setDays(option)}>{option}d</Period>
            ))}
          </Periods>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => openList('financials', [
              { key: 'status', values: ['Aberto'] },
              { key: 'dueDate:ate', values: [isoOf(totals.limit)] },
            ])}
          >
            Ver tudo
          </Button>
        </Head>
      </Head>
      <div>
        <Row>
          <RowLabel>Receitas a receber</RowLabel>
          <RowValue $color={theme.colors.revenue}>{formatCurrencyBRL(totals.receber)}</RowValue>
        </Row>
        <Row>
          <RowLabel>Despesas a pagar</RowLabel>
          <RowValue $color={theme.colors.expense}>{formatCurrencyBRL(totals.pagar)}</RowValue>
        </Row>
        <Row>
          <RowLabel>Saldo projetado</RowLabel>
          <RowValue $color={totals.saldo >= 0 ? theme.colors.revenue : theme.colors.expense}>
            {formatCurrencyBRL(totals.saldo)}
          </RowValue>
        </Row>
      </div>
    </Card>
  );
}
`;

export const financeiroPlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.financeiro',
    version: '1.0.3',
    kernel: '^1.0.0',
    name: 'Financeiro',
    description: 'Os lançamentos financeiros do escritório recriados como extensão, sobre os MESMOS lançamentos — a quarta entidade a sair do kernel.',
    publisher: { name: 'Microteia' },
    // O lançamento aponta para pessoa, processo e contrato: as três coleções vêm das extensões que
    // as declaram, e é por isso que as três precisam estar instaladas.
    dependencies: {
      'core.ui': '^1.0.0',
      'com.microteia.pessoa': { version: '^1.0.0', collections: ['persons'] },
      'com.microteia.contrato': { version: '^1.0.0', collections: ['contracts'] },
      'com.microteia.processo': { version: '^2.0.0', collections: ['cases'] },
    },
    contributes: [
      nav({ key: 'financeiro', label: 'Financeiro', icon: 'moneyDollar', order: 70 }),
      page({ key: 'financeiro', title: 'Financeiro', icon: 'moneyDollar' }, 'financeiro'),
      surfaceWidget({ surface: 'dashboard', key: 'financeiro.resumo', title: 'Resumo financeiro', description: 'O que há a receber e a pagar no horizonte escolhido, e o saldo projetado.', icon: 'moneyDollar', defaultSpan: 1, order: 70 }, 'widget-financeiro-resumo'),
    ],
  },
  summary:
    'O controle financeiro do escritório: receitas e despesas com categoria, valor, vencimento, pagamento, forma, centro de custo e nota, vinculadas a pessoa, processo e contrato — com etiquetas, documentos e os gestos de registrar pagamento, estornar e cancelar.',
  overview: {
    type: 'stack',
    gap: 'lg',
    children: [
      {
        type: 'markdown',
        content:
          'A extensão **Financeiro** traz os lançamentos do escritório: cada receita ou despesa com categoria, valor, vencimento e status, ligada à pessoa, ao processo e ao contrato de origem.\n\nA listagem abre no mês corrente e mostra os totais do que está filtrado — recebido, pago, saldo e o previsto do que ainda está em aberto. Registrar pagamento, estornar e registrar cancelamento são gestos do próprio cartão.\n\nAs listas de Categoria, Status e Forma de Pagamento já vêm preenchidas e são suas; o Centro de Custo é o mesmo dos Contratos.',
      },
      {
        type: 'keyValue',
        items: [
          { label: 'Adiciona', value: 'Item "Financeiro" no menu' },
          { label: 'Cadastro', value: '14 campos, em 4 seções' },
          { label: 'Por lançamento', value: 'Etiquetas e documentos' },
          { label: 'Quem grava', value: 'Advogado e administrador' },
        ],
      },
      {
        type: 'banner',
        message: 'Remover a extensão remove a tela, nunca os lançamentos: os registros, as listas de opções e as etiquetas continuam no escritório e voltam a aparecer se ela for instalada de novo.',
        variant: 'info',
      },
    ],
  },
  workflows: [PAGAR_WORKFLOW, ESTORNAR_WORKFLOW, CANCELAR_WORKFLOW],
  actions: ACTIONS,
  screens: [FINANCEIRO_SCREEN],
  lookups: LOOKUPS,
  tagLists: [{ collection: 'financialTags', label: 'Etiquetas: Financeiro' }],
  startup: STARTUP_SOURCE,
  views: [
    {
      key: 'financeiro',
      title: 'Financeiro',
      icon: 'moneyDollar',
      source: FINANCEIRO_SOURCE,
    },
    { key: 'widget-financeiro-resumo', title: 'Resumo financeiro', icon: 'moneyDollar', source: FINANCEIRO_RESUMO_SOURCE },
  ],
};
