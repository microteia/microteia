import React from 'react';
import { RiAddLine, RiEditLine, RiDeleteBinLine, RiCheckLine, RiSearchLine } from 'react-icons/ri';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { ColorSwatchPicker } from '../ColorSwatchPicker';
import { S } from './TagManager.styles';
import { useTagManagerViewModel, type TagManagerProps } from './TagManager.viewmodel';
import { useT } from '../../../shared/i18n/useT';

export const TagManager: React.FC<TagManagerProps> = (props) => {
  const vm = useTagManagerViewModel(props);
  const t = useT('core.ui');
  const formActive = vm.isCreating || !!vm.editingTag;

  return (
    <Modal title={t('tags.title')} onClose={props.onClose}>
      <S.Body>

        <S.Toolbar>
          <S.SearchWrapper>
            <RiSearchLine size={14} />
            <S.SearchInput
              value={vm.searchFilter}
              onChange={(e) => vm.setSearchFilter(e.target.value)}
              placeholder={t('tags.search.placeholder')}
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
              <S.FormLabel>{t('tags.new')}</S.FormLabel>
              <S.PreviewPill $color={vm.newTagColor}>{vm.newTagName || t('tags.preview')}</S.PreviewPill>
            </S.FormHeader>
            <S.NameInput
              value={vm.newTagName}
              onChange={(e) => vm.setNewTagName(e.target.value)}
              placeholder={t('tags.name.placeholder')}
              onKeyDown={(e) => { if (e.key === 'Enter') void vm.handleCreate(); if (e.key === 'Escape') vm.cancelCreate(); }}
              autoFocus
            />
            <ColorSwatchPicker colors={vm.tagColors} value={vm.newTagColor} onChange={vm.setNewTagColor} />
            <S.FormActions>
              <Button variant="secondary" size="sm" onClick={vm.cancelCreate}>{t('action.cancel')}</Button>
              <Button size="sm" onClick={() => void vm.handleCreate()} disabled={vm.saving || !vm.newTagName.trim()}>
                <RiAddLine size={14} /> {t('tags.create')}
              </Button>
            </S.FormActions>
          </S.FormBox>
        )}

        {vm.editingTag && (
          <S.FormBox>
            <S.FormHeader>
              <S.FormLabel>{t('tags.edit')}</S.FormLabel>
              <S.PreviewPill $color={vm.editColor}>{vm.editName || t('tags.preview')}</S.PreviewPill>
            </S.FormHeader>
            <S.NameInput
              value={vm.editName}
              onChange={(e) => vm.setEditName(e.target.value)}
              placeholder={t('tags.name.placeholder')}
              onKeyDown={(e) => { if (e.key === 'Enter') void vm.handleSaveEdit(); if (e.key === 'Escape') vm.cancelEdit(); }}
              autoFocus
            />
            <ColorSwatchPicker colors={vm.tagColors} value={vm.editColor} onChange={vm.setEditColor} />
            <S.FormActions>
              <Button variant="secondary" size="sm" onClick={vm.cancelEdit}>{t('action.cancel')}</Button>
              <Button size="sm" onClick={() => void vm.handleSaveEdit()} disabled={vm.saving || !vm.editName.trim()}>
                {t('action.save')}
              </Button>
            </S.FormActions>
          </S.FormBox>
        )}

        {vm.allTags.length === 0 ? (
          <S.EmptyTags>{t('tags.empty')}</S.EmptyTags>
        ) : vm.appliedFilteredTags.length === 0 && vm.restFilteredTags.length === 0 ? (
          <S.EmptyTags>{t('tags.not-found')}</S.EmptyTags>
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
                  <S.ActionBtn type="button" title={t('tags.edit')} onClick={(e) => { e.stopPropagation(); vm.startEdit(tag); }}>
                    <RiEditLine size={13} />
                  </S.ActionBtn>
                  {vm.isAdmin && (
                    <S.DangerBtn type="button" title={t('tags.delete')} onClick={(e) => { e.stopPropagation(); void vm.handleDelete(tag.id); }}>
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
                  <S.ActionBtn type="button" title={t('tags.edit')} onClick={(e) => { e.stopPropagation(); vm.startEdit(tag); }}>
                    <RiEditLine size={13} />
                  </S.ActionBtn>
                  {vm.isAdmin && (
                    <S.DangerBtn type="button" title={t('tags.delete')} onClick={(e) => { e.stopPropagation(); void vm.handleDelete(tag.id); }}>
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
