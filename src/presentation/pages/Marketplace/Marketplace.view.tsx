import React from 'react';
import { RiStoreLine, RiMagicLine, RiUploadLine, RiPencilLine, RiDownloadLine } from 'react-icons/ri';
import { Button } from '../../components/ui/Button';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { Modal } from '../../components/ui/Modal';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { WidgetRenderer } from '../../components/ui/WidgetRenderer';
import { useMarketplaceViewModel } from './Marketplace.viewmodel';
import type { PublicExtensionStatus } from '../../../domain/entities/PublicExtension';
import { S } from './Marketplace.styles';

const publicStatusLabel = (status: PublicExtensionStatus | null): string => {
  switch (status) {
    case 'pending': return 'Em análise';
    case 'approved': return 'Publicada';
    case 'deprecated': return 'Obsoleta';
    default: return 'Privada';
  }
};

export const MarketplaceView: React.FC = () => {
  const vm = useMarketplaceViewModel();

  return (
    <S.Page>
      <S.Header>
        <S.HeaderText>
          <S.Title>Extensões</S.Title>
          <S.Subtitle>Instale funcionalidades adicionais no seu escritório.</S.Subtitle>
        </S.HeaderText>
        {vm.canManage && (
          <S.HeaderActions>
            <Button variant="secondary" size="sm" onClick={vm.openAuthor}>
              <RiMagicLine size={16} /> Criar extensão
            </Button>
            <S.ImportLabel $disabled={vm.busyPluginId === '__import__'}>
              <RiUploadLine size={16} /> Importar .json
              <S.HiddenFile
                type="file"
                accept="application/json,.json"
                disabled={vm.busyPluginId === '__import__'}
                onChange={(e) => void vm.onImportFile(e)}
              />
            </S.ImportLabel>
          </S.HeaderActions>
        )}
      </S.Header>

      <S.Content>
        {!vm.canManage && (
          <InfoBanner
            message="Somente administradores do escritório podem instalar ou remover extensões."
            variant="info"
          />
        )}

        {vm.canManage && vm.myExtensions.length > 0 && (
          <>
            <S.GroupTitle>Minhas Extensões</S.GroupTitle>
            <S.GroupHint>Extensões que você criou neste escritório. Ative para usar aqui; publique para disponibilizar a outros.</S.GroupHint>
            {vm.myExtensions.map((ext) => {
              const busy = vm.busyPluginId === ext.id;
              return (
                <S.Card key={ext.id}>
                  <S.CardHead>
                    <S.CardName>{ext.name}</S.CardName>
                    <S.StatusBadge $on={ext.active}>{ext.active ? 'Ativa' : 'Inativa'}</S.StatusBadge>
                  </S.CardHead>
                  <S.Summary>{ext.summary}</S.Summary>
                  {ext.authorName && (
                    <S.Author>
                      {ext.authorPhotoURL
                        ? <S.AuthorPhoto src={ext.authorPhotoURL} alt={ext.authorName} />
                        : <S.AuthorInitial>{ext.authorName.charAt(0).toUpperCase()}</S.AuthorInitial>}
                      Criada por {ext.authorName}
                    </S.Author>
                  )}
                  <S.Meta>
                    <span>v{ext.version}</span>
                    {ext.hasCode && <S.Origin>Com código</S.Origin>}
                    <S.Origin>{publicStatusLabel(ext.publicStatus)}</S.Origin>
                  </S.Meta>
                  <S.Actions>
                    <Button variant="secondary" size="sm" disabled={busy} onClick={() => vm.editMyExtension(ext.id)}>
                      <RiPencilLine size={16} /> Editar
                    </Button>
                    <Button variant="secondary" size="sm" disabled={busy} onClick={() => vm.toggleMyActive(ext.id, !ext.active)}>
                      {ext.active ? 'Desativar' : 'Ativar'}
                    </Button>
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => vm.downloadMyExtension(ext.id)}>
                      <RiDownloadLine size={16} /> Baixar
                    </Button>
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => vm.publishMyExtension(ext.id)}>
                      <RiUploadLine size={16} /> {ext.publicStatus ? 'Publicar atualização' : 'Publicar'}
                    </Button>
                    <Button variant="danger" size="sm" disabled={busy} onClick={() => vm.requestRemoveMyExtension(ext.id)}>
                      Excluir
                    </Button>
                  </S.Actions>
                </S.Card>
              );
            })}
          </>
        )}

        {vm.canModerate && vm.pendingCards.length > 0 && (
          <>
            <S.GroupTitle>Moderação (aguardando aprovação)</S.GroupTitle>
            <S.GroupHint>Extensões com código publicadas por escritórios, à espera de aprovação para virarem públicas.</S.GroupHint>
            {vm.pendingCards.map((pub) => {
              const busy = vm.busyPluginId === pub.domain;
              return (
                <S.Card key={pub.domain}>
                  <S.CardHead>
                    <S.CardName>{pub.name}</S.CardName>
                    <S.StatusBadge $on={false}>Em análise</S.StatusBadge>
                  </S.CardHead>
                  <S.Summary>{pub.summary}</S.Summary>
                  <S.Author>
                    {pub.authorPhotoURL
                      ? <S.AuthorPhoto src={pub.authorPhotoURL} alt={pub.authorName} />
                      : <S.AuthorInitial>{pub.authorName.charAt(0).toUpperCase()}</S.AuthorInitial>}
                    Publicada por {pub.authorName}
                  </S.Author>
                  <S.Meta>
                    <span>v{pub.version}</span>
                    {pub.hasCode && <S.Origin>Com código</S.Origin>}
                    <S.Origin>{pub.domain}</S.Origin>
                  </S.Meta>
                  <S.Actions>
                    <Button variant="primary" size="sm" disabled={busy} onClick={() => vm.approvePublic(pub.domain)}>
                      Aprovar
                    </Button>
                    <Button variant="danger" size="sm" disabled={busy} onClick={() => vm.rejectPublic(pub.domain)}>
                      Recusar
                    </Button>
                  </S.Actions>
                </S.Card>
              );
            })}
          </>
        )}

        {vm.publicCards.length > 0 && (
          <>
            <S.GroupTitle>Públicas</S.GroupTitle>
            <S.GroupHint>Extensões publicadas e aprovadas, disponíveis para todos os escritórios.</S.GroupHint>
            {vm.publicCards.map((pub) => {
              const busy = vm.busyPluginId === pub.domain;
              return (
                <S.Card key={pub.domain}>
                  <S.CardHead>
                    <S.CardName>{pub.name}</S.CardName>
                    <S.StatusBadge $on>Publicada</S.StatusBadge>
                  </S.CardHead>
                  <S.Summary>{pub.summary}</S.Summary>
                  <S.Author>
                    {pub.authorPhotoURL
                      ? <S.AuthorPhoto src={pub.authorPhotoURL} alt={pub.authorName} />
                      : <S.AuthorInitial>{pub.authorName.charAt(0).toUpperCase()}</S.AuthorInitial>}
                    Publicada por {pub.authorName}
                  </S.Author>
                  <S.Meta>
                    <span>v{pub.version}</span>
                    {pub.hasCode && <S.Origin>Com código</S.Origin>}
                  </S.Meta>
                  {vm.canModerate && (
                    <S.Actions>
                      <Button variant="ghost" size="sm" disabled={busy} onClick={() => vm.deprecatePublic(pub.domain)}>
                        Marcar obsoleta
                      </Button>
                    </S.Actions>
                  )}
                </S.Card>
              );
            })}
          </>
        )}

        {vm.cards.length > 0 && <S.GroupTitle>Exemplos</S.GroupTitle>}

        {vm.cards.map(({ plugin, installed, enabled, installedVersion, workflowCount, published, imported, loadError }) => {
          const busy = vm.busyPluginId === plugin.manifest.id;
          return (
            <S.Card key={plugin.manifest.id}>
              <S.CardHead>
                <S.CardName>{plugin.manifest.name}</S.CardName>
                {installed && <S.StatusBadge $on={enabled}>{enabled ? 'Ativa' : 'Desativada'}</S.StatusBadge>}
              </S.CardHead>

              {loadError && (
                <InfoBanner message={`Esta extensão não pôde ser carregada: ${loadError}`} variant="warning" />
              )}

              <S.Summary>{plugin.summary}</S.Summary>

              {plugin.overview !== undefined && (
                <S.DetailLink type="button" onClick={() => vm.openDetail(plugin)}>
                  Ver detalhes
                </S.DetailLink>
              )}

              <S.Meta>
                <S.Publisher>{plugin.manifest.publisher?.name ?? 'Curatino'}</S.Publisher>
                <span>v{installedVersion ?? plugin.manifest.version}</span>
                <span>
                  {workflowCount} {workflowCount === 1 ? 'automação' : 'automações'}
                </span>
                <S.Origin>{published ? 'Publicada' : imported ? 'Importada' : 'Interna'}</S.Origin>
              </S.Meta>

              {vm.canManage && (
                <S.Actions>
                  {!installed ? (
                    <Button variant="primary" size="sm" disabled={busy} onClick={() => vm.install(plugin)}>
                      <RiStoreLine size={16} /> Instalar
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={() => vm.toggleEnabled(plugin.manifest.id, !enabled)}
                      >
                        {enabled ? 'Desativar' : 'Ativar'}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={busy}
                        onClick={() => vm.uninstall(plugin.manifest.id)}
                      >
                        Remover
                      </Button>
                    </>
                  )}
                </S.Actions>
              )}

              {vm.canPublish && (
                <S.Actions>
                  {!published ? (
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => vm.publish(plugin)}>
                      Publicar no catálogo
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => vm.unpublish(plugin.manifest.id)}>
                      Despublicar
                    </Button>
                  )}
                </S.Actions>
              )}
            </S.Card>
          );
        })}
      </S.Content>

      {vm.detailPlugin && (
        <Modal title={vm.detailPlugin.manifest.name} onClose={vm.closeDetail} size="medium">
          <WidgetRenderer spec={vm.detailPlugin.overview} />
        </Modal>
      )}

      <ConfirmModal
        isOpen={vm.removeTarget !== null}
        title="Excluir extensão"
        message={`Excluir "${vm.removeTarget?.name ?? ''}"? Esta ação remove a extensão do seu escritório e não pode ser desfeita. Se ela estiver publicada, a versão publicada permanece no catálogo.`}
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={vm.confirmRemoveMyExtension}
        onCancel={vm.cancelRemoveMyExtension}
      />
    </S.Page>
  );
};
