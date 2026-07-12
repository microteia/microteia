import React, { Suspense, lazy } from 'react';
import { RiCheckLine, RiBookOpenLine, RiArrowDownSLine, RiArrowRightSLine, RiFileTextLine } from 'react-icons/ri';
import { S } from './AdvancedParametersEditor.styles';
import { WorkflowParametersEditor } from '../WorkflowParametersEditor';
import { useAdvancedParametersEditorViewModel, PARAMETERS_JSON_EXAMPLE } from './AdvancedParametersEditor.viewmodel';
import type { AdvancedParametersEditorProps } from './AdvancedParametersEditor.viewmodel';

const CodeEditor = lazy(() =>
  import('../../../../components/ui/CodeEditor').then((m) => ({ default: m.CodeEditor })),
);

const PROPERTY_REFERENCE: { name: string; usage: string; description: string }[] = [
  { name: 'type', usage: 'todos', description: 'String, Number, Date, Boolean, select, EntityReference ou Object. Atalho: "chave": "String".' },
  { name: 'label', usage: 'opcional', description: 'Nome amigável exibido ao usuário. Se omitido, usa a própria chave.' },
  { name: 'required', usage: 'opcional', description: 'true torna o preenchimento obrigatório.' },
  { name: 'default', usage: 'tipos simples', description: 'Valor padrão quando nada é informado (String, Number, Date, Boolean, select).' },
  { name: 'options', usage: 'select', description: 'Lista de opções, ex.: ["Alta", "Média", "Baixa"].' },
  { name: 'entityType', usage: 'EntityReference', description: 'Entidade referenciada, ex.: "clients", "cases".' },
  { name: 'multi', usage: 'EntityReference', description: 'true permite selecionar vários registros.' },
  { name: 'fields', usage: 'Object', description: 'Objeto com os campos internos, no mesmo formato.' },
];

export const AdvancedParametersEditor: React.FC<AdvancedParametersEditorProps> = (props) => {
  const { parameters, errors, typeOptions, entityOptions, variant, onAdd, onUpdate, onRemove, onClone } = props;
  const vm = useAdvancedParametersEditorViewModel(props);

  return (
    <S.Container>
      <S.Toolbar>
        <S.ModeBtn type="button" $active={vm.mode === 'visual'} onClick={vm.enterVisual}>
          Visual
        </S.ModeBtn>
        <S.ModeBtn type="button" $active={vm.mode === 'json'} onClick={vm.enterJson}>
          JSON (avançado)
        </S.ModeBtn>
      </S.Toolbar>

      {vm.mode === 'visual' ? (
        <WorkflowParametersEditor
          parameters={parameters}
          errors={errors}
          typeOptions={typeOptions}
          entityOptions={entityOptions}
          variant={variant}
          onAdd={onAdd}
          onUpdate={onUpdate}
          onRemove={onRemove}
          onClone={onClone}
        />
      ) : (
        <>
          <S.HintRow>
            <S.Hint>
              Use <code>&quot;chave&quot;: &quot;String&quot;</code> para um campo simples, ou um objeto com{' '}
              <code>type</code>, <code>label</code>, <code>required</code>, <code>default</code> e{' '}
              <code>fields</code> para controle total.
            </S.Hint>
            <S.RefToggle type="button" onClick={vm.toggleReference}>
              {vm.showReference ? <RiArrowDownSLine size={14} /> : <RiArrowRightSLine size={14} />}
              <RiBookOpenLine size={14} /> Referência e exemplo
            </S.RefToggle>
          </S.HintRow>

          {vm.showReference && (
            <S.RefPanel>
              <S.RefTable>
                <S.RefHeadRow>
                  <span>Propriedade</span>
                  <span>Aplica a</span>
                  <span>Para que serve</span>
                </S.RefHeadRow>
                {PROPERTY_REFERENCE.map((item) => (
                  <S.RefRow key={item.name}>
                    <S.RefProp>{item.name}</S.RefProp>
                    <S.RefUsage>{item.usage}</S.RefUsage>
                    <S.RefDesc>{item.description}</S.RefDesc>
                  </S.RefRow>
                ))}
              </S.RefTable>

              <S.RefExampleHeader>Exemplo completo</S.RefExampleHeader>
              <S.RefExample>{PARAMETERS_JSON_EXAMPLE}</S.RefExample>
              <S.RefExampleBtn type="button" onClick={vm.insertExample}>
                <RiFileTextLine size={14} /> Usar este exemplo
              </S.RefExampleBtn>
            </S.RefPanel>
          )}

          <Suspense fallback={<S.Loading>Carregando editor…</S.Loading>}>
            <CodeEditor language="json" value={vm.jsonText} onChange={vm.setJsonText} minHeight="260px" />
          </Suspense>
          {vm.jsonErrors.length > 0 && (
            <S.ErrorBox>
              {vm.jsonErrors.map((error, i) => (
                <S.ErrorLine key={i}>{error}</S.ErrorLine>
              ))}
            </S.ErrorBox>
          )}
          <S.ApplyBtn type="button" onClick={vm.applyJson}>
            <RiCheckLine size={14} /> Aplicar JSON
          </S.ApplyBtn>
        </>
      )}
    </S.Container>
  );
};
