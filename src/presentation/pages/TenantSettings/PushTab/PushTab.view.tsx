import React from 'react';
import { useTheme } from 'styled-components';
import { RiMailLine, RiLinkUnlink, RiRefreshLine, RiAddLine } from 'react-icons/ri';
import { usePushTabViewModel } from './PushTab.viewmodel';
import { S } from './PushTab.styles.tsx';
import { Button } from '../../../components/ui/Button';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { Spinner } from '../../../components/ui/Spinner';

export const PushTabView: React.FC = () => {
  const vm = usePushTabViewModel();
  const theme = useTheme();

  return (
    <S.Container>
      <S.SectionTitle>Monitoramento Gmail</S.SectionTitle>

      {vm.loading ? (
        <Spinner />
      ) : (
        <>
          {vm.error && <S.Feedback $type="error">{vm.error}</S.Feedback>}

          {vm.connections.length === 0 ? (
            <S.EmptyState>
              <RiMailLine size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
              <p>Nenhuma conta Gmail autorizada para este escritório.</p>
            </S.EmptyState>
          ) : (
            <S.ConnectionList>
              {vm.connections.map((conn) => (
                <S.ConnectionCard key={conn.id}>
                  <S.ProviderIcon $color={theme.colors.primary}>
                    <RiMailLine size={18} />
                  </S.ProviderIcon>
                  <S.CardBody>
                    <S.CardName>{conn.email}</S.CardName>
                    <S.CardMeta>
                      Autorizado por {conn.authorizedByName} em{' '}
                      {new Date(conn.authorizedAt).toLocaleDateString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </S.CardMeta>
                  </S.CardBody>
                  <S.CardActions>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void vm.handleAuthorize()}
                      title="Reautorizar"
                      disabled={vm.isAuthorizing}
                    >
                      <RiRefreshLine size={16} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => vm.handleDelete(conn.id)}
                      title="Revogar acesso"
                    >
                      <RiLinkUnlink size={16} />
                    </Button>
                  </S.CardActions>
                </S.ConnectionCard>
              ))}
            </S.ConnectionList>
          )}

          <S.AddRow>
            <Button onClick={() => void vm.handleAuthorize()} disabled={vm.isAuthorizing}>
              <RiAddLine size={16} />
              {vm.isAuthorizing ? 'Autorizando...' : 'Autorizar Conta Gmail'}
            </Button>
          </S.AddRow>
        </>
      )}

      <ConfirmModal
        isOpen={vm.confirmDelete.open}
        title="Remover conta Gmail"
        message={`Deseja remover a autorização da conta "${vm.confirmDelete.email}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Remover"
        variant="danger"
        onConfirm={() => void vm.runDelete()}
        onCancel={vm.cancelDelete}
      />
    </S.Container>
  );
};
