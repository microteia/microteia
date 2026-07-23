import React from 'react';
import { RiStoreLine } from 'react-icons/ri';
import { Button } from '../../components/ui/Button';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { useMarketplaceViewModel } from './Marketplace.viewmodel';
import { S } from './Marketplace.styles';

export const MarketplaceView: React.FC = () => {
  const vm = useMarketplaceViewModel();

  return (
    <S.Page>
      <S.Header>
        <S.Title>Extensões</S.Title>
        <S.Subtitle>Instale funcionalidades adicionais no seu escritório.</S.Subtitle>
      </S.Header>

      <S.Content>
        {!vm.canManage && (
          <InfoBanner
            message="Somente administradores do escritório podem instalar ou remover extensões."
            variant="info"
          />
        )}

        {vm.cards.map(({ plugin, installed, enabled, installedVersion, workflowCount, published }) => {
          const busy = vm.busyPluginId === plugin.manifest.id;
          return (
            <S.Card key={plugin.manifest.id}>
              <S.CardHead>
                <S.CardName>{plugin.manifest.name}</S.CardName>
                {installed && <S.StatusBadge $on={enabled}>{enabled ? 'Ativa' : 'Desativada'}</S.StatusBadge>}
              </S.CardHead>

              <S.Summary>{plugin.summary}</S.Summary>

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
    </S.Page>
  );
};
