import React from 'react';
import {
  RiAddLine,
  RiCloseCircleLine,
  RiDeleteBinLine,
  RiFileCopyLine,
  RiRobot2Line,
  RiShieldKeyholeLine,
} from 'react-icons/ri';
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
import { PermissionPicker } from '../../../components/ui/PermissionPicker';
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

  const renderRow = (row: AgentGrantRow) => (
    <S.Row key={row.id}>
      <S.RowIcon $inactive={row.state !== 'active'}>
        <RiRobot2Line />
      </S.RowIcon>
      <S.RowMain>
        <S.RowHeading>
          <S.RowName>{row.name}</S.RowName>
          <S.State $state={row.state}>{t(STATE_KEY[row.state])}</S.State>
        </S.RowHeading>
        <S.RowMeta>
          {row.expiresAt !== null && `${t('agent.meta.expires')} ${formatDate(row.expiresAt)}`}
          {row.expiresAt === null && t('agent.meta.no-expiry')}
          {row.lastUsedAt !== null && ` · ${t('agent.meta.last-used')} ${formatDate(row.lastUsedAt)}`}
          {row.lastUsedAt === null && row.state === 'active' && ` · ${t('agent.meta.never-used')}`}
          {row.signedInFrom !== null
            && ` · ${t('agent.meta.signed-in-as', { client: row.signedInFrom })}`}
          {!row.isOwn && ` · ${t('agent.meta.of-another')}`}
        </S.RowMeta>
      </S.RowMain>
      <S.RowActions>
        <Button variant="ghost" size="sm" onClick={() => vm.openPermissions(row)}>
          <RiShieldKeyholeLine />
          {t('agent.action.permissions', { count: row.permissions.length })}
        </Button>
        {row.canRevoke && (
          <Button variant="ghost" size="sm" onClick={() => vm.askRevoke(row)}>
            <RiCloseCircleLine />
            {t('agent.action.revoke')}
          </Button>
        )}
        {row.canRemove && (
          <Button variant="ghost" size="sm" onClick={() => vm.askRemove(row)}>
            <RiDeleteBinLine />
            {t('agent.action.remove')}
          </Button>
        )}
      </S.RowActions>
    </S.Row>
  );

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
      ) : vm.isEmpty ? (
        <S.Empty>{t('agent.empty')}</S.Empty>
      ) : (
        <>
          {vm.activeRows.length > 0 && (
            <S.List>{vm.activeRows.map(renderRow)}</S.List>
          )}
          {vm.inactiveRows.length > 0 && (
            <S.Section>
              <S.SectionTitle>
                {t('agent.section.inactive', { count: vm.inactiveRows.length })}
              </S.SectionTitle>
              <S.List>{vm.inactiveRows.map(renderRow)}</S.List>
            </S.Section>
          )}
        </>
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
              <PermissionPicker
                selected={vm.selectedPermissions}
                onChange={vm.setSelectedPermissions}
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

      {vm.viewingPermissions !== null && (
        <Modal
          title={t('agent.permissions.title', { name: vm.viewingPermissions.name })}
          onClose={vm.closePermissions}
        >
          <S.Form>
            <S.FieldHint>{t('agent.permissions.hint')}</S.FieldHint>
            <S.Groups>
              {vm.viewingPermissionGroups.map((group) => (
                <S.Group key={group.resource}>
                  <S.GroupResource>{group.resource}</S.GroupResource>
                  <S.Chips>
                    {group.actions.map((action) => (
                      <S.Chip key={action}>{action}</S.Chip>
                    ))}
                  </S.Chips>
                </S.Group>
              ))}
            </S.Groups>
            <S.ModalActions>
              <Button variant="primary" onClick={vm.closePermissions}>
                {t('agent.permissions.close')}
              </Button>
            </S.ModalActions>
          </S.Form>
        </Modal>
      )}

      <ConfirmModal
        isOpen={vm.removing !== null}
        title={t('agent.remove.title')}
        message={t('agent.remove.message', { name: vm.removing?.name ?? '' })}
        confirmLabel={t('agent.action.remove')}
        variant="danger"
        loading={vm.isRemoving}
        onConfirm={vm.confirmRemove}
        onCancel={vm.cancelRemove}
      />

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
