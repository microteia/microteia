import React from 'react';
import {
  RiMagicLine,
  RiUploadLine,
  RiPencilLine,
  RiDownloadLine,
  RiInstallLine,
  RiUninstallLine,
  RiRefreshLine,
  RiToggleLine,
  RiToggleFill,
  RiDeleteBinLine,
  RiCheckLine,
  RiCloseLine,
  RiArchiveLine,
  RiPuzzle2Line,
  RiShieldCheckLine,
  RiInformationLine,
  RiErrorWarningLine,
} from 'react-icons/ri';
import { Button } from '../../components/ui/Button';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Modal } from '../../components/ui/Modal';
import { WidgetRenderer } from '../../components/ui/WidgetRenderer';
import { useMarketplaceViewModel } from './Marketplace.viewmodel';
import type { Author, ExtensionRow, MarketplaceFilter, StatusBadge } from './Marketplace.viewmodel';
import { S } from './Marketplace.styles';

import { useT } from '../../shared/i18n/useT';

type Tone = 'neutral' | 'success' | 'warning' | 'info' | 'danger' | 'primary';

const FILTERS: { key: MarketplaceFilter; labelKey: string }[] = [
  { key: 'all', labelKey: 'filter.all' },
  { key: 'installed', labelKey: 'filter.installed' },
  { key: 'mine', labelKey: 'filter.mine' },
  { key: 'catalog', labelKey: 'filter.catalog' },
];

const STATUS_LABEL: Record<StatusBadge, { labelKey: string; tone: Tone }> = {
  published: { labelKey: 'status.published', tone: 'success' },
  pending: { labelKey: 'status.pending', tone: 'warning' },
  deprecated: { labelKey: 'status.deprecated', tone: 'neutral' },
  private: { labelKey: 'status.private', tone: 'neutral' },
  builtin: { labelKey: 'status.builtin', tone: 'info' },
  system: { labelKey: 'status.system', tone: 'primary' },
};

const AuthorLine: React.FC<{ author: Author }> = ({ author }) => {
  if (!author.name) return null;
  return (
    <S.MetaAuthor>
      {author.photoURL
        ? <S.AuthorPhoto src={author.photoURL} alt={author.name} referrerPolicy="no-referrer" />
        : <S.AuthorInitial>{author.name.charAt(0).toUpperCase()}</S.AuthorInitial>}
      {author.name}
    </S.MetaAuthor>
  );
};

const RowView: React.FC<{ row: ExtensionRow; busy: boolean; vm: ReturnType<typeof useMarketplaceViewModel> }> = ({ row, busy, vm }) => {
  const t = useT('core.marketplace');

  return (
  <S.Row>
    <S.RowIcon $tone={row.installBadge === 'active' ? 'primary' : 'neutral'}>
      <RiPuzzle2Line size={20} />
    </S.RowIcon>

    <S.RowMain>
      <S.TitleLine>
        <S.NameButton type="button" title={t('extension.details')} onClick={() => vm.openDetails(row.id)}>{row.name}</S.NameButton>
        <S.Badges>
          {row.installBadge === 'active' && <S.Badge $tone="success"><S.BadgeDot $tone="success" />{t('extension.badge.active')}</S.Badge>}
          {row.installBadge === 'inactive' && <S.Badge $tone="neutral"><S.BadgeDot $tone="neutral" />{t('extension.badge.inactive')}</S.Badge>}
          {row.failed && <S.Badge $tone="danger"><S.BadgeDot $tone="danger" />{t('extension.badge.failed')}</S.Badge>}
          {row.updateAvailable && <S.Badge $tone="primary">{t('extension.badge.update')}</S.Badge>}
          {row.statusBadge && <S.Badge $tone={STATUS_LABEL[row.statusBadge].tone}>{t(STATUS_LABEL[row.statusBadge].labelKey)}</S.Badge>}
          {row.hasCode && <S.Badge $tone="info">{t('extension.badge.has-code')}</S.Badge>}
          {row.needsCodeReview && <S.Badge $tone="warning">{t('extension.badge.unreviewed')}</S.Badge>}
        </S.Badges>
      </S.TitleLine>

      {row.summary && <S.Summary>{row.summary}</S.Summary>}

      {/* O que o Kernel recusou nesta extensão. Instalada e ativa, mas com um erro aqui, ela não
          está no ar — e antes o único sintoma era a tela sumir do menu, sem explicação. */}
      {row.problems.length > 0 && (
        <S.Problems>
          {row.problems.map((problem, index) => (
            <S.Problem key={index} $error={problem.severity === 'error'}>
              <RiErrorWarningLine size={13} />
              <span>{problem.message}</span>
            </S.Problem>
          ))}
        </S.Problems>
      )}

      <S.Meta>
        <AuthorLine author={row.author} />
        {row.author.name && <S.MetaSep>·</S.MetaSep>}
        <span>v{row.version}</span>
        <S.MetaSep>·</S.MetaSep>
        <span>{row.id}</span>
      </S.Meta>
    </S.RowMain>

    <S.RowActions onClick={(e) => e.stopPropagation()}>
      <S.ActionButton title={t('extension.details')} onClick={() => vm.openDetails(row.id)}>
        <RiInformationLine size={17} />
      </S.ActionButton>
      {row.canEdit && (
        <S.ActionButton title={t('core.ui/condition.edit')} disabled={busy} onClick={() => vm.edit(row.id)}>
          <RiPencilLine size={17} />
        </S.ActionButton>
      )}
      {row.install === 'install' && (
        <S.ActionButton $primary title={t('extension.install')} disabled={busy} onClick={() => void vm.install(row.id)}>
          <RiInstallLine size={17} />
        </S.ActionButton>
      )}
      {row.install === 'update' && (
        <S.ActionButton $primary title={t('extension.update')} disabled={busy} onClick={() => void vm.install(row.id)}>
          <RiRefreshLine size={17} />
        </S.ActionButton>
      )}
      {row.needsCodeReview && (
        <S.ActionButton
          $primary
          title={t('extension.review')}
          disabled={busy}
          onClick={() => vm.openReview(row.id)}
        >
          <RiShieldCheckLine size={17} />
        </S.ActionButton>
      )}
      {row.canToggleActive && (
        <S.ActionButton
          title={row.active ? t('extension.deactivate') : t('extension.activate')}
          disabled={busy}
          onClick={() => void vm.toggleActive(row.id, !row.active)}
        >
          {row.active ? <RiToggleFill size={18} /> : <RiToggleLine size={18} />}
        </S.ActionButton>
      )}
      {row.canPublish && (
        <S.ActionButton title={row.published ? t('extension.republish') : t('extension.publish')} disabled={busy} onClick={() => void vm.publish(row.id)}>
          <RiUploadLine size={17} />
        </S.ActionButton>
      )}
      {row.canDownload && (
        <S.ActionButton title={t('author.download')} disabled={busy} onClick={() => vm.download(row.id)}>
          <RiDownloadLine size={17} />
        </S.ActionButton>
      )}
      {row.canApprove && (
        <>
          <S.ActionButton $primary title={t('extension.approve')} disabled={busy} onClick={() => void vm.approve(row.id)}>
            <RiCheckLine size={18} />
          </S.ActionButton>
          <S.ActionButton $danger title={t('extension.reject')} disabled={busy} onClick={() => void vm.reject(row.id)}>
            <RiCloseLine size={18} />
          </S.ActionButton>
        </>
      )}
      {row.canDeprecate && (
        <S.ActionButton title={t('extension.deprecate')} disabled={busy} onClick={() => void vm.deprecate(row.id)}>
          <RiArchiveLine size={17} />
        </S.ActionButton>
      )}
      {row.canUninstall && (
        <S.ActionButton title={t('extension.uninstall')} disabled={busy} onClick={() => void vm.uninstall(row.id)}>
          <RiUninstallLine size={17} />
        </S.ActionButton>
      )}
      {row.canDelete && (
        <S.ActionButton $danger title={t('extension.remove')} disabled={busy} onClick={() => vm.requestRemove(row.id)}>
          <RiDeleteBinLine size={17} />
        </S.ActionButton>
      )}
    </S.RowActions>
  </S.Row>
  );
};

export const MarketplaceView: React.FC = () => {
  const t = useT('core.marketplace');
  const vm = useMarketplaceViewModel();

  return (
    <S.Page>
      <S.Header>
        <S.HeaderText>
          <S.Title>{t('page.marketplace')}</S.Title>
          <S.Subtitle>{t('marketplace.subtitle')}</S.Subtitle>
        </S.HeaderText>
        {vm.canManage && (
          <S.HeaderActions>
            <Button variant="secondary" size="sm" onClick={vm.openAuthor}>
              <RiMagicLine size={16} /> {t('page.plugin-author')}
            </Button>
            <S.ImportLabel $disabled={vm.busyId === '__import__'}>
              <RiUploadLine size={16} /> {t('extension.import')}
              <S.HiddenFile
                type="file"
                accept="application/json,.json"
                disabled={vm.busyId === '__import__'}
                onChange={(e) => void vm.onImportFile(e)}
              />
            </S.ImportLabel>
          </S.HeaderActions>
        )}
      </S.Header>

      <S.Scroll>
        <S.Body>
          {!vm.canManage && (
            <InfoBanner
              message={t('marketplace.admin-only')}
              variant="info"
            />
          )}

          <S.Filters>
            {FILTERS.map((f) => (
              <S.Filter key={f.key} $active={vm.filter === f.key} onClick={() => vm.setFilter(f.key)}>
                {t(f.labelKey)}
                <S.FilterCount>{vm.counts[f.key]}</S.FilterCount>
              </S.Filter>
            ))}
          </S.Filters>

          {vm.rows.length === 0 ? (
            <S.Empty>
              {t(vm.filter === 'all' ? 'marketplace.empty' : 'marketplace.empty.filtered')}
            </S.Empty>
          ) : (
            <S.List>
              {vm.rows.map((row) => (
                <RowView key={row.id} row={row} busy={vm.busyId === row.id} vm={vm} />
              ))}
            </S.List>
          )}
        </S.Body>
      </S.Scroll>

      <ConfirmModal
        isOpen={vm.removeTarget !== null}
        title={t('extension.remove.title')}
        message={t('extension.remove.message', { name: vm.removeTarget?.name ?? '' })}
        confirmLabel={t('core.ui/action.delete')}
        variant="danger"
        onConfirm={vm.confirmRemove}
        onCancel={vm.cancelRemove}
      />

      {vm.detailsRow && (
        <Modal title={vm.detailsRow.name} size="large" onClose={vm.closeDetails}>
          <S.DetailsIntro>{vm.detailsRow.description || vm.detailsRow.summary}</S.DetailsIntro>
          {/* A descrição rica do pacote (Widget DSL) — dado, renderizado pelos componentes do
              Microteia. Extensão sem `overview` mostra só o resumo acima. */}
          <WidgetRenderer spec={vm.detailsRow.overview} />
          <S.DetailsMeta>
            <span>v{vm.detailsRow.version}</span>
            <S.MetaSep>·</S.MetaSep>
            <span>{vm.detailsRow.id}</span>
            {vm.detailsRow.author.name && (
              <>
                <S.MetaSep>·</S.MetaSep>
                <span>{vm.detailsRow.author.name}</span>
              </>
            )}
          </S.DetailsMeta>
        </Modal>
      )}

      {vm.reviewTarget && (
        <Modal title={t('extension.review.title', { name: vm.reviewTarget.name })} size="large" onClose={vm.cancelReview}>
          <S.ReviewIntro>{t('extension.review.intro')}</S.ReviewIntro>
          <S.ReviewCode>{vm.reviewTarget.code}</S.ReviewCode>
          <S.ReviewActions>
            <Button variant="secondary" onClick={vm.cancelReview}>{t('core.ui/action.cancel')}</Button>
            <Button onClick={() => void vm.confirmReview()}>{t('extension.review.confirm')}</Button>
          </S.ReviewActions>
        </Modal>
      )}
    </S.Page>
  );
};
