import React from 'react';
import { RiPlayLine, RiCloseLine } from 'react-icons/ri';
import { S } from './RunModal.styles';
import { useRunModalViewModel, type RunModalProps, type RunModalLogLevel } from './RunModal.viewmodel';
import { Button } from '../Button';
import { ParameterField } from '../ParameterField';
import { useT } from '../../../shared/i18n/useT';

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

const statusKey = (status: 'SUCCESS' | 'FAILED' | 'PARTIAL' | null): string => {
  if (status === 'FAILED') return 'run.status.failed';
  if (status === 'PARTIAL') return 'run.status.partial';
  return 'run.status.done';
};

export const RunModal: React.FC<RunModalProps> = (props) => {
  const vm = useRunModalViewModel(props);
  const t = useT('core.ui');

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
                      {t('run.mode.form')}
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
                <S.EmptyHint>{t('run.no-parameters', { action: vm.runLabel })}</S.EmptyHint>
              )}

              {vm.formError && <S.JsonError>{vm.formError}</S.JsonError>}
            </>
          ) : (
            <>
              <S.ResultHeader>
                <S.StatusBadge $tone={statusTone(vm.result?.status ?? null)}>
                  {t(statusKey(vm.result?.status ?? null))}
                </S.StatusBadge>
              </S.ResultHeader>

              {vm.result?.error && <S.ErrorBox>{vm.result.error}</S.ErrorBox>}

              <div>
                <S.SectionLabel>{t('run.output')}</S.SectionLabel>
                {vm.outputsJson ? (
                  <S.Pre>{vm.outputsJson}</S.Pre>
                ) : (
                  <S.EmptyLogs>{t('run.output.empty')}</S.EmptyLogs>
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
                  <S.EmptyLogs>{t('run.logs.empty')}</S.EmptyLogs>
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
