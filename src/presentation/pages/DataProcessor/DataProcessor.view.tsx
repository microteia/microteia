import React from 'react';
import {
  RiSparkling2Line,
  RiFilePdf2Line,
  RiRobot2Line,
  RiFlowChart,
  RiPlayLine,
  RiExternalLinkLine,
  RiCloseLine,
  RiCheckLine,
  RiArrowLeftLine,
  RiArrowRightLine,
  RiFileTextLine,
  RiRefreshLine,
} from 'react-icons/ri';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { useDataProcessorViewModel } from './DataProcessor.viewmodel';
import type { StepKey } from './DataProcessor.viewmodel';
import { S } from './DataProcessor.styles';

import { useT } from '../../shared/i18n/useT';
const STEP_ICON: Record<StepKey, React.ReactNode> = {
  source: <RiFileTextLine />,
  ai: <RiRobot2Line />,
  workflow: <RiFlowChart />,
  run: <RiPlayLine />,
};

export const DataProcessorView: React.FC = () => {
  const t = useT('core.admin');
  const vm = useDataProcessorViewModel();

  if (!vm.hasAccess) {
    return (
      <S.Page>
        <InfoBanner
          message={t('processor.restricted')}
          variant="info"
        />
      </S.Page>
    );
  }

  return (
    <S.Page>
      <S.Header>
        <S.Title>{t('page.data-processor')}</S.Title>
        <S.Subtitle>{t('processor.subtitle')}</S.Subtitle>
      </S.Header>

      <S.Stepper>
        {vm.steps.map((step, index) => (
          <S.StepperItem key={step.key}>
            <S.StepButton
              type="button"
              $status={step.status}
              disabled={!step.reachable}
              onClick={() => vm.onGoToStep(step.key)}
            >
              <S.StepMarker $status={step.status}>
                {step.status === 'done' ? <RiCheckLine /> : index + 1}
              </S.StepMarker>
              <S.StepLabel $status={step.status}>{step.title}</S.StepLabel>
            </S.StepButton>
            {index < vm.steps.length - 1 && <S.StepConnector $filled={step.status === 'done'} />}
          </S.StepperItem>
        ))}
      </S.Stepper>

      <S.Card>
        <S.CardHeader>
          <S.CardIcon>{STEP_ICON[vm.currentStep]}</S.CardIcon>
          <S.CardHeading>
            <S.CardTitle>{vm.currentStepTitle}</S.CardTitle>
            <S.CardHint>{vm.currentStepHint}</S.CardHint>
          </S.CardHeading>
        </S.CardHeader>

        {vm.currentStep === 'source' && (
          <S.Panel>
            <S.Dropzone>
              <S.DropzoneInfo>
                <RiFilePdf2Line />
                {vm.pdfFileName ? (
                  <S.FileName>{vm.pdfFileName}</S.FileName>
                ) : (
                  <span>{t('processor.pdf.none')}</span>
                )}
              </S.DropzoneInfo>
              <S.Row>
                <label htmlFor="dp-pdf-input">
                  <S.Button as="span" $variant="ghost">
                    <RiFilePdf2Line /> {t(vm.pdfFileName ? 'processor.pdf.replace' : 'processor.pdf.select')}
                  </S.Button>
                </label>
                <S.HiddenFileInput
                  id="dp-pdf-input"
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) vm.onPdfSelected(file);
                  }}
                />
                {vm.pdfFileName && (
                  <S.Button $variant="ghost" onClick={vm.onClearPdf}>
                    <RiCloseLine /> {t('core.ui/action.remove')}
                  </S.Button>
                )}
              </S.Row>
            </S.Dropzone>

            {vm.pdfPageCount > 1 && (
              <S.PageSelector>
                <S.PageSelectorField>
                  <SearchSelect
                    options={vm.pdfPageOptions}
                    value={String(vm.pdfPage)}
                    onChange={vm.onSelectPdfPage}
                    placeholder={t('processor.page.placeholder')}
                    label={t('processor.page.label')}
                  />
                </S.PageSelectorField>
              </S.PageSelector>
            )}

            {vm.pdfExtracting && <S.Loading>{t('processor.pdf.extracting')}</S.Loading>}

            {vm.pdfPreviewUrl && (
              <S.CanvasWrapper>
                <S.PreviewImg src={vm.pdfPreviewUrl} alt={t('processor.pdf.preview.alt', { page: vm.pdfPage })} />
              </S.CanvasWrapper>
            )}

            <S.TextArea
              value={vm.freeText}
              onChange={(e) => vm.onFreeTextChange(e.target.value)}
              placeholder={t('processor.text.placeholder')}
            />
            <S.FooterHint>{t('processor.text.count', { count: vm.textCharCount })}</S.FooterHint>
          </S.Panel>
        )}

        {vm.currentStep === 'ai' && (
          <S.Panel>
            {vm.hasNoConnections ? (
              <>
                <InfoBanner
                  message={t('processor.ai.none')}
                  variant="warning"
                />
                <S.LinkButton onClick={vm.openAISettings}>
                  {t('processor.ai.register')}
                </S.LinkButton>
              </>
            ) : (
              <SearchSelect
                options={vm.connectionOptions}
                value={vm.selectedConnectionId}
                onChange={vm.onSelectConnection}
                placeholder={t(vm.connectionsLoading ? 'core.ui/loading' : 'processor.ai.placeholder')}
                label={t('processor.ai.label')}
              />
            )}
          </S.Panel>
        )}

        {vm.currentStep === 'workflow' && (
          <S.Panel>
            <S.SpaceBetween>
              <S.Button onClick={vm.onDetect} disabled={!vm.canDetect}>
                <RiSparkling2Line /> {t(vm.detecting ? 'processor.detecting' : 'processor.detect')}
              </S.Button>
              <S.FooterHint>{t('processor.choose-manually')}</S.FooterHint>
            </S.SpaceBetween>

            {vm.workflowChoices.length === 0 ? (
              <S.Empty>{t('processor.workflows.empty')}</S.Empty>
            ) : (
              <S.WorkflowList>
                {vm.workflowChoices.map((choice) => (
                  <S.WorkflowItem
                    key={choice.id}
                    type="button"
                    disabled={!choice.eligible}
                    $selected={vm.selectedWorkflowId === choice.id}
                    $eligible={choice.eligible}
                    onClick={() => vm.onSelectWorkflow(choice.id)}
                  >
                    <S.WorkflowName>
                      {choice.name}
                      {choice.ranked && <S.Tag>{t('processor.tag.compatible')}</S.Tag>}
                      {!choice.eligible && <S.Tag $tone="warning">{t('processor.tag.reference')}</S.Tag>}
                    </S.WorkflowName>
                    <S.WorkflowDesc>
                      {choice.reason ?? (choice.description || t('processor.no-description'))}
                    </S.WorkflowDesc>
                  </S.WorkflowItem>
                ))}
              </S.WorkflowList>
            )}

            {vm.logs.length > 0 && (
              <S.LogBox>
                {vm.logs.map((log) => (
                  <S.LogLine key={log.id} $level={log.level}>
                    <span>{log.message}</span>
                    {log.workflowId && (
                      <S.LinkButton onClick={() => vm.openWorkflow(log.workflowId as string)}>
                        {t('processor.log.open')}
                      </S.LinkButton>
                    )}
                  </S.LogLine>
                ))}
              </S.LogBox>
            )}
          </S.Panel>
        )}

        {vm.currentStep === 'run' && (
          <S.Panel>
            <S.Summary>
              <S.SummaryRow>
                <S.SummaryLabel>{t('processor.summary.source')}</S.SummaryLabel>
                <S.SummaryValue>
                  {vm.pdfFileName
                    ? t('processor.summary.pdf', { file: vm.pdfFileName, page: vm.pdfPage })
                    : t('processor.summary.text', { count: vm.textCharCount })}
                </S.SummaryValue>
              </S.SummaryRow>
              <S.SummaryRow>
                <S.SummaryLabel>{t('processor.summary.ai')}</S.SummaryLabel>
                <S.SummaryValue>{vm.selectedConnectionLabel || t('processor.summary.none')}</S.SummaryValue>
              </S.SummaryRow>
              <S.SummaryRow>
                <S.SummaryLabel>{t('processor.summary.workflow')}</S.SummaryLabel>
                <S.SummaryValue>{vm.selectedWorkflowName || t('processor.summary.none')}</S.SummaryValue>
              </S.SummaryRow>
            </S.Summary>

            {vm.runStages.length > 0 && (
              <S.Timeline>
                {vm.runStages.map((stage) => (
                  <S.Stage key={stage.key}>
                    <S.StageDot $status={stage.status} />
                    <S.StageBody>
                      <S.StageLabel>{stage.label}</S.StageLabel>
                      {stage.detail && (
                        <S.StageDetail $status={stage.status}>{stage.detail}</S.StageDetail>
                      )}
                    </S.StageBody>
                  </S.Stage>
                ))}
              </S.Timeline>
            )}

            {vm.showResultExecutionsLink && (
              <S.ResultActions>
                <S.LinkButton onClick={vm.openResultExecutions}>
                  <RiExternalLinkLine /> {t('processor.open-executions')}
                </S.LinkButton>
              </S.ResultActions>
            )}
          </S.Panel>
        )}

        <S.Footer>
          <S.Button $variant="ghost" onClick={vm.onBack} disabled={!vm.canGoBack}>
            <RiArrowLeftLine /> {t('processor.back')}
          </S.Button>

          {vm.isLastStep ? (
            <S.Row>
              {vm.runSucceeded && (
                <S.Button $variant="ghost" onClick={vm.onRestart}>
                  <RiRefreshLine /> {t('processor.restart')}
                </S.Button>
              )}
              <S.Button onClick={vm.onRun} disabled={!vm.canRun}>
                <RiPlayLine /> {t(vm.running ? 'processor.running' : 'processor.run')}
              </S.Button>
            </S.Row>
          ) : (
            <S.Button onClick={vm.onNext} disabled={!vm.canGoNext}>
              {t('processor.next')} <RiArrowRightLine />
            </S.Button>
          )}
        </S.Footer>
      </S.Card>
    </S.Page>
  );
};
