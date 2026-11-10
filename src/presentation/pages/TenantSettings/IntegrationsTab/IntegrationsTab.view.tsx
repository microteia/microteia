import React from 'react';
import { RiAddLine, RiDeleteBinLine, RiEditLine } from 'react-icons/ri';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { SearchSelect } from '../../../components/ui/SearchSelect';
import { Spinner } from '../../../components/ui/Spinner';
import { TagInput } from '../../../components/ui/TagInput';
import { InfoBanner } from '../../../components/ui/InfoBanner';
import { useIntegrationsTabViewModel } from './IntegrationsTab.viewmodel';
import { S } from './IntegrationsTab.styles';
import { useT } from '../../../shared/i18n/useT';

export const IntegrationsTabView: React.FC = () => {
  const t = useT('core.automation');
  const vm = useIntegrationsTabViewModel();

  return (
    <S.Container>
      <S.Intro>
        <S.Title>{t('http-connection.title')}</S.Title>
        <S.Description>{t('http-connection.description')}</S.Description>
      </S.Intro>

      {vm.loading ? (
        <Spinner />
      ) : (
        <S.List>
          {vm.connections.length === 0 && <S.Empty>{t('http-connection.empty')}</S.Empty>}
          {vm.connections.map((connection) => (
            <S.Card key={connection.id}>
              <S.CardBody>
                <S.CardName>{connection.name}</S.CardName>
                <S.CardMeta>
                  <S.Key>{connection.key}</S.Key> · {vm.schemeLabel(connection.scheme)} · {connection.hosts.join(', ')}
                </S.CardMeta>
              </S.CardBody>
              <S.Actions>
                <Button size="sm" variant="ghost" onClick={() => vm.openEdit(connection)} title={t('core.ui/action.edit')}>
                  <RiEditLine size={16} />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => vm.askDelete(connection)} title={t('core.ui/action.delete')}>
                  <RiDeleteBinLine size={16} />
                </Button>
              </S.Actions>
            </S.Card>
          ))}
        </S.List>
      )}

      <S.AddRow>
        <Button onClick={vm.openNew}>
          <RiAddLine size={16} /> {t('http-connection.add')}
        </Button>
      </S.AddRow>

      {vm.modalOpen && (
        <Modal title={t(vm.editing ? 'http-connection.edit' : 'http-connection.new')} onClose={vm.closeModal} size="medium">
          <S.Form>
            <S.Field>
              <S.Label htmlFor="http-connection-name">{t('http-connection.name')}</S.Label>
              <Input id="http-connection-name" value={vm.form.name} onChange={(e) => vm.setField('name', e.target.value)} />
              {vm.fieldErrors.name && <S.Error>{vm.fieldErrors.name}</S.Error>}
            </S.Field>

            <S.Field>
              <S.Label htmlFor="http-connection-key">{t('http-connection.key')}</S.Label>
              <Input
                id="http-connection-key"
                value={vm.form.key}
                onChange={(e) => vm.setField('key', e.target.value)}
                disabled={!!vm.editing}
              />
              <S.Hint>{t('http-connection.key.hint')}</S.Hint>
              {vm.fieldErrors.key && <S.Error>{vm.fieldErrors.key}</S.Error>}
            </S.Field>

            <S.Field>
              <S.Label>{t('http-connection.scheme')}</S.Label>
              <SearchSelect options={vm.schemeOptions} value={vm.form.scheme} onChange={(value) => vm.setField('scheme', value)} />
              {vm.fieldErrors.scheme && <S.Error>{vm.fieldErrors.scheme}</S.Error>}
            </S.Field>

            {vm.needsUsername && (
              <S.Field>
                <S.Label htmlFor="http-connection-username">{t('http-connection.username')}</S.Label>
                <Input
                  id="http-connection-username"
                  value={vm.form.username}
                  onChange={(e) => vm.setField('username', e.target.value)}
                  autoComplete="off"
                />
                {vm.fieldErrors.username && <S.Error>{vm.fieldErrors.username}</S.Error>}
              </S.Field>
            )}

            {vm.needsParamName && (
              <S.Field>
                <S.Label htmlFor="http-connection-param">{vm.paramNameLabel}</S.Label>
                <Input
                  id="http-connection-param"
                  value={vm.form.paramName}
                  onChange={(e) => vm.setField('paramName', e.target.value)}
                />
                {vm.fieldErrors.paramName && <S.Error>{vm.fieldErrors.paramName}</S.Error>}
              </S.Field>
            )}

            <S.Field>
              <S.Label htmlFor="http-connection-secret">
                {t(vm.secretRequired ? 'http-connection.secret' : 'http-connection.secret.replace')}
              </S.Label>
              <Input
                id="http-connection-secret"
                type="password"
                value={vm.form.secret}
                onChange={(e) => vm.setField('secret', e.target.value)}
                autoComplete="new-password"
              />
              <S.Hint>{t(vm.secretRequired ? 'http-connection.secret.hint' : 'http-connection.secret.hint-existing')}</S.Hint>
              {vm.fieldErrors.secret && <S.Error>{vm.fieldErrors.secret}</S.Error>}
            </S.Field>

            <S.Field>
              <TagInput
                label={t('http-connection.hosts')}
                hint={t('http-connection.hosts.hint')}
                value={vm.form.hosts}
                onChange={vm.setHosts}
                validator={vm.isHostValid}
                normalizer={vm.normalizeHost}
              />
              {vm.fieldErrors.hosts && <S.Error>{vm.fieldErrors.hosts}</S.Error>}
            </S.Field>

            <InfoBanner variant="info" message={t('http-connection.write-only')} />

            <S.ModalActions>
              <Button variant="secondary" onClick={vm.closeModal} disabled={vm.saving}>
                {t('core.ui/action.cancel')}
              </Button>
              <Button onClick={() => void vm.save()} $isLoading={vm.saving} disabled={vm.saving}>
                {t(vm.saving ? 'core.ui/action.saving' : 'core.ui/action.save')}
              </Button>
            </S.ModalActions>
          </S.Form>
        </Modal>
      )}

      <ConfirmModal
        isOpen={vm.pendingDelete !== null}
        title={t('http-connection.delete.title')}
        message={t('http-connection.delete.message', { name: vm.pendingDelete?.name ?? '', key: vm.pendingDelete?.key ?? '' })}
        confirmLabel={t('core.ui/action.delete')}
        variant="danger"
        onConfirm={() => void vm.confirmDelete()}
        onCancel={vm.cancelDelete}
      />
    </S.Container>
  );
};
