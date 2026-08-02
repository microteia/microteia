import React, { Suspense, lazy } from 'react';
import { RiCodeBoxLine, RiSave3Line, RiDeleteBinLine, RiArrowRightSLine, RiDatabase2Line, RiPlayLine } from 'react-icons/ri';
import { S } from './ViewScript.styles';
import { useViewScriptViewModel } from './ViewScript.viewmodel';
import { Input, Label, Textarea } from '../../components/ui/Input';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { RunModal } from '../../components/ui/RunModal';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { AdvancedParametersEditor } from '../ViewWorkflow/components/AdvancedParametersEditor';
import type { AdvancedParametersEditorProps } from '../ViewWorkflow/components/AdvancedParametersEditor/AdvancedParametersEditor.viewmodel';
import type { WorkflowParameter } from '../../../domain/entities/Workflow';

const CodeEditor = lazy(() =>
  import('../../components/ui/CodeEditor').then((m) => ({ default: m.CodeEditor })),
);

export const ViewScriptView: React.FC<{ tabKey: string }> = ({ tabKey }) => {
  const vm = useViewScriptViewModel(tabKey);

  return (
    <S.Page>
      <S.Header>
        <S.HeaderTitle>
          <RiCodeBoxLine size={20} />
          {vm.isNew ? 'Novo Script' : (vm.formData.name || 'Script')}
        </S.HeaderTitle>
        <S.HeaderActions>
          <S.RunBtn onClick={vm.openRunModal} title="Executar (Debug)">
            <RiPlayLine size={14} />
          </S.RunBtn>
          <S.SaveBtn
            onClick={() => void vm.handleSave()}
            disabled={!vm.canSave}
            title={vm.isSaving ? 'Salvando...' : 'Salvar'}
          >
            <RiSave3Line size={14} />
          </S.SaveBtn>
          {!vm.isNew && (
            <S.DeleteBtn onClick={vm.handleDelete} title="Excluir script">
              <RiDeleteBinLine size={14} />
            </S.DeleteBtn>
          )}
        </S.HeaderActions>
      </S.Header>

      <S.Content>
        <S.Section>
          <S.SectionHeader type="button" onClick={() => vm.toggleSection('general')}>
            <S.SectionChevron $open={!vm.isSectionCollapsed('general')}><RiArrowRightSLine size={18} /></S.SectionChevron>
            <S.SectionTitle>Geral</S.SectionTitle>
          </S.SectionHeader>
          {!vm.isSectionCollapsed('general') && (
            <S.SectionBody>
              <S.Field>
                <Label>Nome</Label>
                <Input
                  value={vm.formData.name}
                  onChange={(e) => vm.setFormData({ name: e.target.value })}
                  placeholder="ex: Calcular prazo processual"
                />
              </S.Field>
              <S.Field>
                <Label>Identificador</Label>
                <Input
                  value={vm.formData.scriptId}
                  onChange={(e) => vm.setFormData({ scriptId: e.target.value })}
                  placeholder={vm.suggestedScriptId || 'ex: calcular-prazo'}
                  disabled={!vm.isNew}
                />
                <S.SectionHint>
                  {vm.isNew
                    ? 'É por ele que um Step e um pacote apontam para este script. Em branco, criamos um a partir do nome. Não muda depois de criado.'
                    : 'O identificador não muda depois que o script é criado — os Steps e os pacotes que apontam para ele deixariam de encontrá-lo.'}
                </S.SectionHint>
                {vm.scriptIdError && <S.FieldError>{vm.scriptIdError}</S.FieldError>}
              </S.Field>
              <S.Field>
                <Label>Descrição</Label>
                <Textarea
                  value={vm.formData.description}
                  onChange={(e) => vm.setFormData({ description: e.target.value })}
                  placeholder="O que este script faz..."
                  rows={2}
                />
              </S.Field>
            </S.SectionBody>
          )}
        </S.Section>

        <S.Section>
          <S.SectionHeader type="button" onClick={() => vm.toggleSection('inputs')}>
            <S.SectionChevron $open={!vm.isSectionCollapsed('inputs')}><RiArrowRightSLine size={18} /></S.SectionChevron>
            <S.SectionTitle>Parâmetros de entrada</S.SectionTitle>
          </S.SectionHeader>
          {!vm.isSectionCollapsed('inputs') && (
            <S.SectionBody>
              <S.SectionHint>
                Ficam disponíveis no código pelo objeto <code>input</code> (ex: <code>input.orderId</code>).
              </S.SectionHint>
              <AdvancedParametersEditor
                parameters={vm.formData.inputParams}
                errors={vm.inputParamErrors}
                typeOptions={vm.typeOptions}
                entityOptions={vm.entityOptions}
                onAdd={vm.addInputParam}
                onUpdate={vm.updateInputParam}
                onRemove={vm.removeInputParam}
                onClone={vm.cloneInputParam}
                onReplace={vm.replaceInputParams}
              />
            </S.SectionBody>
          )}
        </S.Section>

        <S.Section>
          <S.SectionHeader type="button" onClick={() => vm.toggleSection('code')}>
            <S.SectionChevron $open={!vm.isSectionCollapsed('code')}><RiArrowRightSLine size={18} /></S.SectionChevron>
            <S.SectionTitle>Código</S.SectionTitle>
          </S.SectionHeader>
          {!vm.isSectionCollapsed('code') && (
            <S.SectionBody>
              <InfoBanner
                variant="info"
                message="O código roda em um ambiente isolado e seguro, sem acesso à internet nem a bibliotecas externas. Use o objeto input, as funções fn.* e as funções de dados query(...), upsert(...) e remove(...) para acessar os cadastros do escritório. Retorne um objeto com os parâmetros de saída."
              />
              <S.DocLink type="button" onClick={vm.openDataFunctionReference}>
                <RiDatabase2Line size={14} /> Ver funções de dados (query, upsert, remove)
              </S.DocLink>
              <Suspense fallback={<S.EditorLoading>Carregando editor…</S.EditorLoading>}>
                <CodeEditor
                  value={vm.formData.sourceTs}
                  onChange={(sourceTs) => vm.setFormData({ sourceTs })}
                  extraLib={vm.scriptTypeDefs}
                />
              </Suspense>
            </S.SectionBody>
          )}
        </S.Section>

        <S.Section>
          <S.SectionHeader type="button" onClick={() => vm.toggleSection('queryDoc')}>
            <S.SectionChevron $open={!vm.isSectionCollapsed('queryDoc')}><RiArrowRightSLine size={18} /></S.SectionChevron>
            <S.SectionTitle>Como consultar o banco (função query)</S.SectionTitle>
          </S.SectionHeader>
          {!vm.isSectionCollapsed('queryDoc') && (
            <S.SectionBody>
              <S.Doc>
                <S.DocLead>
                  A função <S.Code>query</S.Code> busca registros dos cadastros do escritório. Ela é
                  assíncrona: use sempre <S.Code>await</S.Code>. Recebe um objeto de configuração e
                  devolve <S.Code>{'{ count, results, first }'}</S.Code>.
                </S.DocLead>

                <S.Signature>{`const resultado = await query({ table: 'cases', where: [...] });
// resultado.count   → quantos registros vieram
// resultado.results → a lista de registros
// resultado.first   → o primeiro registro (ou null)`}</S.Signature>

                <S.DocGroup>
                  <S.DocGroupTitle>Configurações</S.DocGroupTitle>
                  <S.ParamList>
                    <S.ParamRow>
                      <S.ParamHead>
                        <S.ParamName>table</S.ParamName>
                        <S.Pill $required>Obrigatório</S.Pill>
                      </S.ParamHead>
                      <S.ParamDesc>
                        A tabela a consultar: <S.Code>persons</S.Code> (pessoas),{' '}
                        <S.Code>cases</S.Code> (processos), <S.Code>contracts</S.Code> (contratos),{' '}
                        <S.Code>deadlines</S.Code> (prazos), <S.Code>financials</S.Code> (financeiro)
                        ou o identificador de uma tela personalizada.
                      </S.ParamDesc>
                    </S.ParamRow>
                    <S.ParamRow>
                      <S.ParamHead>
                        <S.ParamName>where</S.ParamName>
                        <S.Pill>Opcional</S.Pill>
                      </S.ParamHead>
                      <S.ParamDesc>
                        Lista de filtros, cada um no formato{' '}
                        <S.Code>{'{ path, op, value }'}</S.Code>. Todos são combinados com E (todos
                        precisam ser verdadeiros). <S.Code>path</S.Code> é o campo, aceitando ponto
                        para campos aninhados (ex: <S.Code>address.city</S.Code>).
                      </S.ParamDesc>
                    </S.ParamRow>
                    <S.ParamRow>
                      <S.ParamHead>
                        <S.ParamName>orderBy</S.ParamName>
                        <S.Pill>Opcional</S.Pill>
                      </S.ParamHead>
                      <S.ParamDesc>
                        Ordenação, no formato <S.Code>{"{ path, dir }"}</S.Code>, com{' '}
                        <S.Code>dir</S.Code> igual a <S.Code>'asc'</S.Code> (crescente) ou{' '}
                        <S.Code>'desc'</S.Code> (decrescente).
                      </S.ParamDesc>
                    </S.ParamRow>
                    <S.ParamRow>
                      <S.ParamHead>
                        <S.ParamName>limit</S.ParamName>
                        <S.Pill>Opcional</S.Pill>
                      </S.ParamHead>
                      <S.ParamDesc>
                        Quantidade máxima de registros retornados. Padrão 50, teto de 100.
                      </S.ParamDesc>
                    </S.ParamRow>
                    <S.ParamRow>
                      <S.ParamHead>
                        <S.ParamName>projections</S.ParamName>
                        <S.Pill>Opcional</S.Pill>
                      </S.ParamHead>
                      <S.ParamDesc>
                        Lista de campos a carregar por completo, inclusive dados de entidades
                        referenciadas usando ponto (ex: <S.Code>client.name</S.Code>). Sem
                        projeções, cada registro traz apenas seus campos diretos.
                      </S.ParamDesc>
                    </S.ParamRow>
                  </S.ParamList>
                </S.DocGroup>

                <S.DocGroup>
                  <S.DocGroupTitle>Operadores (op)</S.DocGroupTitle>
                  <S.OpGrid>
                    <S.OpChip><S.OpName>eq</S.OpName><S.OpLabel>igual a</S.OpLabel></S.OpChip>
                    <S.OpChip><S.OpName>neq</S.OpName><S.OpLabel>diferente de</S.OpLabel></S.OpChip>
                    <S.OpChip><S.OpName>lt</S.OpName><S.OpLabel>menor que</S.OpLabel></S.OpChip>
                    <S.OpChip><S.OpName>lte</S.OpName><S.OpLabel>menor ou igual a</S.OpLabel></S.OpChip>
                    <S.OpChip><S.OpName>gt</S.OpName><S.OpLabel>maior que</S.OpLabel></S.OpChip>
                    <S.OpChip><S.OpName>gte</S.OpName><S.OpLabel>maior ou igual a</S.OpLabel></S.OpChip>
                    <S.OpChip><S.OpName>in</S.OpName><S.OpLabel>está na lista</S.OpLabel></S.OpChip>
                    <S.OpChip><S.OpName>contains</S.OpName><S.OpLabel>contém</S.OpLabel></S.OpChip>
                    <S.OpChip><S.OpName>exists</S.OpName><S.OpLabel>está preenchido</S.OpLabel></S.OpChip>
                  </S.OpGrid>
                  <S.DocLead>
                    <S.Code>exists</S.Code> não usa <S.Code>value</S.Code>. Para <S.Code>in</S.Code>,{' '}
                    <S.Code>value</S.Code> é uma lista.
                  </S.DocLead>
                </S.DocGroup>

                <S.DocGroup>
                  <S.DocGroupTitle>Exemplos</S.DocGroupTitle>
                  <S.Examples>
                    <S.Example>
                      <S.ExampleTitle>Processos ativos, do mais recente ao mais antigo</S.ExampleTitle>
                      <S.Pre>{`const r = await query({
  table: 'cases',
  where: [{ path: 'status', op: 'eq', value: 'ativo' }],
  orderBy: [{ path: 'filedAt', dir: 'desc' }],
  limit: 10,
});
log('Encontrados:', r.count);`}</S.Pre>
                    </S.Example>
                    <S.Example>
                      <S.ExampleTitle>Contar processos com valor de causa acima de R$ 10.000</S.ExampleTitle>
                      <S.Pre>{`const r = await query({
  table: 'cases',
  where: [{ path: 'causeValue', op: 'gte', value: 10000 }],
});
return { totalAltoValor: r.count };`}</S.Pre>
                    </S.Example>
                    <S.Example>
                      <S.ExampleTitle>Pessoas de uma cidade que tenham e-mail cadastrado</S.ExampleTitle>
                      <S.Pre>{`const r = await query({
  table: 'persons',
  where: [
    { path: 'address.city', op: 'eq', value: 'São Paulo' },
    { path: 'email', op: 'exists' },
  ],
  projections: ['name', 'email'],
});
const nomes = r.results.map((p) => p.name);`}</S.Pre>
                    </S.Example>
                  </S.Examples>
                </S.DocGroup>

                <S.DocGroup>
                  <S.DocGroupTitle>Limites</S.DocGroupTitle>
                  <S.NoteList>
                    <S.Note>Sempre use <S.Code>await</S.Code> ao chamar <S.Code>query</S.Code>.</S.Note>
                    <S.Note>No máximo 25 consultas por execução do script.</S.Note>
                    <S.Note>Os filtros e a ordenação percorrem até 300 registros por consulta.</S.Note>
                  </S.NoteList>
                </S.DocGroup>
              </S.Doc>
            </S.SectionBody>
          )}
        </S.Section>

        <S.Section>
          <S.SectionHeader type="button" onClick={() => vm.toggleSection('outputs')}>
            <S.SectionChevron $open={!vm.isSectionCollapsed('outputs')}><RiArrowRightSLine size={18} /></S.SectionChevron>
            <S.SectionTitle>Parâmetros de saída</S.SectionTitle>
          </S.SectionHeader>
          {!vm.isSectionCollapsed('outputs') && (
            <S.SectionBody>
              <S.SectionHint>
                Declaram o que o script retorna, para facilitar o uso nos Steps seguintes.
              </S.SectionHint>
              <AdvancedParametersEditor
                variant="output"
                parameters={vm.formData.outputParams as unknown as WorkflowParameter[]}
                errors={vm.outputParamErrors}
                typeOptions={vm.typeOptions}
                entityOptions={vm.entityOptions}
                onAdd={vm.addOutputParam}
                onUpdate={vm.updateOutputParam as unknown as AdvancedParametersEditorProps['onUpdate']}
                onRemove={vm.removeOutputParam}
                onClone={vm.cloneOutputParam}
                onReplace={vm.replaceOutputParams as unknown as AdvancedParametersEditorProps['onReplace']}
              />
            </S.SectionBody>
          )}
        </S.Section>
      </S.Content>

      {vm.runModalOpen && (
        <RunModal
          title={`Executar: ${vm.formData.name || 'Script'}`}
          parameters={vm.formData.inputParams}
          runLabel="Executar Script"
          onClose={vm.closeRunModal}
          onRun={vm.runScriptForModal}
        />
      )}

      <ConfirmModal
        isOpen={!!vm.scriptToDelete}
        onConfirm={() => void vm.confirmDelete()}
        onCancel={vm.cancelDelete}
        title="Excluir Script"
        message={`Tem certeza que deseja excluir o script "${vm.scriptToDelete?.name}"? Steps que o utilizam deixarão de funcionar.`}
        confirmLabel="Excluir"
        variant="danger"
      />
    </S.Page>
  );
};
