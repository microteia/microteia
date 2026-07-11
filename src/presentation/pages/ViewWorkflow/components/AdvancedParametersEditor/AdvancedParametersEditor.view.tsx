import React, { Suspense, lazy } from 'react';
import { RiCheckLine } from 'react-icons/ri';
import { S } from './AdvancedParametersEditor.styles';
import { WorkflowParametersEditor } from '../WorkflowParametersEditor';
import { useAdvancedParametersEditorViewModel } from './AdvancedParametersEditor.viewmodel';
import type { AdvancedParametersEditorProps } from './AdvancedParametersEditor.viewmodel';

const CodeEditor = lazy(() =>
  import('../../../../components/ui/CodeEditor').then((m) => ({ default: m.CodeEditor })),
);

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
          <S.Hint>
            Use <code>&quot;chave&quot;: &quot;String&quot;</code> para um campo simples, ou um objeto com{' '}
            <code>type</code>, <code>label</code>, <code>required</code>, <code>default</code> e{' '}
            <code>fields</code> para controle total. Um objeto aninhado cria uma estrutura.
          </S.Hint>
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
