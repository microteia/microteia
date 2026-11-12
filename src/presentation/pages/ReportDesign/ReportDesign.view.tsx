import React from 'react';
import { RiSparkling2Line } from 'react-icons/ri';
import {
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiDeleteBinLine,
  RiDraggable,
  RiEyeLine,
  RiFileList2Line,
  RiSave3Line,
} from 'react-icons/ri';
import { S } from './ReportDesign.styles';
import { useReportDesignViewModel } from './ReportDesign.viewmodel';
import type {
  ReportGranularity,
  ReportHighlightOp,
  ReportHighlightTone,
} from '../../../domain/schema/report/reportSpec';
import { Button } from '../../components/ui/Button';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { Checkbox } from '../../components/ui/Checkbox';
import { ExpressionEditor } from '../../components/ui/ExpressionEditor';
import { FieldFilterInput } from '../../components/ui/FieldFilterInput';
import { Input, Textarea } from '../../components/ui/Input';
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
          {/* Descrever primeiro: o rascunho proposto PREENCHE o formulário abaixo, que continua sendo a
              autoria — nada é salvo sem a pessoa revisar e salvar. */}
          <S.Group>
            <S.Legend as="label" htmlFor="report-ai">{vm.labels.aiTitle}</S.Legend>
            <S.Hint>{vm.labels.aiHint}</S.Hint>
            <Textarea
              id="report-ai"
              value={vm.aiDescription}
              placeholder={vm.labels.aiPlaceholder}
              onChange={(event) => vm.setAiDescription(event.target.value)}
            />
            {vm.aiUnavailable && <InfoBanner message={vm.aiUnavailable} variant="info" />}
            <S.Row>
              <Button
                variant="secondary"
                size="sm"
                onClick={vm.describeWithAI}
                disabled={!vm.canDescribeWithAI || vm.aiBusy || vm.aiDescription.trim() === ''}
              >
                <RiSparkling2Line /> {vm.labels.aiAction}
              </Button>
              {vm.openAISettings && (
                <Button variant="ghost" size="sm" onClick={vm.openAISettings}>
                  {vm.labels.aiOpenSettings}
                </Button>
              )}
            </S.Row>
          </S.Group>

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
            {/*
              * A ORDEM é o relatório: ela é a ordem dos níveis do resumo e a das colunas da lista.
              * O gesto é o do Form Design — arrastar pela alça, ou as setas, que é o que funciona
              * sem mouse.
              */}
            {vm.dimensions.map((dimension) => (
              <S.DimensionItem
                key={dimension.key}
                draggable
                $dragging={vm.draggedDimension === dimension.key}
                $dragOver={vm.dragOverDimension === dimension.key && vm.draggedDimension !== dimension.key}
                onDragStart={() => vm.startDragDimension(dimension.key)}
                onDragOver={(event) => {
                  event.preventDefault();
                  vm.dragOverDimensionAt(dimension.key);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  vm.dropDimension(dimension.key);
                }}
                onDragEnd={vm.endDragDimension}
              >
                <S.DragHandle title={vm.labels.reorder}>
                  <RiDraggable size={16} />
                </S.DragHandle>
                <div>
                  <S.ItemLabel>{dimension.label}</S.ItemLabel>
                  {dimension.expression && <S.Hint>{dimension.expression}</S.Hint>}
                  {dimension.isDate && (
                    <SearchSelect
                      options={[
                        { value: '', label: vm.labels.noGranularity },
                        ...vm.labels.granularityOptions,
                      ]}
                      value={dimension.granularity}
                      onChange={(value) => vm.setGranularity(
                        dimension.key,
                        value === '' ? undefined : (value as ReportGranularity),
                      )}
                    />
                  )}
                  {/* Ordem, limite e "Outros" só valem para um campo que AGRUPA: num campo que é só
                      coluna da lista, não haveria membros a ordenar nem a cortar. */}
                  {dimension.isGroup && (
                    <S.Row>
                      <S.Grow>
                        <SearchSelect
                          label={vm.labels.sort}
                          options={vm.sortOptions}
                          value={dimension.sortValue}
                          onChange={(value) => vm.setDimensionSort(dimension.key, value)}
                        />
                      </S.Grow>
                      <S.Grow>
                        <S.Legend as="label" htmlFor={`limit-${dimension.key}`}>{vm.labels.limit}</S.Legend>
                        <Input
                          id={`limit-${dimension.key}`}
                          inputMode="numeric"
                          value={dimension.limit}
                          placeholder={vm.labels.limitPlaceholder}
                          onChange={(event) => vm.setDimensionLimit(dimension.key, event.target.value)}
                        />
                      </S.Grow>
                    </S.Row>
                  )}
                  {dimension.isGroup && dimension.limit !== '' && (
                    <Checkbox
                      checked={dimension.others}
                      onChange={(checked) => vm.setDimensionOthers(dimension.key, checked)}
                      label={vm.labels.others}
                    />
                  )}
                  {/* Faixas valem sobre NÚMERO: num campo de data, o corte é o balde de tempo acima. */}
                  {dimension.isGroup && !dimension.isDate && (
                    <>
                      <S.Legend as="label" htmlFor={`bands-${dimension.key}`}>{vm.labels.bands}</S.Legend>
                      <Input
                        id={`bands-${dimension.key}`}
                        value={dimension.bandLimits}
                        placeholder={vm.labels.bandsPlaceholder}
                        onChange={(event) => vm.setDimensionBands(dimension.key, event.target.value)}
                      />
                    </>
                  )}
                </div>
                <S.ItemActions>
                  <S.MoveBtn
                    title={vm.labels.moveUp}
                    disabled={!dimension.canMoveUp}
                    onClick={() => vm.moveDimension(dimension.key, -1)}
                  >
                    <RiArrowUpSLine size={16} />
                  </S.MoveBtn>
                  <S.MoveBtn
                    title={vm.labels.moveDown}
                    disabled={!dimension.canMoveDown}
                    onClick={() => vm.moveDimension(dimension.key, 1)}
                  >
                    <RiArrowDownSLine size={16} />
                  </S.MoveBtn>
                  <Button variant="ghost" size="sm" onClick={() => vm.removeDimension(dimension.key)}>
                    {vm.labels.remove}
                  </Button>
                </S.ItemActions>
              </S.DimensionItem>
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
                <div>
                  <S.ItemLabel>{measure.label}</S.ItemLabel>
                  {measure.detail !== '' && <S.ItemMeta>{measure.detail}</S.ItemMeta>}
                  <S.Row>
                    <S.Grow>
                      <SearchSelect
                        label={vm.labels.format}
                        options={vm.formatOptions}
                        value={measure.formatKind}
                        onChange={(value) => vm.setMeasureFormat(measure.key, value)}
                      />
                    </S.Grow>
                    {measure.formatKind !== 'integer' && measure.formatKind !== 'currency' && (
                      <S.Grow>
                        <S.Legend as="label" htmlFor={`decimals-${measure.key}`}>{vm.labels.decimals}</S.Legend>
                        <Input
                          id={`decimals-${measure.key}`}
                          inputMode="numeric"
                          value={measure.decimals}
                          onChange={(event) => vm.setMeasureDecimals(measure.key, event.target.value)}
                        />
                      </S.Grow>
                    )}
                  </S.Row>
                </div>
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
              {vm.measureOp !== 'count' ? (
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
              ) : (
                <S.Grow>
                  <SearchSelect
                    label={vm.labels.distinctField}
                    options={vm.distinctOptions}
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

          {/* O AGRUPAMENTO calculado lê o REGISTRO — o oposto do número calculado abaixo, que lê os totais. */}
          <S.Group>
            <S.GroupHeader>
              <S.Legend>{vm.labels.computedDimension}</S.Legend>
            </S.GroupHeader>
            <S.Hint>{vm.labels.computedDimensionHint}</S.Hint>
            <S.Legend as="label" htmlFor="computed-dimension-name">{vm.labels.computedDimensionName}</S.Legend>
            <Input
              id="computed-dimension-name"
              value={vm.computedDimensionName}
              onChange={(event) => vm.setComputedDimensionName(event.target.value)}
            />
            <ExpressionEditor
              value={vm.computedDimensionExpression}
              onChange={vm.setComputedDimensionExpression}
              workflowVariables={vm.expressionVariables}
              placeholder={vm.labels.computedDimensionPlaceholder}
            />
            <S.Row>
              <Button variant="secondary" size="sm" onClick={vm.addComputedDimension} disabled={!vm.canAddComputedDimension}>
                {vm.labels.add}
              </Button>
            </S.Row>
          </S.Group>

          {/* O número CALCULADO lê os outros números, nunca o registro: uma razão de totais, e não a
              média das razões de cada linha. */}
          <S.Group>
            <S.GroupHeader>
              <S.Legend>{vm.labels.computed}</S.Legend>
            </S.GroupHeader>
            <S.Hint>{vm.labels.computedHint}</S.Hint>
            <S.Legend as="label" htmlFor="computed-name">{vm.labels.computedName}</S.Legend>
            <Input
              id="computed-name"
              value={vm.computedName}
              onChange={(event) => vm.setComputedName(event.target.value)}
            />
            <ExpressionEditor
              value={vm.computedExpression}
              onChange={vm.setComputedExpression}
              workflowVariables={vm.measureVariables}
              placeholder={vm.labels.computedPlaceholder}
            />
            <S.Row>
              <Button variant="secondary" size="sm" onClick={vm.addComputed} disabled={!vm.canAddComputed}>
                {vm.labels.add}
              </Button>
            </S.Row>
          </S.Group>

          <S.Group>
            <S.GroupHeader>
              <S.Legend>{vm.labels.highlight}</S.Legend>
            </S.GroupHeader>
            <S.Hint>{vm.labels.highlightHint}</S.Hint>
            {vm.highlights.map((rule, index) => (
              <S.Item key={`${rule.label}:${index}`}>
                <S.ItemLabel>{rule.label}</S.ItemLabel>
                <Button variant="ghost" size="sm" onClick={() => vm.removeHighlight(index)}>
                  {vm.labels.remove}
                </Button>
              </S.Item>
            ))}
            <S.Row>
              <S.Grow>
                <SearchSelect
                  options={vm.measures.map((measure) => ({ value: measure.key, label: measure.label }))}
                  value={vm.highlightMeasure}
                  onChange={vm.setHighlightMeasure}
                  placeholder={vm.labels.add}
                />
              </S.Grow>
              <S.Grow>
                <SearchSelect
                  options={vm.labels.opHighlightOptions}
                  value={vm.highlightOp}
                  onChange={(value) => vm.setHighlightOp(value as ReportHighlightOp)}
                />
              </S.Grow>
              <S.Grow>
                <Input
                  inputMode="decimal"
                  value={vm.highlightValue}
                  placeholder={vm.labels.highlightValue}
                  onChange={(event) => vm.setHighlightValue(event.target.value)}
                />
              </S.Grow>
              <S.Grow>
                <SearchSelect
                  options={vm.labels.toneOptions}
                  value={vm.highlightTone}
                  onChange={(value) => vm.setHighlightTone(value as ReportHighlightTone)}
                />
              </S.Grow>
              <Button variant="secondary" size="sm" onClick={vm.addHighlight} disabled={!vm.canAddHighlight}>
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
                  label: dimension.label,
                }))}
                value={vm.columnDimension}
                onChange={vm.setColumnDimension}
              />
            )}
            {/* O agrupamento vale para as TRÊS dobras — é a mesma pergunta, respondida de um jeito
                em cada uma. Deixá-lo só na lista era o que fazia o resumo e o pivô comerem a lista
                inteira de campos como níveis. A ordem é a da escolha, e ela é a ordem dos níveis. */}
            <S.GroupHeader>
              <S.Legend>{vm.labels.group}</S.Legend>
            </S.GroupHeader>
            <MultiSearchSelect
              options={vm.dimensions.map((dimension) => ({
                value: dimension.key,
                label: dimension.label,
              }))}
              values={vm.groupDimensions}
              onChange={vm.setGroupDimensions}
              placeholder={vm.labels.noGroup}
            />
            <S.Hint>{vm.labels.groupHint}</S.Hint>
            {vm.shapeKind !== 'tabular' && (
              <Checkbox checked={vm.grandTotal} onChange={vm.setGrandTotal} label={vm.labels.grandTotal} />
            )}
            {vm.shapeKind === 'matrix' && (
              <SearchSelect
                label={vm.labels.emptyCell}
                options={vm.emptyCellOptions}
                value={vm.emptyCell}
                onChange={vm.setEmptyCell}
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
              {vm.filterNeedsValue && vm.filterField && (
                <S.Grow>
                  {/* O valor é pedido no FORMATO DO CAMPO — o mesmo controle que o formulário do
                      registro usa. Um texto livre aqui cobrava da autoria o id do registro que ela
                      queria comparar, e o formato exato da data. */}
                  <FieldFilterInput
                    field={vm.filterField}
                    value={vm.filterValue}
                    onChange={vm.setFilterValue}
                  />
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

          {/* A pergunta que nenhuma lista de predicados escreve: dois campos comparados entre si,
              uma conta, uma data relativa a hoje. Mesmo editor e mesmo idioma do `hiddenWhen` de uma
              ação — o escopo é a linha, e o intellisense oferece os campos da tela escolhida. */}
          <S.Group>
            <S.GroupHeader>
              <S.Legend>{vm.labels.expressionFilter}</S.Legend>
            </S.GroupHeader>
            <S.Hint>{vm.labels.expressionFilterHint}</S.Hint>
            <ExpressionEditor
              value={vm.filterExpression}
              onChange={vm.setFilterExpression}
              workflowVariables={vm.expressionVariables}
              placeholder={vm.labels.expressionFilterPlaceholder}
            />
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
                    label: dimension.label,
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
                <SearchSelect
                  label={vm.labels.chartSplit}
                  options={vm.chartSplitOptions}
                  value={vm.chartSplitBy}
                  onChange={vm.setChartSplitBy}
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
                  <Checkbox
                    checked={prompt.required}
                    onChange={(checked) => vm.setPromptRequired(prompt.key, checked)}
                    label={vm.labels.promptRequired}
                  />
                  {prompt.isPeriod && (
                    <SearchSelect
                      label={vm.labels.promptDefault}
                      options={vm.periodOptions}
                      value={prompt.periodDefault}
                      onChange={(value) => vm.setPromptPeriodDefault(prompt.key, value)}
                    />
                  )}
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
                  options={vm.promptOpOptions}
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

          <S.Group>
            <S.Legend as="label" htmlFor="report-scan-limit">{vm.labels.scanLimit}</S.Legend>
            <Input
              id="report-scan-limit"
              inputMode="numeric"
              value={vm.scanLimit}
              placeholder={vm.labels.scanLimitPlaceholder}
              onChange={(event) => vm.setScanLimit(event.target.value)}
            />
            <SearchSelect
              label={vm.labels.permission}
              options={vm.permissionOptions}
              value={vm.permission}
              onChange={vm.setPermission}
            />
            <S.Hint>{vm.labels.permissionHint}</S.Hint>
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
