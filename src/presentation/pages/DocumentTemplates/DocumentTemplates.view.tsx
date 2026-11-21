import React from 'react';
import {
  RiAddLine,
  RiArrowGoBackLine,
  RiDeleteBinLine,
  RiEdit2Line,
  RiEyeLine,
  RiEyeOffLine,
  RiFileCopyLine,
  RiFileTextLine,
  RiFileWordLine,
  RiMarkdownLine,
  RiPencilLine,
} from 'react-icons/ri';
import { Button } from '../../components/ui/Button';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { CompositeFilter } from '../../components/ui/CompositeFilter';
import { ExtensionBadge } from '../../components/ui/ExtensionBadge';
import { useDocumentTemplatesViewModel } from './DocumentTemplates.viewmodel';
import { S } from './DocumentTemplates.styles';
import { useT } from '../../shared/i18n/useT';

/** A lista dos modelos de documento. Cada um abre na sua aba; os gestos de estado ficam na linha. */
export const DocumentTemplatesView: React.FC = () => {
  const vm = useDocumentTemplatesViewModel();
  const t = useT('core.documents');
  const restoring = vm.toRemove?.state === 'override';

  return (
    <S.Page>
      <S.Header>
        <S.Title>{t('page.templates')}</S.Title>
        {vm.canManage && (
          <Button onClick={vm.create} title={t('template.new')}>
            <RiAddLine size={16} />
          </Button>
        )}
      </S.Header>

      {!vm.canManage ? (
        <S.Content>
          <InfoBanner variant="info" message={t('page.no-permission')} />
        </S.Content>
      ) : (
        <>
          <S.Toolbar>
            <CompositeFilter
              defs={vm.filterDefs}
              tokens={vm.filterTokens}
              onChange={vm.setFilterTokens}
              placeholder={t('template.search')}
              screenKey={vm.savedFiltersScreenKey}
            />
          </S.Toolbar>

          <S.Content>
            {!vm.hasAny ? (
              <S.EmptyState>
                <S.EmptyIcon><RiFileTextLine /></S.EmptyIcon>
                <S.EmptyTitle>{t('template.empty')}</S.EmptyTitle>
                <Button onClick={vm.create} variant="secondary">
                  <RiAddLine size={14} /> {t('template.new')}
                </Button>
              </S.EmptyState>
            ) : vm.rows.length === 0 ? (
              <S.EmptyState>{t('template.search.empty')}</S.EmptyState>
            ) : (
              <S.List>
                {vm.rows.map((row) => (
                  <S.Row key={row.key} onClick={() => vm.open(row)}>
                    <S.FormatIcon $format={row.format}>
                      {row.format === 'docx' ? <RiFileWordLine size={18} /> : <RiMarkdownLine size={18} />}
                    </S.FormatIcon>
                    <S.RowInfo>
                      <S.RowName>{row.title}</S.RowName>
                      <S.RowDescription>{row.screenLabel} · {t(`format.${row.format}`)}</S.RowDescription>
                    </S.RowInfo>
                    {(row.state === 'override' || row.state === 'disabled') && (
                      <S.Pill $tone={row.state === 'disabled' ? 'warning' : 'primary'}>{t(`state.${row.state}`)}</S.Pill>
                    )}
                    {row.outdated && <S.Pill $tone="warning"><S.Dot />{t('state.outdated')}</S.Pill>}
                    <ExtensionBadge owner={row.extension} />
                    {/* Os gestos de cada estado — os mesmos da autoria, para a lista não pedir uma ida e volta. */}
                    <S.RowActions>
                      {row.state === 'plugin' && (
                        <S.IconBtn
                          title={t('template.customize')}
                          onClick={(event) => { event.stopPropagation(); void vm.customize(row); }}
                        >
                          <RiEdit2Line size={14} />
                        </S.IconBtn>
                      )}
                      {(row.state === 'override' || row.state === 'tenant') && (
                        <S.IconBtn
                          title={t('template.edit')}
                          onClick={(event) => { event.stopPropagation(); vm.open(row); }}
                        >
                          <RiPencilLine size={14} />
                        </S.IconBtn>
                      )}
                      <S.IconBtn
                        title={t('template.clone')}
                        onClick={(event) => { event.stopPropagation(); vm.clone(row); }}
                      >
                        <RiFileCopyLine size={14} />
                      </S.IconBtn>
                      {row.state === 'plugin' && (
                        <S.IconBtn
                          title={t('template.disable')}
                          onClick={(event) => { event.stopPropagation(); void vm.toggleDisabled(row); }}
                        >
                          <RiEyeOffLine size={14} />
                        </S.IconBtn>
                      )}
                      {row.state === 'disabled' && (
                        <S.IconBtn
                          title={t('template.enable')}
                          onClick={(event) => { event.stopPropagation(); void vm.toggleDisabled(row); }}
                        >
                          <RiEyeLine size={14} />
                        </S.IconBtn>
                      )}
                      {row.state === 'override' && (
                        <S.IconBtn
                          title={t('template.restore.short')}
                          onClick={(event) => { event.stopPropagation(); vm.askRemove(row); }}
                        >
                          <RiArrowGoBackLine size={14} />
                        </S.IconBtn>
                      )}
                      {row.state === 'tenant' && (
                        <S.DeleteBtn
                          title={t('template.delete')}
                          onClick={(event) => { event.stopPropagation(); vm.askRemove(row); }}
                        >
                          <RiDeleteBinLine size={14} />
                        </S.DeleteBtn>
                      )}
                    </S.RowActions>
                  </S.Row>
                ))}
              </S.List>
            )}
          </S.Content>
        </>
      )}

      <ConfirmModal
        isOpen={vm.toRemove !== null}
        title={t(restoring ? 'template.restore' : 'template.delete')}
        message={t(restoring ? 'template.restore.confirm' : 'template.delete.confirm')}
        variant={restoring ? 'default' : 'danger'}
        loading={vm.isRemoving}
        onConfirm={() => void vm.confirmRemove()}
        onCancel={vm.cancelRemove}
      />
    </S.Page>
  );
};
