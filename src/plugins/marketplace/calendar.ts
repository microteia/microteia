import type {
  LookupModuleTemplate,
  MarketplacePlugin,
  ScreenModuleTemplate,
  TemplateField,
} from '../../domain/entities/MarketplacePlugin';
import type { CustomFieldOption } from '../../domain/entities';
import type { ExtensionPointDefinition } from '../../domain/schema/plugin/extensionPoint';
import { nav, page, settingsSection } from '../contributionBuilders';

/**
 * **Calendário** — a agenda do escritório, agnóstica. Era a última tela de código do kernel a
 * conhecer uma entidade de negócio: lia prazos, escrevia prazos e sabia o que era "vencido",
 * "concluído" e "prioridade crítica". Aqui ela não sabe o que apresenta.
 *
 * O que ela conhece é UMA entidade própria — `calendar` —, cujo único propósito é aparecer na
 * agenda. Quem tem data a mostrar (um prazo, uma audiência, uma parcela) mantém um item aqui e é
 * responsável por ele: criar, atualizar e excluir quando o registro de origem muda. O calendário
 * nunca escreve no registro de origem, e por isso não precisa saber que ele existe — guarda apenas
 * `origem` (a COLEÇÃO) e `origemId`, e é por esse par que o clique no cartão abre o registro certo.
 *
 * **Os gestos do cartão são configuração da TELA, não deste código.** Eles saem de "Ações do card na
 * listagem" do Form Design da entidade Calendário — a mesma lista que qualquer listagem do sistema
 * usa, e que o escritório edita à vontade. Uma extensão que queira oferecer um gesto acrescenta a
 * Action dela àquela lista pelo complemento de tela; não há ponto de extensão próprio para isso,
 * porque haveria duas origens para a mesma pergunta ("o que aparece neste cartão?") e o usuário só
 * conseguiria mexer numa delas.
 *
 * O único ponto próprio é o do ARRASTO — `calendar.moveaction` —, e ele é próprio porque não tem
 * equivalente em lugar nenhum: nenhuma listagem tem o gesto de "mudar de dia", então não há lista do
 * Form Design onde ele caberia. A contribuição aponta para uma Action do escritório pelo `sourceId`
 * (o `templateId` do pacote que a instalou), o endereço estável já que o id real nasce na
 * instalação. Arrastar não grava nada por conta própria: quem decide o que "mudar de dia" significa
 * é a origem, que pode adiar o prazo, remarcar a audiência ou recusar o movimento.
 */
const SOURCE_ID = 'microteia:calendar';

const CALENDAR_MOVE_POINT = 'calendar.moveaction';

const IDENTIFICACAO = 'Item';
const DATAS = 'Datas';
const ORIGEM = 'Origem';

const FIELDS: TemplateField[] = [
  { key: 'title', label: 'Título', type: 'text', required: true, order: 0, section: IDENTIFICACAO, placeholder: 'O que aparece no cartão' },
  { key: 'status', label: 'Situação', type: 'select', required: true, order: 1, section: IDENTIFICACAO, lookupCollection: 'calendarStatuses', optionsColored: true, filterable: true, placeholder: 'Selecione a situação...' },
  { key: 'priority', label: 'Prioridade', type: 'select', required: true, order: 2, section: IDENTIFICACAO, lookupCollection: 'calendarPriorities', optionsColored: true, filterable: true, placeholder: 'Selecione a prioridade...' },
  { key: 'description', label: 'Descrição', type: 'textarea', required: false, order: 3, section: IDENTIFICACAO, placeholder: 'Detalhe que aparece no cartão' },
  { key: 'date', label: 'Data', type: 'date', required: true, order: 4, section: DATAS, filterable: true },
  { key: 'hour', label: 'Hora', type: 'time', required: false, order: 5, section: DATAS },
  { key: 'finishDate', label: 'Data da conclusão', type: 'date', required: false, order: 6, section: DATAS, filterable: true },
  { key: 'finishHour', label: 'Hora da conclusão', type: 'time', required: false, order: 7, section: DATAS },
  // O par que endereça o registro que mandou o item para cá. `origem` é o nome da COLEÇÃO, não um
  // rótulo: é o que o clique no cartão usa para abrir o registro na tela que o apresenta hoje.
  { key: 'origem', label: 'Coleção de origem', type: 'text', required: true, order: 8, section: ORIGEM, filterable: true, placeholder: 'O cadastro de onde o item veio' },
  { key: 'origemId', label: 'Registro de origem', type: 'text', required: true, order: 9, section: ORIGEM },
];

const colored = (entries: [string, string, string][]): CustomFieldOption[] =>
  entries.map(([key, label, color]) => ({ key, label, color }));

/**
 * As duas listas de partida. As CHAVES são estáveis e em inglês porque quem grava um item é uma
 * automação de outra extensão — ela precisa de um valor que não mude quando o escritório renomeia o
 * rótulo. O que o usuário lê é o `label`, e é dele daqui em diante.
 */
const LOOKUPS: LookupModuleTemplate[] = [
  {
    collection: 'calendarStatuses',
    label: 'Calendário: Situação',
    options: colored([['pending', 'Pendente', 'warning'], ['closed', 'Concluído', 'success']]),
  },
  {
    collection: 'calendarPriorities',
    label: 'Calendário: Prioridade',
    options: colored([
      ['low', 'Baixa', 'success'],
      ['medium', 'Média', 'warning'],
      ['high', 'Alta', 'secondary'],
      ['critical', 'Crítica', 'danger'],
    ]),
  },
];

const CALENDAR_SCREEN: ScreenModuleTemplate = {
  key: 'calendar',
  sourceId: SOURCE_ID,
  sourceRev: 1,
  titleSingular: 'Item do calendário',
  titlePlural: 'Calendário',
  icon: 'calendar',
  fields: FIELDS,
  titleFieldKey: 'title',
  subtitleFieldKey: 'status',
  hasNotes: false,
  hasDocuments: false,
  hasTags: false,
  eventPrefix: 'calendar',
  /**
   * O item do calendário é um ESPELHO: quem manda nele é o registro de origem, e editá-lo à mão
   * criaria uma verdade paralela que a próxima gravação da origem apaga. Por isso o cartão não
   * oferece gesto de edição e a listagem crua fica fora do menu.
   *
   * `writeRoles: ['admin']` é o mais estreito que a regra do curinga sabe expressar — quem grava de
   * verdade é a automação da origem, pelo servidor, que não passa por esta lista. Deixar o admin de
   * fora também tiraria a única saída para consertar um item órfão de uma sincronização quebrada.
   */
  writeRoles: ['admin'],
  listActions: [],
  sidebarOrder: 0,
  hideFromSidebar: true,
};

const EXTENSION_POINTS: ExtensionPointDefinition[] = [
  {
    id: CALENDAR_MOVE_POINT,
    apiVersion: '1.0.0',
    title: 'Ação ao mover um item de dia',
    description: 'A ação executada quando um item é arrastado para outro dia. Quem decide o que a mudança significa é a origem.',
    ownerPluginId: 'com.microteia.calendar',
    allowedImplKinds: [],
    implRequired: false,
    multiple: true,
  },
];

/**
 * A agenda. Fiel à que existia no kernel — a barra de números, a navegação por mês, as colunas de
 * dia com rolagem horizontal que abre no dia de hoje, o cartão colorido pela prioridade, o arrastar
 * entre dias e a legenda que filtra por prioridade —, com três diferenças que a tornam agnóstica:
 * o dado vem da entidade `calendar`, o filtro é o `CompositeFilter` sobre os campos que a tela
 * declara (inclusive os que outra extensão acrescentou), e todo gesto é uma Action de terceiro.
 */
const CALENDAR_SOURCE = `
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { styled, useTheme } from 'styled-components';
import { CompositeFilter, EntityListModals, Icon, InfoBanner, cardActionIcon } from '@microteia/ui';
import {
  useEntityList, useContributions, useRunAction, useActionVisible, useOpenRecord, useLookup, useNotify,
} from '@microteia/data';
import { getConfigColor } from '@microteia/theme';
import { useSettingValue } from '@microteia/settings';

const SOURCE_ID = 'microteia:calendar';
const COLLECTION = 'calendar';
const MOVE_POINT = 'calendar.moveaction';
const MOVE_SETTING = 'calendar.moveActions';

const StatsBar = styled.div\`
  display: flex;
  gap: \${({ theme }) => theme.spacing.md};
  margin-bottom: \${({ theme }) => theme.spacing.lg};
  padding: \${({ theme }) => theme.spacing.md};
  background: \${({ theme }) => theme.colors.surface};
  border: 1px solid \${({ theme }) => theme.colors.border};
  border-radius: \${({ theme }) => theme.borderRadius.lg};
\`;

const StatItem = styled.div\`
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  padding: \${({ theme }) => theme.spacing.sm};
\`;

const StatValue = styled.div\`
  font-size: \${({ theme }) => theme.fontSizes['2xl']};
  font-weight: 700;
  line-height: 1;
  color: \${({ $color, theme }) => $color || theme.colors.primary};
\`;

const StatLabel = styled.div\`
  font-size: \${({ theme }) => theme.fontSizes.xs};
  color: \${({ theme }) => theme.colors.textMuted};
  margin-top: 4px;
\`;

const CalendarCard = styled.div\`
  background: \${({ theme }) => theme.colors.surface};
  border: 1px solid \${({ theme }) => theme.colors.border};
  border-radius: \${({ theme }) => theme.borderRadius.lg};
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: calc(100vh - 260px);
  min-height: 500px;
\`;

const MonthNav = styled.div\`
  display: flex;
  align-items: center;
  gap: \${({ theme }) => theme.spacing.sm};
  padding: \${({ theme }) => theme.spacing.md} \${({ theme }) => theme.spacing.lg};
  border-bottom: 1px solid \${({ theme }) => theme.colors.border};
  flex-shrink: 0;
\`;

const NavButton = styled.button\`
  background: none;
  border: 1px solid \${({ theme }) => theme.colors.border};
  border-radius: \${({ theme }) => theme.borderRadius.md};
  color: \${({ theme }) => theme.colors.text};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  transition: background \${({ theme }) => theme.transitions.fast};
  &:hover { background: \${({ theme }) => theme.colors.cardHover}; }
\`;

const MonthLabel = styled.h2\`
  font-size: \${({ theme }) => theme.fontSizes.lg};
  font-weight: 700;
  color: \${({ theme }) => theme.colors.text};
  text-transform: capitalize;
  flex: 1;
  text-align: center;
  margin: 0;
\`;

const TodayButton = styled.button\`
  background: \${({ theme }) => theme.colors.primary + '18'};
  border: 1px solid \${({ theme }) => theme.colors.primary + '40'};
  border-radius: \${({ theme }) => theme.borderRadius.md};
  color: \${({ theme }) => theme.colors.primary};
  cursor: pointer;
  font-size: \${({ theme }) => theme.fontSizes.sm};
  font-weight: 600;
  padding: 4px 14px;
  flex-shrink: 0;
  transition: background \${({ theme }) => theme.transitions.fast};
  &:hover { background: \${({ theme }) => theme.colors.primary + '28'}; }
\`;

const FilterRow = styled.div\`
  padding: \${({ theme }) => theme.spacing.sm} \${({ theme }) => theme.spacing.lg};
  border-bottom: 1px solid \${({ theme }) => theme.colors.border};
  flex-shrink: 0;
\`;

const DayColumnsScroller = styled.div\`
  display: flex;
  overflow-x: auto;
  overflow-y: hidden;
  flex: 1;

  &::-webkit-scrollbar { height: 6px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb {
    background: \${({ theme }) => theme.colors.border};
    border-radius: 3px;
  }
\`;

const DayColumn = styled.div\`
  display: flex;
  flex-direction: column;
  min-width: 170px;
  flex-shrink: 0;
  border-right: 1px solid \${({ theme }) => theme.colors.border};
  background: \${({ theme, $isToday, $isDragOver }) =>
    $isDragOver ? theme.colors.primary + '12' : $isToday ? theme.colors.primary + '06' : 'transparent'};
  box-shadow: \${({ theme, $isDragOver }) => $isDragOver ? 'inset 0 0 0 2px ' + theme.colors.primary : 'none'};
  transition: background \${({ theme }) => theme.transitions.fast}, box-shadow \${({ theme }) => theme.transitions.fast};

  &:last-child { border-right: none; }
\`;

const DayHeader = styled.div\`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: \${({ theme }) => theme.spacing.sm};
  border-bottom: 1px solid \${({ theme }) => theme.colors.border};
  flex-shrink: 0;
  gap: 4px;
  background: \${({ theme, $isToday }) => $isToday ? theme.colors.primary + '10' : theme.colors.background};
\`;

const DayNumber = styled.div\`
  font-size: \${({ theme }) => theme.fontSizes.lg};
  font-weight: 700;
  line-height: 1;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: \${({ theme, $isToday }) => $isToday ? theme.colors.primary : theme.colors.text};
  background: \${({ theme, $isToday }) => $isToday ? theme.colors.primary + '22' : 'transparent'};
\`;

const DayName = styled.div\`
  font-size: \${({ theme }) => theme.fontSizes.xs};
  color: \${({ theme }) => theme.colors.textMuted};
  text-transform: capitalize;
\`;

const DayEvents = styled.div\`
  padding: \${({ theme }) => theme.spacing.sm};
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  flex: 1;

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb {
    background: \${({ theme }) => theme.colors.border};
    border-radius: 2px;
  }
\`;

const EventCard = styled.div\`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border-radius: \${({ theme }) => theme.borderRadius.md};
  border-left: 3px solid \${({ $color }) => $color};
  border-right: 3px solid \${({ $color }) => $color};
  background: \${({ theme, $done }) => $done ? theme.colors.background : theme.colors.primary + '08'};
  opacity: \${({ $done, $dragging, $pending }) => $dragging ? 0.35 : $pending ? 0.5 : $done ? 0.72 : 1};
  cursor: \${({ $dragging }) => $dragging ? 'grabbing' : 'grab'};
  /* A caminho: o cartão já está no dia novo, mas quem confirma é a origem. */
  border-top: 1px dashed \${({ $pending, theme }) => $pending ? theme.colors.primary : 'transparent'};
  transition: opacity \${({ theme }) => theme.transitions.fast}, transform \${({ theme }) => theme.transitions.fast}, box-shadow \${({ theme }) => theme.transitions.fast};

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px \${({ theme }) => theme.colors.primary + '10'};
  }

  &:hover .calendar-card-actions {
    opacity: 1;
    pointer-events: auto;
  }
\`;

const EventTitle = styled.div\`
  font-size: \${({ theme }) => theme.fontSizes.xs};
  font-weight: 600;
  color: \${({ theme }) => theme.colors.text};
  line-height: 1.35;
  max-width: 150px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
\`;

const EventMeta = styled.div\`
  font-size: 0.65rem;
  color: \${({ theme }) => theme.colors.textMuted};
  display: flex;
  flex-direction: column;
  gap: 3px;
\`;

const MetaRow = styled.div\`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.65rem;
  color: \${({ theme }) => theme.colors.textMuted};

  span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
\`;

const BadgeRow = styled.div\`
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
\`;

const Badge = styled.span\`
  display: inline-flex;
  align-items: center;
  padding: 1px 5px;
  border-radius: \${({ theme }) => theme.borderRadius.full};
  font-size: 9px;
  font-weight: 500;
  background: \${({ $color }) => $color + '20'};
  color: \${({ $color }) => $color};
  border: 1px solid \${({ $color }) => $color + '40'};
  flex-shrink: 0;
  white-space: nowrap;
\`;

const EventDescription = styled.div\`
  font-size: 0.65rem;
  color: \${({ theme }) => theme.colors.textMuted};
  font-style: italic;
  max-width: 150px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
\`;

const CardActions = styled.div\`
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 4px;
  opacity: 0;
  pointer-events: none;
  transition: \${({ theme }) => theme.transitions.fast};
  z-index: 1;
\`;

const CardActionButton = styled.button\`
  width: 20px;
  height: 20px;
  border-radius: \${({ theme }) => theme.borderRadius.sm};
  border: 1px solid \${({ theme }) => theme.colors.border};
  background: \${({ theme }) => theme.colors.surface};
  color: \${({ theme }) => theme.colors.textMuted};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: \${({ theme }) => theme.transitions.fast};

  &:disabled { opacity: 0.5; cursor: progress; }
  &:hover:not(:disabled) {
    background: \${({ theme }) => theme.colors.primary};
    color: \${({ theme }) => theme.colors.white};
    border-color: \${({ theme }) => theme.colors.primary};
  }
\`;

const Legend = styled.div\`
  display: flex;
  align-items: center;
  gap: \${({ theme }) => theme.spacing.sm};
  padding: \${({ theme }) => theme.spacing.sm} \${({ theme }) => theme.spacing.lg};
  flex-wrap: wrap;
  border-top: 1px solid \${({ theme }) => theme.colors.border};
  flex-shrink: 0;
\`;

const LegendLabel = styled.span\`
  font-size: \${({ theme }) => theme.fontSizes.xs};
  font-weight: 600;
  opacity: 0.6;
  margin-right: 4px;
  color: \${({ theme }) => theme.colors.textMuted};
\`;

const LegendItem = styled.div\`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: \${({ theme }) => theme.fontSizes.xs};
  color: \${({ theme }) => theme.colors.textSecondary};
  padding: 4px 8px;
  border-radius: \${({ theme }) => theme.borderRadius.md};
  cursor: pointer;
  transition: all \${({ theme }) => theme.transitions.fast};
  opacity: \${({ $dimmed }) => $dimmed ? 0.4 : 1};
  &:hover { background: \${({ theme }) => theme.colors.cardHover}; }
\`;

const LegendDot = styled.span\`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: \${({ $color }) => $color};
  flex-shrink: 0;
\`;

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

const pad = (value) => String(value).padStart(2, '0');

const dateOf = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return isNaN(date.getTime()) ? null : date;
};

const dayKey = (date) => date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const daysOfMonth = (month) => {
  const days = [];
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  for (let day = 1; day <= last; day += 1) days.push(new Date(month.getFullYear(), month.getMonth(), day));
  return days;
};

const isClosed = (record) => record.status === 'closed';

/**
 * O item aparece no dia em que ele ACONTECE — e um item concluído aconteceu no dia da conclusão. É
 * a mesma leitura da agenda anterior: o que já passou se lê onde foi resolvido, não onde estava
 * marcado.
 */
const displayDate = (record) => {
  const finish = dateOf(record.finishDate);
  if (isClosed(record) && finish) return finish;
  return dateOf(record.date);
};

/**
 * ONDE o cartão aparece. Normalmente é o dia do dado; enquanto a origem não responde ao arrasto, é
 * o dia para onde ele foi levado — senão o cartão volta ao lugar e o gesto parece ter falhado,
 * embora esteja a caminho.
 *
 * A aposta se desfaz SOZINHA, e é isso que a torna segura: ela só vale enquanto o registro ainda
 * está onde estava ('from'). Assim que a gravação chega, o item deixa de casar com 'from' e quem
 * manda volta a ser o dado — inclusive quando a origem decide um TERCEIRO dia, que é a razão de a
 * agenda não poder simplesmente confiar no dia que o usuário soltou.
 */
const positionOf = (record, moves) => {
  const shown = displayDate(record);
  const key = shown ? dayKey(shown) : null;
  const move = moves[record.id];
  if (move && move.from === key) return { key: move.to, pending: true };
  return { key, pending: false };
};

const PRIORITY_ORDER = { critical: 3, high: 2, medium: 1, low: 0 };

const byPriority = (a, b) => {
  const ap = PRIORITY_ORDER[a.priority] != null ? PRIORITY_ORDER[a.priority] : -1;
  const bp = PRIORITY_ORDER[b.priority] != null ? PRIORITY_ORDER[b.priority] : -1;
  return bp - ap;
};

const text = (value) => (typeof value === 'string' ? value : '');

/** A contribuição atende este item? Origem vazia na declaração significa "qualquer origem". */
const servesRecord = (contribution, record) => {
  const origem = text(contribution.metadata.origem);
  return origem === '' || origem === record.origem;
};

export default function CalendarView() {
  const theme = useTheme();
  const list = useEntityList(SOURCE_ID);
  const moveActions = useContributions(MOVE_POINT);
  const moveLayout = useSettingValue(MOVE_SETTING);
  const runAction = useRunAction();
  const isVisible = useActionVisible();
  const openRecord = useOpenRecord();
  const notify = useNotify();
  const statusOptions = useLookup('calendarStatuses');
  const priorityOptions = useLookup('calendarPriorities');

  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverKey, setDragOverKey] = useState(null);
  // O arrasto em trânsito: { [id]: { from, to } }. Ver positionOf.
  const [moves, setMoves] = useState({});
  const scrollerRef = useRef(null);

  const records = list.filteredRecords;

  const monthLabel = MONTHS[month.getMonth()] + ' ' + month.getFullYear();

  const days = useMemo(() => {
    const todayKey = dayKey(new Date());
    return daysOfMonth(month).map((date) => {
      const key = dayKey(date);
      const items = records
        .map((record) => ({ record, position: positionOf(record, moves) }))
        .filter((item) => item.position.key === key)
        .sort((a, b) => byPriority(a.record, b.record));
      return {
        date,
        key,
        dayNumber: date.getDate(),
        weekday: WEEKDAYS[date.getDay()],
        isToday: key === todayKey,
        items,
      };
    });
  }, [month, records, moves]);

  const stats = useMemo(() => {
    const prefix = month.getFullYear() + '-' + pad(month.getMonth() + 1);
    const today = startOfToday().getTime();
    const inMonth = records.filter((record) => {
      const shown = displayDate(record);
      return !!shown && dayKey(shown).indexOf(prefix) === 0;
    });
    const late = inMonth.filter((record) => {
      const due = dateOf(record.date);
      return !isClosed(record) && !!due && new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime() < today;
    });
    return {
      total: inMonth.length,
      pending: inMonth.filter((record) => !isClosed(record)).length - late.length,
      closed: inMonth.filter(isClosed).length,
      late: late.length,
    };
  }, [records, month]);

  // A agenda abre no dia de hoje, não no dia 1: é o que o mês corrente tem de útil. Ler o nó só
  // dentro do efeito é a regra — no render, a medida ainda não existe.
  useEffect(() => {
    const container = scrollerRef.current;
    if (!container) return;
    const todayEl = container.querySelector('[data-today="true"]');
    if (!todayEl) {
      container.scrollLeft = 0;
      return;
    }
    container.scrollLeft = Math.max(0, todayEl.offsetLeft - container.clientWidth / 2 + todayEl.offsetWidth / 2);
  }, [month]);

  const priorityColor = useCallback(
    (record) => getConfigColor(priorityOptions, record.priority, theme),
    [priorityOptions, theme],
  );

  const labelOf = (options, key) => {
    const found = options.find((option) => option.key === key);
    return found ? found.label : key;
  };

  const goToMonth = (offset) => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  const goToToday = () => {
    const now = new Date();
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const priorityToken = useMemo(() => {
    const found = list.filterTokens.find((token) => token.key === 'priority');
    return found && found.values.length === 1 ? found.values[0] : null;
  }, [list.filterTokens]);

  const filterByPriority = useCallback((key) => {
    const others = list.filterTokens.filter((token) => token.key !== 'priority');
    list.setFilterTokens(key === null ? others : others.concat([{ key: 'priority', values: [key] }]));
  }, [list]);

  const executarMovimento = useCallback(async (contribution, record, params) => {
    const result = await runAction({
      actionSourceId: text(contribution.metadata.actionSourceId),
      collection: COLLECTION,
      recordId: record.id,
      record,
      params,
    });
    if (!result.ok && result.message) notify(result.message, 'error');
    return result.ok;
  }, [runAction, notify]);

  /**
   * Arrastar não grava: pergunta. A lista de quem responde ao movimento é a das Configurações — o
   * escritório liga, desliga e ordena —, e vale a PRIMEIRA que atende aquela origem. Rodar todas
   * faria a extensão do Financeiro receber o arrasto de um prazo.
   */
  const handleDrop = useCallback(async (day, recordId) => {
    setDraggingId(null);
    setDragOverKey(null);
    if (!recordId) return;

    const record = records.find((item) => item.id === recordId);
    if (!record) return;
    const shown = displayDate(record);
    if (shown && dayKey(shown) === day.key) return;

    const enabled = Array.isArray(moveLayout) ? moveLayout : [];
    const isEnabled = (contribution) => {
      const key = text(contribution.metadata.key) || contribution.id;
      const entry = enabled.find((item) => item.key === key);
      return entry ? entry.enabled !== false : true;
    };
    const order = (contribution) => {
      const key = text(contribution.metadata.key) || contribution.id;
      const index = enabled.findIndex((item) => item.key === key);
      return index === -1 ? enabled.length : index;
    };

    const handler = moveActions
      .filter((contribution) => (
        servesRecord(contribution, record)
          && isEnabled(contribution)
          && isVisible(contribution.metadata.hiddenWhen, record, 'calendar')
      ))
      .sort((a, b) => order(a) - order(b))[0];

    if (!handler) {
      notify('Nenhuma extensão responde por este item ao mudar de dia.', 'info');
      return;
    }

    /**
     * A aposta é feita ANTES de chamar, e é só visual: o cartão aparece no dia novo enquanto a
     * origem decide. Recusado, ela é desfeita na hora e o cartão volta; aceito, ela se desfaz
     * sozinha quando o registro chega gravado (ver positionOf).
     *
     * Uma origem que responda "sucesso" sem mover nada deixaria o cartão adiantado até a próxima
     * leitura da coleção. É o preço de não inventar um relógio aqui — e o sinal certo continua
     * sendo o dado, não um tempo que a agenda arbitrasse.
     */
    setMoves((prev) => ({ ...prev, [record.id]: { from: shown ? dayKey(shown) : null, to: day.key } }));

    const ok = await executarMovimento(handler, record, { targetDate: day.key });
    if (!ok) {
      setMoves((prev) => {
        const next = {};
        for (const id of Object.keys(prev)) if (id !== record.id) next[id] = prev[id];
        return next;
      });
    }
  }, [records, moveActions, moveLayout, executarMovimento, notify, isVisible]);

  if (!list.definition) {
    return (
      <div style={{ padding: '24px' }}>
        <InfoBanner message='Tela "Calendário" não encontrada. Instale a extensão para ativá-la.' variant="warning" />
      </div>
    );
  }

  return (
    <>
      <StatsBar>
        <StatItem>
          <StatValue>{stats.total}</StatValue>
          <StatLabel>No mês</StatLabel>
        </StatItem>
        <StatItem>
          <StatValue $color={theme.colors.warning}>{stats.pending}</StatValue>
          <StatLabel>Pendentes</StatLabel>
        </StatItem>
        <StatItem>
          <StatValue $color={theme.colors.success}>{stats.closed}</StatValue>
          <StatLabel>Concluídos</StatLabel>
        </StatItem>
        <StatItem>
          <StatValue $color={theme.colors.danger}>{stats.late}</StatValue>
          <StatLabel>Atrasados</StatLabel>
        </StatItem>
      </StatsBar>

      <CalendarCard>
        <MonthNav>
          <NavButton onClick={() => goToMonth(-1)} aria-label="Mês anterior">
            <Icon name="arrowLeft" size={20} />
          </NavButton>
          <MonthLabel>{monthLabel}</MonthLabel>
          <NavButton onClick={() => goToMonth(1)} aria-label="Próximo mês">
            <Icon name="arrowRight" size={20} />
          </NavButton>
          <TodayButton onClick={goToToday}>Hoje</TodayButton>
        </MonthNav>

        <FilterRow>
          <CompositeFilter
            defs={list.filterDefs}
            tokens={list.filterTokens}
            onChange={list.setFilterTokens}
            screenKey={list.savedFiltersScreenKey}
            placeholder="Filtrar a agenda..."
          />
        </FilterRow>

        <DayColumnsScroller ref={scrollerRef}>
          {days.map((day) => (
            <DayColumn
              key={day.key}
              $isToday={day.isToday}
              $isDragOver={dragOverKey === day.key}
              data-today={day.isToday ? 'true' : undefined}
              onDragOver={(e) => { e.preventDefault(); setDragOverKey(day.key); }}
              onDragLeave={() => setDragOverKey((prev) => (prev === day.key ? null : prev))}
              onDrop={(e) => { e.preventDefault(); handleDrop(day, e.dataTransfer.getData('text/plain')); }}
            >
              <DayHeader $isToday={day.isToday}>
                <DayNumber $isToday={day.isToday}>{day.dayNumber}</DayNumber>
                <DayName>{day.weekday}</DayName>
              </DayHeader>

              <DayEvents>
                {day.items.map(({ record, position }) => (
                  <EventCard
                    key={record.id}
                    $color={priorityColor(record)}
                    $done={isClosed(record)}
                    $dragging={draggingId === record.id}
                    $pending={position.pending}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', record.id);
                      e.dataTransfer.effectAllowed = 'move';
                      setDraggingId(record.id);
                    }}
                    onDragEnd={() => { setDraggingId(null); setDragOverKey(null); }}
                    onClick={() => {
                      if (record.origem && record.origemId) openRecord(record.origem, record.origemId);
                    }}
                    title={text(record.title)}
                  >
                    <EventTitle>{list.getCardTitle(record)}</EventTitle>

                    <EventMeta>
                      {record.hour ? (
                        <MetaRow><Icon name="time" size={10} /><span>{record.hour}</span></MetaRow>
                      ) : null}

                      {/*
                        As linhas do cartão saem da CONFIGURAÇÃO da tela — os campos marcados para
                        aparecer na listagem. É por aqui que o campo acrescentado por outra extensão
                        (o processo de um prazo, a pessoa de uma audiência) chega ao cartão sem que
                        a agenda o conheça pelo nome.
                      */}
                      {list.getCardItems(record).map((item) => (
                        <MetaRow key={item.key}>
                          <span>{item.value}</span>
                        </MetaRow>
                      ))}

                      <BadgeRow>
                        <Badge $color={getConfigColor(statusOptions, record.status, theme)}>
                          {labelOf(statusOptions, record.status)}
                        </Badge>
                        <Badge $color={priorityColor(record)}>
                          {labelOf(priorityOptions, record.priority)}
                        </Badge>
                      </BadgeRow>

                      {record.description ? (
                        <EventDescription>{record.description}</EventDescription>
                      ) : null}
                    </EventMeta>

                    {/*
                      Os gestos do cartão vêm da CONFIGURAÇÃO da tela — "Ações do card na listagem"
                      do Form Design —, resolvidos pelo mesmo caminho de qualquer listagem: as ações
                      nativas que a tela habilitou mais as do escritório, já com a expressão de
                      visibilidade avaliada registro a registro. A agenda não conhece nenhuma pelo nome, e o
                      usuário acrescenta ou tira quantas quiser sem tocar neste código.
                    */}
                    {list.getCardActions(record).length > 0 ? (
                      <CardActions className="calendar-card-actions">
                        {list.getCardActions(record).map((action) => (
                          <CardActionButton
                            key={action.key}
                            type="button"
                            title={action.title}
                            disabled={action.disabled}
                            onClick={(e) => { e.stopPropagation(); action.onClick(); }}
                          >
                            {cardActionIcon(action, 11)}
                          </CardActionButton>
                        ))}
                      </CardActions>
                    ) : null}
                  </EventCard>
                ))}
              </DayEvents>
            </DayColumn>
          ))}
        </DayColumnsScroller>

        <Legend>
          <LegendLabel>Prioridade:</LegendLabel>
          <LegendItem onClick={() => filterByPriority(null)}>
            <span>Todas</span>
          </LegendItem>
          {priorityOptions.map((option) => (
            <LegendItem
              key={option.key}
              $dimmed={priorityToken !== null && priorityToken !== option.key}
              onClick={() => filterByPriority(option.key)}
            >
              <LegendDot $color={getConfigColor(priorityOptions, option.key, theme)} />
              <span>{option.label}</span>
            </LegendItem>
          ))}
        </Legend>
      </CalendarCard>

      {/* Ação que pergunta parâmetros antes de executar, confirmação de exclusão e etiquetas — os
          mesmos modais da listagem padrão. Sem eles, uma ação com parâmetros ficaria esperando por
          uma pergunta que ninguém desenha. */}
      <EntityListModals vm={list} />
    </>
  );
}
`;

export const calendarPlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.calendar',
    version: '1.0.0',
    kernel: '^1.0.0',
    name: 'Calendário',
    description: 'A agenda do escritório, agnóstica: qualquer extensão põe um item nela e continua dona dele.',
    publisher: { name: 'Microteia' },
    dependencies: { 'core.ui': '^1.0.0' },
    extensionPoints: EXTENSION_POINTS,
    contributes: [
      nav({ key: 'calendar', label: 'Calendário', icon: 'calendar', order: 20 }),
      page({ key: 'calendar', title: 'Calendário', icon: 'calendar' }, 'calendar'),
      settingsSection({
        key: 'calendar',
        title: 'Calendário',
        description: 'Como a agenda responde aos gestos do usuário.',
        icon: 'calendar',
        order: 30,
        properties: [
          {
            key: 'calendar.moveActions',
            label: 'Ao arrastar um item para outro dia',
            description:
              'As ações que respondem à mudança de dia, na ordem em que são consultadas. Vale a primeira que atende a origem do item — arrastar não grava nada por conta própria.',
            type: 'contributions',
            point: CALENDAR_MOVE_POINT,
            default: [],
            scopes: ['tenant'],
          },
        ],
      }),
    ],
  },
  summary:
    'A agenda do escritório em colunas de dia, com o mês inteiro numa rolagem que abre no dia de hoje. Ela não conhece prazo, audiência nem parcela: qualquer extensão registra um item, continua dona dele e diz o que acontece quando o usuário o arrasta para outro dia.',
  overview: {
    type: 'stack',
    gap: 'lg',
    children: [
      {
        type: 'markdown',
        content:
          'O **Calendário** mostra, lado a lado, os dias do mês e o que está marcado em cada um. A rolagem abre no dia de hoje, o cartão é colorido pela prioridade e a legenda embaixo filtra por ela num clique.\n\nA agenda não é dona de nada do que mostra. Cada item pertence ao registro que o criou — um prazo, uma audiência, uma parcela — e é esse registro que o mantém em dia: mudou lá, muda aqui; foi excluído lá, some daqui. Por isso o item não se edita pela agenda, e clicar no cartão leva direto ao registro de origem.\n\nArrastar um cartão para outro dia **pergunta** à extensão dona do item o que fazer. Em Configurações › Calendário você escolhe quais respondem e em que ordem.',
      },
      {
        type: 'keyValue',
        items: [
          { label: 'Adiciona', value: 'Item "Calendário" no menu' },
          { label: 'Mostra', value: 'O mês inteiro, em colunas de dia' },
          { label: 'Filtro', value: 'Por situação, prioridade, data — e o que as extensões acrescentarem' },
          { label: 'Arrastar', value: 'Executa a ação que a origem declarou' },
        ],
      },
      {
        type: 'banner',
        message: 'Sozinha, a agenda abre vazia: quem a preenche são as extensões que registram itens nela, como a de Prazos.',
        variant: 'info',
      },
    ],
  },
  workflows: [],
  screens: [CALENDAR_SCREEN],
  lookups: LOOKUPS,
  views: [
    { key: 'calendar', title: 'Calendário', icon: 'calendar', source: CALENDAR_SOURCE },
  ],
};
