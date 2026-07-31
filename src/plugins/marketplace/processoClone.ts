import type { MarketplacePlugin, ScreenModuleTemplate, TemplateField } from '../../domain/entities/MarketplacePlugin';
import { nav, page } from '../contributionBuilders';

/**
 * "Processo (clone)" — a tela de Processos recriada inteiramente como Extensão, SOBRE OS MESMOS
 * DADOS: `dataCollection: 'cases'` aponta a tela para a coleção onde os processos do escritório já
 * estão, e o pacote declara o ESQUEMA INTEIRO dessa coleção (campos, listas de opções, relações,
 * seções, linhas do card e filtros).
 *
 * As duas declarações — a desta extensão e a do `entityRegistry` — descrevem hoje a mesma coleção e
 * se sobrepõem campo a campo, sem conflito. Esse é o ponto: **o dia em que `cases` sair do kernel,
 * nada aqui muda e nenhum registro se move.** Basta a tela deixar de ser uma visão e passar a se
 * chamar `cases` (a chave deixa de ser reservada quando a entidade sai). Se, em vez disso, o pacote
 * herdasse os campos do registro, a extensão morreria junto com a entidade nativa — e a migração
 * não existiria.
 *
 * Enquanto as duas convivem: os ajustes do escritório na tela de Processos (Form Design) continuam
 * prevalecendo sobre o que o pacote declara, e os campos personalizados que ele acrescentou a
 * Processos aparecem aqui também.
 *
 * O `sourceId` estável é o elo entre a tela instalada e as views: elas resolvem a tela por ele,
 * imunes a qualquer desambiguação da chave instalada.
 */
const SOURCE_ID = 'microteia:processo-clone';

const IDENTIFICACAO = 'Identificação';
const CLASSIFICACAO = 'Classificação';
const TRIBUNAL = 'Tribunal';
const FINANCEIRO = 'Financeiro e Responsável';
const PARTES = 'Partes';

/**
 * O esquema da coleção, declarado por extensão. Cada `lookupCollection` aponta para uma lista de
 * opções do escritório — as MESMAS que a tela nativa usa, com as mesmas cores —, e `listIcon` +
 * `listOrder` dizem quais campos viram linha do card e em que ordem (o responsável vem primeiro no
 * card, embora seja um dos últimos campos do formulário). Nada aqui é cópia de dado: listas de
 * opções e etiquetas são do escritório e sobrevivem à desinstalação.
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

const PROCESSO_SCREEN: ScreenModuleTemplate = {
  key: 'processo-clone',
  sourceId: SOURCE_ID,
  sourceRev: 2,
  titleSingular: 'Processo (clone)',
  titlePlural: 'Processos (clone)',
  icon: 'folder',
  // A coleção onde os processos do escritório já estão. Não é cópia nem espelho: é a mesma.
  dataCollection: 'cases',
  fields: FIELDS,
  titleFieldKey: 'title',
  // O número do processo: subtítulo no cabeçalho do detalhe e rótulo da aba — curto e único, cabe
  // na aba melhor do que o título. Mesma escolha da tela nativa.
  subtitleFieldKey: 'caseNumber',
  hasNotes: true,
  hasDocuments: true,
  hasTags: true,
  // As etiquetas de Processo, declaradas para que a tela continue tendo etiquetas quando a
  // entidade sair do kernel — hoje é exatamente o que o registro aponta.
  tagCollection: 'caseTags',
  listActions: ['copyLink', 'clone', 'manageTags', 'delete'],
  sidebarOrder: 0,
  hideFromSidebar: true,
};

/**
 * A view de código (lista rica). Escrita SÓ contra `@microteia/*`, `react` e `styled-components`.
 *
 * Aqui está o ponto da prova: em vez de remontar a lista na mão, ela REUTILIZA a mesma superfície
 * padrão das telas nativas — `RecordListSurface`, alimentada por `useEntityList(sourceId)`. Com isso
 * o TÍTULO, os FILTROS (com cor), as META-LINHAS do card (área, instância, vara, valor da causa e o
 * advogado responsável — derivadas do `ui.list` da própria entidade `cases`), as ETIQUETAS e as
 * AÇÕES vêm todos da CONFIGURAÇÃO: a extensão não fixa nada.
 *
 * A view só injeta o que a arquitetura reserva aos SLOTS por ser exclusivo desta tela: o subtítulo
 * (número do processo + chip de dias em trâmite), os badges coloridos de Status/Fase e o quadro de
 * polos — os mesmos três pedaços que a tela nativa injeta, com o mesmo CSS, todo ele em tokens do
 * tema. As cores de Status/Fase saem das listas de opções do escritório (`caseStatuses`,
 * `casePhases`), como na nativa: nada de cor fixa no código da extensão.
 */
const PROCESSO_SOURCE = `
import { useMemo } from 'react';
import { styled, useTheme } from 'styled-components';
import { RecordListSurface, Badge, InfoBanner } from '@microteia/ui';
import { useEntityList, useLookup, usePersons, useWorkspace } from '@microteia/data';
import { getConfigColor } from '@microteia/theme';

const SOURCE_ID = 'microteia:processo-clone';
const EDIT_PREFIX = 'processo-clone-edit:';

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

export default function ProcessoCloneView() {
  const theme = useTheme();
  const list = useEntityList(SOURCE_ID, { editKeyPrefix: EDIT_PREFIX });
  const persons = usePersons();
  const statusOptions = useLookup('caseStatuses');
  const phaseOptions = useLookup('casePhases');
  const { openTab } = useWorkspace();

  const personById = useMemo(() => {
    const map = {};
    for (const p of persons) map[p.id] = p;
    return map;
  }, [persons]);

  if (!list.definition) {
    return <div style={{ padding: '24px' }}><InfoBanner message='Tela "Processos (clone)" não encontrada. Instale a extensão para ativá-la.' variant="warning" /></div>;
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
      const collection = screen.dataCollection || screen.id;
      for (const r of ctx.records) {
        const title = r[screen.titleFieldKey];
        if (r.collection === collection && title && title.toLowerCase().indexOf(q) !== -1) {
          items.push({ id: 'proc-clone:' + r.id, title, subtitle: 'Processo (clone)', group: GROUP, icon, onSelect: () => { ctx.openTab(EDIT_PREFIX + r.id); ctx.close(); } });
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
      const collection = screen.dataCollection || screen.id;
      return ctx.records
        .filter((r) => r.collection === collection)
        .map((r) => ({ record: r, title: r[screen.titleFieldKey] }))
        .filter(({ title }) => title && (!q || title.toLowerCase().indexOf(q) !== -1))
        .slice(0, 20)
        .map(({ record, title }) => ({ id: record.id, title, subtitle: 'Processo (clone)', tabKey: EDIT_PREFIX + record.id }));
    },
  });
}
`;

export const processoClonePlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.processo-clone',
    version: '2.0.0',
    kernel: '^1.0.0',
    name: 'Processo (clone)',
    description: 'A tela de Processos recriada como extensão, sobre os MESMOS processos do escritório — o caminho de migração de uma tela fixa para o modelo de extensão.',
    publisher: { name: 'Microteia' },
    dependencies: { 'core.ui': '^1.0.0' },
    contributes: [
      nav({ key: 'processo-clone', label: 'Processos (clone)', icon: 'folder', order: 105 }),
      page({ key: 'processo-clone', title: 'Processos (clone)', icon: 'folder' }, 'processo-clone'),
      page({ key: '', keyPrefix: 'processo-clone-edit:', title: 'Editar processo', icon: 'folder' }, 'processo-clone-edit'),
    ],
  },
  summary:
    'Recria a tela de Processos como extensão SOBRE OS MESMOS DADOS: a tela é uma visão da entidade Processo, com os campos, as listas de opções, as etiquetas, as anotações e os documentos que já existem. Cards, filtros e ações vêm da configuração; o subtítulo, os badges e os polos, da tela em código. Prova que uma tela fixa pode virar extensão sem migrar um único registro.',
  overview: {
    type: 'stack',
    gap: 'lg',
    children: [
      {
        type: 'markdown',
        content:
          'A extensão **Processo (clone)** reproduz a tela de Processos do escritório usando apenas o mecanismo de extensões — e trabalhando **nos mesmos processos**.\n\nNada é duplicado: os registros, as listas de opções (Área, Fase, Status…), as etiquetas, as anotações e os documentos são os do Processo de sempre. Abrir a tela nova é ver os mesmos dados, com a mesma aparência.',
      },
      {
        type: 'keyValue',
        items: [
          { label: 'Adiciona', value: 'Item "Processos (clone)" no menu' },
          { label: 'Dados', value: 'Os processos do escritório — sem cópia' },
          { label: 'Detalhe', value: 'Formulário nativo (campos, etiquetas, notas, documentos)' },
        ],
      },
      {
        type: 'banner',
        message: 'Esta tela trabalha nos processos reais do escritório: o que você criar, alterar ou excluir aqui vale também na tela de Processos. Remover a extensão remove apenas a tela — nenhum processo é apagado.',
        variant: 'warning',
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
