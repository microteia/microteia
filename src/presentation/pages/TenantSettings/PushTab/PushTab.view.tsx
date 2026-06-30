import React from 'react';
import { useTheme } from 'styled-components';
import { RiMailLine, RiLinkUnlink, RiRefreshLine, RiAddLine, RiShieldCheckLine, RiMailOpenLine } from 'react-icons/ri';
import { usePushTabViewModel } from './PushTab.viewmodel';
import { S } from './PushTab.styles.tsx';
import { Button } from '../../../components/ui/Button';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { Spinner } from '../../../components/ui/Spinner';
import { TagInput } from '../../../components/ui/TagInput';

export const PushTabView: React.FC = () => {
  const vm = usePushTabViewModel();
  const theme = useTheme();

  return (
    <S.Container>
      <S.Section>
        <S.SectionTitle>Remetentes Permitidos</S.SectionTitle>
        <S.SectionDescription>
          Configure os e-mails de tribunais autorizados a enviar notificações.
          Apenas mensagens destes remetentes serão processadas pelo monitoramento Gmail. Se nenhum remetente for informado, somente os e-mails do domínio (.jus.br) serão processados.
        </S.SectionDescription>
        <S.AllowedSendersCard>
          <S.IconWrapper $color={theme.colors.success}>
            <RiShieldCheckLine size={20} />
          </S.IconWrapper>
          <S.InputWrapper>
            <TagInput
              value={vm.allowedSenders}
              onChange={(senders) => void vm.handleAllowedSendersChange(senders)}
              placeholder="Digite um e-mail e pressione Enter (ex: pje@tjba.jus.br)"
              hint="Pressione Enter para adicionar. Clique no × para remover."
              validator={(email) => {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                return emailRegex.test(email);
              }}
              normalizer={(email) => email.toLowerCase()}
            />
          </S.InputWrapper>
        </S.AllowedSendersCard>
      </S.Section>

      <S.Section>
        <S.SectionTitle>Assuntos Permitidos</S.SectionTitle>
        <S.SectionDescription>
          Configure textos que devem estar presentes no assunto dos e-mails.
          Se nenhum assunto for informado, todos os e-mails dos remetentes permitidos serão processados.
        </S.SectionDescription>
        <S.AllowedSendersCard>
          <S.IconWrapper $color={theme.colors.info}>
            <RiMailOpenLine size={20} />
          </S.IconWrapper>
          <S.InputWrapper>
            <TagInput
              value={vm.allowedSubjects}
              onChange={(subjects) => void vm.handleAllowedSubjectsChange(subjects)}
              placeholder="Digite um texto e pressione Enter (ex: intimação, citação)"
              hint="Pressione Enter para adicionar. Clique no × para remover."
            />
          </S.InputWrapper>
        </S.AllowedSendersCard>
      </S.Section>

      <S.Section>
        <S.SectionTitle>Monitoramento Gmail</S.SectionTitle>
        <S.SectionDescription>
          Autorize contas Gmail para monitoramento automático de e-mails dos tribunais.
        </S.SectionDescription>

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
      </S.Section>

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
