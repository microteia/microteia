import PROCESSO_SOURCE from './views/processo/Cases.view.tsx?raw';
import STARTUP_SOURCE from './views/processo/startup.tsx?raw';
import type {
  LookupModuleTemplate,
  MarketplacePlugin,
  ScreenModuleTemplate,
  TemplateField,
} from '../../domain/entities/MarketplacePlugin';
import type { CustomFieldOption } from '../../domain/entities';
import { nav, page, surfaceWidget } from '../contributionBuilders';
import { themeTokensContribution } from '../../domain/schema/theme';

/**
 * As cores do vocabulário de Processo. Elas viviam no tema do núcleo, onde não tinham o que fazer:
 * "procedente é verde" é decisão DESTE domínio, e enquanto morava lá, remover Processos deixava a
 * cor órfã e acrescentar um domínio novo exigia um commit no kernel.
 *
 * `CASE_COLORS` é o PISO, e vale sob qualquer tema — inclusive um que o escritório escreveu ontem.
 * Os dois lados trazem o mesmo valor porque estas são cores de SIGNIFICADO, não de superfície; o
 * par existe para poderem divergir no dia em que um fundo muito claro ou muito escuro exigir.
 *
 * `CASE_COLORS_BY_THEME` é o afinamento para os temas que ESTE plugin conhece pelo nome. Declarar
 * uma entrada aqui não faz de Processos um tema: continua sendo Processos definindo as cores dele,
 * agora dizendo como elas se leem naquela paleta. É por isso que nenhum pacote de tema precisa
 * carregar `casePhaseSentence` dentro dele — o token tem um dono, e o dono responde por ele em todo
 * contexto.
 */
const CASE_COLORS: Record<string, string> = {
  caseStatusInProgress: '#3b82f6',
  caseStatusWon: '#10b981',
  caseStatusLost: '#ef4444',
  caseStatusSettlement: '#f59e0b',
  caseStatusArchived: '#6b7280',
  caseStatusSuspended: '#9ca3af',
  casePhaseInitial: '#38bdf8',
  casePhaseInstruction: '#3b82f6',
  casePhaseSentence: '#6c63ff',
  casePhaseAppeal: '#f97316',
  casePhaseExecution: '#22c55e',
  casePhaseArchived: '#6b7280',
};

const CASE_COLORS_BY_THEME: Record<string, Record<string, string>> = {
  dark: {
    casePhaseSentence: '#F56B3A',
    casePhaseAppeal: '#FF9A6E',
    casePhaseExecution: '#92C353',
    casePhaseArchived: '#8A8886',
  },
  white: {
    casePhaseSentence: '#5B7ED6',
    casePhaseAppeal: '#8896B3',
    casePhaseExecution: '#3D9970',
    casePhaseArchived: '#8896B3',
  },
  claude: {
    casePhaseSentence: '#DA7756',
    casePhaseAppeal: '#B5A48B',
    casePhaseExecution: '#5A8A6A',
    casePhaseArchived: '#A89884',
  },
  teams: {
    casePhaseSentence: '#6264A7',
    casePhaseAppeal: '#5C5C5C',
    casePhaseExecution: '#92C353',
    casePhaseArchived: '#8A8886',
  },
  kindle: {
    casePhaseSentence: '#8B6040',
    casePhaseAppeal: '#A08060',
    casePhaseExecution: '#4A7C59',
    casePhaseArchived: '#A08868',
  },
  themis: {
    caseStatusInProgress: '#3E6B8C',
    caseStatusWon: '#2F6B4F',
    caseStatusLost: '#C03B2D',
    caseStatusSettlement: '#B07D2B',
    caseStatusArchived: '#8C7F6F',
    caseStatusSuspended: '#A29383',
    casePhaseInitial: '#3E6B8C',
    casePhaseInstruction: '#4A5878',
    casePhaseSentence: '#6D2233',
    casePhaseAppeal: '#B08D3E',
    casePhaseExecution: '#2F6B4F',
    casePhaseArchived: '#A29383',
  },
  'themis-night': {
    caseStatusInProgress: '#7BA7C9',
    caseStatusWon: '#5FA37F',
    caseStatusLost: '#D96A5B',
    caseStatusSettlement: '#D2A455',
    caseStatusArchived: '#9A8C7E',
    caseStatusSuspended: '#7A6D62',
    casePhaseInitial: '#7BA7C9',
    casePhaseInstruction: '#8898BE',
    casePhaseSentence: '#B85C6E',
    casePhaseAppeal: '#C9A24B',
    casePhaseExecution: '#5FA37F',
    casePhaseArchived: '#9A8C7E',
  },
};

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

/**
 * O STARTUP da extensão: roda uma vez ao carregar o escritório e registra serviços no host — os
 * comandos de ⌘K ("Novo processo", "Abrir Processos", a busca dos registros) e a menção `@processo`
 * das anotações. Resolve a tela pelo `sourceId`, então acompanha a instalação.
 */

const CARD_STYLES = `
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
\`;

const Title = styled.h3\`
  font-size: \${({ theme }) => theme.fontSizes.md};
  font-weight: 600;
  color: \${({ theme }) => theme.colors.text};
\`;

const Empty = styled.div\`
  padding: \${({ theme }) => theme.spacing.lg};
  text-align: center;
  color: \${({ theme }) => theme.colors.textMuted};
  font-size: \${({ theme }) => theme.fontSizes.sm};
\`;
`;

/**
 * Os WIDGETS do Dashboard. O número de processos ativos e a lista dos mais recentes eram cartões
 * escritos no kernel; agora são desta extensão, que é quem sabe o que é um processo "Em Andamento".
 */
const PROCESSOS_NUMEROS_SOURCE = `
import { useMemo } from 'react';
import { styled } from 'styled-components';
import { useCollection, useOpenScreenList } from '@microteia/data';
${CARD_STYLES}
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

const Stat = styled.button\`
  background: none;
  border: none;
  padding: 0;
  text-align: left;
  cursor: pointer;
\`;

export default function ProcessosNumerosWidget() {
  const cases = useCollection('cases');
  const openList = useOpenScreenList();
  const ativos = useMemo(() => cases.filter((c) => c.status === 'Em Andamento').length, [cases]);

  return (
    <Card>
      <Head><Title>Processos</Title></Head>
      <Stat onClick={() => openList('cases', [{ key: 'status', values: ['Em Andamento'] }])}>
        <Value>{ativos}</Value>
        <Label>Em andamento</Label>
      </Stat>
    </Card>
  );
}
`;

const PROCESSOS_RECENTES_SOURCE = `
import { useMemo } from 'react';
import { styled } from 'styled-components';
import { Button } from '@microteia/ui';
import { useCollection, useOpenRecord, useOpenScreenList } from '@microteia/data';
import { formatDate } from '@microteia/format';
${CARD_STYLES}
const List = styled.div\`
  display: flex;
  flex-direction: column;
  gap: \${({ theme }) => theme.spacing.sm};
\`;

const Item = styled.div\`
  display: flex;
  align-items: center;
  gap: \${({ theme }) => theme.spacing.sm};
  padding: \${({ theme }) => theme.spacing.sm} \${({ theme }) => theme.spacing.md};
  border: 1px solid \${({ theme }) => theme.colors.border};
  border-radius: \${({ theme }) => theme.borderRadius.md};
  background: \${({ theme }) => theme.colors.background};
  cursor: pointer;
  &:hover { border-color: \${({ theme }) => theme.colors.primary}; }
\`;

const Info = styled.div\`
  flex: 1;
  min-width: 0;
\`;

const ItemTitle = styled.div\`
  font-size: \${({ theme }) => theme.fontSizes.sm};
  font-weight: 500;
  color: \${({ theme }) => theme.colors.text};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
\`;

const ItemSub = styled.div\`
  font-size: \${({ theme }) => theme.fontSizes.xs};
  color: \${({ theme }) => theme.colors.textMuted};
  font-family: \${({ theme }) => theme.fonts.mono};
\`;

const When = styled.span\`
  font-size: 10px;
  font-family: \${({ theme }) => theme.fonts.mono};
  color: \${({ theme }) => theme.colors.textMuted};
  flex-shrink: 0;
\`;

const time = (value) => {
  if (!value) return 0;
  const date = new Date(value);
  return isNaN(date.getTime()) ? 0 : date.getTime();
};

export default function ProcessosRecentesWidget() {
  const cases = useCollection('cases');
  const openRecord = useOpenRecord();
  const openList = useOpenScreenList();

  const items = useMemo(() => cases
    .filter((c) => c.status === 'Em Andamento')
    .slice()
    .sort((a, b) => time(b.createdAt) - time(a.createdAt))
    .slice(0, 5), [cases]);

  return (
    <Card>
      <Head>
        <Title>Processos Recentes</Title>
        <Button size="sm" variant="ghost" onClick={() => openList('cases', [{ key: 'status', values: ['Em Andamento'] }])}>
          Ver todos
        </Button>
      </Head>
      {items.length === 0 ? (
        <Empty>Nenhum processo ativo</Empty>
      ) : (
        <List>
          {items.map((item) => (
            <Item key={item.id} onClick={() => openRecord('cases', item.id)}>
              <Info>
                <ItemTitle>{item.title}</ItemTitle>
                <ItemSub>{item.caseNumber}</ItemSub>
              </Info>
              {item.filedAt ? <When>{formatDate(item.filedAt)}</When> : null}
            </Item>
          ))}
        </List>
      )}
    </Card>
  );
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
      'core.theme': '^1.0.0',
      'com.microteia.pessoa': { version: '^1.0.0', collections: ['persons'] },
      'com.microteia.contrato': { version: '^1.0.0', collections: ['contracts'] },
    },
    contributes: [
      themeTokensContribution('case-colors', { light: CASE_COLORS, dark: CASE_COLORS, themes: CASE_COLORS_BY_THEME }),
      nav({ key: 'processos', label: 'Processos', icon: 'folder', order: 105 }),
      page({ key: 'processos', title: 'Processos', icon: 'folder' }, 'processos'),
      surfaceWidget({ surface: 'dashboard', key: 'processo.numeros', title: 'Processos em números', description: 'Quantos processos estão em andamento.', icon: 'folder', defaultSpan: 1, order: 10 }, 'widget-processos-numeros'),
      surfaceWidget({ surface: 'dashboard', key: 'processo.recentes', title: 'Processos recentes', description: 'Os últimos processos cadastrados que seguem em andamento.', icon: 'folder', defaultSpan: 1, order: 60 }, 'widget-processos-recentes'),
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
    { key: 'widget-processos-numeros', title: 'Processos em números', icon: 'folder', source: PROCESSOS_NUMEROS_SOURCE },
    { key: 'widget-processos-recentes', title: 'Processos recentes', icon: 'folder', source: PROCESSOS_RECENTES_SOURCE },
  ],
};
