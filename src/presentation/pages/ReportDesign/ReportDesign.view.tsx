import React from 'react';
import { RiDeleteBinLine, RiEyeLine, RiFileList2Line, RiSave3Line } from 'react-icons/ri';
import { S } from './ReportDesign.styles';
import { useReportDesignViewModel } from './ReportDesign.viewmodel';
import { Button } from '../../components/ui/Button';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { Checkbox } from '../../components/ui/Checkbox';
import { DateInput } from '../../components/ui/DateInput';
import { Input } from '../../components/ui/Input';
import { MultiSearchSelect } from '../../components/ui/MultiSearchSelect';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { ReportChart } from '../../components/ui/ReportChart';
import { ReportMatrix } from '../../components/ui/ReportMatrix';
import { ReportTable } from '../../components/ui/ReportTable';

/**
 * A autoria de um relatório — irmã do Form Design.
 *
 * A pré-visualização usa a MESMA callable que a execução, com o spec cru: o número que aparece aqui
 * é o número que o relatório salvo vai dar, e a permissão de cada coleção é cobrada igual.
 */
export const ReportDesignView: React.FC<{ tabKey: string }> = ({ tabKey }) => {
  const vm = useReportDesignViewModel(tabKey);

  return (
    <S.Page>
      <S.Header>
        <S.HeaderTitle>
          <RiFileList2Line size={20} />
          {vm.reportTitle.trim() === '' ? vm.title : vm.reportTitle}
        </S.HeaderTitle>
        {/*
          * As ações no CABEÇALHO, à direita — o mesmo lugar de toda tela de edição do produto. No
          * rodapé do formulário elas ensinavam um gesto que não vale em nenhuma outra tela.
          */}
        <S.HeaderActions>
          <S.IconBtn
            onClick={() => void vm.runPreview()}
            disabled={vm.errors.length > 0 || vm.isPreviewing}
            title={vm.labels.preview}
          >
            <RiEyeLine size={14} />
          </S.IconBtn>
          <S.SaveBtn
            onClick={() => void vm.save()}
            disabled={!vm.canSave || vm.isSaving}
            title={vm.labels.save}
          >
            <RiSave3Line size={14} />
          </S.SaveBtn>
          {vm.canDelete && (
            <S.DeleteBtn onClick={vm.askDelete} title={vm.labels.deleteAction}>
              <RiDeleteBinLine size={14} />
            </S.DeleteBtn>
          )}
        </S.HeaderActions>
      </S.Header>

      <S.Content>
      {vm.notFound && <InfoBanner message={vm.notFound} variant="warning" />}
      {/* Só sobrou o aviso do relatório de PACOTE: ele diz por que os gestos estão bloqueados. */}
      {vm.editingNotice && <InfoBanner message={vm.editingNotice} variant="info" />}

      <S.Columns>
        <S.Panel>
          <S.Group>
            <SearchSelect
              label={vm.labels.table}
              options={vm.tableOptions}
              value={vm.table}
              onChange={vm.setTable}
            />
          </S.Group>

          <S.Group>
            <S.Legend as="label" htmlFor="report-title">{vm.labels.reportTitle}</S.Legend>
            <Input
              id="report-title"
              value={vm.reportTitle}
              onChange={(event) => vm.setReportTitle(event.target.value)}
            />
          </S.Group>

          <S.Group>
            <S.GroupHeader>
              <S.Legend>{vm.labels.dimensions}</S.Legend>
            </S.GroupHeader>
            <S.Hint>{vm.labels.dimensionsHint}</S.Hint>
            {vm.dimensions.map((dimension) => (
              <S.Item key={dimension.key}>
                <div>
                  <S.ItemLabel>{dimension.label ?? dimension.key}</S.ItemLabel>
                  {dimension.granularity !== undefined && (
                    <SearchSelect
                      options={[
                        { value: '', label: vm.labels.noGranularity },
                        ...vm.labels.granularityOptions,
                      ]}
                      value={dimension.granularity ?? ''}
                      onChange={(value) => vm.setGranularity(
                        dimension.key,
                        value === '' ? undefined : (value as typeof dimension.granularity),
                      )}
                    />
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => vm.removeDimension(dimension.key)}>
                  {vm.labels.remove}
                </Button>
              </S.Item>
            ))}
            <SearchSelect
              options={vm.pathOptions.map((option) => ({ value: option.value, label: option.label }))}
              value=""
              onChange={vm.addDimension}
              placeholder={vm.labels.add}
            />
          </S.Group>

          <S.Group>
            <S.GroupHeader>
              <S.Legend>{vm.labels.measures}</S.Legend>
            </S.GroupHeader>
            <S.Hint>{vm.labels.measuresHint}</S.Hint>
            {vm.measures.map((measure) => (
              <S.Item key={measure.key}>
                <S.ItemLabel>{measure.label ?? measure.key}</S.ItemLabel>
                <Button variant="ghost" size="sm" onClick={() => vm.removeMeasure(measure.key)}>
                  {vm.labels.remove}
                </Button>
              </S.Item>
            ))}
            <S.Row>
              <S.Grow>
                <SearchSelect
                  label={vm.labels.measureOp}
                  options={vm.labels.opOptions}
                  value={vm.measureOp}
                  onChange={(value) => vm.setMeasureOp(value as typeof vm.measureOp)}
                />
              </S.Grow>
              {vm.measureOp !== 'count' && (
                <S.Grow>
                  <SearchSelect
                    label={vm.labels.measureField}
                    options={vm.pathOptions
                      .filter((option) => option.isNumeric)
                      .map((option) => ({ value: option.value, label: option.label }))}
                    value={vm.measurePath}
                    onChange={vm.setMeasurePath}
                  />
                </S.Grow>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={vm.addMeasure}
                disabled={!vm.canAddMeasure}
              >
                {vm.labels.add}
              </Button>
            </S.Row>
          </S.Group>

          <S.Group>
            <S.Legend>{vm.labels.shape}</S.Legend>
            <SearchSelect
              options={vm.labels.shapeOptions}
              value={vm.shapeKind}
              onChange={(value) => vm.setShapeKind(value as typeof vm.shapeKind)}
            />
            {vm.shapeKind === 'matrix' && (
              <SearchSelect
                label={vm.labels.columnDimension}
                options={vm.dimensions.map((dimension) => ({
                  value: dimension.key,
                  label: dimension.label ?? dimension.key,
                }))}
                value={vm.columnDimension}
                onChange={vm.setColumnDimension}
              />
            )}
          </S.Group>


          <S.Group>
            <S.GroupHeader>
              <S.Legend>{vm.labels.filters}</S.Legend>
            </S.GroupHeader>
            <S.Hint>{vm.labels.filtersHint}</S.Hint>
            {vm.filters.map((filter, index) => (
              <S.Item key={`${filter.label}:${filter.op}:${filter.value}:${index}`}>
                <div>
                  <S.ItemLabel>{filter.label}</S.ItemLabel>
                  <S.ItemMeta>{`${filter.op} ${filter.value}`.trim()}</S.ItemMeta>
                </div>
                <Button variant="ghost" size="sm" onClick={() => vm.removeFilter(index)}>
                  {vm.labels.remove}
                </Button>
              </S.Item>
            ))}
            <S.Row>
              <S.Grow>
                <SearchSelect
                  options={vm.pathOptions.map((option) => ({ value: option.value, label: option.label }))}
                  value={vm.filterPath}
                  onChange={vm.setFilterPath}
                  placeholder={vm.labels.add}
                />
              </S.Grow>
              <S.Grow>
                <SearchSelect
                  options={vm.labels.operatorOptions}
                  value={vm.filterOp}
                  onChange={(value) => vm.setFilterOp(value as typeof vm.filterOp)}
                />
              </S.Grow>
              {vm.filterNeedsValue && (
                <S.Grow>
                  {/* Campo de data é o `DateInput`, nunca um texto livre — a regra vale aqui como
                      em qualquer outro lugar do produto. */}
                  {vm.filterIsDate ? (
                    <DateInput value={vm.filterValue} onChange={vm.setFilterValue} />
                  ) : (
                    <Input
                      value={vm.filterValue}
                      placeholder={vm.labels.filterValue}
                      onChange={(event) => vm.setFilterValue(event.target.value)}
                    />
                  )}
                </S.Grow>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={vm.addFilter}
                disabled={!vm.canAddFilter}
              >
                {vm.labels.add}
              </Button>
            </S.Row>
          </S.Group>

          <S.Group>
            <S.Legend>{vm.labels.chart}</S.Legend>
            <S.Hint>{vm.labels.chartHint}</S.Hint>
            <SearchSelect
              options={[{ value: '', label: vm.labels.noChart }, ...vm.labels.chartOptions]}
              value={vm.chartKind}
              onChange={vm.setChartKind}
            />
            {vm.chartKind !== '' && (
              <>
                <SearchSelect
                  label={vm.labels.chartCategory}
                  options={vm.dimensions.map((dimension) => ({
                    value: dimension.key,
                    label: dimension.label ?? dimension.key,
                  }))}
                  value={vm.chartCategory}
                  onChange={vm.setChartCategory}
                />
                <MultiSearchSelect
                  options={vm.measures.map((measure) => ({
                    value: measure.key,
                    label: measure.label ?? measure.key,
                  }))}
                  values={vm.chartSeries}
                  onChange={vm.setChartSeries}
                  placeholder={vm.labels.chartSeries}
                />
                <Checkbox
                  checked={vm.chartStacked}
                  onChange={vm.setChartStacked}
                  label={vm.labels.chartStacked}
                />
              </>
            )}
          </S.Group>

          <S.Group>
            <S.GroupHeader>
              <S.Legend>{vm.labels.prompts}</S.Legend>
            </S.GroupHeader>
            <S.Hint>{vm.labels.promptsHint}</S.Hint>
            {vm.prompts.map((prompt) => (
              <S.Item key={prompt.key}>
                <div>
                  <S.ItemLabel>{prompt.label}</S.ItemLabel>
                  <S.ItemMeta>{prompt.op}</S.ItemMeta>
                </div>
                <Button variant="ghost" size="sm" onClick={() => vm.removePrompt(prompt.key)}>
                  {vm.labels.remove}
                </Button>
              </S.Item>
            ))}
            <S.Row>
              <S.Grow>
                <SearchSelect
                  options={vm.pathOptions.map((option) => ({ value: option.value, label: option.label }))}
                  value={vm.promptPath}
                  onChange={vm.setPromptPath}
                  placeholder={vm.labels.add}
                />
              </S.Grow>
              <S.Grow>
                <SearchSelect
                  options={vm.labels.operatorOptions}
                  value={vm.promptOp}
                  onChange={(value) => vm.setPromptOp(value as typeof vm.promptOp)}
                />
              </S.Grow>
              <Button
                variant="secondary"
                size="sm"
                onClick={vm.addPrompt}
                disabled={!vm.canAddPrompt}
              >
                {vm.labels.add}
              </Button>
            </S.Row>
          </S.Group>

          {vm.errors.map((error) => <InfoBanner key={error} message={error} variant="warning" />)}
          {vm.warnings.map((warning) => <InfoBanner key={warning} message={warning} variant="info" />)}

        </S.Panel>

        <S.Panel>
          {vm.previewError && <InfoBanner message={vm.previewError} variant="warning" />}
          {vm.preview && <ReportChart spec={vm.spec} result={vm.preview} />}
          {vm.preview && (vm.spec.shape.kind === 'matrix'
            ? <ReportMatrix spec={vm.spec} result={vm.preview} />
            : <ReportTable spec={vm.spec} result={vm.preview} />)}
        </S.Panel>
      </S.Columns>
      </S.Content>

      <ConfirmModal
        isOpen={vm.isConfirmingDelete}
        title={vm.labels.deleteAction}
        message={vm.labels.deleteConfirm}
        confirmLabel={vm.labels.deleteAction}
        variant="danger"
        loading={vm.isDeleting}
        onConfirm={() => void vm.confirmDelete()}
        onCancel={vm.cancelDelete}
      />
    </S.Page>
  );
};
