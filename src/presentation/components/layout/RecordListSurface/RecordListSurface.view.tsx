import React from 'react';
import { RiApps2Line, RiUploadLine } from 'react-icons/ri';
import { Button } from '../../ui/Button';
import { CustomFieldMetaRows } from '../../ui/CustomFieldMetaRows';
import { EntityListCard } from '../../ui/EntityListCard';
import { RecordCardTemplate } from '../../ui/RecordCardTemplate';
import { UserAvatar } from '../../ui/UserAvatar';
import { EntityListView } from '../EntityListView';
import { EntityListModals } from './EntityListModals';
import { cardActionIcon } from './cardActionIcon';
import { getScreenIcon } from '../../../shared/screenIcons';
import { deriveListRows } from '../../../shared/deriveEntitySchema';
import { useSchemaContext } from '../../../shared/useSchemaContext';
import { useListRowResolver } from '../../../shared/listRows';
import { useCardTemplateResolvers } from '../../../shared/entityScreen/useCardTemplateResolvers';
import { readCardTemplate } from '../../../../domain/schema/ui/cardTemplate';
import { useLabel, useT } from '../../../shared/i18n/useT';
import type { RecordListViewModel } from '../../../shared/entityScreen/useRecordListViewModel';
import type { EntityRecord, ScreenDefinition } from '../../../../domain/entities';

interface RecordListSurfaceProps {
  vm: RecordListViewModel;
  definition: ScreenDefinition;
  variant?: 'page' | 'embedded';
  /**
   * Slots OPCIONAIS para conteúdo específico da tela — o que uma extensão injeta sem abrir mão do
   * resto padrão (ações, filtros, etiquetas e modais continuam vindo da configuração/Form Design).
   * `renderSubtitle` SUBSTITUI o subtítulo declarado (`subtitleFieldKey`) quando a tela precisa de
   * mais do que um campo ali; `renderBelowHeader` alimenta a faixa logo abaixo do cabeçalho (ex.:
   * badges próprios, colunas de polos). Ausentes, o card é o padrão de sempre.
   */
  renderSubtitle?: (record: EntityRecord) => React.ReactNode;
  renderBelowHeader?: (record: EntityRecord) => React.ReactNode;
  /**
   * Linhas ACRESCENTADAS ao começo das meta-linhas do card, para o que a declaração de um campo não
   * alcança: uma composição de dois campos (a vigência do contrato é "início – fim"; separadas, as
   * duas datas ficariam sem sentido). As linhas declaradas em `listIcon` seguem depois, intactas.
   */
  renderMetaRows?: (record: EntityRecord) => { key: string; icon?: React.ReactNode; value: string }[];
  /**
   * Cor da faixa no alto do card, por registro. É o realce que se lê de UMA olhada na lista inteira,
   * antes de ler qualquer texto — a prioridade de um prazo, a criticidade de um chamado. Ausente, o
   * card não tem faixa.
   */
  accentColor?: (record: EntityRecord) => string | undefined;
  /**
   * Redireciona abrir/criar registro para uma tela PRÓPRIA (ex.: um editor de código da extensão),
   * no lugar do detalhe dinâmico nativo. Ausentes, mantêm o comportamento padrão (`vm.openRecord`/
   * `vm.openNewRecord`).
   */
  onOpenRecord?: (record: EntityRecord) => void;
  onNewRecord?: () => void;
  /**
   * A tela cria registros. Ausente, vale a PERMISSÃO da coleção — quem hospeda a lista só precisa
   * dizer algo aqui para restringir MAIS que isso (uma aba de leitura, por exemplo).
   */
  canCreate?: boolean;
  /** Textos do estado vazio, quando a tela prefere os seus aos genéricos. */
  emptyTitle?: string;
  emptyActionLabel?: string;
  /**
   * Conteúdo próprio da PÁGINA (não do card): `headerActions` entra no cabeçalho, antes do botão
   * "novo"; `summary` ocupa a faixa entre o cabeçalho e o filtro. É o que uma barra de totais precisa
   * — uma soma sobre os registros filtrados não é declarável campo a campo.
   */
  headerActions?: React.ReactNode;
  summary?: React.ReactNode;
}

/**
 * Listagem de registros de uma tela customizada. A mesma superfície serve à janela própria da tela
 * e à aba de registros filhos dentro do pai — só muda a variante do `EntityListView`.
 */
export const RecordListSurface: React.FC<RecordListSurfaceProps> = ({ vm, definition, variant = 'page', renderSubtitle, renderBelowHeader, renderMetaRows, accentColor, onOpenRecord, onNewRecord, canCreate, emptyTitle, emptyActionLabel, headerActions, summary }) => {
  const t = useT('core.records');
  // O título da tela é DECLARATIVO: referência numa tela de extensão, texto digitado numa do
  // escritório. `resolveLabel` atende os dois.
  const label = useLabel();
  const openRecord = onOpenRecord ?? vm.openRecord;
  const openNewRecord = onNewRecord ?? vm.openNewRecord;
  const modals = <EntityListModals vm={vm} />;
  const schemaContext = useSchemaContext();
  const resolveRow = useListRowResolver();
  // O cartão DECLARADO pela tela (`cardTemplate`). O arranjo (grade ou lista) vale sempre; o desenho,
  // só quando quem hospeda a lista não trouxe cartão de código — a view de uma extensão que já passa
  // slots continua dona do cartão que desenha.
  const cardTemplate = readCardTemplate(definition.cardTemplate);
  const hostDrawsCard = !!(renderSubtitle || renderBelowHeader || renderMetaRows || accentColor);
  const declaredBody = !hostDrawsCard ? cardTemplate?.body : undefined;
  const templateResolvers = useCardTemplateResolvers(vm);
  // As meta-linhas que a COLEÇÃO declara — venham do registro do kernel ou da tela que a descreve
  // (`listIcon`). Sem nenhuma declarada, o card segue só com os campos marcados "exibir na
  // listagem". Mesmo caminho das listas fixas: mesma aparência, mesma ordem.
  // O campo do subtítulo não se repete como meta-linha: seria a mesma informação duas vezes no
  // cartão, como já vale entre as meta-linhas e o bloco de campos adicionais.
  const listRows = deriveListRows(schemaContext, vm.collection)
    .filter((row) => row.key !== definition.subtitleFieldKey);
  // O ícone da TELA é o piso do avatar: um registro sem imagem, ou uma tela que não declarou campo
  // de imagem, segue com ele. `UserAvatar` cuida do carregamento, da falha e do cache — dois
  // componentes de imagem seriam dois caches, e o mesmo registro shimmeraria de novo no detalhe.
  const screenIcon = getScreenIcon(definition.icon, 22);
  const recordAvatar = (record: EntityRecord): React.ReactNode => {
    const url = vm.getCardImageUrl(record);
    if (!url) return screenIcon;
    return <UserAvatar src={url} name={vm.getCardTitle(record)} size={44} fallback={screenIcon} />;
  };

  // O campo declarado como subtítulo serve ao cartão como já serve ao cabeçalho do detalhe e ao
  // rótulo da aba: uma declaração, três lugares. Sem ela, o cartão segue só com título e linhas.
  const declaredSubtitle = (record: EntityRecord): React.ReactNode => {
    const text = vm.getCardSubtitle(record);
    if (!text) return undefined;
    return vm.cardSubtitleIconKey
      ? <>{getScreenIcon(vm.cardSubtitleIconKey, 12)}{text}</>
      : text;
  };

  return (
    <EntityListView
      variant={variant}
      layout={cardTemplate?.layout}
      cardMinWidth={cardTemplate?.minWidth}
      title={label(definition.titlePlural)}
      titleIcon={getScreenIcon(definition.icon, 22)}
      onNew={openNewRecord}
      canCreate={canCreate ?? vm.canCreate}
      newTitle={t('record.new.title', { entity: label(definition.titleSingular) })}
      filterDefs={vm.filterDefs}
      filterTokens={vm.filterTokens}
      onFilterChange={vm.setFilterTokens}
      filterPlaceholder={t('record.filter.placeholder', { entity: label(definition.titlePlural) })}
      savedFiltersScreenKey={vm.savedFiltersScreenKey}
      isLoading={vm.isLoading && vm.records.length === 0}
      isEmpty={vm.filteredRecords.length === 0}
      emptyIcon={<RiApps2Line />}
      emptyTitle={emptyTitle ?? t('record.list.empty')}
      emptyActionLabel={emptyActionLabel ?? t('record.create-action', { entity: label(definition.titleSingular) })}
      headerExtra={vm.recordImport
        ? (
          <>
            {headerActions}
            <Button variant="secondary" size="sm" onClick={vm.recordImport.open} title={t('import.open')}>
              <RiUploadLine size={14} />
              {t('import.open')}
            </Button>
          </>
        )
        : headerActions}
      belowHeader={summary}
      modals={modals}
    >
      {vm.filteredRecords.map((record) => {
        if (declaredBody) {
          return (
            <RecordCardTemplate
              key={record.id}
              body={declaredBody}
              record={record}
              resolvers={templateResolvers}
              screenIcon={definition.icon}
              accentColor={cardTemplate?.accent ? vm.getCardAccentColor(record, cardTemplate.accent.field) : undefined}
              onOpen={() => openRecord(record)}
            />
          );
        }
        const recordTags = vm.tags.filter((t) => record.tagIds?.includes(t.id));
        const items = vm.getCardItems(record);
        const metaRows = [
          ...(renderMetaRows?.(record) ?? []),
          ...listRows
            .map((row) => ({
              key: row.key,
              icon: getScreenIcon(row.icon, 12),
              value: resolveRow(record as unknown as Record<string, unknown>, row),
            })),
        ].filter((row) => row.value !== '');
        return (
          <EntityListCard
            key={record.id}
            onClick={() => openRecord(record)}
            accentColor={accentColor?.(record)}
            avatar={recordAvatar(record)}
            title={vm.getCardTitle(record)}
            subtitle={renderSubtitle ? renderSubtitle(record) : declaredSubtitle(record)}
            belowHeader={renderBelowHeader?.(record)}
            metaRows={metaRows}
            tags={recordTags}
            actions={vm.getCardActions(record).map((action) => ({
              key: action.key,
              icon: cardActionIcon(action),
              title: action.title,
              danger: action.danger,
              disabled: action.disabled,
              active: action.active,
              onClick: action.onClick,
            }))}
            extra={items.length > 0 ? <CustomFieldMetaRows items={items} /> : undefined}
          />
        );
      })}
    </EntityListView>
  );
};
