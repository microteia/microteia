import React from 'react';
import {
  RiUserAddLine,
  RiUserLine,
  RiBuildingLine,
  RiPhoneLine,
  RiMailLine,
  RiMapPinLine,
  RiIdCardLine,
  RiBriefcaseLine,
} from 'react-icons/ri';
import { S } from './Persons.styles';
import { usePersonsViewModel } from './Persons.viewmodel';
import { CompositeFilter } from '../../components/ui/CompositeFilter';
import { Button } from '../../components/ui/Button';
import { CustomFieldMetaRows } from '../../components/ui/CustomFieldMetaRows';

import { Spinner } from '../../components/ui/Spinner';
import { usePersonTagStore } from '../../../stores/usePersonTagStore';

export const PersonsView: React.FC = () => {
  const vm = usePersonsViewModel();
  const { tags } = usePersonTagStore();

  return (
    <S.Page>
      <S.Header>
        <S.Title>Pessoas</S.Title>
        <Button onClick={vm.openNewPerson}>
          <RiUserAddLine size={16} />
          Nova Pessoa
        </Button>
      </S.Header>

      <S.Toolbar>
        <CompositeFilter
          defs={vm.filterDefs}
          tokens={vm.filterTokens}
          onChange={vm.setFilterTokens}
          placeholder="Filtrar pessoas..."
          screenKey={vm.savedFiltersScreenKey}
        />
      </S.Toolbar>

      <S.Content>
        {vm.isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '48px' }}>
            <Spinner />
          </div>
        ) : vm.filteredPersons.length === 0 ? (
          <S.EmptyState>
            <S.EmptyIcon><RiUserLine /></S.EmptyIcon>
            <S.EmptyTitle>Nenhuma pessoa encontrada</S.EmptyTitle>
            <Button onClick={vm.openNewPerson} variant="secondary">
              <RiUserAddLine size={14} />
              Cadastrar primeira pessoa
            </Button>
          </S.EmptyState>
        ) : (
          <S.Grid>
            {vm.filteredPersons.map((person) => {
              const personTags = tags.filter((t) => person.tagIds?.includes(t.id));
              return (
                <S.PersonCard key={person.id} onClick={() => vm.openPerson(person)}>
                  <S.PersonHeader>
                    <S.PersonAvatar>
                      {person.name.charAt(0).toUpperCase()}
                    </S.PersonAvatar>
                    <S.PersonHeaderInfo>
                      <S.PersonName>{person.name}</S.PersonName>
                      <S.PersonType>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {person.type === 'Pessoa Física' ? <RiUserLine size={11} /> : <RiBuildingLine size={11} />}
                          {person.type}
                        </span>
                        {person.relationship && (
                          <S.RelationshipBadge $color={vm.getRelationshipColor(person.relationship)}>
                            {person.relationship}
                          </S.RelationshipBadge>
                        )}
                      </S.PersonType>
                    </S.PersonHeaderInfo>
                    {person.status !== 'Ativo' && (
                      <S.InactiveBadge>Inativo</S.InactiveBadge>
                    )}
                  </S.PersonHeader>

                  <S.PersonMeta>
                    {(person.cpf || person.cnpj) && (
                      <S.MetaRow>
                        <RiIdCardLine size={12} />
                        {person.cpf ?? person.cnpj}
                      </S.MetaRow>
                    )}
                    {person.email && (
                      <S.MetaRow>
                        <RiMailLine size={12} />
                        {person.email}
                      </S.MetaRow>
                    )}
                    {person.phone && (
                      <S.MetaRow>
                        <RiPhoneLine size={12} />
                        {person.phone}
                        {person.secondaryPhone && ` · ${person.secondaryPhone}`}
                      </S.MetaRow>
                    )}
                    {person.occupation && (
                      <S.MetaRow>
                        <RiBriefcaseLine size={12} />
                        {person.occupation}
                      </S.MetaRow>
                    )}
                    {person.address?.city && (
                      <S.MetaRow>
                        <RiMapPinLine size={12} />
                        {[person.address.neighborhood, person.address.city, person.address.state].filter(Boolean).join(' · ')}
                      </S.MetaRow>
                    )}
                  </S.PersonMeta>

                  <CustomFieldMetaRows items={vm.getCustomFieldItems(person)} />

                  {personTags.length > 0 && (
                    <S.Tags onClick={(e) => e.stopPropagation()}>
                      {personTags.map((t) => (
                        <S.TagPill key={t.id} $color={t.color}>
                          <S.TagDot $color={t.color} />
                          {t.name}
                        </S.TagPill>
                      ))}
                    </S.Tags>
                  )}
                </S.PersonCard>
              );
            })}
          </S.Grid>
        )}
      </S.Content>
    </S.Page>
  );
};
