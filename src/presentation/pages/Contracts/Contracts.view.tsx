import React from 'react';
import {
  RiFileTextLine,
  RiCalendarLine,
  RiLinkM,
  RiFileCopyLine,
  RiPriceTag3Line,
  RiDeleteBinLine,
} from 'react-icons/ri';
import { S } from './Contracts.styles';
import { useContractsViewModel } from './Contracts.viewmodel';
import { Badge } from '../../components/ui/Badge';
import { CustomFieldMetaRows } from '../../components/ui/CustomFieldMetaRows';
import { EntityListCard, type EntityCardAction } from '../../components/ui/EntityListCard';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { TagManager } from '../../components/ui/TagManager';
import { EntityListView } from '../../components/layout/EntityListView';
import { getScreenIcon } from '../../shared/screenIcons';
import { useContractTagStore } from '../../../stores/useContractTagStore';
import { useListRowResolver } from '../../shared/listRows';
import { CONTRACT_LIST_ROWS } from './contractListSchema';

export const ContractsView: React.FC = () => {
  const vm = useContractsViewModel();
  const { tags } = useContractTagStore();
  const resolveRow = useListRowResolver();

  return (
    <EntityListView
      title="Contratos"
      titleIcon={<RiFileTextLine size={22} />}
      onNew={vm.openNewContract}
      newTitle="Novo Contrato"
      filterDefs={vm.filterDefs}
      filterTokens={vm.filterTokens}
      onFilterChange={vm.setFilterTokens}
      filterPlaceholder="Filtrar contratos..."
      savedFiltersScreenKey={vm.savedFiltersScreenKey}
      isLoading={vm.isLoading}
      isEmpty={vm.filteredContracts.length === 0}
      emptyIcon={<RiFileTextLine />}
      emptyTitle="Nenhum contrato encontrado"
      modals={
        <>
          {vm.tagManagerContract && (
            <TagManager
              entityId={vm.tagManagerContract.id}
              onClose={vm.closeTagManager}
              adapter={vm.tagAdapter}
            />
          )}
          <ConfirmModal
            isOpen={vm.contractToDelete !== null}
            title="Excluir contrato"
            message={`Tem certeza que deseja excluir "${vm.contractToDelete?.title ?? ''}"? As anotações e documentos vinculados também serão excluídos.`}
            variant="danger"
            confirmLabel="Excluir"
            onConfirm={() => void vm.confirmDelete()}
            onCancel={vm.cancelDelete}
          />
        </>
      }
      emptyActionLabel="Cadastrar primeiro contrato"
    >
      {vm.filteredContracts.map((c) => {
        const contractTags = tags.filter((t) => c.tagIds?.includes(t.id));
        const contractorNames = vm.getPersonNames(c.contractorIds);
        const contracteeNames = vm.getPersonNames(c.contracteeIds);
        const hasParties = contractorNames.length > 0 || contracteeNames.length > 0;
        const customItems = vm.getCustomFieldItems(c);
        const record = c as unknown as Record<string, unknown>;

        // Exclusivo do Contrato: badges de status/tipo e as colunas Contratante/Contratado.
        const belowHeader = (
          <>
            <S.Badges>
              <Badge color={vm.getStatusColor(c.status)}>{c.status}</Badge>
              <Badge>{c.type}</Badge>
            </S.Badges>

            {hasParties && (
              <S.PartesRow>
                <S.PoleColumn $side="left">
                  <S.PoleLabel>Contratante</S.PoleLabel>
                  {contractorNames.length > 0
                    ? contractorNames.map((n) => <S.PoleName key={n}>{n}</S.PoleName>)
                    : <S.PoleEmpty>—</S.PoleEmpty>}
                </S.PoleColumn>
                <S.PoleColumn $side="right">
                  <S.PoleLabel>Contratado</S.PoleLabel>
                  {contracteeNames.length > 0
                    ? contracteeNames.map((n) => <S.PoleName key={n}>{n}</S.PoleName>)
                    : <S.PoleEmpty>—</S.PoleEmpty>}
                </S.PoleColumn>
              </S.PartesRow>
            )}
          </>
        );

        // A vigência é uma composição de dois campos (início – fim): como duas linhas separadas
        // ficaria ambígua sem rótulo, segue montada aqui. As demais linhas vêm do registry.
        const vigencia = (c.effectiveStart || c.effectiveEnd)
          ? `${c.effectiveStart ? c.effectiveStart.toLocaleDateString('pt-BR') : '—'} – ${c.effectiveEnd ? c.effectiveEnd.toLocaleDateString('pt-BR') : '—'}`
          : '';

        const metaRows = [
          ...(vigencia ? [{ key: 'vigencia', icon: <RiCalendarLine size={12} />, value: vigencia }] : []),
          ...CONTRACT_LIST_ROWS
            .map((row) => ({
              key: row.key,
              icon: getScreenIcon(row.icon, 12),
              value: resolveRow(record, row),
            }))
            .filter((row) => row.value !== ''),
        ];

        const configurable: Record<string, EntityCardAction> = {
          copyLink: { key: 'copyLink', icon: <RiLinkM size={13} />, title: 'Copiar link', onClick: () => vm.handleCopyLink(c) },
          clone: { key: 'clone', icon: <RiFileCopyLine size={13} />, title: 'Duplicar', onClick: () => vm.handleClone(c) },
          manageTags: { key: 'manageTags', icon: <RiPriceTag3Line size={13} />, title: 'Gerenciar etiquetas', onClick: () => vm.setTagManagerContract(c) },
          delete: { key: 'delete', icon: <RiDeleteBinLine size={13} />, title: 'Excluir', danger: true, onClick: () => vm.setContractToDelete(c) },
        };

        return (
          <EntityListCard
            actions={vm.listActions.map((key) => configurable[key]).filter(Boolean)}
            key={c.id}
            onClick={() => vm.openContract(c)}
            avatar={<RiFileTextLine size={22} />}
            title={c.title}
            subtitle={c.number}
            belowHeader={belowHeader}
            metaRows={metaRows}
            tags={contractTags}
            extra={customItems.length > 0 ? <CustomFieldMetaRows items={customItems} /> : undefined}
          />
        );
      })}
    </EntityListView>
  );
};
