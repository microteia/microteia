import React from 'react';
import { ErrorBoundary } from '../../layout/ErrorBoundary';
import { WidgetRenderer } from '../WidgetRenderer';
import { useWidgetSurfaceViewModel, type SurfaceSlot } from './WidgetSurface.viewmodel';
import { S } from './WidgetSurface.styles';

import { useT } from '../../../shared/i18n/useT';
interface WidgetSurfaceProps {
  /** O nome da superfície. Quem contribui um widget declara este mesmo nome. */
  surface: string;
  /** Texto do vazio, quando nada está registrado ou tudo está desligado. */
  emptyMessage?: string;
}

const logWidgetFailure = (key: string) => (error: Error): void => {
  console.error(`[widget ${key}]`, error);
};

const SurfaceWidgetSlot: React.FC<{ slot: SurfaceSlot }> = ({ slot }) => {
  const t = useT('core.ui');
  const Component = slot.widget.component;
  return (
    <S.Slot $span={slot.span}>
      <ErrorBoundary
        fallback={<S.Failure>{t('widget.render-failed', { title: slot.widget.title })}</S.Failure>}
        onError={logWidgetFailure(slot.key)}
      >
        {Component ? <Component /> : <WidgetRenderer spec={slot.widget.spec} />}
      </ErrorBoundary>
    </S.Slot>
  );
};

/**
 * A superfície de widgets: uma grade que renderiza o que as extensões registraram, na ordem e na
 * largura que a configuração mandar. Não conhece nenhum widget — só o NOME da superfície.
 *
 * Cada widget vive dentro do seu próprio limite de erro: um cartão que quebra vira um aviso naquele
 * espaço, e a tela continua de pé. Com dezenas de extensões, essa é a diferença entre um painel com
 * um cartão a menos e um painel em branco.
 */
export const WidgetSurface: React.FC<WidgetSurfaceProps> = ({ surface, emptyMessage }) => {
  const vm = useWidgetSurfaceViewModel(surface);
  const t = useT('core.ui');

  if (vm.slots.length === 0) {
    return (
      <S.Empty>
        {vm.isAllDisabled
          ? t('widget.none-active')
          : (emptyMessage ?? t('widget.none-available'))}
      </S.Empty>
    );
  }

  return (
    <S.Grid>
      {vm.slots.map((slot) => (
        <SurfaceWidgetSlot key={slot.key} slot={slot} />
      ))}
    </S.Grid>
  );
};
