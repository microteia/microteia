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

const STEP_ICON: Record<StepKey, React.ReactNode> = {
  source: <RiFileTextLine />,
  ai: <RiRobot2Line />,
  workflow: <RiFlowChart />,
  run: <RiPlayLine />,
};

export const DataProcessorView: React.FC = () => {
  const vm = useDataProcessorViewModel();

  if (!vm.hasAccess) {
    return (
      <S.Page>
        <InfoBanner
          message="O Processador de Dados está disponível apenas para administradores e advogados do escritório."
          variant="info"
        />
      </S.Page>
    );
  }

  return (
    <S.Page>
      <S.Header>
        <S.Title>Processador de Dados</S.Title>
        <S.Subtitle>
          Transforme um texto ou um PDF em uma automação executada com os dados já preenchidos, em quatro
          etapas.
        </S.Subtitle>
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
                  <span>Nenhum PDF selecionado. O texto pode ser colado abaixo.</span>
                )}
              </S.DropzoneInfo>
              <S.Row>
                <label htmlFor="dp-pdf-input">
                  <S.Button as="span" $variant="ghost">
                    <RiFilePdf2Line /> {vm.pdfFileName ? 'Trocar PDF' : 'Selecionar PDF'}
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
                    <RiCloseLine /> Remover
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
                    placeholder="Escolha a página"
                    label="Página a processar"
                  />
                </S.PageSelectorField>
              </S.PageSelector>
            )}

            {vm.pdfExtracting && <S.Loading>Extraindo o conteúdo da página selecionada…</S.Loading>}

            {vm.pdfPreviewUrl && (
              <S.CanvasWrapper>
                <S.PreviewImg src={vm.pdfPreviewUrl} alt={`Página ${vm.pdfPage} do PDF`} />
              </S.CanvasWrapper>
            )}

            <S.TextArea
              value={vm.freeText}
              onChange={(e) => vm.onFreeTextChange(e.target.value)}
              placeholder="Cole aqui o texto livre, ou selecione um PDF e escolha a página desejada…"
            />
            <S.FooterHint>{vm.textCharCount} caractere(s) prontos para processamento.</S.FooterHint>
          </S.Panel>
        )}

        {vm.currentStep === 'ai' && (
          <S.Panel>
            {vm.hasNoConnections ? (
              <>
                <InfoBanner
                  message="Nenhuma inteligência artificial cadastrada neste escritório."
                  variant="warning"
                />
                <S.LinkButton onClick={vm.openAISettings}>
                  Cadastrar uma IA nas configurações →
                </S.LinkButton>
              </>
            ) : (
              <SearchSelect
                options={vm.connectionOptions}
                value={vm.selectedConnectionId}
                onChange={vm.onSelectConnection}
                placeholder={vm.connectionsLoading ? 'Carregando…' : 'Selecione a IA'}
                label="IA a utilizar"
              />
            )}
          </S.Panel>
        )}

        {vm.currentStep === 'workflow' && (
          <S.Panel>
            <S.SpaceBetween>
              <S.Button onClick={vm.onDetect} disabled={!vm.canDetect}>
                <RiSparkling2Line /> {vm.detecting ? 'Detectando…' : 'Detectar automação por IA'}
              </S.Button>
              <S.FooterHint>Ou escolha manualmente uma automação da lista.</S.FooterHint>
            </S.SpaceBetween>

            {vm.workflowChoices.length === 0 ? (
              <S.Empty>Nenhuma automação com gatilho “Chamado por outro workflow” cadastrada.</S.Empty>
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
                      {choice.ranked && <S.Tag>compatível</S.Tag>}
                      {!choice.eligible && <S.Tag $tone="warning">referência</S.Tag>}
                    </S.WorkflowName>
                    <S.WorkflowDesc>
                      {choice.reason ?? (choice.description || 'Sem descrição cadastrada.')}
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
                        abrir
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
                <S.SummaryLabel>Origem</S.SummaryLabel>
                <S.SummaryValue>
                  {vm.pdfFileName
                    ? `${vm.pdfFileName} — página ${vm.pdfPage}`
                    : `Texto livre — ${vm.textCharCount} caractere(s)`}
                </S.SummaryValue>
              </S.SummaryRow>
              <S.SummaryRow>
                <S.SummaryLabel>Inteligência</S.SummaryLabel>
                <S.SummaryValue>{vm.selectedConnectionLabel || 'Nenhuma'}</S.SummaryValue>
              </S.SummaryRow>
              <S.SummaryRow>
                <S.SummaryLabel>Automação</S.SummaryLabel>
                <S.SummaryValue>{vm.selectedWorkflowName || 'Nenhuma'}</S.SummaryValue>
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

            {vm.resultExecution && vm.resultExecution.status !== 'SUCCESS' && (
              <S.ResultActions>
                <S.LinkButton onClick={vm.openResultExecutions}>
                  <RiExternalLinkLine /> Ver na aba Execuções da automação
                </S.LinkButton>
              </S.ResultActions>
            )}
          </S.Panel>
        )}

        <S.Footer>
          <S.Button $variant="ghost" onClick={vm.onBack} disabled={!vm.canGoBack}>
            <RiArrowLeftLine /> Voltar
          </S.Button>

          {vm.isLastStep ? (
            <S.Row>
              {vm.runSucceeded && (
                <S.Button $variant="ghost" onClick={vm.onRestart}>
                  <RiRefreshLine /> Novo processamento
                </S.Button>
              )}
              <S.Button onClick={vm.onRun} disabled={!vm.canRun}>
                <RiPlayLine /> {vm.running ? 'Executando…' : 'Executar automação'}
              </S.Button>
            </S.Row>
          ) : (
            <S.Button onClick={vm.onNext} disabled={!vm.canGoNext}>
              Avançar <RiArrowRightLine />
            </S.Button>
          )}
        </S.Footer>
      </S.Card>
    </S.Page>
  );
};
