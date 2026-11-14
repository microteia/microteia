import React from 'react';
import { RiAddLine, RiArrowDownSLine, RiDeleteBinLine, RiEditLine, RiSparkling2Line } from 'react-icons/ri';
import { useAssistantPanelViewModel } from './AssistantPanel.viewmodel';
import { S } from './AssistantPanel.styles';
import { AssistantMessage } from '../AssistantMessage';
import { AssistantComposer } from '../AssistantComposer';
import { InfoBanner } from '../../ui/InfoBanner';
import { ConfirmModal } from '../../ui/ConfirmModal';
import { Spinner } from '../../ui/Spinner';
import { useT } from '../../../shared/i18n/useT';

/**
 * O assistente de IA: a conversa com a conexão de IA do escritório, que usa as ferramentas do agente
 * com as permissões de quem está logado. Mora no dock à direita; a conversa continua montada quando
 * o dock fecha, e o que já terminou está gravado — fechar a aba não perde nada.
 */
export const AssistantPanelView: React.FC = () => {
  const { attachList, ...vm } = useAssistantPanelViewModel();
  const t = useT('core.assistant');

  return (
    <S.Root>
      <S.Toolbar>
        <S.HistoryButton onClick={vm.toggleHistory} aria-expanded={vm.historyOpen} title={t('panel.history')}>
          <S.HistoryTitle>{vm.title}</S.HistoryTitle>
          <RiArrowDownSLine size={16} />
        </S.HistoryButton>
        <S.IconButton onClick={vm.openRename} disabled={!vm.hasConversation || vm.busy} title={t('panel.rename')} aria-label={t('panel.rename')}>
          <RiEditLine size={15} />
        </S.IconButton>
        <S.IconButton onClick={vm.openDelete} disabled={!vm.hasConversation || vm.busy} title={t('panel.delete')} aria-label={t('panel.delete')}>
          <RiDeleteBinLine size={15} />
        </S.IconButton>
        <S.IconButton onClick={vm.newConversation} disabled={vm.busy} title={t('panel.new')} aria-label={t('panel.new')}>
          <RiAddLine size={17} />
        </S.IconButton>
        {vm.historyOpen && (
          <S.HistoryList role="listbox" aria-label={t('panel.history')}>
            {vm.conversations.length === 0 && <S.HistoryEmpty>{t('panel.history.empty')}</S.HistoryEmpty>}
            {vm.conversations.map((conversation) => (
              <S.HistoryItem
                key={conversation.id}
                role="option"
                aria-selected={conversation.active}
                $active={conversation.active}
                onClick={() => vm.selectConversation(conversation.id)}
              >
                {conversation.title}
              </S.HistoryItem>
            ))}
          </S.HistoryList>
        )}
      </S.Toolbar>

      {(vm.readOnly || vm.error) && (
        <S.Banners>
          {vm.readOnly && <InfoBanner variant="info" message={t('panel.read-only')} />}
          {vm.error && <InfoBanner variant="warning" message={vm.error} />}
        </S.Banners>
      )}

      <S.Messages ref={attachList} onScroll={vm.onListScroll}>
        {vm.items.length === 0 && !vm.busy && vm.notices.length === 0 && (
          <S.Empty>
            <S.EmptyIcon><RiSparkling2Line size={28} /></S.EmptyIcon>
            <S.EmptyTitle>{t('panel.empty.title')}</S.EmptyTitle>
            <S.EmptyHint>{t('panel.empty.hint')}</S.EmptyHint>
          </S.Empty>
        )}
        {vm.items.map((item) => (
          <AssistantMessage key={item.id} item={item} labels={vm.labels} />
        ))}
        {vm.compacting && (
          <S.Status><Spinner size={12} />{t('panel.compacting')}</S.Status>
        )}
        {vm.showThinking && (
          <S.Status><Spinner size={12} />{t('panel.thinking')}</S.Status>
        )}
        {vm.notices.map((notice, index) => (
          <S.Notice key={`${index}-${notice}`}>{notice}</S.Notice>
        ))}
        {vm.approvals.length > 0 && (
          <S.Approval>
            <S.ApprovalTitle>{t('approval.title')}</S.ApprovalTitle>
            <S.ApprovalHint>{t('approval.hint')}</S.ApprovalHint>
            {vm.approvals.map((call) => (
              <S.ApprovalCall key={call.id}>
                <S.ApprovalLabel>{call.label}</S.ApprovalLabel>
                <S.ApprovalInput>{call.input}</S.ApprovalInput>
              </S.ApprovalCall>
            ))}
            <S.ApprovalActions>
              <S.Button onClick={vm.reject}>{t('approval.reject')}</S.Button>
              <S.Button $primary onClick={vm.approve}>{t('approval.approve')}</S.Button>
            </S.ApprovalActions>
          </S.Approval>
        )}
      </S.Messages>

      <AssistantComposer
        busy={vm.busy}
        placeholder={t('composer.placeholder')}
        sendLabel={t('composer.send')}
        stopLabel={t('composer.stop')}
        commands={vm.commands}
        onSend={vm.send}
        onStop={vm.stop}
      />

      <ConfirmModal
        isOpen={vm.renameOpen}
        title={t('panel.rename.title')}
        message=""
        confirmLabel={t('panel.rename.confirm')}
        inputValue={vm.renameValue}
        inputPlaceholder={t('panel.rename.placeholder')}
        onInputChange={vm.changeRename}
        onConfirm={vm.confirmRename}
        onCancel={vm.cancelRename}
      />
      <ConfirmModal
        isOpen={vm.deleteOpen}
        title={t('panel.delete.title')}
        message={t('panel.delete.message')}
        confirmLabel={t('panel.delete.confirm')}
        variant="danger"
        loading={vm.deleting}
        onConfirm={vm.confirmDelete}
        onCancel={vm.cancelDelete}
      />
    </S.Root>
  );
};
