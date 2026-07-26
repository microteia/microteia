import type { MarketplacePlugin, ScreenModuleTemplate } from '../../domain/entities/MarketplacePlugin';
import type { CustomFieldOption, FieldDefinition } from '../../domain/entities';
import { nav, page } from '../contributionBuilders';

/**
 * "Processo (clone)" — PROVA DE CONCEITO de recriar uma tela nativa inteiramente como Extensão, fiel
 * porém INDEPENDENTE do Processo real. A entidade é declarativa (comporta-se como criada no Form
 * Design: campos, lookups coloridos, máscaras, validações, título/etiquetas/notas/documentos nativos)
 * e NÃO tem `ui.nav` própria — existe sem item de menu. A view de código abaixo é a lista rica (cards,
 * filtros, badges, polos), que lê o SCHEMA VIVO e os PRÓPRIOS registros (coleção genérica
 * `customRecords`) pela ponte `@microteia/*`, sem tocar nenhum repositório de Case. Abrir/criar um
 * registro cai no detalhe dinâmico nativo (`ViewDynamicRecord`), gerado a partir deste mesmo schema.
 *
 * O `sourceId` estável é o elo entre o schema instalado e a view: a view resolve a tela por ele,
 * imune ao namespacing da chave instalada.
 */
const SOURCE_ID = 'microteia:processo-clone';

const opts = (labels: string[]): CustomFieldOption[] => labels.map((label) => ({ key: label, label }));

const coloredOpts = (entries: [string, string][]): CustomFieldOption[] =>
  entries.map(([label, color]) => ({ key: label, label, color }));

const STATUS_OPTIONS = coloredOpts([
  ['Em Andamento', 'caseStatusInProgress'],
  ['Procedente', 'caseStatusWon'],
  ['Procedente em Parte', 'caseStatusWon'],
  ['Improcedente', 'caseStatusLost'],
  ['Acordo', 'caseStatusSettlement'],
  ['Suspenso', 'caseStatusSuspended'],
  ['Arquivado', 'caseStatusArchived'],
  ['Extinto', 'caseStatusLost'],
]);

const PHASE_OPTIONS = coloredOpts([
  ['Fase Inicial', 'casePhaseInitial'],
  ['Instrução', 'casePhaseInstruction'],
  ['Sentença', 'casePhaseSentence'],
  ['Recurso', 'casePhaseAppeal'],
  ['Execução', 'casePhaseExecution'],
  ['Arquivado', 'casePhaseArchived'],
]);

const AREA_OPTIONS = opts([
  'Cível', 'Criminal', 'Trabalhista', 'Tributário', 'Família', 'Consumidor', 'Administrativo',
  'Constitucional', 'Ambiental', 'Imobiliário', 'Empresarial', 'Digital', 'Outros',
]);

const INSTANCE_OPTIONS = opts(['1º Grau', '2º Grau', 'Turma Recursal', 'STJ', 'STF', 'TST', 'TSE']);

const TYPE_OPTIONS = opts([
  'Ação de Cobrança', 'Ação de Indenização', 'Ação Trabalhista', 'Execução Fiscal',
  'Mandado de Segurança', 'Ação de Divórcio', 'Ação Penal',
]);

const IDENTIFICACAO = 'Identificação';
const CLASSIFICACAO = 'Classificação';
const TRIBUNAL = 'Tribunal';
const FINANCEIRO = 'Financeiro e Responsável';
const PARTES = 'Partes';

const FIELDS: FieldDefinition[] = [
  { key: 'caseNumber', label: 'Número do processo', type: 'text', required: true, order: 0, section: IDENTIFICACAO },
  { key: 'title', label: 'Título', type: 'text', required: true, order: 1, section: IDENTIFICACAO },
  { key: 'area', label: 'Área', type: 'select', required: false, order: 2, section: CLASSIFICACAO, options: AREA_OPTIONS, optionsAllowUserAdd: true, showInList: true, filterable: true },
  { key: 'type', label: 'Tipo de ação', type: 'select', required: false, order: 3, section: CLASSIFICACAO, options: TYPE_OPTIONS, optionsAllowUserAdd: true, multi: true, filterable: true },
  { key: 'phase', label: 'Fase', type: 'select', required: false, order: 4, section: CLASSIFICACAO, options: PHASE_OPTIONS, optionsColored: true, optionsAllowUserAdd: true, showInList: true, filterable: true },
  { key: 'status', label: 'Status', type: 'select', required: false, order: 5, section: CLASSIFICACAO, options: STATUS_OPTIONS, optionsColored: true, optionsAllowUserAdd: true, showInList: true, filterable: true },
  { key: 'instance', label: 'Instância', type: 'select', required: false, order: 6, section: TRIBUNAL, options: INSTANCE_OPTIONS, optionsAllowUserAdd: true, showInList: true, filterable: true },
  { key: 'court', label: 'Vara/Tribunal', type: 'select', required: false, order: 7, section: TRIBUNAL, options: [], optionsAllowUserAdd: true, showInList: true, filterable: true },
  { key: 'courtDistrict', label: 'Comarca', type: 'select', required: false, order: 8, section: TRIBUNAL, options: [], optionsAllowUserAdd: true, filterable: true },
  { key: 'judge', label: 'Juiz(a)', type: 'select', required: false, order: 9, section: TRIBUNAL, options: [], optionsAllowUserAdd: true, filterable: true },
  { key: 'filedAt', label: 'Data de distribuição', type: 'date', required: false, order: 10, section: TRIBUNAL },
  { key: 'causeValue', label: 'Valor da causa', type: 'currency', required: false, order: 11, section: FINANCEIRO, showInList: true },
  { key: 'responsibleLawyerId', label: 'Advogado responsável', type: 'reference', required: false, order: 12, section: FINANCEIRO, refEntity: 'persons', showInList: true, filterable: true },
  { key: 'contractId', label: 'Contrato', type: 'reference', required: false, order: 13, section: FINANCEIRO, refEntity: 'contracts' },
  { key: 'notes', label: 'Observações', type: 'textarea', required: false, order: 14, section: FINANCEIRO },
  { key: 'activePoleIds', label: 'Polo ativo', type: 'reference', required: false, order: 15, section: PARTES, refEntity: 'persons', multi: true },
  { key: 'passivePoleIds', label: 'Polo passivo', type: 'reference', required: false, order: 16, section: PARTES, refEntity: 'persons', multi: true },
];

const PROCESSO_SCREEN: ScreenModuleTemplate = {
  key: 'processo-clone',
  sourceId: SOURCE_ID,
  sourceRev: 1,
  titleSingular: 'Processo (clone)',
  titlePlural: 'Processos (clone)',
  icon: 'folder',
  fields: FIELDS,
  titleFieldKey: 'title',
  hasNotes: true,
  hasDocuments: true,
  hasTags: true,
  listActions: ['copyLink', 'clone', 'manageTags', 'delete'],
  sidebarOrder: 0,
  hideFromSidebar: true,
};

/**
 * A view de código (lista rica). Escrita SÓ contra `@microteia/*`, `react` e `styled-components`.
 *
 * Aqui está o ponto da prova: em vez de remontar a lista na mão, ela REUTILIZA a mesma superfície
 * padrão das telas nativas — `RecordListSurface`, alimentada por `useEntityList(sourceId)`. Com isso
 * o TÍTULO, os FILTROS (com cor), os BADGES coloridos de Status/Fase, as ETIQUETAS e — o ponto que o
 * usuário pediu — as AÇÕES do card vêm todos da CONFIGURAÇÃO (Form Design): a extensão não fixa nada.
 * A view só injeta os pedaços EXCLUSIVOS por slots: o subtítulo (número + chip de dias) e os polos.
 * Quem cria a extensão pode manter esse padrão ou, para relocar (ex.: ações num dropdown), compor a
 * própria tela com `useEntityList` + `EntityListView`/`EntityListCard`, sem perder a governança da
 * configuração. Nenhuma cor é fixa: os lookups usam nome de token do tema, resolvidos pela app.
 */
const PROCESSO_SOURCE = `
import { useMemo } from 'react';
import { useTheme } from 'styled-components';
import { RecordListSurface, Badge, InfoBanner } from '@microteia/ui';
import { useEntityList, usePersons, useWorkspace } from '@microteia/data';

const SOURCE_ID = 'microteia:processo-clone';
const EDIT_PREFIX = 'processo-clone-edit:';

const asArray = (v) => Array.isArray(v) ? v : (v == null || v === '' ? [] : [v]);

function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  return diff < 0 ? 0 : diff;
}

export default function ProcessoCloneView() {
  const theme = useTheme();
  const list = useEntityList(SOURCE_ID, { editKeyPrefix: EDIT_PREFIX });
  const persons = usePersons();
  const { openTab } = useWorkspace();

  const personById = useMemo(() => {
    const map = {};
    for (const p of persons) map[p.id] = p;
    return map;
  }, [persons]);

  if (!list.definition) {
    return <div style={{ padding: '24px' }}><InfoBanner message='Entidade "Processo (clone)" não encontrada. Instale a extensão para ativar esta tela.' variant="warning" /></div>;
  }

  const namesOf = (ids) => asArray(ids).map((id) => personById[id] ? personById[id].name : '').filter(Boolean);

  const poleLabel = { fontSize: theme.fontSizes.xs, color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' };
  const poleName = { fontSize: theme.fontSizes.sm, color: theme.colors.text };
  const poleEmpty = { fontSize: theme.fontSizes.sm, color: theme.colors.textMuted };

  const renderPole = (label, names) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '160px' }}>
      <span style={poleLabel}>{label}</span>
      {names.length > 0
        ? names.map((n, i) => <span key={i} style={poleName}>{n}</span>)
        : <span style={poleEmpty}>—</span>}
    </div>
  );

  const renderSubtitle = (record) => {
    const v = record.values || {};
    const days = daysSince(v.filedAt);
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
        {v.caseNumber ? <span style={{ fontFamily: 'monospace' }}>{v.caseNumber}</span> : null}
        {days != null ? <Badge color={theme.colors.textSecondary}>{days} dias</Badge> : null}
      </span>
    );
  };

  const renderBelowHeader = (record) => {
    const v = record.values || {};
    return (
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', margin: '8px 0' }}>
        {renderPole('Polo Ativo', namesOf(v.activePoleIds))}
        {renderPole('Polo Passivo', namesOf(v.passivePoleIds))}
      </div>
    );
  };

  return (
    <RecordListSurface
      vm={list}
      definition={list.definition}
      renderSubtitle={renderSubtitle}
      renderBelowHeader={renderBelowHeader}
      onOpenRecord={(record) => openTab(EDIT_PREFIX + record.id)}
      onNewRecord={() => openTab(EDIT_PREFIX + 'new')}
    />
  );
}
`;

/**
 * A tela de EDIÇÃO própria da extensão. Reaproveita a MESMA superfície de detalhe do sistema
 * (`RecordDetailSurface`, alimentada por `useEntityDetailVM`): cabeçalho com salvar (verde)/excluir
 * (vermelho)/clonar/copiar-link/etiquetas nos mesmos ícones, abas Dados/Anotações/Documentos, seções
 * e campos do schema (grade 1fr 1fr) — tudo governado pela configuração (Form Design). Diferença do
 * detalhe nativo: os links (copiar link, clonar, reabrir ao salvar) apontam para ESTE editor, via
 * `editKeyPrefix`. Para um layout de campos próprio, passar `renderData` (usa `FieldInput`/`EntityForm`).
 */
const EDIT_SOURCE = `
import { RecordDetailSurface } from '@microteia/ui';
import { useEntityDetailVM } from '@microteia/data';

const SOURCE_ID = 'microteia:processo-clone';
const EDIT_PREFIX = 'processo-clone-edit:';

export default function EditProcessoView({ tabKey }) {
  const vm = useEntityDetailVM(SOURCE_ID, tabKey, { editKeyPrefix: EDIT_PREFIX });
  return <RecordDetailSurface vm={vm} />;
}
`;

/**
 * O STARTUP da extensão: roda uma vez ao carregar o escritório e REGISTRA SERVIÇOS no host. Aqui,
 * comandos de ⌘K próprios — "Novo processo (clone)", "Abrir Processos (clone)" e a busca dos registros
 * — todos abrindo as telas DA EXTENSÃO (não as nativas). Resolve a tela pelo `sourceId` no contexto do
 * comando, então acompanha a instalação. É a prova do conceito "extensão registra serviços via código".
 */
const STARTUP_SOURCE = `
import { Icon } from '@microteia/ui';

const SOURCE_ID = 'microteia:processo-clone';
const EDIT_PREFIX = 'processo-clone-edit:';
const LIST_KEY = 'processo-clone';
const GROUP = 'Processos (clone)';

export default function startup(host) {
  host.commands.register({
    group: GROUP,
    getItems(query, ctx) {
      const q = String(query || '').toLowerCase().trim();
      if (!q) return [];
      const screen = ctx.screenDefinitions.find((s) => (s.sourceId || s.id) === SOURCE_ID);
      if (!screen) return [];
      const icon = <Icon name="folder" size={16} />;
      const items = [];
      if ('novo processo clone'.indexOf(q) !== -1) {
        items.push({ id: 'proc-clone:new', title: 'Novo processo (clone)', group: GROUP, icon, onSelect: () => { ctx.openTab(EDIT_PREFIX + 'new'); ctx.close(); } });
      }
      if ('abrir processos clone'.indexOf(q) !== -1) {
        items.push({ id: 'proc-clone:list', title: 'Abrir Processos (clone)', group: GROUP, icon, onSelect: () => { ctx.openTab(LIST_KEY); ctx.close(); } });
      }
      for (const r of ctx.customRecords) {
        if (r.screenKey === screen.id && r.title && r.title.toLowerCase().indexOf(q) !== -1) {
          items.push({ id: 'proc-clone:' + r.id, title: r.title, subtitle: 'Processo (clone)', group: GROUP, icon, onSelect: () => { ctx.openTab(EDIT_PREFIX + r.id); ctx.close(); } });
        }
      }
      return items.slice(0, 9);
    },
  });

  host.mentions.register({
    key: 'processo-clone',
    label: 'Processo (clone)',
    description: 'Inserir link para um processo (clone)',
    icon: 'folder',
    search(query, ctx) {
      const screen = ctx.screenDefinitions.find((s) => (s.sourceId || s.id) === SOURCE_ID);
      if (!screen) return [];
      const q = String(query || '').toLowerCase().trim();
      return ctx.customRecords
        .filter((r) => r.screenKey === screen.id && r.title && (!q || r.title.toLowerCase().indexOf(q) !== -1))
        .slice(0, 20)
        .map((r) => ({ id: r.id, title: r.title, subtitle: 'Processo (clone)', tabKey: EDIT_PREFIX + r.id }));
    },
  });
}
`;

export const processoClonePlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.processo-clone',
    version: '1.0.0',
    kernel: '^1.0.0',
    name: 'Processo (clone)',
    description: 'Réplica independente da tela de Processos, construída inteiramente como extensão — prova de conceito da ponte de componentes.',
    publisher: { name: 'Microteia' },
    dependencies: { 'core.ui': '^1.0.0' },
    contributes: [
      nav({ key: 'processo-clone', label: 'Processos (clone)', icon: 'folder', order: 105 }),
      page({ key: 'processo-clone', title: 'Processos (clone)', icon: 'folder' }, 'processo-clone'),
      page({ key: '', keyPrefix: 'processo-clone-edit:', title: 'Editar processo', icon: 'folder' }, 'processo-clone-edit'),
    ],
  },
  summary:
    'Recria a tela de Processos como extensão: uma entidade própria (com campos, lookups coloridos, máscaras e validações, editável no Form Design) e uma tela em código com cards, filtros, badges e polos — independente do Processo nativo. Prova o que a ponte de componentes já permite construir.',
  overview: {
    type: 'stack',
    gap: 'lg',
    children: [
      {
        type: 'markdown',
        content:
          'A extensão **Processo (clone)** é uma **prova de conceito**: reproduz a tela de Processos do escritório usando apenas o mecanismo de extensões.\n\nEla traz a **própria entidade** — com os mesmos campos, lookups coloridos (Status, Fase), máscaras e validações — que aparece no **Form Design** como qualquer outra, e uma **tela em código** com cards, filtros e badges. Os dados são independentes dos Processos reais.',
      },
      {
        type: 'keyValue',
        items: [
          { label: 'Adiciona', value: 'Item "Processos (clone)" no menu' },
          { label: 'Entidade', value: 'Processo (clone) — editável no Form Design' },
          { label: 'Detalhe', value: 'Formulário nativo (campos, etiquetas, notas, documentos)' },
        ],
      },
      {
        type: 'banner',
        message: 'Os registros desta extensão são independentes: nada é compartilhado com os Processos nativos do escritório.',
        variant: 'info',
      },
    ],
  },
  workflows: [],
  screens: [PROCESSO_SCREEN],
  startup: STARTUP_SOURCE,
  views: [
    {
      key: 'processo-clone',
      title: 'Processos (clone)',
      icon: 'folder',
      source: PROCESSO_SOURCE,
    },
    {
      key: 'processo-clone-edit',
      title: 'Editar processo',
      icon: 'folder',
      source: EDIT_SOURCE,
    },
  ],
};
