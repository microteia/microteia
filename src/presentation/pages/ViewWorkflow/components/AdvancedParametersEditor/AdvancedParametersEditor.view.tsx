import React, { Suspense, lazy } from 'react';
import { RiCheckLine, RiBookOpenLine, RiArrowDownSLine, RiArrowRightSLine, RiFileTextLine } from 'react-icons/ri';
import { S } from './AdvancedParametersEditor.styles';
import { WorkflowParametersEditor } from '../WorkflowParametersEditor';
import { useAdvancedParametersEditorViewModel, parametersJsonExample } from './AdvancedParametersEditor.viewmodel';
import type { AdvancedParametersEditorProps } from './AdvancedParametersEditor.viewmodel';

import { useT, type TranslateFn } from '../../../../shared/i18n/useT';

const CodeEditor = lazy(() =>
  import('../../../../components/ui/CodeEditor').then((m) => ({ default: m.CodeEditor })),
);

const propertyReference = (t: TranslateFn): { name: string; usage: string; description: string }[] => [
  { name: 'type', usage: t('parameter.ref.usage.all'), description: t('parameter.ref.type') },
  { name: 'label', usage: t('parameter.ref.usage.optional'), description: t('parameter.ref.label') },
  { name: 'required', usage: t('parameter.ref.usage.optional'), description: t('parameter.ref.required') },
  { name: 'list', usage: t('parameter.ref.usage.all'), description: t('parameter.ref.list') },
  { name: 'default', usage: t('parameter.ref.usage.simple'), description: t('parameter.ref.default') },
  { name: 'options', usage: 'select', description: t('parameter.ref.options') },
  { name: 'entityType', usage: 'EntityReference', description: t('parameter.ref.entity-type') },
  { name: 'lookupCollection', usage: 'lookup', description: t('parameter.ref.lookup-collection') },
  { name: 'fields', usage: 'Object', description: t('parameter.ref.fields') },
];

export const AdvancedParametersEditor: React.FC<AdvancedParametersEditorProps> = (props) => {
  const { parameters, errors, typeOptions, entityOptions, lookupOptions, variant, onAdd, onUpdate, onRemove, onClone } = props;
  const vm = useAdvancedParametersEditorViewModel(props);
  const t = useT('core.automation');

  return (
    <S.Container>
      <S.Toolbar>
        <S.ModeBtn type="button" $active={vm.mode === 'visual'} onClick={vm.enterVisual}>
          {t('parameter.mode.visual')}
        </S.ModeBtn>
        <S.ModeBtn type="button" $active={vm.mode === 'json'} onClick={vm.enterJson}>
          {t('parameter.mode.json')}
        </S.ModeBtn>
      </S.Toolbar>

      {vm.mode === 'visual' ? (
        <WorkflowParametersEditor
          parameters={parameters}
          errors={errors}
          typeOptions={typeOptions}
          entityOptions={entityOptions}
          lookupOptions={lookupOptions}
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
              <RiBookOpenLine size={14} /> {t('parameter.reference')}
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
                {propertyReference(t).map((item) => (
                  <S.RefRow key={item.name}>
                    <S.RefProp>{item.name}</S.RefProp>
                    <S.RefUsage>{item.usage}</S.RefUsage>
                    <S.RefDesc>{item.description}</S.RefDesc>
                  </S.RefRow>
                ))}
              </S.RefTable>

              <S.RefExampleHeader>Exemplo completo</S.RefExampleHeader>
              <S.RefExample>{parametersJsonExample(t)}</S.RefExample>
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
