import React from 'react';
import {
  RiFileAddLine,
  RiFileTextLine,
  RiMoneyDollarCircleLine,
  RiCalendarLine,
} from 'react-icons/ri';
import { S } from './Contracts.styles';
import { useContractsViewModel } from './Contracts.viewmodel';
import { CompositeFilter } from '../../components/ui/CompositeFilter';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { CustomFieldMetaRows } from '../../components/ui/CustomFieldMetaRows';
import { useContractTagStore } from '../../../stores/useContractTagStore';
import { formatCurrencyBRL } from '../../../utils/formatters';

export const ContractsView: React.FC = () => {
  const vm = useContractsViewModel();
  const { tags } = useContractTagStore();

  return (
    <S.Page>
      <S.Header>
        <S.Title>Contratos</S.Title>
        <Button onClick={vm.openNewContract} title="Novo Contrato">
          <RiFileAddLine size={16} />
        </Button>
      </S.Header>

      <S.Toolbar>
        <CompositeFilter
          defs={vm.filterDefs}
          tokens={vm.filterTokens}
          onChange={vm.setFilterTokens}
          placeholder="Filtrar contratos..."
          screenKey={vm.savedFiltersScreenKey}
        />
      </S.Toolbar>

      <S.Content>
        {vm.isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '48px' }}>
            <Spinner />
          </div>
        ) : vm.filteredContracts.length === 0 ? (
          <S.EmptyState>
            <S.EmptyIcon><RiFileTextLine /></S.EmptyIcon>
            <S.EmptyTitle>Nenhum contrato encontrado</S.EmptyTitle>
            <Button onClick={vm.openNewContract} variant="secondary">
              <RiFileAddLine size={14} />
              Cadastrar primeiro contrato
            </Button>
          </S.EmptyState>
        ) : (
          <S.Grid>
            {vm.filteredContracts.map((c) => {
              const contractTags = tags.filter((t) => c.tagIds?.includes(t.id));
              const contractorNames = vm.getPersonNames(c.contractorIds);
              const contracteeNames = vm.getPersonNames(c.contracteeIds);
              return (
                <S.ContractCard key={c.id} onClick={() => vm.openContract(c)}>
                  <S.CardHeader>
                    <S.CardAvatar $color={vm.getStatusColor(c.status)}>
                      <RiFileTextLine size={22} />
                    </S.CardAvatar>
                    <S.CardHeaderInfo>
                      <S.CardTitle>{c.title}</S.CardTitle>
                      <S.CardNumber>{c.number}</S.CardNumber>
                    </S.CardHeaderInfo>
                  </S.CardHeader>

                  <S.Badges>
                    <Badge color={vm.getStatusColor(c.status)}>{c.status}</Badge>
                    <Badge>{c.type}</Badge>
                  </S.Badges>

                  {(contractorNames.length > 0 || contracteeNames.length > 0) && (
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

                  <S.Meta>
                    {(c.effectiveStart || c.effectiveEnd) && (
                      <S.MetaRow>
                        <RiCalendarLine size={12} />
                        <S.MetaText>
                          {c.effectiveStart ? c.effectiveStart.toLocaleDateString('pt-BR') : '—'}
                          {' – '}
                          {c.effectiveEnd ? c.effectiveEnd.toLocaleDateString('pt-BR') : '—'}
                        </S.MetaText>
                      </S.MetaRow>
                    )}
                    {c.totalValue != null && (
                      <S.MetaRow>
                        <RiMoneyDollarCircleLine size={12} />
                        <S.MetaText>{formatCurrencyBRL(c.totalValue)}</S.MetaText>
                      </S.MetaRow>
                    )}
                  </S.Meta>

                  <CustomFieldMetaRows items={vm.getCustomFieldItems(c)} />

                  {contractTags.length > 0 && (
                    <S.Tags onClick={(e) => e.stopPropagation()}>
                      {contractTags.map((t) => (
                        <S.TagPill key={t.id} $color={t.color}>
                          <S.TagDot $color={t.color} />
                          {t.name}
                        </S.TagPill>
                      ))}
                    </S.Tags>
                  )}
                </S.ContractCard>
              );
            })}
          </S.Grid>
        )}
      </S.Content>
    </S.Page>
  );
};
