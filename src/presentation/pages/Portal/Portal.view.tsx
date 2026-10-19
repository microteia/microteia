import React from 'react';
import { RiAddLine, RiArrowLeftLine, RiExternalLinkLine, RiLogoutBoxRLine } from 'react-icons/ri';
import { usePortalViewModel } from './Portal.viewmodel';
import { S } from './Portal.styles';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { getScreenIcon } from '../../shared/screenIcons';
import { PortalCreateForm } from './components/PortalCreateForm';
import { useT } from '../../shared/i18n/useT';

export const PortalView: React.FC = () => {
  const vm = usePortalViewModel();
  const t = useT('core.tenant');

  const header = (
    <S.Header>
      <S.Brand>
        {vm.logoURL && <S.Logo src={vm.logoURL} alt="" />}
        <S.BrandName>{vm.tenantName || t('portal.title')}</S.BrandName>
      </S.Brand>
      <S.HeaderActions>
        {vm.memberships.length > 1 && !vm.showChooser && (
          <Button variant="ghost" size="sm" onClick={vm.goToChooser}>
            {t('portal.switch')}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => void vm.signOut()} title={t('portal.sign-out')}>
          <RiLogoutBoxRLine size={16} />
        </Button>
      </S.HeaderActions>
    </S.Header>
  );

  if (vm.loading) {
    return (
      <S.Page>
        {header}
        <S.Centered><Spinner size={32} /></S.Centered>
      </S.Page>
    );
  }

  if (vm.error) {
    return (
      <S.Page>
        {header}
        <S.Centered>
          <S.Title>{t('portal.title')}</S.Title>
          <p>
            {vm.error === 'load-failed'
              ? t('portal.load-failed')
              : vm.error === 'no-access' ? t('portal.no-access') : t('portal.not-invited')}
          </p>
          {vm.signedInAs && <S.Muted>{t('portal.signed-in-as', { email: vm.signedInAs })}</S.Muted>}
          <Button variant="secondary" size="sm" onClick={() => void vm.signOut()}>
            {t('portal.use-another-account')}
          </Button>
        </S.Centered>
      </S.Page>
    );
  }

  if (vm.showChooser) {
    return (
      <S.Page>
        {header}
        <S.Main>
          <S.Title>{t('portal.choose')}</S.Title>
          <S.List>
            {vm.memberships.map((membership) => (
              <S.Card key={membership.tenantId} onClick={() => vm.chooseTenant(membership.tenantId)}>
                <S.CardTitle>{membership.tenantName}</S.CardTitle>
              </S.Card>
            ))}
          </S.List>
        </S.Main>
      </S.Page>
    );
  }

  return (
    <S.Page>
      {header}
      {vm.screens.length > 1 && (
        <S.Nav>
          {vm.screens.map((screen) => (
            <S.NavItem key={screen.collection} $active={screen.active} onClick={() => vm.selectScreen(screen.collection)}>
              {getScreenIcon(screen.icon, 16)}
              {screen.label}
            </S.NavItem>
          ))}
        </S.Nav>
      )}
      <S.Main>
        {vm.createScreen && !vm.creating && !vm.selected && (
          <S.Toolbar>
            <Button size="sm" onClick={vm.startCreate}>
              <RiAddLine size={14} />
              {t('portal.create.new', { screen: vm.createScreen.titleSingular })}
            </Button>
          </S.Toolbar>
        )}
        {vm.justSubmitted && !vm.creating && <S.Success>{t('portal.create.sent')}</S.Success>}
        {vm.emptyScreens ? (
          <S.Centered>{t('portal.empty-screens')}</S.Centered>
        ) : vm.creating && vm.createScreen ? (
          <PortalCreateForm screen={vm.createScreen} onCancel={vm.cancelCreate} onSubmitted={vm.handleSubmitted} />
        ) : vm.selected ? (
          <S.Detail>
            <div>
              <Button variant="ghost" size="sm" onClick={vm.closeRecord}>
                <RiArrowLeftLine size={14} />
                {t('portal.record.back')}
              </Button>
            </div>
            <S.DetailTitle>{vm.selected.title}</S.DetailTitle>
            <S.Fields>
              {vm.selected.fields.map((field) => (
                <S.Field key={field.key}>
                  <S.FieldLabel>{field.label}</S.FieldLabel>
                  <S.FieldValue>
                    {field.href
                      ? <S.Link href={field.href} target="_blank" rel="noopener noreferrer">{field.value}</S.Link>
                      : field.value}
                  </S.FieldValue>
                </S.Field>
              ))}
            </S.Fields>
            {vm.selected.hasDocuments && (
              <>
                <S.SectionTitle>{t('portal.documents')}</S.SectionTitle>
                {vm.documentError && <S.ErrorText>{t('portal.document.unavailable')}</S.ErrorText>}
                {vm.selected.documentsLoading ? (
                  <Spinner size={20} />
                ) : vm.selected.documents.length === 0 ? (
                  <S.Muted>{t('portal.documents.empty')}</S.Muted>
                ) : vm.selected.documents.map((document) => (
                  <S.DocumentRow key={document.id}>
                    <S.DocumentInfo>
                      <S.DocumentName title={document.name}>{document.name}</S.DocumentName>
                      {document.meta && <S.Muted>{document.meta}</S.Muted>}
                    </S.DocumentInfo>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void vm.openDocument(document.id)}
                      disabled={vm.openingDocumentId === document.id}
                    >
                      <RiExternalLinkLine size={14} />
                      {t('portal.document.open')}
                    </Button>
                  </S.DocumentRow>
                ))}
              </>
            )}
          </S.Detail>
        ) : vm.recordsLoading ? (
          <S.Centered><Spinner size={28} /></S.Centered>
        ) : vm.records.length === 0 ? (
          <S.Centered>{t('portal.records.empty')}</S.Centered>
        ) : (
          <S.List>
            {vm.records.map((record) => (
              <S.Card key={record.id} onClick={() => vm.openRecord(record.id)}>
                <S.CardTitle>{record.title}</S.CardTitle>
                {record.summary && <S.CardMeta>{record.summary}</S.CardMeta>}
                {record.updatedAt && <S.Muted>{record.updatedAt}</S.Muted>}
              </S.Card>
            ))}
          </S.List>
        )}
      </S.Main>
    </S.Page>
  );
};
