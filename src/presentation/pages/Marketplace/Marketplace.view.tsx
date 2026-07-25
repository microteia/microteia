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
} from 'react-icons/ri';
import { Button } from '../../components/ui/Button';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { useMarketplaceViewModel } from './Marketplace.viewmodel';
import type { Author, ExtensionRow, MarketplaceFilter, StatusBadge } from './Marketplace.viewmodel';
import { S } from './Marketplace.styles';

type Tone = 'neutral' | 'success' | 'warning' | 'info' | 'danger' | 'primary';

const FILTERS: { key: MarketplaceFilter; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'installed', label: 'Instaladas' },
  { key: 'mine', label: 'Minhas' },
  { key: 'catalog', label: 'Catálogo' },
];

const STATUS_LABEL: Record<StatusBadge, { label: string; tone: Tone }> = {
  published: { label: 'Publicada', tone: 'success' },
  pending: { label: 'Em análise', tone: 'warning' },
  deprecated: { label: 'Obsoleta', tone: 'neutral' },
  private: { label: 'Privada', tone: 'neutral' },
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

const RowView: React.FC<{ row: ExtensionRow; busy: boolean; vm: ReturnType<typeof useMarketplaceViewModel> }> = ({ row, busy, vm }) => (
  <S.Row>
    <S.RowIcon $tone={row.installBadge === 'active' ? 'primary' : 'neutral'}>
      <RiPuzzle2Line size={20} />
    </S.RowIcon>

    <S.RowMain>
      <S.TitleLine>
        <S.Name>{row.name}</S.Name>
        <S.Badges>
          {row.installBadge === 'active' && <S.Badge $tone="success"><S.BadgeDot $tone="success" />Ativa</S.Badge>}
          {row.installBadge === 'inactive' && <S.Badge $tone="neutral"><S.BadgeDot $tone="neutral" />Inativa</S.Badge>}
          {row.updateAvailable && <S.Badge $tone="primary">Atualização</S.Badge>}
          {row.statusBadge && <S.Badge $tone={STATUS_LABEL[row.statusBadge].tone}>{STATUS_LABEL[row.statusBadge].label}</S.Badge>}
          {row.hasCode && <S.Badge $tone="info">Com código</S.Badge>}
        </S.Badges>
      </S.TitleLine>

      {row.summary && <S.Summary>{row.summary}</S.Summary>}

      <S.Meta>
        <AuthorLine author={row.author} />
        {row.author.name && <S.MetaSep>·</S.MetaSep>}
        <span>v{row.version}</span>
        <S.MetaSep>·</S.MetaSep>
        <span>{row.id}</span>
      </S.Meta>
    </S.RowMain>

    <S.RowActions onClick={(e) => e.stopPropagation()}>
      {row.canEdit && (
        <S.ActionButton title="Editar" disabled={busy} onClick={() => vm.edit(row.id)}>
          <RiPencilLine size={17} />
        </S.ActionButton>
      )}
      {row.install === 'install' && (
        <S.ActionButton $primary title="Instalar no escritório" disabled={busy} onClick={() => void vm.install(row.id)}>
          <RiInstallLine size={17} />
        </S.ActionButton>
      )}
      {row.install === 'update' && (
        <S.ActionButton $primary title="Atualizar" disabled={busy} onClick={() => void vm.install(row.id)}>
          <RiRefreshLine size={17} />
        </S.ActionButton>
      )}
      {row.canToggleActive && (
        <S.ActionButton
          title={row.active ? 'Desativar no escritório' : 'Ativar no escritório'}
          disabled={busy}
          onClick={() => void vm.toggleActive(row.id, !row.active)}
        >
          {row.active ? <RiToggleFill size={18} /> : <RiToggleLine size={18} />}
        </S.ActionButton>
      )}
      {row.canPublish && (
        <S.ActionButton title={row.published ? 'Republicar no catálogo' : 'Publicar no catálogo'} disabled={busy} onClick={() => void vm.publish(row.id)}>
          <RiUploadLine size={17} />
        </S.ActionButton>
      )}
      {row.canDownload && (
        <S.ActionButton title="Baixar .json" disabled={busy} onClick={() => vm.download(row.id)}>
          <RiDownloadLine size={17} />
        </S.ActionButton>
      )}
      {row.canApprove && (
        <>
          <S.ActionButton $primary title="Aprovar publicação" disabled={busy} onClick={() => void vm.approve(row.id)}>
            <RiCheckLine size={18} />
          </S.ActionButton>
          <S.ActionButton $danger title="Recusar publicação" disabled={busy} onClick={() => void vm.reject(row.id)}>
            <RiCloseLine size={18} />
          </S.ActionButton>
        </>
      )}
      {row.canDeprecate && (
        <S.ActionButton title="Marcar como obsoleta" disabled={busy} onClick={() => void vm.deprecate(row.id)}>
          <RiArchiveLine size={17} />
        </S.ActionButton>
      )}
      {row.canUninstall && (
        <S.ActionButton title="Desinstalar do escritório" disabled={busy} onClick={() => void vm.uninstall(row.id)}>
          <RiUninstallLine size={17} />
        </S.ActionButton>
      )}
      {row.canDelete && (
        <S.ActionButton $danger title="Excluir da área privada" disabled={busy} onClick={() => vm.requestRemove(row.id)}>
          <RiDeleteBinLine size={17} />
        </S.ActionButton>
      )}
    </S.RowActions>
  </S.Row>
);

export const MarketplaceView: React.FC = () => {
  const vm = useMarketplaceViewModel();

  return (
    <S.Page>
      <S.Header>
        <S.HeaderText>
          <S.Title>Extensões</S.Title>
          <S.Subtitle>
            Crie e edite extensões na sua área privada, instale-as para usar no escritório e publique
            no catálogo para compartilhar com outros escritórios.
          </S.Subtitle>
        </S.HeaderText>
        {vm.canManage && (
          <S.HeaderActions>
            <Button variant="secondary" size="sm" onClick={vm.openAuthor}>
              <RiMagicLine size={16} /> Criar extensão
            </Button>
            <S.ImportLabel $disabled={vm.busyId === '__import__'}>
              <RiUploadLine size={16} /> Importar .json
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
              message="Somente administradores do escritório podem criar, instalar ou publicar extensões."
              variant="info"
            />
          )}

          <S.Filters>
            {FILTERS.map((f) => (
              <S.Filter key={f.key} $active={vm.filter === f.key} onClick={() => vm.setFilter(f.key)}>
                {f.label}
                <S.FilterCount>{vm.counts[f.key]}</S.FilterCount>
              </S.Filter>
            ))}
          </S.Filters>

          {vm.rows.length === 0 ? (
            <S.Empty>
              {vm.filter === 'all'
                ? 'Nenhuma extensão ainda. Use "Criar extensão", importe um .json ou instale a partir do catálogo público.'
                : 'Nenhuma extensão nesta visão.'}
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
        title="Excluir extensão"
        message={`Excluir "${vm.removeTarget?.name ?? ''}" da sua área privada? Cópias já instaladas (aqui ou em outros escritórios) e a versão publicada não são afetadas.`}
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={vm.confirmRemove}
        onCancel={vm.cancelRemove}
      />
    </S.Page>
  );
};
