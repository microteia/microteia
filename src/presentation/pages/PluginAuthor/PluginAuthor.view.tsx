import React from 'react';
import { RiDownloadLine, RiUploadLine } from 'react-icons/ri';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { usePluginAuthorViewModel } from './PluginAuthor.viewmodel';
import { S } from './PluginAuthor.styles';

export const PluginAuthorView: React.FC = () => {
  const vm = usePluginAuthorViewModel();

  return (
    <S.Page>
      <S.Header>
        <S.HeaderText>
          <S.Title>Criar extensão</S.Title>
          <S.Subtitle>Empacote telas, ações, automações e scripts do seu escritório em uma extensão.</S.Subtitle>
        </S.HeaderText>
        <S.HeaderActions>
          <S.ImportLabel $disabled={vm.busy || !vm.canManage}>
            <RiUploadLine size={16} /> Importar .json
            <S.HiddenFile
              type="file"
              accept="application/json,.json"
              disabled={vm.busy || !vm.canManage}
              onChange={(e) => void vm.onImportFile(e)}
            />
          </S.ImportLabel>
        </S.HeaderActions>
      </S.Header>

      <S.Content>
        {!vm.canManage && (
          <InfoBanner
            message="Somente administradores do escritório podem criar ou importar extensões."
            variant="info"
          />
        )}

        <S.Section>
          <S.SectionTitle>Identificação</S.SectionTitle>
          <S.FormGrid>
            <S.Field>
              Identificador
              <S.Input
                placeholder="com.seuescritorio.vendas"
                value={vm.form.id}
                onChange={(e) => vm.updateForm({ id: e.target.value })}
              />
              <S.Hint>DNS reverso, ao menos dois segmentos.</S.Hint>
            </S.Field>
            <S.Field>
              Nome
              <S.Input
                placeholder="Vendas"
                value={vm.form.name}
                onChange={(e) => vm.updateForm({ name: e.target.value })}
              />
            </S.Field>
            <S.Field>
              Versão
              <S.Input
                placeholder="1.0.0"
                value={vm.form.version}
                onChange={(e) => vm.updateForm({ version: e.target.value })}
              />
            </S.Field>
            <S.FieldWide>
              Resumo
              <S.Input
                placeholder="O que esta extensão adiciona ao escritório."
                value={vm.form.summary}
                onChange={(e) => vm.updateForm({ summary: e.target.value })}
              />
            </S.FieldWide>
            <S.FieldWide>
              Descrição (opcional)
              <S.Textarea
                value={vm.form.description}
                onChange={(e) => vm.updateForm({ description: e.target.value })}
              />
            </S.FieldWide>
            <S.FieldWide>
              Dependências (opcional)
              <S.Textarea
                placeholder="com.curatino.vendas ^1.0.0"
                value={vm.form.dependencies}
                onChange={(e) => vm.updateForm({ dependencies: e.target.value })}
              />
              <S.Hint>Uma por linha, no formato "identificador faixa". Declare aqui outra extensão referenciada.</S.Hint>
            </S.FieldWide>
          </S.FormGrid>
        </S.Section>

        <S.Section>
          <S.SectionTitle>Conteúdo</S.SectionTitle>
          <S.Groups>
            {vm.groups.map((group) => (
              <S.Group key={group.kind}>
                <S.GroupTitle>{group.title}</S.GroupTitle>
                {group.options.length === 0 ? (
                  <S.Empty>Nada disponível.</S.Empty>
                ) : (
                  group.options.map((option) => (
                    <S.Option key={option.id}>
                      <Checkbox
                        checked={option.selected}
                        onChange={() => vm.toggle(group.kind, option.id)}
                        label={option.label}
                        disabled={!vm.canManage}
                      />
                    </S.Option>
                  ))
                )}
              </S.Group>
            ))}
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
