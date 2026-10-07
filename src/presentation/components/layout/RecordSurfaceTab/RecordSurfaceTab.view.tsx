import React from 'react';
import { S } from './RecordSurfaceTab.styles';
import { ErrorBoundary } from '../ErrorBoundary';
import { WidgetRenderer } from '../../ui/WidgetRenderer';
import type { SurfaceTabDescriptor } from '../../../shared/settings/useSettingsCatalog';
import type { RecordTabProps } from '../../../../domain/schema/ui/uiExtensionPoints';
import { useT } from '../../../shared/i18n/useT';

interface RecordSurfaceTabProps {
  tab: SurfaceTabDescriptor;
  recordProps: RecordTabProps;
}

const logTabFailure = (key: string) => (error: Error): void => {
  console.error(`[record tab ${key}]`, error);
};

/**
 * Uma aba contribuída no detalhe de um registro, dentro do próprio limite de erro: a aba que quebra
 * vira um aviso naquele espaço, e o registro continua editável. A view de código recebe o registro
 * aberto; a Widget DSL não recebe dado, como em toda superfície.
 */
export const RecordSurfaceTab: React.FC<RecordSurfaceTabProps> = ({ tab, recordProps }) => {
  const t = useT('core.ui');
  const Component = tab.component as React.ComponentType<RecordTabProps> | undefined;
  return (
    <ErrorBoundary
      fallback={<S.Failure>{t('tab.render-failed', { title: tab.title })}</S.Failure>}
      onError={logTabFailure(tab.key)}
    >
      {Component ? <Component {...recordProps} /> : <WidgetRenderer spec={tab.spec} />}
    </ErrorBoundary>
  );
};
