import React from 'react';
import { RiPlayLine, RiCloseLine } from 'react-icons/ri';
import { S } from './RunModal.styles';
import { useRunModalViewModel, type RunModalProps, type RunModalLogLevel } from './RunModal.viewmodel';
import { Button } from '../Button';
import { ParameterField } from '../ParameterField';

type Tone = 'success' | 'danger' | 'warning' | 'muted';

const levelTone = (level: RunModalLogLevel): Tone => {
  if (level === 'ERROR') return 'danger';
  if (level === 'WARN') return 'warning';
  if (level === 'SUCCESS') return 'success';
  return 'muted';
};

const statusTone = (status: 'SUCCESS' | 'FAILED' | 'PARTIAL' | null): 'success' | 'danger' | 'warning' => {
  if (status === 'FAILED') return 'danger';
  if (status === 'PARTIAL') return 'warning';
  return 'success';
};

const statusLabel = (status: 'SUCCESS' | 'FAILED' | 'PARTIAL' | null): string => {
  if (status === 'FAILED') return 'Falhou';
  if (status === 'PARTIAL') return 'Parcial';
  return 'Concluído';
};

export const RunModal: React.FC<RunModalProps> = (props) => {
  const vm = useRunModalViewModel(props);

  return (
    <S.Overlay onClick={(e) => e.target === e.currentTarget && vm.handleClose()}>
      <S.Box>
        <S.Header>
          <S.Title>
            <RiPlayLine size={18} />
            {props.title}
          </S.Title>
          <S.CloseBtn type="button" onClick={vm.handleClose} title="Fechar">
            <RiCloseLine size={18} />
          </S.CloseBtn>
        </S.Header>

        <S.Body>
          {vm.phase === 'input' ? (
            <>
              {vm.hasParameters ? (
                <>
                  <S.ModeTabs>
                    <S.ModeTab $active={vm.mode === 'form'} type="button" onClick={() => vm.setMode('form')}>
                      Formulário
                    </S.ModeTab>
                    <S.ModeTab $active={vm.mode === 'json'} type="button" onClick={() => vm.setMode('json')}>
                      JSON
                    </S.ModeTab>
                  </S.ModeTabs>

                  {vm.mode === 'form' ? (
                    vm.parameters.map((param) => (
                      <S.Field key={param.key}>
                        <S.FieldLabel>
                          {param.label || param.key}
                          {param.required && <S.Required>*</S.Required>}
                          <S.FieldKey>{param.key}</S.FieldKey>
                        </S.FieldLabel>
                        <ParameterField
                          parameter={param}
                          value={vm.getValue(param.key)}
                          onChange={(value) => vm.setValue(param.key, value)}
                        />
                      </S.Field>
                    ))
                  ) : (
                    <S.Field>
                      <S.JsonArea
                        value={vm.jsonText}
                        onChange={(e) => vm.setJsonText(e.target.value)}
                        spellCheck={false}
                      />
                    </S.Field>
                  )}
                </>
              ) : (
                <S.EmptyHint>Este item não tem parâmetros de entrada. Clique em {vm.runLabel} para executar.</S.EmptyHint>
              )}

              {vm.formError && <S.JsonError>{vm.formError}</S.JsonError>}
            </>
          ) : (
            <>
              <S.ResultHeader>
                <S.StatusBadge $tone={statusTone(vm.result?.status ?? null)}>
                  {statusLabel(vm.result?.status ?? null)}
                </S.StatusBadge>
              </S.ResultHeader>

              {vm.result?.error && <S.ErrorBox>{vm.result.error}</S.ErrorBox>}

              <div>
                <S.SectionLabel>Saída</S.SectionLabel>
                {vm.outputsJson ? (
                  <S.Pre>{vm.outputsJson}</S.Pre>
                ) : (
                  <S.EmptyLogs>Nenhuma saída retornada.</S.EmptyLogs>
                )}
              </div>

              <div>
                <S.SectionLabel>Logs</S.SectionLabel>
                {vm.result && vm.result.logs.length > 0 ? (
                  <S.LogList>
                    {vm.result.logs.map((entry, index) => {
                      const tone = levelTone(entry.level);
                      return (
                        <S.LogLine key={index} $tone={tone}>
                          <S.LogLevel $tone={tone}>{entry.level}</S.LogLevel>
                          <S.LogMessage>{entry.message}</S.LogMessage>
                        </S.LogLine>
                      );
                    })}
                  </S.LogList>
                ) : (
                  <S.EmptyLogs>Nenhum log registrado.</S.EmptyLogs>
                )}
              </div>
            </>
          )}
        </S.Body>

        <S.Footer>
          {vm.phase === 'input' ? (
            <>
              <Button variant="secondary" onClick={vm.handleClose} disabled={vm.running}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={() => void vm.handleRun()} disabled={!vm.canRun} $isLoading={vm.running}>
                {vm.runLabel}
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={vm.handleClose}>
                Fechar
              </Button>
              <Button variant="primary" onClick={vm.handleReset}>
                Executar novamente
              </Button>
            </>
          )}
        </S.Footer>
      </S.Box>
    </S.Overlay>
  );
};
