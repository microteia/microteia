import React from 'react';
import { useAddNewsViewModel } from './AddNews.viewmodel';
import { Button } from '../../components/ui/Button';
import { Label, InputGroup, Input, Textarea } from '../../components/ui/Input';
import { DynamicSelect } from '../../components/ui/DynamicSelect';
import { MarkdownEditor } from '../../components/ui/MarkdownEditor';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { S } from './AddNews.styles';

interface AddNewsViewProps {
  tabKey: string;
}

export const AddNewsView: React.FC<AddNewsViewProps> = ({ tabKey }) => {
  const vm = useAddNewsViewModel(tabKey);

  return (
    <S.Page>
      <S.Header>
        <S.Title>{vm.isEdit ? 'Editar Notícia' : 'Nova Notícia'}</S.Title>
      </S.Header>

      <S.Form>
        <S.FormGrid>
          <S.FormFullRow>
            <InputGroup>
              <Label>Título *</Label>
              <Input
                value={vm.title}
                onChange={(e) => vm.setTitle(e.target.value)}
                placeholder="Título da notícia..."
              />
            </InputGroup>
          </S.FormFullRow>

          <InputGroup>
            <Label>Categoria</Label>
            <DynamicSelect
              staticOptions={vm.categoryOptions}
              dynamicOptions={vm.isSystemScope ? [] : vm.categoryDynamicOptions}
              value={vm.category}
              onChange={vm.setCategory}
              placeholder="Selecione a categoria..."
              onAdd={vm.isSystemScope ? undefined : vm.handleAddCategory}
              onDelete={vm.isSystemScope || !vm.isAdmin ? undefined : vm.handleDeleteCategory}
              deleteConfirmTitle="Excluir categoria"
            />
          </InputGroup>

          {vm.canChooseScope && (
            <InputGroup>
              <Label>Escopo</Label>
              <S.ScopeRow>
                <S.ScopeToggle
                  $active={!vm.isSystemScope}
                  onClick={() => vm.setIsSystemScope(false)}
                  type="button"
                >
                  Escritório
                </S.ScopeToggle>
                <S.ScopeToggle
                  $active={vm.isSystemScope}
                  onClick={() => vm.setIsSystemScope(true)}
                  type="button"
                >
                  Sistema (global)
                </S.ScopeToggle>
              </S.ScopeRow>
              {vm.isSystemScope && (
                <InfoBanner message="Notícias do Sistema são visíveis a todos os usuários da plataforma." />
              )}
            </InputGroup>
          )}

          <S.FormFullRow>
            <InputGroup>
              <Label>Link da Fonte</Label>
              <Input
                value={vm.sourceURL}
                onChange={(e) => vm.setSourceURL(e.target.value)}
                placeholder="https://..."
              />
            </InputGroup>
          </S.FormFullRow>

          <S.FormFullRow>
            <InputGroup>
              <Label>Resumo *</Label>
              <Textarea
                value={vm.summary}
                onChange={(e) => vm.setSummary(e.target.value)}
                placeholder="Resumo curto exibido na listagem..."
                rows={3}
              />
            </InputGroup>
          </S.FormFullRow>

          <S.FormFullRow>
            <InputGroup>
              <Label>Conteúdo Completo</Label>
              <S.EditorWrapper>
                <MarkdownEditor
                  value={vm.content}
                  onChange={vm.setContent}
                  placeholder="Conteúdo completo em Markdown (opcional)..."
                />
              </S.EditorWrapper>
            </InputGroup>
          </S.FormFullRow>
        </S.FormGrid>

        <S.Actions>
          <Button variant="secondary" onClick={vm.handleCancel} disabled={vm.saving}>
            Cancelar
          </Button>
          <Button
            onClick={vm.handleSave}
            $isLoading={vm.saving}
            disabled={vm.saving || !vm.canSave}
          >
            {vm.saving ? 'Salvando...' : vm.isEdit ? 'Salvar Alterações' : 'Publicar Notícia'}
          </Button>
        </S.Actions>
      </S.Form>
    </S.Page>
  );
};
