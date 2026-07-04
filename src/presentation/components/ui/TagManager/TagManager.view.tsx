import React from 'react';
import { RiAddLine, RiEditLine, RiDeleteBinLine, RiCheckLine, RiSearchLine } from 'react-icons/ri';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { S } from './TagManager.styles';
import { useTagManagerViewModel, type TagManagerProps } from './TagManager.viewmodel';

export const TagManager: React.FC<TagManagerProps> = (props) => {
  const vm = useTagManagerViewModel(props);
  const formActive = vm.isCreating || !!vm.editingTag;

  return (
    <Modal title="Etiquetas" onClose={props.onClose}>
      <S.Body>

        <S.Toolbar>
          <S.SearchWrapper>
            <RiSearchLine size={14} />
            <S.SearchInput
              value={vm.searchFilter}
              onChange={(e) => vm.setSearchFilter(e.target.value)}
              placeholder="Pesquisar etiqueta..."
            />
          </S.SearchWrapper>
          {!formActive && (
            <S.AddTagBtn type="button" onClick={vm.startCreate}>
              <RiAddLine size={15} />
            </S.AddTagBtn>
          )}
        </S.Toolbar>

        {vm.isCreating && (
          <S.FormBox>
            <S.FormHeader>
              <S.FormLabel>Nova etiqueta</S.FormLabel>
              <S.PreviewPill $color={vm.newTagColor}>{vm.newTagName || 'Prévia'}</S.PreviewPill>
            </S.FormHeader>
            <S.NameInput
              value={vm.newTagName}
              onChange={(e) => vm.setNewTagName(e.target.value)}
              placeholder="Nome da etiqueta..."
              onKeyDown={(e) => { if (e.key === 'Enter') void vm.handleCreate(); if (e.key === 'Escape') vm.cancelCreate(); }}
              autoFocus
            />
            <S.ColorPalette>
              {vm.tagColors.map((c) => (
                <S.ColorSwatch
                  key={c.value}
                  type="button"
                  $color={c.value}
                  $selected={vm.newTagColor === c.value}
                  title={c.label}
                  onClick={() => vm.setNewTagColor(c.value)}
                />
              ))}
            </S.ColorPalette>
            <S.FormActions>
              <Button variant="secondary" size="sm" onClick={vm.cancelCreate}>Cancelar</Button>
              <Button size="sm" onClick={() => void vm.handleCreate()} disabled={vm.saving || !vm.newTagName.trim()}>
                <RiAddLine size={14} /> Criar
              </Button>
            </S.FormActions>
          </S.FormBox>
        )}

        {vm.editingTag && (
          <S.FormBox>
            <S.FormHeader>
              <S.FormLabel>Editar etiqueta</S.FormLabel>
              <S.PreviewPill $color={vm.editColor}>{vm.editName || 'Prévia'}</S.PreviewPill>
            </S.FormHeader>
            <S.NameInput
              value={vm.editName}
              onChange={(e) => vm.setEditName(e.target.value)}
              placeholder="Nome da etiqueta..."
              onKeyDown={(e) => { if (e.key === 'Enter') void vm.handleSaveEdit(); if (e.key === 'Escape') vm.cancelEdit(); }}
              autoFocus
            />
            <S.ColorPalette>
              {vm.tagColors.map((c) => (
                <S.ColorSwatch
                  key={c.value}
                  type="button"
                  $color={c.value}
                  $selected={vm.editColor === c.value}
                  title={c.label}
                  onClick={() => vm.setEditColor(c.value)}
                />
              ))}
            </S.ColorPalette>
            <S.FormActions>
              <Button variant="secondary" size="sm" onClick={vm.cancelEdit}>Cancelar</Button>
              <Button size="sm" onClick={() => void vm.handleSaveEdit()} disabled={vm.saving || !vm.editName.trim()}>
                Salvar
              </Button>
            </S.FormActions>
          </S.FormBox>
        )}

        {vm.allTags.length === 0 ? (
          <S.EmptyTags>Nenhuma etiqueta criada ainda.</S.EmptyTags>
        ) : vm.appliedFilteredTags.length === 0 && vm.restFilteredTags.length === 0 ? (
          <S.EmptyTags>Nenhuma etiqueta encontrada.</S.EmptyTags>
        ) : (
          <S.TagList>
            {vm.appliedFilteredTags.map((tag) => (
              <S.TagRowWrapper key={tag.id} $editing={vm.editingTag?.id === tag.id}>
                <S.TagRow onClick={() => vm.toggleTag(tag.id)}>
                  <S.TagCheck $checked $color={tag.color}><RiCheckLine size={10} /></S.TagCheck>
                  <S.TagPill $color={tag.color}>
                    <S.PillDot $color={tag.color} />
                    <S.TagName>{tag.name}</S.TagName>
                  </S.TagPill>
                </S.TagRow>
                <S.TagActions>
                  <S.ActionBtn type="button" title="Editar etiqueta" onClick={(e) => { e.stopPropagation(); vm.startEdit(tag); }}>
                    <RiEditLine size={13} />
                  </S.ActionBtn>
                  {vm.isAdmin && (
                    <S.DangerBtn type="button" title="Excluir etiqueta" onClick={(e) => { e.stopPropagation(); void vm.handleDelete(tag.id); }}>
                      <RiDeleteBinLine size={13} />
                    </S.DangerBtn>
                  )}
                </S.TagActions>
              </S.TagRowWrapper>
            ))}

            {vm.appliedFilteredTags.length > 0 && vm.restFilteredTags.length > 0 && (
              <S.ListDivider />
            )}

            {vm.restFilteredTags.map((tag) => (
              <S.TagRowWrapper key={tag.id} $editing={vm.editingTag?.id === tag.id}>
                <S.TagRow onClick={() => vm.toggleTag(tag.id)}>
                  <S.TagCheck $checked={false} $color={tag.color} />
                  <S.TagPill $color={tag.color}>
                    <S.PillDot $color={tag.color} />
                    <S.TagName>{tag.name}</S.TagName>
                  </S.TagPill>
                </S.TagRow>
                <S.TagActions>
                  <S.ActionBtn type="button" title="Editar etiqueta" onClick={(e) => { e.stopPropagation(); vm.startEdit(tag); }}>
                    <RiEditLine size={13} />
                  </S.ActionBtn>
                  {vm.isAdmin && (
                    <S.DangerBtn type="button" title="Excluir etiqueta" onClick={(e) => { e.stopPropagation(); void vm.handleDelete(tag.id); }}>
                      <RiDeleteBinLine size={13} />
                    </S.DangerBtn>
                  )}
                </S.TagActions>
              </S.TagRowWrapper>
            ))}
          </S.TagList>
        )}

      </S.Body>
    </Modal>
  );
};
