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
  RiCopyrightLine,
  RiErrorWarningLine,
  RiDatabase2Line,
  RiHistoryLine,
  RiGlobalLine,
  RiStarFill,
  RiStarHalfFill,
  RiStarLine,
  RiVerifiedBadgeFill,
  RiVerifiedBadgeLine,
  RiDownloadCloud2Line,
  RiShieldKeyholeLine,
  RiGroupLine,
  RiQuestionMark,
} from 'react-icons/ri';
import { getScreenIcon } from '../../shared/screenIcons';
import { Button } from '../../components/ui/Button';
import { CompositeFilter } from '../../components/ui/CompositeFilter';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Modal } from '../../components/ui/Modal';
import { WidgetRenderer } from '../../components/ui/WidgetRenderer';
import { RadioGroup } from '../../components/ui/RadioButton';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { useMarketplaceViewModel } from './Marketplace.viewmodel';
import type { Author, ExtensionRow, HistoryPanel, MarketplaceFilter, PublishAction, RatingSummary, StatusBadge } from './Marketplace.viewmodel';
import type { StarKind } from '../../../domain/usecases/plugins/extensionReputation';
import { S } from './Marketplace.styles';

import { useT } from '../../shared/i18n/useT';
import { PackageLocaleProvider } from '../../shared/i18n/PackageLocaleProvider';

type Tone = 'neutral' | 'success' | 'warning' | 'info' | 'danger' | 'primary';

const FILTERS: { key: MarketplaceFilter; labelKey: string }[] = [
  { key: 'all', labelKey: 'filter.all' },
  { key: 'installed', labelKey: 'filter.installed' },
  { key: 'mine', labelKey: 'filter.mine' },
  { key: 'catalog', labelKey: 'filter.catalog' },
];

/** Cada gesto de publicação diz o que vai acontecer — inclusive o que NÃO vai, e por quê. */
const PUBLISH_TITLE: Record<PublishAction, string> = {
  publish: 'extension.publish',
  republish: 'extension.republish',
  'needs-version': 'extension.publish.needs-version',
};

const STATUS_LABEL: Record<StatusBadge, { labelKey: string; tone: Tone }> = {
  published: { labelKey: 'status.published', tone: 'success' },
  pending: { labelKey: 'status.pending', tone: 'warning' },
  deprecated: { labelKey: 'status.deprecated', tone: 'neutral' },
  private: { labelKey: 'status.private', tone: 'neutral' },
  builtin: { labelKey: 'status.builtin', tone: 'info' },
  system: { labelKey: 'status.system', tone: 'primary' },
};

const AuthorLine: React.FC<{ author: Author; verificationLabel: string | null }> = ({ author, verificationLabel }) => {
  if (!author.name) return null;
  return (
    <S.MetaAuthor>
      {author.photoURL
        ? <S.AuthorPhoto src={author.photoURL} alt={author.name} referrerPolicy="no-referrer" />
        : <S.AuthorInitial>{author.name.charAt(0).toUpperCase()}</S.AuthorInitial>}
      {author.name}
      {verificationLabel && (
        <S.Verified title={verificationLabel} aria-label={verificationLabel}>
          <RiVerifiedBadgeFill size={14} />
        </S.Verified>
      )}
    </S.MetaAuthor>
  );
};

const STAR_ICON: Record<StarKind, React.ReactNode> = {
  full: <RiStarFill size={13} />,
  half: <RiStarHalfFill size={13} />,
  empty: <RiStarLine size={13} />,
};

const Rating: React.FC<{ rating: RatingSummary }> = ({ rating }) => (
  <S.Stat title={rating.label} aria-label={rating.label}>
    <S.Stars>
      {rating.stars.map((kind, index) => <React.Fragment key={index}>{STAR_ICON[kind]}</React.Fragment>)}
    </S.Stars>
    {rating.average}
    <span>({rating.count})</span>
  </S.Stat>
);

/** A identidade visual da extensão: a imagem que ela declara, senão o ícone dela, senão a peça. */
const Identity: React.FC<{ row: ExtensionRow; large?: boolean }> = ({ row, large }) => {
  const size = large ? 30 : 20;
  if (row.image) return large ? <S.DetailsImage src={row.image} alt="" /> : <S.RowImage src={row.image} alt="" />;
  const glyph = row.glyph ? getScreenIcon(row.glyph, size) : <RiPuzzle2Line size={size} />;
  return large
    ? <S.DetailsGlyph>{glyph}</S.DetailsGlyph>
    : <S.RowIcon $tone={row.installBadge === 'active' ? 'primary' : 'neutral'}>{glyph}</S.RowIcon>;
};

const Reputation: React.FC<{ row: ExtensionRow }> = ({ row }) => (
  <>
    {row.installs !== null && row.installsLabel !== null && (
      <>
        <S.MetaSep>·</S.MetaSep>
        <S.Stat title={row.installsLabel} aria-label={row.installsLabel}>
          <RiDownloadCloud2Line size={13} />
          {row.installs}
        </S.Stat>
      </>
    )}
    {row.rating && (
      <>
        <S.MetaSep>·</S.MetaSep>
        <Rating rating={row.rating} />
      </>
    )}
  </>
);

/**
 * A pergunta de confiança, no molde da do VS Code: quem escreveu, se a origem foi confirmada e o que
 * o código passa a poder fazer. A fonte não aparece — quem decide é o admin do escritório, e a
 * decisão dele é sobre o autor.
 */
const TrustModal: React.FC<{ row: ExtensionRow; vm: ReturnType<typeof useMarketplaceViewModel> }> = ({ row, vm }) => {
  const t = useT('core.marketplace');
  const verified = row.verification !== null;
  return (
    <Modal title={t('extension.trust.title')} size="medium" onClose={vm.cancelReview}>
      <S.TrustHero>
        <S.TrustShield $verified={verified}>
          {verified ? <RiShieldCheckLine size={30} /> : <RiShieldKeyholeLine size={30} />}
        </S.TrustShield>
        <S.TrustQuestion>{t('extension.trust.question')}</S.TrustQuestion>
        <S.TrustLead>{t('extension.trust.lead', { name: row.name })}</S.TrustLead>
      </S.TrustHero>

      <S.TrustCard>
        <S.TrustCardHead>
          <Identity row={row} />
          <S.TrustCardText>
            <S.TrustName>{row.name}</S.TrustName>
            <S.TrustMeta>
              <span>v{row.version}</span>
              <Reputation row={row} />
            </S.TrustMeta>
          </S.TrustCardText>
        </S.TrustCardHead>
        <S.TrustPublisher $verified={verified}>
          {row.author.photoURL
            ? <S.TrustAvatarPhoto src={row.author.photoURL} alt="" referrerPolicy="no-referrer" />
            : (
              <S.TrustAvatar $verified={verified}>
                {row.author.name ? row.author.name.charAt(0).toUpperCase() : <RiQuestionMark size={14} />}
              </S.TrustAvatar>
            )}
          <S.TrustPublisherText>
            <S.TrustPublisherName>
              {row.author.name ?? t('extension.trust.unknown-author')}
              {verified && <RiVerifiedBadgeFill size={15} />}
            </S.TrustPublisherName>
            <S.TrustPublisherStatus $verified={verified}>
              {verified ? row.verificationLabel : t('extension.trust.unverified')}
            </S.TrustPublisherStatus>
            <S.TrustPublisherHint>
              {t(verified ? 'extension.trust.verified.hint' : 'extension.trust.unverified.hint')}
            </S.TrustPublisherHint>
          </S.TrustPublisherText>
        </S.TrustPublisher>
      </S.TrustCard>

      <S.TrustEffectsTitle>{t('extension.trust.effects.title')}</S.TrustEffectsTitle>
      <S.TrustEffects>
        <S.TrustEffect><RiGroupLine size={16} />{t('extension.trust.effect.every-member')}</S.TrustEffect>
        <S.TrustEffect><RiDatabase2Line size={16} />{t('extension.trust.effect.data')}</S.TrustEffect>
        <S.TrustEffect><RiToggleLine size={16} />{t('extension.trust.effect.revocable')}</S.TrustEffect>
      </S.TrustEffects>

      <S.TrustNote>{t('extension.trust.catalog-note')}</S.TrustNote>

      <S.TrustActions>
        <Button variant="secondary" onClick={vm.cancelReview}>{t('extension.trust.decline')}</Button>
        <Button onClick={() => void vm.confirmReview()}>{t('extension.trust.confirm')}</Button>
      </S.TrustActions>
    </Modal>
  );
};

const RowView: React.FC<{ row: ExtensionRow; busy: boolean; vm: ReturnType<typeof useMarketplaceViewModel> }> = ({ row, busy, vm }) => {
  const t = useT('core.marketplace');

  return (
  <S.Row>
    <Identity row={row} />

    <S.RowMain>
      <S.TitleLine>
        <S.NameButton type="button" title={t('extension.details')} onClick={() => vm.openDetails(row.id)}>{row.name}</S.NameButton>
        <S.Badges>
          {row.installBadge === 'active' && <S.Badge $tone="success"><S.BadgeDot $tone="success" />{t('extension.badge.active')}</S.Badge>}
          {row.installBadge === 'inactive' && <S.Badge $tone="neutral"><S.BadgeDot $tone="neutral" />{t('extension.badge.inactive')}</S.Badge>}
          {row.failed && <S.Badge $tone="danger"><S.BadgeDot $tone="danger" />{t('extension.badge.failed')}</S.Badge>}
          {row.updateAvailable && <S.Badge $tone="primary">{t('extension.badge.update')}</S.Badge>}
          {row.statusBadge && <S.Badge $tone={STATUS_LABEL[row.statusBadge].tone}>{t(STATUS_LABEL[row.statusBadge].labelKey)}</S.Badge>}
          {row.imported && <S.Badge $tone="neutral" title={t('extension.badge.imported.hint')}>{t('extension.badge.imported')}</S.Badge>}
          {row.hasCode && <S.Badge $tone="info">{t('extension.badge.has-code')}</S.Badge>}
          {row.hasServerCode && <S.Badge $tone="warning" title={t('extension.badge.server-code.hint')}>{t('extension.badge.server-code')}</S.Badge>}
          {row.needsCodeReview && <S.Badge $tone="warning">{t('extension.badge.unreviewed')}</S.Badge>}
          {row.backendPending && <S.Badge $tone="warning">{t('extension.badge.backend-pending')}</S.Badge>}
          {row.migrationPending && <S.Badge $tone="warning">{t('extension.badge.migration-pending')}</S.Badge>}
        </S.Badges>
      </S.TitleLine>

      {row.summary && <S.Summary>{row.summary}</S.Summary>}

      {/* Exige do projeto Firebase o que só o Console cria. Dizer o que falta E o comando que resolve,
          porque quem lê esta tela não é, necessariamente, quem tem acesso ao projeto. */}
      {row.backendPending && (
        <S.Problems>
          <S.Problem $error={false}>
            <RiErrorWarningLine size={13} />
            <span>{t(row.backendPendingDetail.key, { functions: row.backendPendingDetail.functions })}</span>
          </S.Problem>
        </S.Problems>
      )}

      {/* Instalada, mas sobre dado que uma versão anterior dela deixou em outro formato. Mesma
          consequência do backend pendente: não está no ar. O erro da última tentativa vem junto,
          porque sem ele não há como saber se falta rodar ou se rodar já falhou. */}
      {row.migrationPending && (
        <S.Problems>
          <S.Problem $error={false}>
            <RiErrorWarningLine size={13} />
            <span>{t('extension.migration-pending.detail')}</span>
          </S.Problem>
          {row.migrationError && (
            <S.Problem $error>
              <RiErrorWarningLine size={13} />
              <span>{row.migrationError}</span>
            </S.Problem>
          )}
        </S.Problems>
      )}

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
        <AuthorLine author={row.author} verificationLabel={row.verificationLabel} />
        {row.author.name && <S.MetaSep>·</S.MetaSep>}
        <span>v{row.version}</span>
        <Reputation row={row} />
        <S.MetaSep>·</S.MetaSep>
        <span>{row.id}</span>
        {row.categoryLabel && (
          <>
            <S.MetaSep>·</S.MetaSep>
            <span>{row.categoryLabel}</span>
          </>
        )}
      </S.Meta>
    </S.RowMain>

    <S.RowActions onClick={(e) => e.stopPropagation()}>
      <S.ActionButton title={t('extension.details')} onClick={() => vm.openDetails(row.id)}>
        <RiInformationLine size={17} />
      </S.ActionButton>
      {/* Só quem tem termo que DESENHA oferece o gesto. Ver `licenseOf`. */}
      {row.license !== null && (
        <S.ActionButton title={t('extension.license')} onClick={() => vm.openLicense(row.id)}>
          <RiCopyrightLine size={17} />
        </S.ActionButton>
      )}
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
      {row.canRunMigrations && (
        <S.ActionButton
          $primary
          title={t('extension.run-migrations')}
          disabled={busy}
          onClick={() => void vm.runMigrations(row.id)}
        >
          <RiDatabase2Line size={17} />
        </S.ActionButton>
      )}
      {row.hasHistory && (
        <S.ActionButton title={t('extension.history')} onClick={() => vm.openHistory(row.id)}>
          <RiHistoryLine size={17} />
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
      {row.publish && (
        <S.ActionButton
          title={t(PUBLISH_TITLE[row.publish], { version: row.version })}
          disabled={busy || row.publish === 'needs-version'}
          onClick={() => void vm.publish(row.id)}
        >
          <RiGlobalLine size={17} />
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
      {row.canVerifyPublisher && (
        <S.ActionButton
          title={t(row.publisherVerified ? 'extension.unverify-publisher' : 'extension.verify-publisher')}
          disabled={busy}
          onClick={() => void vm.togglePublisherVerified(row.id)}
        >
          {row.publisherVerified ? <RiVerifiedBadgeFill size={17} /> : <RiVerifiedBadgeLine size={17} />}
        </S.ActionButton>
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

/**
 * As versões que este escritório já aplicou desta extensão. A que está no ar aparece marcada e sem
 * gesto — reaplicá-la não faria nada, e oferecer o botão sugeriria que faria.
 */
const HistoryModal: React.FC<{ history: HistoryPanel; vm: ReturnType<typeof useMarketplaceViewModel> }> = ({ history, vm }) => {
  const t = useT('core.marketplace');

  return (
    <Modal title={t('history.title', { name: history.name })} size="large" onClose={vm.closeHistory}>
      <S.DetailsIntro>{t('history.intro')}</S.DetailsIntro>
      {history.uninstalled && <InfoBanner message={t('history.uninstalled')} variant="info" />}
      {history.versions.length === 0 ? (
        <S.Empty>{t('history.empty')}</S.Empty>
      ) : (
        <S.HistoryList>
          {history.versions.map((version) => (
            <S.HistoryItem key={version.revision} $current={version.current}>
              <S.HistoryMain>
                <S.HistoryVersion>
                  v{version.version}
                  {version.current && <S.Badge $tone="success">{t('history.current')}</S.Badge>}
                </S.HistoryVersion>
                <S.HistoryMeta>{version.appliedBy}</S.HistoryMeta>
              </S.HistoryMain>
              {!version.current && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={vm.busyId === history.id}
                  onClick={() => void vm.restore(history.id, version.revision)}
                >
                  <RiHistoryLine size={15} /> {t('history.apply')}
                </Button>
              )}
            </S.HistoryItem>
          ))}
        </S.HistoryList>
      )}
      <S.HistoryFooter>{t('history.limit', { count: history.limit })}</S.HistoryFooter>
    </Modal>
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

          {vm.residue !== null && (
            <InfoBanner message={vm.residue.message} variant="warning" />
          )}

          <S.Filters>
            {FILTERS.map((f) => (
              <S.Filter key={f.key} $active={vm.filter === f.key} onClick={() => vm.setFilter(f.key)}>
                {t(f.labelKey)}
                <S.FilterCount>{vm.counts[f.key]}</S.FilterCount>
              </S.Filter>
            ))}
            <S.Sort>
              <S.SortLabel>{t('sort.label')}</S.SortLabel>
              <S.SortSelect>
                <SearchSelect options={vm.sortOptions} value={vm.sort} onChange={vm.setSort} />
              </S.SortSelect>
            </S.Sort>
          </S.Filters>

          {/* O filtro fino é da aba "Todas": as outras três já SÃO um recorte, e um segundo por cima
              delas ofereceria o vazio como escolha. */}
          {vm.filter === 'all' && (
            <CompositeFilter
              defs={vm.filterDefs}
              tokens={vm.filterTokens}
              onChange={vm.setFilterTokens}
              placeholder={t('filter.compose.placeholder')}
              screenKey={vm.savedFiltersScreenKey}
            />
          )}

          {vm.rows.length === 0 ? (
            <S.Empty>
              {t(vm.filter === 'all' && vm.filterTokens.length === 0
                ? 'marketplace.empty'
                : 'marketplace.empty.filtered')}
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

      <ConfirmModal
        isOpen={vm.rangeConfirmMessage !== null}
        title={t('extension.range.title')}
        message={vm.rangeConfirmMessage ?? ''}
        confirmLabel={t('extension.range.confirm')}
        cancelLabel={t('core.ui/action.cancel')}
        variant="danger"
        onConfirm={vm.confirmRange}
        onCancel={vm.cancelRange}
      />

      {vm.detailsRow && (
        <Modal title={vm.detailsRow.name} size="large" onClose={vm.closeDetails}>
          <S.DetailsHeader>
            <Identity row={vm.detailsRow} large />
            <S.DetailsHeaderText>
              <S.DetailsHeaderLine>
                <AuthorLine author={vm.detailsRow.author} verificationLabel={vm.detailsRow.verificationLabel} />
                {vm.detailsRow.verificationLabel && <S.Verified>{vm.detailsRow.verificationLabel}</S.Verified>}
              </S.DetailsHeaderLine>
              <S.DetailsHeaderLine>
                <span>v{vm.detailsRow.version}</span>
                <Reputation row={vm.detailsRow} />
              </S.DetailsHeaderLine>
            </S.DetailsHeaderText>
          </S.DetailsHeader>
          <S.DetailsIntro>{vm.detailsRow.description || vm.detailsRow.summary}</S.DetailsIntro>
          {/* A descrição rica do pacote (Widget DSL) — dado, renderizado pelos componentes do
              Microteia. Extensão sem `overview` mostra só o resumo acima. O catálogo desta tela desce
              pelo contexto porque o renderizador resolve os rótulos dele mesmo, e o pacote pode não
              estar instalado: sem isso a descrição vinha como chave crua. */}
          <PackageLocaleProvider catalog={vm.catalog}>
            <WidgetRenderer spec={vm.detailsRow.overview} />
          </PackageLocaleProvider>
          {vm.myRatingStars.length > 0 && (
            <S.RateBox>
              <S.RateTitle>{t('extension.my-rating')}</S.RateTitle>
              <S.RateLine>
                <S.RateStars>
                  {vm.myRatingStars.map((star) => (
                    <S.RateStar
                      key={star.value}
                      type="button"
                      $filled={star.filled}
                      title={star.label}
                      aria-label={star.label}
                      aria-pressed={star.filled}
                      onClick={() => void vm.rate(star.value)}
                    >
                      {star.filled ? <RiStarFill size={22} /> : <RiStarLine size={22} />}
                    </S.RateStar>
                  ))}
                </S.RateStars>
                {vm.hasMyRating && (
                  <Button variant="secondary" size="sm" onClick={() => void vm.clearMyRating()}>
                    {t('extension.rating.clear')}
                  </Button>
                )}
              </S.RateLine>
              <S.RateHint>{t('extension.my-rating.hint')}</S.RateHint>
            </S.RateBox>
          )}
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

      {/* Os termos como o AUTOR os escreveu. O catálogo desta tela desce pelo contexto pela mesma
          razão da descrição rica: o `WidgetRenderer` resolve os rótulos no ponto de render, e o
          pacote pode nem estar instalado — sem isso o termo apareceria como chave crua. */}
      {vm.licenseRow && (
        <Modal title={t('extension.license.title', { name: vm.licenseRow.name })} size="large" onClose={vm.closeLicense}>
          <S.DetailsIntro>{t('extension.license.intro')}</S.DetailsIntro>
          <PackageLocaleProvider catalog={vm.catalog}>
            <WidgetRenderer spec={vm.licenseRow.license} />
          </PackageLocaleProvider>
          <S.DetailsMeta>
            <span>v{vm.licenseRow.version}</span>
            <S.MetaSep>·</S.MetaSep>
            <span>{vm.licenseRow.id}</span>
            {vm.licenseRow.author.name && (
              <>
                <S.MetaSep>·</S.MetaSep>
                <span>{vm.licenseRow.author.name}</span>
              </>
            )}
          </S.DetailsMeta>
        </Modal>
      )}

      {vm.history && <HistoryModal history={vm.history} vm={vm} />}

      {vm.importTarget && (
        <Modal title={t('import.title', { name: vm.importTarget.name })} size="small" onClose={vm.cancelImport}>
          <S.DetailsIntro>{t('import.intro', { name: vm.importTarget.name, version: vm.importTarget.version })}</S.DetailsIntro>
          <RadioGroup
            name="import-scope"
            value={vm.importScope}
            onChange={(value) => vm.setImportScope(value === 'public' ? 'public' : 'private')}
            options={[
              { value: 'private', label: t('import.scope.private') },
              ...(vm.importTarget.canPublish ? [{ value: 'public', label: t('import.scope.public') }] : []),
            ]}
          />
          <S.ImportHint>
            {t(vm.importScope === 'public' ? 'import.scope.public.hint' : 'import.scope.private.hint')}
          </S.ImportHint>
          {/* Sem a explicação, a opção que falta parece defeito da tela. */}
          {!vm.importTarget.canPublish && (
            <InfoBanner message={t('import.code-requires-system')} variant="info" />
          )}
          <S.ReviewActions>
            <Button variant="secondary" onClick={vm.cancelImport}>{t('core.ui/action.cancel')}</Button>
            <Button onClick={() => void vm.confirmImport()}>{t('import.confirm')}</Button>
          </S.ReviewActions>
        </Modal>
      )}

      {vm.reviewTarget && <TrustModal row={vm.reviewTarget} vm={vm} />}
    </S.Page>
  );
};
