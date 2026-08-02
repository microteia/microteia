import type {
  ActionModuleTemplate,
  LookupModuleTemplate,
  MarketplacePlugin,
  ScreenModuleTemplate,
  TemplateField,
  WorkflowModuleTemplate,
} from '../../domain/entities/MarketplacePlugin';
import type { CustomFieldOption } from '../../domain/entities';
import { nav, page } from '../contributionBuilders';

/**
 * **Prazos** — o controle de prazos do escritório, inteiro, declarado por extensão: campos, listas de
 * opções, o cartão da listagem, a ordem em que a lista se lê, os filtros e o prefixo dos eventos.
 *
 * `dataCollection: 'deadlines'` aponta para a coleção onde os prazos já estão — nada se move, e os
 * eventos (`deadline.saved`) que as automações escutam seguem com o mesmo nome.
 *
 * O que ANTES era código do kernel e agora é declaração: o botão "marcar como concluído" virou uma
 * **Action** sobre um workflow, com a expressão que decide quando ele aparece; a prioridade e o
 * status, que eram uniões fechadas no tipo, viraram listas de opções do escritório; e a ordem da
 * lista (do vencimento mais próximo ao mais distante) virou o comparador que a listagem recebe.
 */
const SOURCE_ID = 'microteia:prazo';

const IDENTIFICACAO = 'Identificação';
const DATAS = 'Datas';
const DETALHES = 'Responsável e Detalhes';

const FIELDS: TemplateField[] = [
  { key: 'type', label: 'Tipo', type: 'select', required: true, order: 0, section: IDENTIFICACAO, lookupCollection: 'deadlineTypes', optionsAllowUserAdd: true, filterable: true, placeholder: 'Selecione o tipo...' },
  { key: 'priority', label: 'Prioridade', type: 'select', required: true, order: 1, section: IDENTIFICACAO, lookupCollection: 'deadlinePriorities', optionsColored: true, filterable: true, placeholder: 'Selecione a prioridade...' },
  { key: 'status', label: 'Status', type: 'select', required: true, order: 2, section: IDENTIFICACAO, lookupCollection: 'deadlineStatuses', optionsColored: true, filterable: true, placeholder: 'Selecione o status...' },
  { key: 'caseId', label: 'Processo', type: 'reference', required: true, order: 3, section: IDENTIFICACAO, refEntity: 'cases', placeholder: 'Selecione o processo...', filterable: true, showInList: true, listIcon: 'folder', listOrder: 0 },
  { key: 'dueDate', label: 'Data de vencimento', type: 'date', required: true, order: 4, section: DATAS, filterable: true, showInList: true, listIcon: 'calendar', listOrder: 1 },
  { key: 'completedAt', label: 'Data de conclusão', type: 'date', required: false, order: 5, section: DATAS, filterable: true, showInList: true, listIcon: 'calendarCheck', listOrder: 2 },
  { key: 'responsibleLawyerId', label: 'Advogado responsável', type: 'reference', required: false, order: 6, section: DETALHES, refEntity: 'persons', placeholder: 'Selecione o responsável...', filterable: true, showInList: true, listIcon: 'scales', listOrder: 3 },
  { key: 'description', label: 'Descrição', type: 'textarea', required: false, order: 7, section: DETALHES, placeholder: 'Detalhes sobre o prazo, documentos necessários, etc.', showInList: true, listIcon: 'fileText', listOrder: 4 },
];

const opts = (labels: string[]): CustomFieldOption[] => labels.map((label) => ({ key: label, label }));

const colored = (entries: [string, string][]): CustomFieldOption[] =>
  entries.map(([label, color]) => ({ key: label, label, color }));

/**
 * As listas com as opções de PARTIDA — semeadas só quando a lista está vazia no escritório; dali em
 * diante são dele. As chaves de prioridade e status são os RÓTULOS que os prazos já guardam
 * ("Pendente", "Crítica"): a lista descreve o que está gravado, não um esquema novo.
 */
const LOOKUPS: LookupModuleTemplate[] = [
  {
    collection: 'deadlineTypes',
    label: 'Prazo: Tipo',
    options: opts(['Audiência', 'Recurso', 'Contestação', 'Petição', 'Pagamento', 'Outro']),
  },
  {
    collection: 'deadlinePriorities',
    label: 'Prazo: Prioridade',
    options: colored([['Baixa', 'success'], ['Média', 'warning'], ['Alta', 'secondary'], ['Crítica', 'danger']]),
  },
  {
    collection: 'deadlineStatuses',
    label: 'Prazo: Status',
    options: colored([['Pendente', 'info'], ['Concluído', 'success'], ['Vencido', 'danger'], ['Cancelado', 'textSecondary']]),
  },
];

/**
 * Concluir um prazo era um `if` na view seguido de uma chamada de store. Agora são três passos
 * declarados — Montar Objeto com o que muda → Gravar Registro → resposta com `actions: ['refresh']` —
 * e uma Action que diz QUANDO o gesto aparece, por expressão sobre o próprio registro.
 */
const CONCLUIR_WORKFLOW: WorkflowModuleTemplate = {
  templateId: 'wf-prazo-concluir',
  name: 'Marcar prazo como concluído',
  description: 'Marca o prazo como Concluído e carimba a data de conclusão de hoje.',
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
            name: 'prazo',
            fields: [
              { name: 'id', value: { kind: 'Expression', expression: 'event.recordId' } },
              { name: 'status', value: { kind: 'Literal', value: 'Concluído' } },
              { name: 'completedAt', value: { kind: 'Expression', expression: 'today()' } },
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
        upsert: { kind: 'Literal', value: { table: 'deadlines', source: 'input', property: 'prazo' } },
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
              { name: 'status', value: { kind: 'Literal', value: 'Prazo marcado como concluído.' } },
              { name: 'actions', value: { kind: 'Literal', value: ['refresh'] } },
            ],
          },
        },
      },
    },
  ],
};

const ACTIONS: ActionModuleTemplate[] = [
  {
    templateId: 'act-prazo-concluir',
    key: 'prazo_concluir',
    title: 'Marcar como concluído',
    icon: 'check',
    workflowId: 'wf-prazo-concluir',
    // O gesto só existe enquanto há o que concluir — prazo encerrado (concluído ou cancelado) não
    // volta pelo cartão, e registro novo ainda não tem status gravado.
    hiddenWhen: 'isNew or status == "Concluído" or status == "Cancelado"',
    danger: false,
    enabled: true,
    order: 0,
  },
];

const PRAZOS_SCREEN: ScreenModuleTemplate = {
  key: 'prazos',
  sourceId: SOURCE_ID,
  sourceRev: 1,
  titleSingular: 'Prazo',
  titlePlural: 'Prazos',
  icon: 'time',
  dataCollection: 'deadlines',
  fields: FIELDS,
  titleFieldKey: 'type',
  subtitleFieldKey: 'status',
  hasNotes: false,
  hasDocuments: false,
  hasTags: false,
  // Os eventos que as automações escutam continuam sendo `deadline.saved`/`deadline.deleted`.
  eventPrefix: 'deadline',
  listActions: ['copyLink', 'delete'],
  viewActionIds: ['act-prazo-concluir'],
  cardActionIds: ['act-prazo-concluir'],
  // O menu e a página vêm das contribuições da extensão, que apontam para a view própria.
  sidebarOrder: 0,
  hideFromSidebar: true,
};

/**
 * A listagem. Do padrão vêm filtros, ações do cartão e os modais; a view injeta o que é do Prazo: a
 * faixa de prioridade no alto do cartão, o número do processo clicável com o chip de dias que o
 * acompanha, e os selos de situação e prioridade.
 */
const PRAZOS_SOURCE = `
import { useMemo } from 'react';
import { styled, useTheme } from 'styled-components';
import { Icon, RecordListSurface, InfoBanner } from '@microteia/ui';
import { useEntityList, useCollection, useLookup, useOpenRecord } from '@microteia/data';
import { getConfigColor } from '@microteia/theme';

const SOURCE_ID = 'microteia:prazo';

const CaseRow = styled.div\`
  display: flex;
  align-items: center;
  gap: \${({ theme }) => theme.spacing.xs};
  margin-top: 2px;
  min-width: 0;
\`;

const CaseNumber = styled.button\`
  font-size: \${({ theme }) => theme.fontSizes.xs};
  color: \${({ theme }) => theme.colors.textMuted};
  font-family: \${({ theme }) => theme.fonts.mono};
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  transition: \${({ theme }) => theme.transitions.fast};

  &:hover { color: \${({ theme }) => theme.colors.primary}; text-decoration: underline; }
\`;

const DaysChip = styled.span\`
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  margin-left: auto;
  padding: 1px 7px;
  border-radius: \${({ theme }) => theme.borderRadius.full};
  font-size: 10px;
  font-weight: 600;
  font-family: \${({ theme }) => theme.fonts.mono};
  white-space: nowrap;
  background: \${({ $tone, theme }) => $tone ? theme.colors[$tone] + '20' : theme.colors.surfaceHover};
  color: \${({ $tone, theme }) => $tone ? theme.colors[$tone] : theme.colors.textMuted};
  border: 1px solid \${({ $tone, theme }) => $tone ? theme.colors[$tone] + '44' : theme.colors.border};
\`;

const Badges = styled.div\`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
\`;

const MetaBadge = styled.span\`
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: \${({ theme }) => theme.borderRadius.full};
  font-size: 10px;
  font-weight: 500;
  background: \${({ $color }) => $color + '20'};
  color: \${({ $color }) => $color};
  border: 1px solid \${({ $color }) => $color + '40'};
  flex-shrink: 0;
\`;

const dateOf = (value) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return isNaN(d.getTime()) ? null : d;
};

const startOfDay = (date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const daysUntilDue = (record) => {
  const due = dateOf(record.dueDate);
  if (!due) return null;
  return Math.round((startOfDay(due).getTime() - startOfDay(new Date()).getTime()) / 86400000);
};

const isOverdue = (record) => {
  const due = dateOf(record.dueDate);
  return record.status === 'Pendente' && !!due && due.getTime() < Date.now();
};

const PRIORITY_ORDER = { 'Crítica': 3, 'Alta': 2, 'Média': 1, 'Baixa': 0 };

/**
 * A lista de prazos se lê do vencimento mais PRÓXIMO ao mais distante — é uma agenda, não um
 * cadastro —, e o empate do dia se desfaz pela prioridade. Fora do componente de propósito: um
 * comparador novo a cada render reordenaria a lista inteira sem que nada tivesse mudado.
 */
const byDueDateThenPriority = (a, b) => {
  const at = dateOf(a.dueDate) ? dateOf(a.dueDate).getTime() : Infinity;
  const bt = dateOf(b.dueDate) ? dateOf(b.dueDate).getTime() : Infinity;
  if (at !== bt) return at - bt;
  const ap = PRIORITY_ORDER[a.priority] != null ? PRIORITY_ORDER[a.priority] : -1;
  const bp = PRIORITY_ORDER[b.priority] != null ? PRIORITY_ORDER[b.priority] : -1;
  return bp - ap;
};

// A visão útil de quem abre Prazos é o que ainda está de pé: sem isso, a primeira tela é o histórico
// inteiro do escritório, com os concluídos misturados aos pendentes.
const PENDENTES = [{ key: 'status', values: ['Pendente'] }];

export default function PrazosView() {
  const theme = useTheme();
  const list = useEntityList(SOURCE_ID, { defaultFilterTokens: PENDENTES, sortRecords: byDueDateThenPriority });
  const cases = useCollection('cases');
  const statusOptions = useLookup('deadlineStatuses');
  const priorityOptions = useLookup('deadlinePriorities');
  const openRecord = useOpenRecord();

  const caseNumberById = useMemo(() => {
    const map = {};
    for (const item of cases) map[item.id] = item.caseNumber || '';
    return map;
  }, [cases]);

  if (!list.definition) {
    return <div style={{ padding: '24px' }}><InfoBanner message='Tela "Prazos" não encontrada. Instale a extensão para ativá-la.' variant="warning" /></div>;
  }

  const priorityColor = (record) => getConfigColor(priorityOptions, record.priority, theme);

  const renderDaysChip = (record) => {
    if (record.status === 'Concluído') return <DaysChip $tone="success">Concluído</DaysChip>;
    if (record.status === 'Cancelado') return <DaysChip>Cancelado</DaysChip>;
    const days = daysUntilDue(record);
    if (days == null) return null;
    if (isOverdue(record)) {
      return <DaysChip $tone="danger"><Icon name="alert" size={10} />{Math.abs(days)}d vencido</DaysChip>;
    }
    if (days === 0) return <DaysChip $tone="warning">Hoje</DaysChip>;
    if (days === 1) return <DaysChip $tone="warning">Amanhã</DaysChip>;
    return <DaysChip>{days}d</DaysChip>;
  };

  const renderSubtitle = (record) => {
    const number = caseNumberById[record.caseId];
    return (
      <CaseRow>
        {number ? (
          <CaseNumber
            title={'Abrir processo ' + number}
            onClick={(e) => { e.stopPropagation(); openRecord('cases', record.caseId); }}
          >
            {number}
          </CaseNumber>
        ) : null}
        {renderDaysChip(record)}
      </CaseRow>
    );
  };

  const renderBelowHeader = (record) => (
    <Badges>
      <MetaBadge $color={getConfigColor(statusOptions, record.status, theme)}>{record.status}</MetaBadge>
      <MetaBadge $color={priorityColor(record)}>{record.priority}</MetaBadge>
    </Badges>
  );

  return (
    <RecordListSurface
      vm={list}
      definition={list.definition}
      accentColor={priorityColor}
      renderSubtitle={renderSubtitle}
      renderBelowHeader={renderBelowHeader}
      emptyTitle="Nenhum prazo encontrado"
      emptyActionLabel="Cadastrar primeiro prazo"
    />
  );
}
`;

/**
 * O STARTUP: comandos de ⌘K e a menção `@prazo` das anotações — o que era um provider do kernel. A
 * tela é resolvida pelo `sourceId`, então acompanha a chave instalada.
 */
const STARTUP_SOURCE = `
import { Icon } from '@microteia/ui';

const SOURCE_ID = 'microteia:prazo';
const LIST_KEY = 'prazos';
const GROUP = 'Prazos';

const viewKey = (screen, id) => 'view-dyn:' + screen.id + ':' + id;

const screenOf = (ctx) => ctx.screenDefinitions.find((s) => (s.sourceId || s.id) === SOURCE_ID);
const textOf = (record, key) => (key && typeof record[key] === 'string' ? record[key] : '');

/**
 * A busca casa só o TÍTULO (o tipo do prazo). O subtítulo é o STATUS, uma classificação que todo
 * registro repete: casá-la devolveria a agenda inteira para quem digitasse "pen". Quem inclui o
 * subtítulo é Processos e Contratos, onde ele é o NÚMERO do registro.
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
      const icon = <Icon name="time" size={16} />;
      const items = [];
      if ('novo prazo'.indexOf(q) !== -1) {
        items.push({ id: 'prazo:new', title: 'Novo prazo', group: GROUP, icon, onSelect: () => { ctx.openTab('new-dyn:' + screen.id); ctx.close(); } });
      }
      if ('abrir prazos'.indexOf(q) !== -1) {
        items.push({ id: 'prazo:list', title: 'Abrir Prazos', group: GROUP, icon, onSelect: () => { ctx.openTab(LIST_KEY); ctx.close(); } });
      }
      for (const r of recordsOf(ctx, screen)) {
        if (!matches(r, screen, q)) continue;
        items.push({
          id: 'prazo:' + r.id,
          title: textOf(r, screen.titleFieldKey),
          subtitle: textOf(r, screen.subtitleFieldKey) || 'Prazo',
          group: GROUP,
          icon,
          onSelect: () => { ctx.openTab(viewKey(screen, r.id)); ctx.close(); },
        });
      }
      return items.slice(0, 9);
    },
  });

  host.mentions.register({
    key: 'prazo',
    label: 'Prazo',
    description: 'Inserir link para um prazo',
    icon: 'time',
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
          subtitle: textOf(record, screen.subtitleFieldKey) || 'Prazo',
          tabKey: viewKey(screen, record.id),
        }));
    },
  });
}
`;

export const prazoPlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.prazo',
    version: '1.0.0',
    kernel: '^1.0.0',
    name: 'Prazos',
    description: 'O controle de prazos do escritório recriado como extensão, sobre os MESMOS prazos — a quinta entidade a sair do kernel.',
    publisher: { name: 'Microteia' },
    // Todo prazo é de um processo, e pode ter um advogado responsável: as duas coleções vêm das
    // extensões que as declaram, e é por isso que as duas precisam estar instaladas.
    dependencies: {
      'core.ui': '^1.0.0',
      'com.microteia.pessoa': { version: '^1.0.0', collections: ['persons'] },
      'com.microteia.processo': { version: '^2.0.0', collections: ['cases'] },
    },
    contributes: [
      nav({ key: 'prazos', label: 'Prazos', icon: 'time', order: 60 }),
      page({ key: 'prazos', title: 'Prazos', icon: 'time' }, 'prazos'),
    ],
  },
  summary:
    'A agenda de prazos do escritório: tipo, prioridade, vencimento e responsável, sempre ligados a um processo — com a lista aberta nos pendentes, ordenada do vencimento mais próximo ao mais distante, e o gesto de marcar como concluído no próprio cartão.',
  overview: {
    type: 'stack',
    gap: 'lg',
    children: [
      {
        type: 'markdown',
        content:
          'A extensão **Prazos** traz o controle de prazos do escritório: cada prazo com tipo, prioridade, vencimento e advogado responsável, ligado ao processo de origem.\n\nA listagem abre nos prazos pendentes e se lê do vencimento mais próximo ao mais distante. Cada cartão mostra, de uma olhada, a prioridade na faixa colorida do alto, o número do processo e quantos dias faltam — ou há quantos dias venceu. Marcar como concluído é um gesto do próprio cartão.\n\nAs listas de Tipo, Prioridade e Status já vêm preenchidas e são suas.',
      },
      {
        type: 'keyValue',
        items: [
          { label: 'Adiciona', value: 'Item "Prazos" no menu' },
          { label: 'Cadastro', value: '8 campos, em 3 seções' },
          { label: 'No cartão', value: 'Faixa de prioridade e dias para vencer' },
          { label: 'Abre em', value: 'Prazos pendentes' },
        ],
      },
      {
        type: 'banner',
        message: 'Remover a extensão remove a tela, nunca os prazos: os registros e as listas de opções continuam no escritório e voltam a aparecer se ela for instalada de novo.',
        variant: 'info',
      },
    ],
  },
  workflows: [CONCLUIR_WORKFLOW],
  actions: ACTIONS,
  screens: [PRAZOS_SCREEN],
  lookups: LOOKUPS,
  startup: STARTUP_SOURCE,
  views: [
    {
      key: 'prazos',
      title: 'Prazos',
      icon: 'time',
      source: PRAZOS_SOURCE,
    },
  ],
};
