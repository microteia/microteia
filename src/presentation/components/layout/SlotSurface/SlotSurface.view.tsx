import React from 'react';
import { S } from './SlotSurface.styles';
import { useSlotSurfaceViewModel } from './SlotSurface.viewmodel';
import type { SurfaceSlotDescriptor } from '../../../shared/settings/useSettingsCatalog';
import { ErrorBoundary } from '../ErrorBoundary';
import { WidgetRenderer } from '../../ui/WidgetRenderer';
import { useT } from '../../../shared/i18n/useT';

interface SlotSurfaceProps {
  /** O nome da região. Quem contribui um trecho declara este mesmo nome. */
  surface: string;
}

const logSlotFailure = (key: string) => (error: Error): void => {
  console.error(`[slot ${key}]`, error);
};

const SlotItem: React.FC<{ slot: SurfaceSlotDescriptor }> = ({ slot }) => {
  const t = useT('core.ui');
  const Component = slot.component;
  return (
    <S.Item>
      <ErrorBoundary
        fallback={<S.Failure>{t('slot.render-failed', { title: slot.title })}</S.Failure>}
        onError={logSlotFailure(slot.key)}
      >
        {Component ? <Component /> : <WidgetRenderer spec={slot.spec} />}
      </ErrorBoundary>
    </S.Item>
  );
};

/**
 * Uma região do shell: renderiza o que as extensões registraram naquele nome, na ordem que a
 * configuração mandar. Não conhece nenhum trecho — só o NOME da região.
 *
 * Região vazia não desenha NADA, nem um espaço: ela é a regra, não a exceção — quase toda instalação
 * não contribui trecho nenhum, e um vazio visível somaria seis buracos ao shell de todo mundo.
 */
export const SlotSurface: React.FC<SlotSurfaceProps> = ({ surface }) => {
  const vm = useSlotSurfaceViewModel(surface);

  if (vm.slots.length === 0) return null;

  return (
    <S.Row>
      {vm.slots.map((slot) => (
        <SlotItem key={slot.key} slot={slot} />
      ))}
    </S.Row>
  );
};
