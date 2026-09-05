import React from 'react';
import { RiCloseLine, RiPlayLine } from 'react-icons/ri';
import { S } from './ReportView.styles';
import { useReportViewViewModel } from './ReportView.viewmodel';
import { Button } from '../Button';
import { FieldFilterInput } from '../FieldFilterInput';
import { InfoBanner } from '../InfoBanner';
import { Input } from '../Input';
import { ReportChart } from '../ReportChart';
import { ReportMatrix } from '../ReportMatrix';
import { ReportTable } from '../ReportTable';

export interface ReportViewProps {
  /** A CHAVE do relatório no catálogo do escritório. */
  reportKey: string;
  /** A aba que o hospeda, quando há uma — é ela que passa a se chamar como o relatório. */
  tabKey?: string;
}

/**
 * O relatório, do começo ao fim: cabeçalho, avisos e a dobra que ele declara.
 *
 * A escolha da dobra é a única decisão de renderização aqui, e ela é fechada de propósito: dobra que
 * este kernel não conhece já foi degradada para `tabular` na validação, com aviso — então aqui não
 * existe caso "desconhecido" a tratar.
 */
export const ReportView: React.FC<ReportViewProps> = ({ reportKey, tabKey }) => {
  const vm = useReportViewViewModel(reportKey, tabKey);

  if (!vm.report || !vm.spec) return <InfoBanner message={reportKey} variant="warning" />;

  return (
    <S.Wrapper data-print-root>
      <S.Header>
        <div>
          <S.Title>{vm.title}</S.Title>
          {vm.description && <S.Description>{vm.description}</S.Description>}
        </div>
        <S.Actions data-print-hide>
          {vm.meta && <S.Meta>{vm.meta}</S.Meta>}
          <Button variant="secondary" size="sm" onClick={vm.exportCsv} disabled={!vm.canExport}>
            {vm.exportLabel}
          </Button>
          <Button variant="secondary" size="sm" onClick={vm.print} disabled={!vm.canExport}>
            {vm.printLabel}
          </Button>
        </S.Actions>
      </S.Header>

      {vm.prompts.length > 0 && (
        <S.Prompts
          data-print-hide
          onSubmit={(event) => { event.preventDefault(); void vm.run(); }}
        >
          {vm.prompts.map((prompt) => (
            <S.PromptField key={prompt.key}>
              {prompt.label}
              {/* O valor é pedido no FORMATO DO CAMPO — o mesmo controle do formulário do registro.
                  Um texto livre aqui pedia a quem lê o relatório o id do registro que ele queria
                  ver, e o formato exato da data. */}
              {prompt.field ? (
                <FieldFilterInput
                  field={prompt.field}
                  value={prompt.value}
                  onChange={(value) => vm.setPromptValue(prompt.key, value)}
                />
              ) : (
                <Input
                  value={typeof prompt.value === 'string' ? prompt.value : ''}
                  onChange={(event) => vm.setPromptValue(prompt.key, event.target.value)}
                />
              )}
            </S.PromptField>
          ))}
          <S.PromptActions>
            <S.PromptBtn type="submit" title={vm.runLabel} disabled={vm.isLoading}>
              <RiPlayLine size={15} />
            </S.PromptBtn>
            {vm.hasPromptValues && (
              <S.PromptBtn type="button" title={vm.clearLabel} onClick={vm.clearPrompts}>
                <RiCloseLine size={15} />
              </S.PromptBtn>
            )}
          </S.PromptActions>
        </S.Prompts>
      )}

      {vm.error && <InfoBanner message={vm.error} variant="warning" />}
      {vm.partial && <InfoBanner message={vm.partial} variant="warning" />}
      {vm.warnings.map((warning) => (
        <InfoBanner key={warning} message={warning} variant="info" />
      ))}

      {vm.isLoading && !vm.result && <S.Loading />}

      {vm.result && <ReportChart spec={vm.spec} result={vm.result} />}

      {vm.result && (vm.spec.shape.kind === 'matrix'
        ? <ReportMatrix spec={vm.spec} result={vm.result} />
        : <ReportTable spec={vm.spec} result={vm.result} />)}
    </S.Wrapper>
  );
};
