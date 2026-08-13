import React from 'react';
import { ErrorBoundary } from '../../layout/ErrorBoundary';
import { WidgetRenderer } from '../WidgetRenderer';
import { useWidgetSurfaceViewModel, type SurfaceSlot } from './WidgetSurface.viewmodel';
import { S } from './WidgetSurface.styles';

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
  const Component = slot.widget.component;
  return (
    <S.Slot $span={slot.span}>
      <ErrorBoundary
        fallback={<S.Failure>Não foi possível exibir “{slot.widget.title}”.</S.Failure>}
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

  if (vm.slots.length === 0) {
    return (
      <S.Empty>
        {vm.isAllDisabled
          ? 'Nenhum widget ativo. Ative os que você quer ver em Configurações.'
          : (emptyMessage ?? 'Nenhum widget disponível. Instale uma extensão que ofereça widgets.')}
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
