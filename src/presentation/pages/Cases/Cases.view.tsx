import React from 'react';
import {
  RiFolderAddLine,
  RiFolderLine,
  RiScalesLine,
  RiMoneyDollarCircleLine,
} from 'react-icons/ri';
import { S } from './Cases.styles';
import { useCasesViewModel } from './Cases.viewmodel';
import { CompositeFilter } from '../../components/ui/CompositeFilter';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { CustomFieldMetaRows } from '../../components/ui/CustomFieldMetaRows';
import { useCaseTagStore } from '../../../stores/useCaseTagStore';

export const CasesView: React.FC = () => {
  const vm = useCasesViewModel();
  const { tags } = useCaseTagStore();

  return (
    <S.Page>
      <S.Header>
        <S.Title>Processos</S.Title>
        <Button onClick={vm.openNewCase} title="Novo Processo">
          <RiFolderAddLine size={16} />
        </Button>
      </S.Header>

      <S.Toolbar>
        <CompositeFilter
          defs={vm.filterDefs}
          tokens={vm.filterTokens}
          onChange={vm.setFilterTokens}
          placeholder="Filtrar processos..."
          screenKey={vm.savedFiltersScreenKey}
        />
      </S.Toolbar>

      <S.Content>
        {vm.isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '48px' }}>
            <Spinner />
          </div>
        ) : vm.filteredCases.length === 0 ? (
          <S.EmptyState>
            <S.EmptyIcon><RiFolderLine /></S.EmptyIcon>
            <S.EmptyTitle>Nenhum processo encontrado</S.EmptyTitle>
            <Button onClick={vm.openNewCase} variant="secondary">
              <RiFolderAddLine size={14} />
              Cadastrar primeiro processo
            </Button>
          </S.EmptyState>
        ) : (
          <S.Grid>
            {vm.filteredCases.map((c) => {
              const caseTags = tags.filter((t) => c.tagIds?.includes(t.id));
              return (
                <S.CaseCard key={c.id} onClick={() => vm.openCase(c)}>
                  <S.CaseHeader>
                    <S.CaseAvatar $color={vm.getStatusColor(c.status)}>
                      <RiFolderLine size={22} />
                    </S.CaseAvatar>
                    <S.CaseHeaderInfo>
                      <S.CaseTitle>{c.title}</S.CaseTitle>
                      {c.caseNumber && (
                        <S.CaseNumberRow>
                          <S.CaseNumber>{c.caseNumber}</S.CaseNumber>
                          {(() => {
                            const days = vm.getDaysInTramitation(c);
                            return days !== null
                              ? <S.DaysChip>{days} dias</S.DaysChip>
                              : null;
                          })()}
                        </S.CaseNumberRow>
                      )}
                    </S.CaseHeaderInfo>
                  </S.CaseHeader>

                  <S.Badges>
                    <Badge color={vm.getStatusColor(c.status)}>
                      {c.status}
                    </Badge>
                    <Badge color={vm.getPhaseColor(c.phase)}>
                      {c.phase}
                    </Badge>
                  </S.Badges>

                  {((c.activePoleIds?.length ?? 0) > 0 || (c.passivePoleIds?.length ?? 0) > 0) && (() => {
                    const activeNames = vm.getPartyNames(c.activePoleIds ?? []);
                    const passiveNames = vm.getPartyNames(c.passivePoleIds ?? []);
                    return (
                      <S.PartesRow>
                        <S.PoleColumn $side="left">
                          <S.PoleLabel>Polo Ativo</S.PoleLabel>
                          {activeNames.length > 0
                            ? activeNames.map((n) => <S.PoleName key={n}>{n}</S.PoleName>)
                            : <S.PoleEmpty>—</S.PoleEmpty>}
                        </S.PoleColumn>
                        <S.PoleColumn $side="right">
                          <S.PoleLabel>Polo Passivo</S.PoleLabel>
                          {passiveNames.length > 0
                            ? passiveNames.map((n) => <S.PoleName key={n}>{n}</S.PoleName>)
                            : <S.PoleEmpty>—</S.PoleEmpty>}
                        </S.PoleColumn>
                      </S.PartesRow>
                    );
                  })()}

                  <S.CaseMeta>
                    {c.responsibleLawyerName && (
                      <S.MetaRow>
                        <RiScalesLine size={12} />
                        <S.MetaText>{c.responsibleLawyerName}</S.MetaText>
                      </S.MetaRow>
                    )}
                    {c.instance && (
                      <S.MetaRow>
                        <RiScalesLine size={12} />
                        <S.MetaText>{c.instance} - {c.court}</S.MetaText>
                      </S.MetaRow>
                    )}
                    {c.type && c.type.length > 0 && (
                      <S.MetaRow>
                        <RiScalesLine size={12} />
                        <S.MetaText>{c.area} - {Array.isArray(c.type) ? c.type.join(', ') : c.type}</S.MetaText>
                      </S.MetaRow>
                    )}
                    {c.causeValue != null && (
                      <S.MetaRow>
                        <RiMoneyDollarCircleLine size={12} />
                        <S.MetaText>
                          {c.causeValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </S.MetaText>
                      </S.MetaRow>
                    )}
                  </S.CaseMeta>

                  <CustomFieldMetaRows items={vm.getCustomFieldItems(c)} />

                  {caseTags.length > 0 && (
                    <S.Tags onClick={(e) => e.stopPropagation()}>
                      {caseTags.map((t) => (
                        <S.TagPill key={t.id} $color={t.color}>
                          <S.TagDot $color={t.color} />
                          {t.name}
                        </S.TagPill>
                      ))}
                    </S.Tags>
                  )}
                </S.CaseCard>
              );
            })}
          </S.Grid>
        )}
      </S.Content>
    </S.Page>
  );
};
