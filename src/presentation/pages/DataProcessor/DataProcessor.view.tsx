import React from 'react';
import {
  RiSparkling2Line,
  RiFilePdf2Line,
  RiRobot2Line,
  RiFlowChart,
  RiPlayLine,
  RiExternalLinkLine,
  RiCloseLine,
} from 'react-icons/ri';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { useDataProcessorViewModel } from './DataProcessor.viewmodel';
import { S } from './DataProcessor.styles';

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
          Cole um texto ou envie um PDF, escolha a inteligência artificial e execute a automação com os
          dados preenchidos automaticamente.
        </S.Subtitle>
      </S.Header>

      <S.Grid>
        <S.Card>
          <S.CardTitle>
            <S.StepBadge>1</S.StepBadge> Origem dos dados
          </S.CardTitle>
          <S.TextArea
            value={vm.freeText}
            onChange={(e) => vm.onFreeTextChange(e.target.value)}
            placeholder="Cole aqui o texto livre ou selecione um PDF para extrair a primeira página…"
          />
          <S.SpaceBetween>
            <S.Row>
              <label htmlFor="dp-pdf-input">
                <S.Button as="span" $variant="ghost">
                  <RiFilePdf2Line /> Selecionar PDF
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
              {vm.pdfFileName && <S.FileName>{vm.pdfFileName}</S.FileName>}
            </S.Row>
            {vm.pdfFileName && (
              <S.Button $variant="ghost" onClick={vm.onClearPdf}>
                <RiCloseLine /> Remover
              </S.Button>
            )}
          </S.SpaceBetween>
          {vm.pdfExtracting && <S.Empty>Extraindo a primeira página do PDF…</S.Empty>}
          {vm.pdfPreviewUrl && (
            <S.CanvasWrapper>
              <S.PreviewImg src={vm.pdfPreviewUrl} alt="Primeira página do PDF" />
            </S.CanvasWrapper>
          )}
        </S.Card>

        <S.Card>
          <S.CardTitle>
            <S.StepBadge>2</S.StepBadge> <RiRobot2Line /> Inteligência Artificial
          </S.CardTitle>
          {vm.hasNoConnections ? (
            <>
              <InfoBanner
                message="Nenhuma inteligência artificial cadastrada neste escritório."
                variant="warning"
              />
              <S.LinkButton onClick={vm.openAISettings}>Cadastrar uma IA nas configurações →</S.LinkButton>
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

          <S.CardTitle>
            <S.StepBadge>3</S.StepBadge> <RiFlowChart /> Automação
          </S.CardTitle>
          <S.Button onClick={vm.onDetect} disabled={!vm.canDetect}>
            <RiSparkling2Line /> {vm.detecting ? 'Detectando…' : 'Detectar automação por IA'}
          </S.Button>

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
                  <S.WorkflowDesc>{choice.reason ?? (choice.description || 'Sem descrição cadastrada.')}</S.WorkflowDesc>
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
                    <S.LinkButton onClick={() => vm.openWorkflow(log.workflowId as string)}>abrir</S.LinkButton>
                  )}
                </S.LogLine>
              ))}
            </S.LogBox>
          )}
        </S.Card>
      </S.Grid>

      <S.Card>
        <S.CardTitle>
          <S.StepBadge>4</S.StepBadge> <RiPlayLine /> Execução
        </S.CardTitle>
        <S.Row>
          <S.Button onClick={vm.onRun} disabled={!vm.canRun}>
            <RiPlayLine /> {vm.running ? 'Executando…' : 'Executar automação'}
          </S.Button>
        </S.Row>

        {vm.runStages.length > 0 && (
          <S.Timeline>
            {vm.runStages.map((stage) => (
              <S.Stage key={stage.key}>
                <S.StageDot $status={stage.status} />
                <S.StageBody>
                  <S.StageLabel>{stage.label}</S.StageLabel>
                  {stage.detail && <S.StageDetail $status={stage.status}>{stage.detail}</S.StageDetail>}
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
      </S.Card>
    </S.Page>
  );
};
