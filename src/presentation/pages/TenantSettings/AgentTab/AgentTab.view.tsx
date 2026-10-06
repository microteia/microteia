import React from 'react';
import { RiAddLine, RiFileCopyLine, RiRobot2Line, RiCloseCircleLine } from 'react-icons/ri';
import { useAgentTabViewModel } from './AgentTab.viewmodel';
import { AGENT_EXPIRY_CHOICES } from '../../../shared/agentExpiry';
import type { AgentGrantRow } from './AgentTab.viewmodel';
import { S } from './AgentTab.styles.tsx';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { Spinner } from '../../../components/ui/Spinner';
import { InfoBanner } from '../../../components/ui/InfoBanner';
import { SearchSelect } from '../../../components/ui/SearchSelect';
import { MultiSearchSelect } from '../../../components/ui/MultiSearchSelect';
import { useT } from '../../../shared/i18n/useT';
import { formatDate } from '../../../../utils/formatters';

const STATE_KEY: Record<AgentGrantRow['state'], string> = {
  active: 'agent.state.active',
  revoked: 'agent.state.revoked',
  expired: 'agent.state.expired',
};

export const AgentTabView: React.FC = () => {
  const vm = useAgentTabViewModel();
  const t = useT('core.access');

  const expiryOptions = AGENT_EXPIRY_CHOICES.map((choice) => ({
    value: String(choice.days ?? ''),
    label: t(choice.labelKey),
  }));

  return (
    <S.Container>
      <S.Header>
        <S.Intro>
          <S.Title>{t('agent.title')}</S.Title>
          <S.Description>{t('agent.description')}</S.Description>
        </S.Intro>
        {vm.availability === 'ready' && (
          <Button variant="primary" onClick={vm.openForm}>
            <RiAddLine />
            {t('agent.action.issue')}
          </Button>
        )}
      </S.Header>

      {vm.availability === 'disabled' && (
        <InfoBanner message={t('agent.banner.disabled')} variant="info" />
      )}
      {vm.availability === 'pending' && (
        <InfoBanner message={t('agent.banner.pending')} variant="warning" />
      )}

      {vm.availability === 'ready' && (
        <S.Endpoint>
          <S.EndpointLabel>{t('agent.endpoint.label')}</S.EndpointLabel>
          <S.Mono>{vm.endpointUrl}</S.Mono>
          <S.FieldHint>{t('agent.endpoint.hint')}</S.FieldHint>
        </S.Endpoint>
      )}

      {vm.isLoading ? (
        <Spinner />
      ) : vm.rows.length === 0 ? (
        <S.Empty>{t('agent.empty')}</S.Empty>
      ) : (
        <S.List>
          {vm.rows.map((row) => (
            <S.Row key={row.id} $inactive={row.state !== 'active'}>
              <S.RowMain>
                <S.RowName>
                  <RiRobot2Line />
                  {' '}
                  {row.name}
                </S.RowName>
                <S.Chips>
                  {row.permissions.map((permission) => (
                    <S.Chip key={permission}>{permission}</S.Chip>
                  ))}
                </S.Chips>
                <S.RowMeta>
                  {t(STATE_KEY[row.state])}
                  {row.expiresAt !== null && ` · ${t('agent.meta.expires')} ${formatDate(row.expiresAt)}`}
                  {row.lastUsedAt !== null && ` · ${t('agent.meta.last-used')} ${formatDate(row.lastUsedAt)}`}
                  {row.lastUsedAt === null && row.state === 'active' && ` · ${t('agent.meta.never-used')}`}
                  {row.signedInFrom !== null
                    && ` · ${t('agent.meta.signed-in-as', { client: row.signedInFrom })}`}
                  {!row.isOwn && ` · ${t('agent.meta.of-another')}`}
                </S.RowMeta>
              </S.RowMain>
              <S.RowActions>
                {row.state === 'active' && (row.isOwn || vm.canManageOthers) && (
                  <Button variant="ghost" size="sm" onClick={() => vm.askRevoke(row)}>
                    <RiCloseCircleLine />
                    {t('agent.action.revoke')}
                  </Button>
                )}
              </S.RowActions>
            </S.Row>
          ))}
        </S.List>
      )}

      {vm.isFormOpen && (
        <Modal title={t('agent.form.title')} onClose={vm.closeForm}>
          <S.Form>
            <S.Field>
              <S.FieldLabel htmlFor="agent-name">{t('agent.form.name')}</S.FieldLabel>
              <Input
                id="agent-name"
                value={vm.name}
                onChange={(event) => vm.setName(event.target.value)}
                placeholder={t('agent.form.name.placeholder')}
              />
              <S.FieldHint>{t('agent.form.name.hint')}</S.FieldHint>
            </S.Field>

            <S.Field>
              <S.FieldLabel>{t('agent.form.permissions')}</S.FieldLabel>
              <MultiSearchSelect
                options={vm.permissionChoices.map((choice) => ({
                  value: choice.id,
                  label: `${choice.resource} · ${choice.label}`,
                }))}
                values={vm.selectedPermissions}
                onChange={vm.setSelectedPermissions}
                placeholder={t('agent.form.permissions.placeholder')}
              />
              <S.FieldHint>{t('agent.form.permissions.hint')}</S.FieldHint>
            </S.Field>

            <S.Field>
              <S.FieldLabel>{t('agent.form.expiry')}</S.FieldLabel>
              <SearchSelect
                options={expiryOptions}
                value={String(vm.expiryDays ?? '')}
                onChange={(value) => vm.setExpiryDays(value === '' ? null : Number(value))}
              />
            </S.Field>

            <S.ModalActions>
              <Button variant="ghost" onClick={vm.closeForm}>{t('agent.form.cancel')}</Button>
              <Button variant="primary" onClick={vm.submit} disabled={!vm.canSubmit}>
                {vm.isIssuing ? t('agent.form.issuing') : t('agent.form.confirm')}
              </Button>
            </S.ModalActions>
          </S.Form>
        </Modal>
      )}

      {vm.issuedToken !== null && (
        <Modal title={t('agent.issued.title')} onClose={vm.dismissIssuedToken}>
          <S.Form>
            <InfoBanner message={t('agent.issued.once')} variant="warning" />
            <S.Field>
              <S.FieldLabel>{t('agent.issued.token')}</S.FieldLabel>
              <S.Mono>{vm.issuedToken}</S.Mono>
            </S.Field>
            <S.Field>
              <S.FieldLabel>{t('agent.issued.command')}</S.FieldLabel>
              <S.Mono>{vm.connectCommand}</S.Mono>
              <S.FieldHint>{t('agent.issued.command.hint')}</S.FieldHint>
            </S.Field>
            <S.ModalActions>
              <Button variant="secondary" onClick={vm.copyIssuedToken}>
                <RiFileCopyLine />
                {t('agent.issued.copy')}
              </Button>
              <Button variant="primary" onClick={vm.dismissIssuedToken}>
                {t('agent.issued.done')}
              </Button>
            </S.ModalActions>
          </S.Form>
        </Modal>
      )}

      <ConfirmModal
        isOpen={vm.revoking !== null}
        title={t('agent.revoke.title')}
        message={t('agent.revoke.message', { name: vm.revoking?.name ?? '' })}
        confirmLabel={t('agent.action.revoke')}
        variant="danger"
        loading={vm.isRevoking}
        onConfirm={vm.confirmRevoke}
        onCancel={vm.cancelRevoke}
      />
    </S.Container>
  );
};
