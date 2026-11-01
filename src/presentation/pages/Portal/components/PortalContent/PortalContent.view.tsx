import React from 'react';
import { RiAddLine, RiArrowLeftLine, RiEditLine, RiExternalLinkLine } from 'react-icons/ri';
import { S } from './PortalContent.styles';
import { PORTAL_DOCUMENTS_TAB, type PortalViewModel } from '../../Portal.viewmodel';
import { PortalChildList } from '../PortalChildList';
import { Button } from '../../../../components/ui/Button';
import { Spinner } from '../../../../components/ui/Spinner';
import { PortalCreateForm } from '../PortalCreateForm';
import { PortalUploadForm } from '../PortalUploadForm';
import { PortalRecordActions } from '../PortalRecordActions';
import { PortalCardList } from '../PortalCardList';
import { PortalTemplateNodes } from '../PortalTemplateNodes';
import { useT } from '../../../../shared/i18n/useT';

/**
 * O CONTEÚDO da página — a home, a lista, o registro aberto, o formulário. É o mesmo em qualquer
 * layout: a casca (do kernel ou de uma extensão) decide onde ele fica, e nunca o que ele mostra.
 */
export const PortalContent: React.FC<{ vm: PortalViewModel }> = ({ vm }) => {
  const t = useT('core.tenant');

  const recordList = (cards: typeof vm.records) => vm.recordsArrangement ? (
    <PortalCardList cards={cards} arrangement={vm.recordsArrangement} onOpen={vm.openRecord} />
  ) : (
    <S.List>
      {cards.map((record) => (
        <S.Card key={record.id} onClick={() => vm.openRecord(record.collection, record.id)}>
          <S.CardTitle>{record.title}</S.CardTitle>
          {record.summary && <S.CardMeta>{record.summary}</S.CardMeta>}
          {record.updatedAt && <S.Muted>{record.updatedAt}</S.Muted>}
        </S.Card>
      ))}
    </S.List>
  );

  const backButton = (
    <div>
      <Button variant="ghost" size="sm" onClick={vm.goBack}>
        <RiArrowLeftLine size={14} />
        {t('portal.record.back')}
      </Button>
    </div>
  );

  const recordTabs = vm.selected && (
    <>
      {vm.selected.tabs.length > 0 && (
        <S.Tabs role="tablist">
          {vm.selected.tabs.map((tab) => (
            <S.Tab
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={tab.key === vm.selected?.activeTab}
              $active={tab.key === vm.selected?.activeTab}
              onClick={() => vm.setActiveTab(tab.key)}
            >
              {tab.label}
            </S.Tab>
          ))}
        </S.Tabs>
      )}
      {vm.selected.children
        .filter((child) => child.collection === vm.selected?.activeTab)
        .map((child) => (
          <PortalChildList key={`${child.parentKey}|${child.collection}`} child={child} onOpen={vm.openRecord} onCreate={vm.startCreate} />
        ))}
      {vm.selected.hasDocuments && vm.selected.activeTab === PORTAL_DOCUMENTS_TAB && (
        <>
          {vm.upload && (
            <PortalUploadForm
              collection={vm.upload.collection}
              recordId={vm.upload.recordId}
              types={vm.upload.types}
              onUploaded={vm.handleUploaded}
            />
          )}
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
                {document.hash && <S.DocumentHash title={t('portal.document.sha256.hint')}>{document.hash}</S.DocumentHash>}
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
    </>
  );

  const homeContent = vm.home.Component ? (
    <vm.home.Component collection="" />
  ) : (
    <>
      <S.Title>{vm.home.title}</S.Title>
      {vm.home.welcome && <S.Welcome>{vm.home.welcome}</S.Welcome>}
      {vm.home.widgets.length > 0 ? (
        <S.Widgets>
          {vm.home.widgets.map((widget) => (
            <S.WidgetCard key={widget.id}>
              {widget.title && <S.WidgetTitle>{widget.title}</S.WidgetTitle>}
              {widget.Component ? (
                <widget.Component collection="" />
              ) : widget.loading ? (
                <Spinner size={20} />
              ) : (
                <PortalTemplateNodes nodes={widget.nodes ?? []} onOpen={vm.openRecord} />
              )}
            </S.WidgetCard>
          ))}
        </S.Widgets>
      ) : !vm.home.welcome && <S.Muted>{t('portal.home.empty')}</S.Muted>}
    </>
  );

  const entryContent = vm.entryMissing ? (
    <S.Centered>
      {t('portal.entry-missing')}
      <Button size="sm" onClick={vm.goHome}>{t('portal.home')}</Button>
    </S.Centered>
  ) : vm.pageView ? (
    <vm.pageView collection="" />
  ) : vm.declaredPage ? (
    <S.Detail>
      <S.Title>{vm.declaredPage.title}</S.Title>
      {vm.declaredPage.loading ? (
        <S.Centered><Spinner size={28} /></S.Centered>
      ) : vm.declaredPage.nodes.length === 0 ? (
        <S.Muted>{t('portal.page.empty')}</S.Muted>
      ) : (
        <PortalTemplateNodes nodes={vm.declaredPage.nodes} onOpen={vm.openRecord} />
      )}
    </S.Detail>
  ) : vm.openedRecord === 'loading' ? (
    <S.Centered><Spinner size={28} /></S.Centered>
  ) : vm.openedRecord === 'missing' ? (
    <S.Centered>
      {t('portal.record.unavailable')}
      <Button size="sm" onClick={vm.goHome}>{t('portal.home')}</Button>
    </S.Centered>
  ) : vm.detailView ? (
    <S.Detail>
      {backButton}
      {vm.recordActions && <PortalRecordActions {...vm.recordActions} />}
      <vm.detailView.Component collection={vm.detailView.collection} recordId={vm.detailView.recordId} />
    </S.Detail>
  ) : vm.selected?.body ? (
    <S.Detail>
      {backButton}
      {!vm.selected.placesEdit && vm.selected.editLabel && (
        <S.DetailToolbar>
          <Button size="sm" variant="secondary" onClick={vm.startEdit}>
            <RiEditLine size={14} />
            {vm.selected.editLabel}
          </Button>
        </S.DetailToolbar>
      )}
      {!vm.selected.placesActions && vm.recordActions && <PortalRecordActions {...vm.recordActions} />}
      <PortalTemplateNodes nodes={vm.selected.body} onEdit={vm.startEdit} actions={vm.recordActions} />
      {recordTabs}
    </S.Detail>
  ) : vm.selected ? (
    <S.Detail>
      {backButton}
      <S.DetailHeader>
        <S.DetailTitle>{vm.selected.title}</S.DetailTitle>
        {vm.selected.editLabel && (
          <Button size="sm" variant="secondary" onClick={vm.startEdit}>
            <RiEditLine size={14} />
            {vm.selected.editLabel}
          </Button>
        )}
      </S.DetailHeader>
      {vm.recordActions && <PortalRecordActions {...vm.recordActions} />}
      <S.Fields>
        {vm.selected.fields.map((field) => (
          <S.Field key={field.key}>
            <S.FieldLabel>{field.label}</S.FieldLabel>
            <S.FieldValue>
              {field.href
                ? <S.Link href={field.href} target="_blank" rel="noopener noreferrer">{field.value}</S.Link>
                : field.color
                  ? <S.OptionValue><S.OptionDot $color={field.color} />{field.value}</S.OptionValue>
                  : field.value}
            </S.FieldValue>
          </S.Field>
        ))}
      </S.Fields>
      {recordTabs}
    </S.Detail>
  ) : vm.listView ? (
    <vm.listView.Component collection={vm.listView.collection} />
  ) : (
    <>
      {vm.rootCreateLabel && (
        <S.Toolbar>
          <Button size="sm" onClick={vm.startRootCreate} title={vm.rootCreateLabel} aria-label={vm.rootCreateLabel}>
            <RiAddLine size={16} />
          </Button>
        </S.Toolbar>
      )}
      {vm.recordsLoading ? (
        <S.Centered><Spinner size={28} /></S.Centered>
      ) : vm.records.length === 0 ? (
        <S.Centered>{t('portal.records.empty')}</S.Centered>
      ) : recordList(vm.records)}
    </>
  );

  return (
    <>
      {vm.justSubmitted && !vm.creating && <S.Success>{t('portal.create.sent')}</S.Success>}
      {vm.justSaved && !vm.creating && <S.Success>{t('portal.edit.saved')}</S.Success>}
      {vm.emptyScreens ? (
        <S.Centered>{t('portal.empty-screens')}</S.Centered>
      ) : vm.creating ? (
        <PortalCreateForm
          screen={vm.creating.screen}
          fixedLinkRecordId={vm.creating.parentRecordId}
          editing={vm.creating.editing}
          onCancel={vm.cancelCreate}
          onSubmitted={vm.creating.editing ? vm.handleSaved : vm.handleSubmitted}
        />
      ) : vm.atHome ? homeContent : entryContent}
    </>
  );
};
