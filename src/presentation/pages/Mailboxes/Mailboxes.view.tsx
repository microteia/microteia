import React from 'react';
import { RiAddLine, RiArrowDownSLine, RiArrowUpSLine, RiDeleteBinLine, RiEditLine, RiPlugLine } from 'react-icons/ri';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Checkbox } from '../../components/ui/Checkbox';
import { MultiSearchSelect } from '../../components/ui/MultiSearchSelect';
import { Spinner } from '../../components/ui/Spinner';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { CopyButton } from '../../components/ui/CopyButton';
import { useT } from '../../shared/i18n/useT';
import { ForwardingGuide } from './ForwardingGuide';
import { useMailboxesViewModel } from './Mailboxes.viewmodel';
import { S } from './Mailboxes.styles';

export const MailboxesView: React.FC = () => {
  const t = useT('core.automation');
  const vm = useMailboxesViewModel();

  return (
    <S.Container>
      <S.Intro>
        <S.Title>{t('mailbox.title')}</S.Title>
        <S.Description>{t('mailbox.description')}</S.Description>
      </S.Intro>

      {vm.noSubscribableWorkflows && <InfoBanner variant="info" message={t('mailbox.no-subscribable')} />}

      {vm.loading ? (
        <Spinner />
      ) : (
        vm.sections.map((section) => (
          <S.Section key={section.key}>
            <S.SectionHeader>
              <S.SectionTitle>{section.title}</S.SectionTitle>
              {section.key !== 'members' && (
                <Button size="sm" onClick={() => vm.openNew(section.key === 'office' ? 'office' : 'own')}>
                  <RiAddLine size={16} /> {t('mailbox.add')}
                </Button>
              )}
            </S.SectionHeader>
            <S.List>
              {section.cards.length === 0 && <S.Empty>{t('mailbox.empty')}</S.Empty>}
              {section.cards.map((card) => (
                <S.Card key={card.mailbox.id}>
                  <S.Dot $tone={card.tone} />
                  <S.CardBody>
                    <S.CardName>{card.mailbox.name}</S.CardName>
                    <S.AddressRow>
                      <S.CardMeta>{card.account}</S.CardMeta>
                      {card.address && <CopyButton text={card.address} size={14} inline />}
                    </S.AddressRow>
                    {card.owner && <S.CardMeta>{t('mailbox.owner', { name: card.owner })}</S.CardMeta>}
                    <S.CardMeta>{t('mailbox.feeds', { workflows: card.subscriptions })}</S.CardMeta>
                    <S.CardStatus $tone={card.tone}>{card.status}</S.CardStatus>
                    {card.confirmation && (
                      <S.Confirmation>
                        {card.confirmation.text}
                        {card.confirmation.url && (
                          <S.ConfirmationLink href={card.confirmation.url} target="_blank" rel="noopener noreferrer">
                            {t('mailbox.forward.confirmation-open')}
                          </S.ConfirmationLink>
                        )}
                      </S.Confirmation>
                    )}
                    {card.guide && (
                      <S.GuideToggle type="button" onClick={() => vm.toggleGuide(card)} aria-expanded={card.guideOpen}>
                        {card.guideOpen ? <RiArrowUpSLine size={14} /> : <RiArrowDownSLine size={14} />}
                        {t(card.guideOpen ? 'mailbox.guide.hide' : 'mailbox.guide.show')}
                      </S.GuideToggle>
                    )}
                    {card.guide && card.guideOpen && <ForwardingGuide address={card.guide.address} rule={card.guide.rule} />}
                  </S.CardBody>
                  <S.Actions>
                    {card.canTest && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void vm.test(card.mailbox)}
                        disabled={vm.testingId !== null}
                        $isLoading={vm.testingId === card.mailbox.id}
                        title={t('mailbox.test')}
                      >
                        <RiPlugLine size={16} />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => vm.openEdit(card.mailbox)} title={t('core.ui/action.edit')}>
                      <RiEditLine size={16} />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => vm.askDelete(card.mailbox)} title={t('core.ui/action.delete')}>
                      <RiDeleteBinLine size={16} />
                    </Button>
                  </S.Actions>
                </S.Card>
              ))}
            </S.List>
          </S.Section>
        ))
      )}

      {vm.modalOpen && (
        <Modal title={t(vm.editing ? 'mailbox.edit' : 'mailbox.new')} onClose={vm.closeModal} size="medium">
          <S.Form>
            <S.Field>
              <S.Label htmlFor="mailbox-name">{t('mailbox.field.name')}</S.Label>
              <Input id="mailbox-name" value={vm.form.name} onChange={(event) => vm.setText('name', event.target.value)} />
            </S.Field>

            <S.Field>
              <S.Label>{t('mailbox.field.source')}</S.Label>
              <SearchSelect options={vm.sourceOptions} value={vm.form.source} onChange={vm.setSource} />
              <S.Hint>{t(vm.isPolled ? 'mailbox.source.imap.hint' : 'mailbox.source.forward.hint')}</S.Hint>
              {!vm.forwardingAvailable && <S.Hint>{t('mailbox.source.forward.unavailable')}</S.Hint>}
            </S.Field>

            {vm.isPolled && (
              <S.Grid>
                <S.Field>
                  <S.Label htmlFor="mailbox-host">{t('mailbox.field.host')}</S.Label>
                  <Input id="mailbox-host" value={vm.form.host} onChange={(event) => vm.setText('host', event.target.value)} />
                  <S.Hint>{t('mailbox.field.host.hint')}</S.Hint>
                </S.Field>
                <S.Field>
                  <S.Label htmlFor="mailbox-port">{t('mailbox.field.port')}</S.Label>
                  <Input id="mailbox-port" type="number" value={vm.form.port} onChange={(event) => vm.setText('port', event.target.value)} />
                  <Checkbox checked={vm.form.secure} onChange={vm.setSecure} label={t('mailbox.field.secure')} />
                </S.Field>
                <S.Field>
                  <S.Label htmlFor="mailbox-username">{t('mailbox.field.username')}</S.Label>
                  <Input
                    id="mailbox-username"
                    autoComplete="off"
                    value={vm.form.username}
                    onChange={(event) => vm.setText('username', event.target.value)}
                  />
                </S.Field>
                <S.Field>
                  <S.Label htmlFor="mailbox-password">{t('mailbox.field.password')}</S.Label>
                  <Input
                    id="mailbox-password"
                    type="password"
                    autoComplete="new-password"
                    value={vm.form.password}
                    onChange={(event) => vm.setText('password', event.target.value)}
                    placeholder={vm.editing?.hasPassword ? t('mailbox.field.password.kept') : ''}
                  />
                  <S.Hint>{t('mailbox.field.password.hint')}</S.Hint>
                </S.Field>
                <S.Field>
                  <S.Label htmlFor="mailbox-folder">{t('mailbox.field.folder')}</S.Label>
                  <Input id="mailbox-folder" value={vm.form.folder} onChange={(event) => vm.setText('folder', event.target.value)} />
                </S.Field>
                <S.Field>
                  <S.Label htmlFor="mailbox-interval">{t('mailbox.field.interval')}</S.Label>
                  <Input
                    id="mailbox-interval"
                    type="number"
                    value={vm.form.pollEveryMinutes}
                    onChange={(event) => vm.setText('pollEveryMinutes', event.target.value)}
                  />
                </S.Field>
                <S.Field>
                  <S.Label htmlFor="mailbox-backfill">{t('mailbox.field.backfill')}</S.Label>
                  <Input
                    id="mailbox-backfill"
                    type="number"
                    value={vm.form.backfillDays}
                    onChange={(event) => vm.setText('backfillDays', event.target.value)}
                  />
                  <S.Hint>{t('mailbox.field.backfill.hint')}</S.Hint>
                </S.Field>
              </S.Grid>
            )}

            <S.Field>
              <S.Label>{t('mailbox.field.subscriptions')}</S.Label>
              <MultiSearchSelect
                options={vm.subscriptionOptions}
                values={vm.form.subscriptions}
                onChange={vm.setSubscriptions}
                placeholder={t('mailbox.field.subscriptions.placeholder')}
              />
              <S.Hint>{t('mailbox.field.subscriptions.hint')}</S.Hint>
            </S.Field>

            <Checkbox checked={vm.form.enabled} onChange={vm.setEnabled} label={t('mailbox.field.enabled')} />

            <InfoBanner variant="info" message={t(vm.isPolled ? 'mailbox.privacy' : 'mailbox.privacy.forward')} />

            {vm.issue && <S.Issue>{vm.issue}</S.Issue>}

            <S.ModalActions>
              <Button variant="secondary" onClick={vm.closeModal} disabled={vm.saving}>
                {t('core.ui/action.cancel')}
              </Button>
              <Button onClick={() => void vm.save()} $isLoading={vm.saving} disabled={vm.saving || vm.issue !== null}>
                {t(vm.saving ? 'core.ui/action.saving' : 'core.ui/action.save')}
              </Button>
            </S.ModalActions>
          </S.Form>
        </Modal>
      )}

      <ConfirmModal
        isOpen={vm.pendingDelete !== null}
        title={t('mailbox.delete.title')}
        message={t('mailbox.delete.message', { name: vm.pendingDelete?.name ?? '' })}
        confirmLabel={t('core.ui/action.delete')}
        variant="danger"
        onConfirm={() => void vm.confirmDelete()}
        onCancel={vm.cancelDelete}
      />
    </S.Container>
  );
};
