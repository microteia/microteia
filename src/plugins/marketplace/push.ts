import type {
  ActionModuleTemplate,
  LookupModuleTemplate,
  MarketplacePlugin,
  ScreenModuleTemplate,
  TemplateField,
  WorkflowModuleTemplate,
} from '../../domain/entities/MarketplacePlugin';
import type { CustomFieldOption } from '../../domain/entities';
import type { WorkflowStep } from '../../domain/entities/Workflow';
import { nav, page } from '../contributionBuilders';

/**
 * **Pushes do Tribunal** — os e-mails de intimação que o escritório recebe, declarados por extensão.
 *
 * A entidade mais estranha a sair do kernel, e por isso a que mais o exercitou: os registros NÃO são
 * criados por ninguém na tela — quem os escreve é a ingestão do Gmail, no servidor. Daí três coisas
 * novas terem nascido com ela: o SELO do item de menu (uma contagem declarada, para o menu avisar que
 * há intimação esperando triagem), a listagem SEM botão de "novo", e a ação que PERGUNTA antes de
 * executar — que é o que devolve o formulário de "Gerar prazo".
 *
 * `dataCollection: 'pushes'` aponta para a coleção onde os pushes já estão, e `eventPrefix: 'push'`
 * mantém `push.saved` como nome do evento: nada se move, e as automações que já o escutam seguem
 * valendo.
 */
const SOURCE_ID = 'microteia:push';

const MENSAGEM = 'Mensagem';
const PROCESSO = 'Processo';
const TRIAGEM = 'Triagem';

/**
 * Os campos que a INGESTÃO grava. A declaração descreve o que já existe no banco — não é um esquema
 * novo, e por isso as chaves são as do documento (`processNumber`, e não `caseNumber`).
 *
 * `emailBodyHtml` e `emailBodyText` ficam de fora de propósito: são o corpo inteiro do e-mail, que a
 * listagem lê direto do registro para exibir na moldura isolada. Declará-los como campos os colocaria
 * no formulário e nos filtros, onde não servem a ninguém.
 */
const FIELDS: TemplateField[] = [
  { key: 'subject', label: 'Assunto', type: 'text', required: false, order: 0, section: MENSAGEM, filterable: true },
  { key: 'from', label: 'Remetente', type: 'text', required: false, order: 1, section: MENSAGEM, filterable: true },
  { key: 'to', label: 'Destinatário', type: 'text', required: false, order: 2, section: MENSAGEM },
  { key: 'receivedAt', label: 'Recebido em', type: 'date', required: false, order: 3, section: MENSAGEM, filterable: true },
  { key: 'processNumber', label: 'Número do processo', type: 'text', required: false, order: 4, section: PROCESSO, filterable: true },
  { key: 'court', label: 'Tribunal', type: 'text', required: false, order: 5, section: PROCESSO, filterable: true },
  { key: 'activeParty', label: 'Polo ativo', type: 'text', required: false, order: 6, section: PROCESSO },
  { key: 'passiveParty', label: 'Polo passivo', type: 'text', required: false, order: 7, section: PROCESSO },
  { key: 'legalClass', label: 'Classe judicial', type: 'text', required: false, order: 8, section: PROCESSO },
  { key: 'processSubject', label: 'Assunto do processo', type: 'text', required: false, order: 9, section: PROCESSO },
  { key: 'distributionType', label: 'Tipo de distribuição', type: 'text', required: false, order: 10, section: PROCESSO },
  { key: 'filingDate', label: 'Data de autuação', type: 'date', required: false, order: 11, section: PROCESSO },
  { key: 'status', label: 'Situação', type: 'select', required: false, order: 12, section: TRIAGEM, lookupCollection: 'pushStatuses', optionsColored: true, filterable: true },
  { key: 'parsedByAI', label: 'Extraído por IA', type: 'checkbox', required: false, order: 13, section: TRIAGEM, filterable: true },
  { key: 'parsingError', label: 'Erro de processamento', type: 'textarea', required: false, order: 14, section: TRIAGEM },
];

const colored = (entries: [string, string, string][]): CustomFieldOption[] =>
  entries.map(([key, label, color]) => ({ key, label, color }));

/**
 * As situações de um push. Note que a CHAVE é o valor em inglês (`pending`) e o rótulo é o que se lê
 * na tela: é o que está gravado nos documentos desde a primeira ingestão, e a lista descreve o banco
 * como ele é — renomear as chaves aqui deixaria todo push existente sem situação reconhecível.
 */
const LOOKUPS: LookupModuleTemplate[] = [
  {
    collection: 'pushStatuses',
    label: 'Push: Situação',
    options: colored([
      ['pending', 'Pendente', 'warning'],
      ['reviewed', 'Revisado', 'success'],
      ['archived', 'Arquivado', 'textSecondary'],
      ['fault', 'Falha', 'danger'],
    ]),
  },
];

const map = (id: string, order: number, name: string, fields: { name: string; value: unknown }[]): WorkflowStep => ({
  id,
  stepDefinitionId: 'map',
  type: 'Action',
  order,
  enabled: true,
  configuration: { map: { kind: 'Literal', value: { name, fields } } },
});

const literal = (value: unknown) => ({ kind: 'Literal' as const, value });
const expression = (expr: string) => ({ kind: 'Expression' as const, expression: expr });

const upsert = (id: string, order: number, table: string, property: string): WorkflowStep => ({
  id,
  stepDefinitionId: 'upsert',
  type: 'Action',
  order,
  enabled: true,
  configuration: { upsert: literal({ table, source: 'input', property }) },
});

/**
 * **Triagem** — um único fluxo para "Revisado" e "Arquivar", separados pela CHAVE que cada Action
 * entrega no parâmetro `action`. É para isso que a chave existe e é para isso que ela pode repetir:
 * duas ações, um fluxo, e a diferença entre elas cabe num ramo.
 */
const TRIAGEM_WORKFLOW: WorkflowModuleTemplate = {
  templateId: 'wf-push-triagem',
  name: 'Triar push',
  description: 'Marca o push como Revisado ou Arquivado, conforme a ação que chamou o fluxo.',
  eventName: 'workflow.called',
  version: 1,
  condition: { kind: 'AlwaysTrue' },
  steps: [
    {
      id: 'arquivando',
      stepDefinitionId: '',
      type: 'Condition',
      order: 0,
      enabled: true,
      condition: { kind: 'Expression', expression: 'event.action == "push_arquivar"' },
      configuration: {},
      branches: {
        whenTrue: [
          map('comoArquivado', 0, '', [
            { name: 'novaSituacao', value: literal('archived') },
            { name: 'aviso', value: literal('Push arquivado.') },
          ]),
        ],
        whenFalse: [
          map('comoRevisado', 0, '', [
            { name: 'novaSituacao', value: literal('reviewed') },
            { name: 'aviso', value: literal('Push marcado como revisado.') },
          ]),
        ],
      },
    },
    map('montarPush', 1, 'push', [
      { name: 'id', value: expression('event.recordId') },
      { name: 'status', value: expression('input.novaSituacao') },
    ]),
    upsert('gravarPush', 2, 'pushes', 'push'),
    map('responder', 3, '', [
      { name: 'status', value: expression('input.aviso') },
      { name: 'actions', value: literal(['refresh']) },
    ]),
  ],
};

/**
 * **Gerar prazo a partir do push** — o que era um formulário escrito à mão dentro da tela de Pushes.
 *
 * Ele encontra o processo pelo NÚMERO (que é o que o e-mail traz) e para quando não acha: prazo
 * pendurado em processo inexistente é pior do que um erro na cara de quem clicou. Gravado o prazo, o
 * push vai junto para "Revisado" — quem gerou o prazo já triou a intimação, e obrigá-lo a um segundo
 * clique seria só cerimônia.
 *
 * O fluxo é da extensão de Pushes, e não da de Prazos, porque o gesto é do push: quem sabe que uma
 * intimação vira um prazo é quem lê intimação. O que vem da outra extensão é a COLEÇÃO (`deadlines`),
 * declarada como dependência — mesma relação que Prazos tem com Processos.
 */
const erro = (id: string, order: number, expr: string): WorkflowStep[] => [
  // A forma compacta do status de uma Action: `["ERROR", mensagem]`. O avaliador tem literal de
  // array e não de objeto, e é por isso que o par existe.
  map(`${id}Mensagem`, order, '', [
    { name: 'status', value: expression(`["ERROR", ${expr}]`) },
  ]),
  { id: `${id}Sair`, stepDefinitionId: 'exit', type: 'Action', order: order + 1, enabled: true, configuration: {} },
];

const GERAR_PRAZO_WORKFLOW: WorkflowModuleTemplate = {
  templateId: 'wf-push-gerar-prazo',
  name: 'Gerar prazo do push',
  description: 'Cria um prazo a partir de um push, encontrando o processo pelo número, e marca o push como revisado.',
  eventName: 'workflow.called',
  version: 1,
  condition: { kind: 'AlwaysTrue' },
  // Tipo e prioridade saem das MESMAS listas do campo do prazo (`deadlineTypes`,
  // `deadlinePriorities`), declaradas pela extensão de Prazos — a de quem o formulário depende. Copiar
  // as opções para dentro do fluxo era garantir que elas envelhecessem: o escritório acrescenta um
  // tipo na tela de Prazos e o formulário do push continuava oferecendo os quatro de fábrica.
  parameters: [
    { key: 'caseNumber', label: 'Número do processo', type: 'String', required: true },
    { key: 'type', label: 'Tipo de prazo', type: 'lookup', lookupCollection: 'deadlineTypes', required: true, defaultValue: 'Petição' },
    { key: 'dueDate', label: 'Data de vencimento', type: 'Date', required: true },
    { key: 'priority', label: 'Prioridade', type: 'lookup', lookupCollection: 'deadlinePriorities', required: false, defaultValue: 'Média' },
    { key: 'description', label: 'Descrição', type: 'String', required: false },
  ],
  steps: [
    {
      id: 'buscarProcesso',
      stepDefinitionId: 'query',
      type: 'Action',
      order: 0,
      enabled: true,
      configuration: {
        query: literal({
          table: 'cases',
          where: [{ path: 'caseNumber', op: 'eq', value: expression('event.caseNumber') }],
          limit: 1,
          projections: [],
        }),
      },
    },
    {
      id: 'processoEncontrado',
      stepDefinitionId: '',
      type: 'Condition',
      order: 1,
      enabled: true,
      condition: { kind: 'Expression', expression: 'output.buscarProcesso.count < 1' },
      configuration: {},
      branches: {
        whenTrue: erro('processo', 0, 'concat("Processo ", event.caseNumber, " não está cadastrado.")'),
        whenFalse: [],
      },
    },
    map('montarPrazo', 2, 'prazo', [
      { name: 'caseId', value: expression('output.buscarProcesso.first.id') },
      { name: 'type', value: { kind: 'Event', path: 'type' } },
      { name: 'dueDate', value: { kind: 'Event', path: 'dueDate' } },
      { name: 'priority', value: { kind: 'Event', path: 'priority' } },
      { name: 'description', value: { kind: 'Event', path: 'description' } },
      // A situação de um prazo é a CHAVE da lista `deadlineStatuses`, que é o próprio rótulo em
      // português. Gravar "pending" — herança de quando Prazos era do kernel — criava um prazo com
      // uma situação que nenhuma opção responde: fora do filtro "Pendente" e sem cor na listagem.
      { name: 'status', value: literal('Pendente') },
      { name: 'completedAt', value: literal(null) },
    ]),
    upsert('gravarPrazo', 3, 'deadlines', 'prazo'),
    map('montarPush', 4, 'push', [
      { name: 'id', value: expression('event.recordId') },
      { name: 'status', value: literal('reviewed') },
    ]),
    upsert('gravarPush', 5, 'pushes', 'push'),
    map('responder', 6, '', [
      { name: 'status', value: literal('Prazo criado e push marcado como revisado.') },
      { name: 'actions', value: literal(['refresh']) },
    ]),
  ],
};

const ACTIONS: ActionModuleTemplate[] = [
  {
    templateId: 'act-push-gerar-prazo',
    key: 'push_gerar_prazo',
    title: 'Gerar prazo',
    icon: 'time',
    workflowId: 'wf-push-gerar-prazo',
    // A ação PERGUNTA: abre os parâmetros do fluxo já preenchidos com o que o push sabe. O número do
    // processo precisa do mapa porque os nomes divergem — o push guarda `processNumber` e o fluxo
    // pede `caseNumber`; a descrição é derivada, e não copiada de campo nenhum.
    promptParameters: true,
    parameterDefaults: {
      caseNumber: 'processNumber',
      description: 'concat("Gerado a partir do push: ", subject)',
    },
    hiddenWhen: 'isEmpty(processNumber)',
    danger: false,
    enabled: true,
    order: 0,
  },
  {
    templateId: 'act-push-revisado',
    key: 'push_revisado',
    title: 'Marcar como revisado',
    icon: 'check',
    workflowId: 'wf-push-triagem',
    hiddenWhen: 'status != "pending"',
    danger: false,
    enabled: true,
    order: 1,
  },
  {
    templateId: 'act-push-arquivar',
    key: 'push_arquivar',
    title: 'Arquivar',
    icon: 'archive',
    workflowId: 'wf-push-triagem',
    hiddenWhen: 'status == "archived"',
    danger: false,
    enabled: true,
    order: 2,
  },
];

const PUSHES_SCREEN: ScreenModuleTemplate = {
  key: 'pushes',
  sourceId: SOURCE_ID,
  titleSingular: 'Push',
  titlePlural: 'Pushes do Tribunal',
  icon: 'inbox',
  dataCollection: 'pushes',
  fields: FIELDS,
  titleFieldKey: 'subject',
  hasNotes: false,
  hasDocuments: false,
  hasTags: false,
  eventPrefix: 'push',
  // Excluir é a única operação de tela que cabe: os pushes chegam prontos, e não há o que duplicar
  // nem link a copiar para um registro sem tela de detalhe.
  listActions: ['delete'],
  cardActionIds: ['act-push-gerar-prazo', 'act-push-revisado', 'act-push-arquivar'],
  // Um push nasce da ingestão de e-mail, nunca de alguém preenchendo formulário. A regra que protegia
  // isso era nomeada no Firestore; agora é declaração: só admin e advogado triam.
  writeRoles: ['admin', 'lawyer'],
  sidebarOrder: 0,
  hideFromSidebar: true,
};

/**
 * A listagem. Não usa a superfície padrão de cartões: o cartão de um push é uma peça de leitura —
 * cabeçalho do e-mail, bloco processual, corpo da mensagem — e não um resumo de cadastro. O que vem
 * do padrão é a moldura (`EntityListView`) — em `layout="list"`, porque o cartão de leitura quer a
 * largura inteira —, os filtros derivados dos campos, os modais e, sobretudo,
 * as AÇÕES: o menu "Ações" é montado a partir de `getCardActions`, então o que aparece ali continua
 * governado pelo Form Design, e uma extensão de terceiro acrescenta a sua sem tocar neste código.
 */
const PUSHES_SOURCE = `
import { useMemo, useState } from 'react';
import { styled, useTheme } from 'styled-components';
import { Button, Dropdown, EntityListModals, EntityListView, HtmlView, Icon, InfoBanner, cardActionIcon } from '@microteia/ui';
import { useEntityList, useCollection, useLookup, useOpenRecord } from '@microteia/data';
import { getConfigColor } from '@microteia/theme';

const SOURCE_ID = 'microteia:push';

const Card = styled.div\`
  background: \${({ theme }) => theme.colors.surface};
  border: 1px solid \${({ theme }) => theme.colors.border};
  border-left: 3px solid \${({ $accent }) => $accent};
  border-radius: \${({ theme }) => theme.borderRadius.lg};
  padding: \${({ theme }) => theme.spacing.md};
  display: flex;
  flex-direction: column;
  gap: \${({ theme }) => theme.spacing.sm};
\`;

const Head = styled.div\`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: \${({ theme }) => theme.spacing.md};
  flex-wrap: wrap;
\`;

const Subject = styled.div\`
  font-size: \${({ theme }) => theme.fontSizes.sm};
  font-weight: 600;
  color: \${({ theme }) => theme.colors.text};
\`;

const Line = styled.div\`
  font-size: \${({ theme }) => theme.fontSizes.xs};
  color: \${({ theme }) => theme.colors.textMuted};
\`;

const Meta = styled.div\`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: \${({ theme }) => theme.fontSizes.xs};
  color: \${({ theme }) => theme.colors.textMuted};
\`;

const Chip = styled.span\`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 7px;
  border-radius: \${({ theme }) => theme.borderRadius.full};
  font-size: 10px;
  font-weight: 600;
  background: \${({ $color, theme }) => ($color || theme.colors.textMuted) + '20'};
  color: \${({ $color, theme }) => $color || theme.colors.textMuted};
  border: 1px solid \${({ $color, theme }) => ($color || theme.colors.textMuted) + '40'};
\`;

const Grid = styled.div\`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: \${({ theme }) => theme.spacing.sm};
  padding-top: \${({ theme }) => theme.spacing.sm};
  border-top: 1px solid \${({ theme }) => theme.colors.border};
\`;

const Label = styled.div\`
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: \${({ theme }) => theme.colors.textMuted};
  margin-bottom: 2px;
\`;

const Value = styled.div\`
  font-size: \${({ theme }) => theme.fontSizes.xs};
  color: \${({ theme }) => theme.colors.text};
\`;

const CaseLink = styled.button\`
  font-size: \${({ theme }) => theme.fontSizes.xs};
  font-family: \${({ theme }) => theme.fonts.mono};
  color: \${({ theme }) => theme.colors.primary};
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;

  &:hover { text-decoration: underline; }
\`;

const Foot = styled.div\`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: \${({ theme }) => theme.spacing.sm};
  padding-top: \${({ theme }) => theme.spacing.sm};
  border-top: 1px solid \${({ theme }) => theme.colors.border};
\`;

const FootLeft = styled.div\`
  display: flex;
  align-items: center;
  gap: \${({ theme }) => theme.spacing.xs};
\`;

const ActionsButton = styled.button\`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: \${({ theme }) => theme.borderRadius.md};
  border: 1px solid \${({ theme }) => theme.colors.border};
  background: \${({ theme }) => theme.colors.surface};
  color: \${({ theme }) => theme.colors.textSecondary};
  font-size: \${({ theme }) => theme.fontSizes.xs};
  cursor: pointer;
  transition: \${({ theme }) => theme.transitions.fast};

  &:hover { background: \${({ theme }) => theme.colors.surfaceHover}; color: \${({ theme }) => theme.colors.text}; }
\`;

const PlainBody = styled.pre\`
  margin: 0;
  padding: \${({ theme }) => theme.spacing.sm};
  max-height: 420px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: \${({ theme }) => theme.fonts.mono};
  font-size: \${({ theme }) => theme.fontSizes.xs};
  color: \${({ theme }) => theme.colors.textSecondary};
  background: \${({ theme }) => theme.colors.surface};
  border: 1px solid \${({ theme }) => theme.colors.border};
  border-radius: \${({ theme }) => theme.borderRadius.md};
\`;

const HeaderCount = styled.span\`
  padding: 2px 8px;
  border-radius: \${({ theme }) => theme.borderRadius.full};
  background: \${({ theme }) => theme.colors.warning};
  color: \${({ theme }) => theme.colors.white};
  font-size: 11px;
  font-weight: 700;
\`;

const dateOf = (value) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return isNaN(d.getTime()) ? null : d;
};

const stamp = (value) => {
  const d = dateOf(value);
  if (!d) return '';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// A caixa se lê do e-mail mais RECENTE ao mais antigo; a ordem por data de gravação não serve, porque
// a ingestão processa em lote e um e-mail de ontem pode ser gravado depois de um de hoje.
const byReceivedAtDesc = (a, b) => {
  const at = dateOf(a.receivedAt) ? dateOf(a.receivedAt).getTime() : 0;
  const bt = dateOf(b.receivedAt) ? dateOf(b.receivedAt).getTime() : 0;
  return bt - at;
};

// A visão útil de quem abre a caixa é o que ainda não foi triado.
const PENDENTES = [{ key: 'status', values: ['pending'] }];

/**
 * De quem o e-mail veio, e se dá para confiar no HTML dele. Domínio do Judiciário e o portal de
 * publicações — o resto é exibido como TEXTO, sem interpretar marcação nenhuma.
 *
 * Vale reparar no que essa decisão NÃO decide mais: mesmo o remetente confiável é exibido dentro de
 * uma moldura isolada, sem script e sem acesso à aplicação. Errar aqui custa uma página feia, e não
 * a sessão de quem está lendo.
 */
const senderAddress = (from) => {
  const raw = String(from || '');
  const angle = raw.match(/<([^>]+)>/);
  if (angle) return angle[1].toLowerCase();
  const plain = raw.match(/[^\\s<>]+@[^\\s<>]+/);
  return plain ? plain[0].toLowerCase() : raw.toLowerCase();
};

const isTrustedSender = (from) => {
  const address = senderAddress(from);
  return address.endsWith('.jus.br') || address.endsWith('@publicacoesonline.com.br');
};

const asPlainText = (record) =>
  record.emailBodyText || String(record.emailBodyHtml || '').replace(/<[^>]*>/g, '');

export default function PushesView() {
  const theme = useTheme();
  const list = useEntityList(SOURCE_ID, { defaultFilterTokens: PENDENTES, sortRecords: byReceivedAtDesc });
  const cases = useCollection('cases');
  const statusOptions = useLookup('pushStatuses');
  const openRecord = useOpenRecord();
  const [expanded, setExpanded] = useState({});

  const caseIdByNumber = useMemo(() => {
    const index = {};
    for (const item of cases) if (item.caseNumber) index[item.caseNumber] = item.id;
    return index;
  }, [cases]);

  const pendingCount = useMemo(
    () => list.records.filter((record) => record.status === 'pending').length,
    [list.records],
  );

  if (!list.definition) {
    return <div style={{ padding: '24px' }}><InfoBanner message='Tela "Pushes do Tribunal" não encontrada. Instale a extensão para ativá-la.' variant="warning" /></div>;
  }

  const statusLabel = (record) => {
    const option = statusOptions.find((item) => item.key === record.status);
    return option ? option.label : record.status || 'Sem situação';
  };

  const toggleBody = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const renderProcess = (record) => {
    const caseId = caseIdByNumber[record.processNumber];
    if (caseId) {
      return (
        <CaseLink title={'Abrir processo ' + record.processNumber} onClick={() => openRecord('cases', caseId)}>
          {record.processNumber}
        </CaseLink>
      );
    }
    return (
      <div>
        <Value>{record.processNumber}</Value>
        <Chip $color={theme.colors.warning}><Icon name="alert" size={10} />Processo não cadastrado</Chip>
      </div>
    );
  };

  const renderInfo = (label, value) => (value ? (
    <div><Label>{label}</Label><Value>{value}</Value></div>
  ) : null);

  const renderCard = (record) => {
    const trusted = isTrustedSender(record.from);
    const isOpen = !!expanded[record.id];
    const actions = list.getCardActions(record);
    return (
      <Card key={record.id} $accent={getConfigColor(statusOptions, record.status, theme)}>
        <Head>
          <div>
            <Subject>{record.subject || '(sem assunto)'}</Subject>
            <Line>De: {record.from}</Line>
            <Line>Para: {record.to}</Line>
          </div>
          <Meta>
            <Chip $color={getConfigColor(statusOptions, record.status, theme)}>{statusLabel(record)}</Chip>
            <Chip>{record.parsedByAI ? 'IA' : 'Regex'}</Chip>
            <span>{stamp(record.receivedAt)}</span>
          </Meta>
        </Head>

        {record.processNumber ? (
          <Grid>
            <div><Label>Processo</Label>{renderProcess(record)}</div>
            {renderInfo('Tribunal', record.court)}
            {renderInfo('Polo ativo', record.activeParty)}
            {renderInfo('Polo passivo', record.passiveParty)}
            {renderInfo('Classe judicial', record.legalClass)}
            {renderInfo('Autuação', dateOf(record.filingDate) ? dateOf(record.filingDate).toLocaleDateString('pt-BR') : '')}
          </Grid>
        ) : null}

        {record.parsingError ? (
          <InfoBanner message={'Erro de processamento: ' + record.parsingError} variant="warning" />
        ) : null}

        <Foot>
          <FootLeft>
            <Button size="sm" variant="ghost" onClick={() => toggleBody(record.id)}>
              <Icon name={isOpen ? 'eyeOff' : 'eye'} size={14} />
              {isOpen ? 'Ocultar e-mail' : 'Ver e-mail completo'}
            </Button>
            {trusted ? <Chip $color={theme.colors.success}><Icon name="shieldCheck" size={10} />Fonte confiável</Chip> : null}
          </FootLeft>
          {actions.length > 0 ? (
            <Dropdown
              align="right"
              trigger={<ActionsButton><Icon name="more" size={14} /><span>Ações</span></ActionsButton>}
              items={actions.map((action) => ({
                id: action.key,
                label: action.title,
                icon: cardActionIcon(action),
                variant: action.danger ? 'danger' : 'default',
                onClick: action.onClick,
              }))}
            />
          ) : null}
        </Foot>

        {isOpen ? (
          trusted && record.emailBodyHtml
            ? <HtmlView html={record.emailBodyHtml} />
            : <PlainBody>{asPlainText(record).trim() || 'Sem conteúdo disponível.'}</PlainBody>
        ) : null}
      </Card>
    );
  };

  return (
    <EntityListView
      title={list.definition.titlePlural}
      titleIcon={<Icon name="inbox" size={22} />}
      layout="list"
      onNew={() => {}}
      newTitle=""
      canCreate={false}
      headerExtra={pendingCount > 0 ? <HeaderCount>{pendingCount}</HeaderCount> : null}
      filterDefs={list.filterDefs}
      filterTokens={list.filterTokens}
      onFilterChange={list.setFilterTokens}
      filterPlaceholder="Filtrar pushes..."
      savedFiltersScreenKey={list.savedFiltersScreenKey}
      isLoading={list.isLoading && list.records.length === 0}
      isEmpty={list.filteredRecords.length === 0}
      emptyIcon={<Icon name="inbox" size={32} />}
      emptyTitle="Nenhum push encontrado"
      emptyActionLabel=""
      modals={<EntityListModals vm={list} />}
    >
      {list.filteredRecords.map(renderCard)}
    </EntityListView>
  );
}
`;

/**
 * O STARTUP: só a menção `@push` das anotações e os comandos de ⌘K. Não há "novo push" — a caixa não
 * se preenche à mão.
 */
const STARTUP_SOURCE = `
import { Icon } from '@microteia/ui';

const SOURCE_ID = 'microteia:push';
const LIST_KEY = 'pushes';
const GROUP = 'Pushes';

const screenOf = (ctx) => ctx.screenDefinitions.find((s) => (s.sourceId || s.id) === SOURCE_ID);
const textOf = (record, key) => (key && typeof record[key] === 'string' ? record[key] : '');

const recordsOf = (ctx, screen) => {
  const collection = screen.dataCollection || screen.id;
  return ctx.records.filter((r) => r.collection === collection);
};

const matches = (record, q) => {
  if (!q) return true;
  const subject = textOf(record, 'subject').toLowerCase();
  const number = textOf(record, 'processNumber').toLowerCase();
  return subject.indexOf(q) !== -1 || number.indexOf(q) !== -1;
};

export default function startup(host) {
  host.commands.register({
    group: GROUP,
    getItems(query, ctx) {
      const q = String(query || '').toLowerCase().trim();
      if (!q) return [];
      const screen = screenOf(ctx);
      if (!screen) return [];
      const icon = <Icon name="inbox" size={16} />;
      const items = [];
      if ('abrir pushes do tribunal'.indexOf(q) !== -1) {
        items.push({ id: 'push:list', title: 'Abrir Pushes do Tribunal', group: GROUP, icon, onSelect: () => { ctx.openTab(LIST_KEY); ctx.close(); } });
      }
      for (const r of recordsOf(ctx, screen)) {
        if (!matches(r, q)) continue;
        items.push({
          id: 'push:' + r.id,
          title: textOf(r, 'subject') || '(sem assunto)',
          subtitle: textOf(r, 'processNumber') || 'Push',
          group: GROUP,
          icon,
          onSelect: () => { ctx.openTab(LIST_KEY); ctx.close(); },
        });
      }
      return items.slice(0, 9);
    },
  });
}
`;

export const pushPlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.push',
    version: '1.0.3',
    kernel: '^1.0.0',
    name: 'Pushes do Tribunal',
    description: 'A caixa de intimações do escritório recriada como extensão, sobre os MESMOS pushes — a sexta entidade a sair do kernel.',
    publisher: { name: 'Microteia' },
    // O processo é o que o número do e-mail resolve; o prazo é o que a triagem gera. As duas coleções
    // vêm das extensões que as declaram.
    dependencies: {
      'core.ui': '^1.0.0',
      'com.microteia.processo': { version: '^2.0.0', collections: ['cases'] },
      'com.microteia.prazo': { version: '^1.0.0', collections: ['deadlines'] },
    },
    contributes: [
      nav({
        key: 'pushes',
        label: 'Pushes do Tribunal',
        icon: 'inbox',
        order: 80,
        // O selo do menu: quantas intimações ainda esperam triagem. Contagem declarada, avaliada
        // sobre os registros que a listagem já enxerga — não há contador a manter em lugar nenhum.
        badge: { collection: 'pushes', when: 'status == "pending"' },
      }),
      page({ key: 'pushes', title: 'Pushes do Tribunal', icon: 'inbox' }, 'pushes'),
    ],
  },
  summary:
    'A caixa de intimações do tribunal: cada e-mail com o número do processo, as partes e o corpo da mensagem, com um selo no menu contando o que ainda espera triagem, o link direto para o processo quando ele já existe, e o gesto de gerar um prazo a partir da intimação.',
  overview: {
    type: 'stack',
    gap: 'lg',
    children: [
      {
        type: 'markdown',
        content:
          'A extensão **Pushes do Tribunal** traz a caixa de intimações do escritório: os e-mails que o tribunal envia, já com o número do processo, as partes e a classe judicial extraídos.\n\nO item no menu mostra **quantas intimações ainda esperam triagem**, e a lista abre exatamente nelas. Cada cartão liga direto para o processo quando ele já está cadastrado — e avisa, quando não está.\n\nDo menu **Ações** de cada intimação sai o essencial: **gerar um prazo** (que abre um formulário já preenchido com o processo e a descrição, encontra o processo pelo número e marca a intimação como revisada), marcar como **revisado** ou **arquivar**.\n\nO corpo do e-mail é exibido dentro de uma moldura **isolada**: nada que venha de fora executa dentro do sistema.',
      },
      {
        type: 'keyValue',
        items: [
          { label: 'Adiciona', value: 'Item "Pushes do Tribunal" no menu, com contador' },
          { label: 'Cadastro', value: '15 campos, em 3 seções' },
          { label: 'Automações', value: 'Gerar prazo do push e Triar push' },
          { label: 'Abre em', value: 'Intimações pendentes' },
        ],
      },
      {
        type: 'banner',
        message: 'Os pushes são criados pela leitura automática da caixa de e-mail, nunca à mão — por isso a listagem não tem botão de "novo". A configuração da conta de e-mail continua nas Configurações do escritório.',
        variant: 'info',
      },
      {
        type: 'banner',
        message: 'Remover a extensão remove a tela, nunca as intimações: os registros continuam no escritório e voltam a aparecer se ela for instalada de novo.',
        variant: 'info',
      },
    ],
  },
  workflows: [GERAR_PRAZO_WORKFLOW, TRIAGEM_WORKFLOW],
  actions: ACTIONS,
  screens: [PUSHES_SCREEN],
  lookups: LOOKUPS,
  startup: STARTUP_SOURCE,
  views: [
    {
      key: 'pushes',
      title: 'Pushes do Tribunal',
      icon: 'inbox',
      source: PUSHES_SOURCE,
    },
  ],
};
