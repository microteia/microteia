import React from 'react';
import { RiDownloadLine, RiCheckLine, RiLockLine } from 'react-icons/ri';
import { Button } from '../../components/ui/Button';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { getScreenIcon } from '../../shared/screenIcons';
import { usePluginAuthorViewModel, type ArtifactKind } from './PluginAuthor.viewmodel';
import { S } from './PluginAuthor.styles';

const GROUP_ICON: Record<ArtifactKind, string> = {
  screens: 'layoutGrid',
  actions: 'cursor',
  workflows: 'flowChart',
  scripts: 'codeBox',
};

export const PluginAuthorView: React.FC = () => {
  const vm = usePluginAuthorViewModel();

  return (
    <S.Page>
      <S.Header>
        <S.Title>Criar extensão</S.Title>
        <S.Subtitle>Empacote telas, ações, automações e scripts do seu escritório em uma extensão.</S.Subtitle>
      </S.Header>

      <S.Content>
        {!vm.canManage && (
          <InfoBanner message="Somente administradores do escritório podem criar extensões." variant="info" />
        )}

        <S.Section>
          <S.SectionTitle>Identificação</S.SectionTitle>
          <S.Card>
            <S.FormGrid>
              <S.Field>
                Identificador
                <S.Input placeholder="com.seuescritorio.vendas" value={vm.form.id} onChange={(e) => vm.updateForm({ id: e.target.value })} />
                <S.Hint>DNS reverso, ao menos dois segmentos.</S.Hint>
              </S.Field>
              <S.Field>
                Nome
                <S.Input placeholder="Vendas" value={vm.form.name} onChange={(e) => vm.updateForm({ name: e.target.value })} />
              </S.Field>
              <S.Field>
                Versão
                <S.Input placeholder="1.0.0" value={vm.form.version} onChange={(e) => vm.updateForm({ version: e.target.value })} />
              </S.Field>
              <S.FieldWide>
                Resumo
                <S.Input placeholder="O que esta extensão adiciona ao escritório." value={vm.form.summary} onChange={(e) => vm.updateForm({ summary: e.target.value })} />
              </S.FieldWide>
              <S.FieldWide>
                Descrição (opcional)
                <S.Textarea value={vm.form.description} onChange={(e) => vm.updateForm({ description: e.target.value })} />
              </S.FieldWide>
            </S.FormGrid>
          </S.Card>
        </S.Section>

        <S.Section>
          <S.SectionTitle>Conteúdo</S.SectionTitle>
          <S.Groups>
            {vm.groups.map((group) => {
              const selectedInGroup = group.options.filter((o) => o.selected).length;
              return (
                <S.Group key={group.kind}>
                  <S.GroupHead>
                    <S.GroupIcon>{getScreenIcon(GROUP_ICON[group.kind], 18)}</S.GroupIcon>
                    <S.GroupTitle>{group.title}</S.GroupTitle>
                    <S.GroupCount>{selectedInGroup}/{group.options.length}</S.GroupCount>
                  </S.GroupHead>
                  <S.GroupBody>
                    {group.options.length === 0 ? (
                      <S.Empty>Nada disponível.</S.Empty>
                    ) : (
                      group.options.map((option) => (
                        <S.Item
                          key={option.id}
                          type="button"
                          $selected={option.selected}
                          disabled={!vm.canManage || option.locked}
                          onClick={() => vm.toggle(group.kind, option.id)}
                          title={option.locked ? 'Necessária por outro item marcado' : undefined}
                        >
                          <S.ItemIcon>{getScreenIcon(option.icon ?? GROUP_ICON[group.kind], 16)}</S.ItemIcon>
                          <S.ItemLabel>{option.label}</S.ItemLabel>
                          {option.locked ? (
                            <S.Required><RiLockLine size={11} /> Obrigatório</S.Required>
                          ) : (
                            <S.Check $on={option.selected}>{option.selected && <RiCheckLine size={14} />}</S.Check>
                          )}
                        </S.Item>
                      ))
                    )}
                  </S.GroupBody>
                </S.Group>
              );
            })}
          </S.Groups>
        </S.Section>

        {vm.issues.length > 0 && vm.selectedCount > 0 && (
          <S.Section>
            <S.SectionTitle>Pendências</S.SectionTitle>
            <S.Issues>
              {vm.issues.map((issue) => (
                <S.Issue key={issue}>{issue}</S.Issue>
              ))}
            </S.Issues>
          </S.Section>
        )}

        <S.Footer>
          <S.Count>{vm.selectedCount} {vm.selectedCount === 1 ? 'item selecionado' : 'itens selecionados'}</S.Count>
          {vm.canPublish && (
            <Button variant="ghost" size="sm" disabled={vm.busy || !vm.canExport} onClick={vm.publish}>
              Publicar no catálogo
            </Button>
          )}
          <Button variant="primary" size="sm" disabled={vm.busy || !vm.canExport} onClick={vm.download}>
            <RiDownloadLine size={16} /> Baixar .json
          </Button>
        </S.Footer>
      </S.Content>
    </S.Page>
  );
};
