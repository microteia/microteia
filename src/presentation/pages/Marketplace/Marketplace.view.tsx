import React from 'react';
import { RiStoreLine, RiMagicLine, RiUploadLine } from 'react-icons/ri';
import { Button } from '../../components/ui/Button';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { Modal } from '../../components/ui/Modal';
import { WidgetRenderer } from '../../components/ui/WidgetRenderer';
import { useMarketplaceViewModel } from './Marketplace.viewmodel';
import { S } from './Marketplace.styles';

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

        {vm.cards.map(({ plugin, installed, enabled, installedVersion, workflowCount, published, loadError }) => {
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
                <S.Origin>{published ? 'Publicada' : 'Interna'}</S.Origin>
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
    </S.Page>
  );
};
