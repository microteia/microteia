import type {
  LookupModuleTemplate,
  MarketplacePlugin,
  ScreenModuleTemplate,
  TemplateField,
} from '../../domain/entities/MarketplacePlugin';
import type { CustomFieldOption } from '../../domain/entities';
import { nav, page } from '../contributionBuilders';

/**
 * **Processo** — a entidade de processo judicial do escritório, inteira, declarada por extensão: os
 * campos, as listas de opções (com as opções de partida), as relações, as etiquetas, o cartão da
 * listagem, os filtros, o prefixo dos eventos de automação e quem pode gravar. O kernel não precisa
 * conhecer nada disso.
 *
 * `dataCollection: 'cases'` aponta para a coleção onde os processos já estão — a entidade muda de
 * dono sem que um registro se mova, e sem renomear os eventos (`case.saved`) que as automações do
 * escritório escutam.
 *
 * O `sourceId` estável é o elo entre a tela instalada e as views: elas resolvem a tela por ele,
 * imunes a qualquer desambiguação da chave instalada.
 */
const SOURCE_ID = 'microteia:processo';

const IDENTIFICACAO = 'Identificação';
const CLASSIFICACAO = 'Classificação';
const TRIBUNAL = 'Tribunal';
const FINANCEIRO = 'Financeiro e Responsável';
const PARTES = 'Partes';

/**
 * `listIcon` + `listOrder` dizem quais campos viram linha do cartão e em que ordem — o responsável é
 * a primeira linha, embora seja um dos últimos campos do formulário.
 */
const FIELDS: TemplateField[] = [
  { key: 'caseNumber', label: 'Número do processo', type: 'text', required: true, order: 2, section: IDENTIFICACAO },
  { key: 'title', label: 'Título', type: 'text', required: true, order: 3, section: IDENTIFICACAO },
  { key: 'area', label: 'Área', type: 'select', required: false, order: 4, section: CLASSIFICACAO, lookupCollection: 'caseAreas', optionsAllowUserAdd: true, showInList: true, listIcon: 'scales', listOrder: 1, filterable: true },
  { key: 'type', label: 'Tipo de ação', type: 'select', required: false, order: 5, section: CLASSIFICACAO, lookupCollection: 'caseActionTypes', optionsAllowUserAdd: true, multi: true, filterable: true },
  { key: 'phase', label: 'Fase', type: 'select', required: false, order: 6, section: CLASSIFICACAO, lookupCollection: 'casePhases', optionsAllowUserAdd: true, filterable: true },
  { key: 'status', label: 'Status', type: 'select', required: false, order: 7, section: CLASSIFICACAO, lookupCollection: 'caseStatuses', optionsAllowUserAdd: true, optionsColored: true, filterable: true },
  { key: 'instance', label: 'Instância', type: 'select', required: false, order: 8, section: TRIBUNAL, lookupCollection: 'caseInstances', optionsAllowUserAdd: true, showInList: true, listIcon: 'scales', listOrder: 2, filterable: true },
  { key: 'court', label: 'Vara/Tribunal', type: 'select', required: false, order: 9, section: TRIBUNAL, lookupCollection: 'caseCourts', optionsAllowUserAdd: true, showInList: true, listIcon: 'scales', listOrder: 3, filterable: true },
  { key: 'courtDistrict', label: 'Comarca', type: 'select', required: false, order: 10, section: TRIBUNAL, lookupCollection: 'caseDistricts', optionsAllowUserAdd: true, filterable: true },
  { key: 'judge', label: 'Juiz(a)', type: 'select', required: false, order: 11, section: TRIBUNAL, lookupCollection: 'caseJudges', optionsAllowUserAdd: true, filterable: true },
  { key: 'filedAt', label: 'Data de distribuição', type: 'date', required: false, order: 12, section: TRIBUNAL, filterable: true },
  { key: 'causeValue', label: 'Valor da causa', type: 'currency', required: false, order: 13, section: FINANCEIRO, showInList: true, listIcon: 'moneyDollar', listOrder: 4 },
  { key: 'responsibleLawyerId', label: 'Advogado responsável', type: 'reference', required: false, order: 14, section: FINANCEIRO, refEntity: 'persons', placeholder: 'Selecione o responsável...', showInList: true, listIcon: 'scales', listOrder: 0, filterable: true },
  { key: 'contractId', label: 'Contrato', type: 'reference', required: false, order: 15, section: FINANCEIRO, refEntity: 'contracts', placeholder: 'Selecione o contrato...', filterable: true },
  { key: 'notes', label: 'Observações', type: 'textarea', required: false, order: 16, section: FINANCEIRO },
  { key: 'activePoleIds', label: 'Polo ativo', type: 'reference', required: false, order: 0, section: PARTES, refEntity: 'persons', multi: true, placeholder: 'Selecione as pessoas...', filterable: true },
  { key: 'passivePoleIds', label: 'Polo passivo', type: 'reference', required: false, order: 1, section: PARTES, refEntity: 'persons', multi: true, placeholder: 'Selecione as pessoas...', filterable: true },
];

const opts = (labels: string[]): CustomFieldOption[] => labels.map((label) => ({ key: label, label }));

const colored = (entries: [string, string][]): CustomFieldOption[] =>
  entries.map(([label, color]) => ({ key: label, label, color }));

/**
 * As listas de opções que os campos referenciam, com as opções de PARTIDA. São semeadas só quando a
 * lista está vazia no escritório: dali em diante as opções são dele — acrescentar, renomear e
 * remover valem, e nem a atualização nem a remoção da extensão as toca. As cores são nomes de token
 * do tema, resolvidos pela aplicação.
 */
const LOOKUPS: LookupModuleTemplate[] = [
  {
    collection: 'caseAreas',
    label: 'Processo: Área do Direito',
    options: opts([
      'Cível', 'Criminal', 'Trabalhista', 'Tributário', 'Família', 'Consumidor', 'Administrativo',
      'Constitucional', 'Ambiental', 'Imobiliário', 'Empresarial', 'Digital', 'Outros',
    ]),
  },
  {
    collection: 'casePhases',
    label: 'Processo: Fase Processual',
    options: colored([
      ['Fase Inicial', 'casePhaseInitial'],
      ['Instrução', 'casePhaseInstruction'],
      ['Sentença', 'casePhaseSentence'],
      ['Recurso', 'casePhaseAppeal'],
      ['Execução', 'casePhaseExecution'],
      ['RPV', 'casePhaseExecution'],
      ['Precatório', 'casePhaseExecution'],
      ['Arquivado', 'casePhaseArchived'],
    ]),
  },
  {
    collection: 'caseStatuses',
    label: 'Processo: Status',
    options: colored([
      ['Em Andamento', 'caseStatusInProgress'],
      ['Procedente', 'caseStatusWon'],
      ['Procedente em Parte', 'caseStatusWon'],
      ['Improcedente', 'caseStatusLost'],
      ['Acordo', 'caseStatusSettlement'],
      ['Arquivado', 'caseStatusArchived'],
      ['Suspenso', 'caseStatusSuspended'],
      ['Extinto', 'caseStatusLost'],
      ['Rejeitado', 'caseStatusArchived'],
    ]),
  },
  {
    collection: 'caseInstances',
    label: 'Processo: Instância',
    options: opts(['1º Grau', '2º Grau', 'Turma Recursal', 'STJ', 'STF', 'TST', 'TSE']),
  },
  { collection: 'caseActionTypes', label: 'Processo: Tipo de Ação' },
  { collection: 'caseCourts', label: 'Processo: Vara/Tribunal' },
  { collection: 'caseDistricts', label: 'Processo: Comarca' },
  { collection: 'caseJudges', label: 'Processo: Juiz(a)' },
];

const PROCESSO_SCREEN: ScreenModuleTemplate = {
  key: 'processos',
  sourceId: SOURCE_ID,
  sourceRev: 6,
  titleSingular: 'Processo',
  titlePlural: 'Processos',
  icon: 'folder',
  dataCollection: 'cases',
  fields: FIELDS,
  titleFieldKey: 'title',
  // O número do processo é o subtítulo: aparece sob o título no cabeçalho do detalhe e na linha
  // sob o título do cartão. O rótulo da ABA é o título, como em toda tela.
  subtitleFieldKey: 'caseNumber',
  hasNotes: true,
  hasDocuments: true,
  hasTags: true,
  tagCollection: 'caseTags',
  // Os eventos que as automações escutam continuam sendo `case.saved`/`case.deleted`.
  eventPrefix: 'case',
  // Sem `recordTabPrefix`: o detalhe é o GENÉRICO (`view-dyn:processos:{id}`). O formulário que o
  // schema monta é idêntico ao que a extensão desenhava em código — manter um editor próprio só
  // duplicaria a mesma tela. O que a extensão ainda desenha é o CARTÃO da listagem, que o genérico
  // não tem como adivinhar (polos, chip de dias em trâmite).
  // Processo não é cadastro de rotina: secretária lê, advogado e admin gravam.
  writeRoles: ['admin', 'lawyer'],
  listActions: ['copyLink', 'clone', 'manageTags', 'delete'],
  // O Contrato MOSTRA os processos ligados a ele, numa aba do registro dele. `related` (e não a
  // posse) é o que mantém Processos uma tela de topo, com menu, busca e o campo "Contrato" no
  // formulário — é por ele que se liga e desliga um processo de um contrato.
  parentEntity: 'contracts',
  parentFieldKey: 'contractId',
  parentRelation: 'related',
  sidebarOrder: 0,
  hideFromSidebar: true,
};

/**
 * A listagem. `RecordListSurface` + `useEntityList` trazem título, filtros, meta-linhas do cartão,
 * etiquetas e ações da CONFIGURAÇÃO da tela; a view injeta pelos slots só o que é exclusivo do
 * Processo: o número com o chip de dias em trâmite, os badges de Status/Fase e o quadro de polos.
 * As cores dos badges saem das listas de opções do escritório — nenhuma cor fixa aqui.
 */
const PROCESSO_SOURCE = `
import { useMemo } from 'react';
import { styled, useTheme } from 'styled-components';
import { RecordListSurface, Badge, InfoBanner } from '@microteia/ui';
import { useCollection, useEntityList, useLookup } from '@microteia/data';
import { getConfigColor } from '@microteia/theme';

const SOURCE_ID = 'microteia:processo';

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

const CaseNumberRow = styled.div\`
  display: flex;
  align-items: center;
  gap: \${({ theme }) => theme.spacing.xs};
  margin-top: 2px;
  min-width: 0;
\`;

const CaseNumber = styled.div\`
  font-size: \${({ theme }) => theme.fontSizes.xs};
  color: \${({ theme }) => theme.colors.textMuted};
  font-family: \${({ theme }) => theme.fonts.mono};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
\`;

const DaysChip = styled.span\`
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  margin-left: auto;
  padding: 1px 6px;
  border-radius: \${({ theme }) => theme.borderRadius.full};
  font-size: 10px;
  font-weight: 500;
  font-family: \${({ theme }) => theme.fonts.mono};
  background: \${({ theme }) => theme.colors.surfaceHover};
  color: \${({ theme }) => theme.colors.textMuted};
  border: 1px solid \${({ theme }) => theme.colors.border};
  white-space: nowrap;
\`;

const asArray = (v) => Array.isArray(v) ? v : (v == null || v === '' ? [] : [v]);

function daysSince(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value).slice(0, 10) + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  return diff < 0 ? 0 : diff;
}

export default function ProcessosView() {
  const theme = useTheme();
  const list = useEntityList(SOURCE_ID);
  const persons = useCollection('persons');
  const statusOptions = useLookup('caseStatuses');
  const phaseOptions = useLookup('casePhases');

  const personById = useMemo(() => {
    const map = {};
    for (const p of persons) map[p.id] = p;
    return map;
  }, [persons]);

  if (!list.definition) {
    return <div style={{ padding: '24px' }}><InfoBanner message='Tela "Processos" não encontrada. Instale a extensão para ativá-la.' variant="warning" /></div>;
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

  const renderSubtitle = (record) => {
    if (!record.caseNumber) return undefined;
    const days = daysSince(record.filedAt);
    return (
      <CaseNumberRow>
        <CaseNumber>{record.caseNumber}</CaseNumber>
        {days != null ? <DaysChip>{days} dias</DaysChip> : null}
      </CaseNumberRow>
    );
  };

  const renderBelowHeader = (record) => {
    const active = namesOf(record.activePoleIds);
    const passive = namesOf(record.passivePoleIds);
    return (
      <>
        <Badges>
          {record.status ? <Badge color={getConfigColor(statusOptions, record.status, theme)}>{record.status}</Badge> : null}
          {record.phase ? <Badge color={getConfigColor(phaseOptions, record.phase, theme)}>{record.phase}</Badge> : null}
        </Badges>
        {active.length > 0 || passive.length > 0 ? (
          <PartesRow>
            {renderPole('Polo Ativo', active, 'left')}
            {renderPole('Polo Passivo', passive, 'right')}
          </PartesRow>
        ) : null}
      </>
    );
  };

  return (
    <RecordListSurface
      vm={list}
      definition={list.definition}
      renderSubtitle={renderSubtitle}
      renderBelowHeader={renderBelowHeader}
      emptyTitle="Nenhum processo encontrado"
      emptyActionLabel="Cadastrar primeiro processo"
    />
  );
}
`;

/**
 * O STARTUP da extensão: roda uma vez ao carregar o escritório e registra serviços no host — os
 * comandos de ⌘K ("Novo processo", "Abrir Processos", a busca dos registros) e a menção `@processo`
 * das anotações. Resolve a tela pelo `sourceId`, então acompanha a instalação.
 */
const STARTUP_SOURCE = `
import { Icon } from '@microteia/ui';

const SOURCE_ID = 'microteia:processo';
const LIST_KEY = 'processos';
const GROUP = 'Processos';

const viewKey = (screen, id) => 'view-dyn:' + screen.id + ':' + id;

const screenOf = (ctx) => ctx.screenDefinitions.find((s) => (s.sourceId || s.id) === SOURCE_ID);
const textOf = (record, key) => (key && typeof record[key] === 'string' ? record[key] : '');

/**
 * Aqui a busca casa o TÍTULO **e o SUBTÍTULO**: o subtítulo do processo é o NÚMERO, e procurar um
 * processo pelo número é tão comum quanto pelo título. Nas demais telas o subtítulo é classificação
 * (o tipo da pessoa, o do lançamento) e casá-lo devolveria o cadastro inteiro — por isso a escolha é
 * de cada extensão, e não uma regra do kernel.
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
      const icon = <Icon name="folder" size={16} />;
      const items = [];
      if ('novo processo'.indexOf(q) !== -1) {
        items.push({ id: 'processo:new', title: 'Novo processo', group: GROUP, icon, onSelect: () => { ctx.openTab('new-dyn:' + screen.id); ctx.close(); } });
      }
      if ('abrir processos'.indexOf(q) !== -1) {
        items.push({ id: 'processo:list', title: 'Abrir Processos', group: GROUP, icon, onSelect: () => { ctx.openTab(LIST_KEY); ctx.close(); } });
      }
      for (const r of recordsOf(ctx, screen)) {
        if (!matches(r, screen, q)) continue;
        items.push({
          id: 'processo:' + r.id,
          title: textOf(r, screen.titleFieldKey),
          subtitle: textOf(r, screen.subtitleFieldKey) || 'Processo',
          group: GROUP,
          icon,
          onSelect: () => { ctx.openTab(viewKey(screen, r.id)); ctx.close(); },
        });
      }
      return items.slice(0, 9);
    },
  });

  host.mentions.register({
    key: 'processo',
    label: 'Processo',
    description: 'Inserir link para um processo',
    icon: 'folder',
    search(query, ctx) {
      const screen = screenOf(ctx);
      if (!screen) return [];
      const q = String(query || '').toLowerCase().trim();
      const collection = screen.dataCollection || screen.id;
      return ctx.records
        .filter((r) => r.collection === collection)
        .map((r) => ({ record: r, title: r[screen.titleFieldKey] }))
        .filter(({ title }) => title && (!q || title.toLowerCase().indexOf(q) !== -1))
        .slice(0, 20)
        .map(({ record, title }) => ({ id: record.id, title, subtitle: 'Processo', tabKey: viewKey(screen, record.id) }));
    },
  });
}
`;

export const processoPlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.processo',
    version: '2.3.1',
    kernel: '^1.0.0',
    name: 'Processos',
    description: 'A tela de Processos recriada como extensão, sobre os MESMOS processos do escritório — o caminho de migração de uma tela fixa para o modelo de extensão.',
    publisher: { name: 'Microteia' },
    // Processo APONTA para pessoas (responsável, polo ativo, polo passivo): a coleção `persons` vem
    // da extensão de Pessoas, e é ela que precisa estar instalada para esses campos terem o que
    // oferecer. `collections` é o que liga o nome global da coleção a quem a instala.
    dependencies: {
      'core.ui': '^1.0.0',
      'com.microteia.pessoa': { version: '^1.0.0', collections: ['persons'] },
      'com.microteia.contrato': { version: '^1.0.0', collections: ['contracts'] },
    },
    contributes: [
      nav({ key: 'processos', label: 'Processos', icon: 'folder', order: 105 }),
      page({ key: 'processos', title: 'Processos', icon: 'folder' }, 'processos'),
    ],
  },
  summary:
    'A tela de Processos do escritório: cadastro completo com número, partes (polo ativo e passivo), área, fase, status, instância, vara, comarca, juiz, valor da causa, advogado responsável e contrato — com etiquetas, anotações e documentos por processo.',
  overview: {
    type: 'stack',
    gap: 'lg',
    children: [
      {
        type: 'markdown',
        content:
          'A extensão **Processos** traz o controle de processos judiciais do escritório: cada processo com número, partes, classificação, tribunal, valor da causa e responsável, além de etiquetas, anotações e documentos.\n\nAs listas de Área, Fase, Status, Instância, Vara, Comarca e Juiz já vêm preenchidas e são suas: acrescente, renomeie ou remova opções à vontade — elas ficam no escritório mesmo que a extensão seja removida.',
      },
      {
        type: 'keyValue',
        items: [
          { label: 'Adiciona', value: 'Item "Processos" no menu' },
          { label: 'Cadastro', value: '17 campos, em 5 seções' },
          { label: 'Por processo', value: 'Etiquetas, anotações e documentos' },
          { label: 'Quem grava', value: 'Advogado e administrador' },
        ],
      },
      {
        type: 'banner',
        message: 'Remover a extensão remove a tela, nunca os processos: os registros, as listas de opções e as etiquetas continuam no escritório e voltam a aparecer se ela for instalada de novo.',
        variant: 'info',
      },
    ],
  },
  workflows: [],
  screens: [PROCESSO_SCREEN],
  lookups: LOOKUPS,
  tagLists: [{ collection: 'caseTags', label: 'Etiquetas: Processos' }],
  startup: STARTUP_SOURCE,
  views: [
    {
      key: 'processos',
      title: 'Processos',
      icon: 'folder',
      source: PROCESSO_SOURCE,
    },
  ],
};
