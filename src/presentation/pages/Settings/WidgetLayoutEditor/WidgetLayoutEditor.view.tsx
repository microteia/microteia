import React from 'react';
import { RiArrowDownLine, RiArrowUpLine } from 'react-icons/ri';
import { Checkbox } from '../../../components/ui/Checkbox';
import { getScreenIcon } from '../../../shared/screenIcons';
import { S } from './WidgetLayoutEditor.styles';
import { useT } from '../../../shared/i18n/useT';
import {
  useWidgetLayoutEditorViewModel,
  type WidgetLayoutEditorProps,
} from './WidgetLayoutEditor.viewmodel';

/**
 * O editor da configuração `widgets`: quais cartões aparecem na superfície, em que ordem e com que
 * largura. Ele não conhece widget nenhum — lista o que está registrado naquela superfície.
 */
export const WidgetLayoutEditor: React.FC<WidgetLayoutEditorProps> = (props) => {
  const t = useT('core.settings');
  const vm = useWidgetLayoutEditorViewModel(props);

  if (vm.items.length === 0) {
    return <S.Empty>{t('settings.widgets.empty')}</S.Empty>;
  }

  return (
    <S.List>
      {vm.items.map((item) => (
        <S.Item key={item.key} $enabled={item.enabled}>
          {item.icon && <S.Icon>{getScreenIcon(item.icon, 18)}</S.Icon>}
          <S.Info>
            <Checkbox
              checked={item.enabled}
              label={item.title}
              onChange={() => vm.toggle(item.key)}
              disabled={props.disabled}
            />
            {item.description && <S.Description>{item.description}</S.Description>}
          </S.Info>
          <S.Controls>
            <S.SpanGroup>
              {vm.spanOptions.map((span) => (
                <S.SpanButton
                  key={span}
                  type="button"
                  $active={item.span === span}
                  disabled={props.disabled}
                  onClick={() => vm.setSpan(item.key, span)}
                >
                  {span}
                </S.SpanButton>
              ))}
            </S.SpanGroup>
            <S.IconButton
              type="button"
              disabled={props.disabled || item.isFirst}
              onClick={() => vm.move(item.key, -1)}
              title={t('core.ui/action.move-up')}
            >
              <RiArrowUpLine size={14} />
            </S.IconButton>
            <S.IconButton
              type="button"
              disabled={props.disabled || item.isLast}
              onClick={() => vm.move(item.key, 1)}
              title={t('core.ui/action.move-down')}
            >
              <RiArrowDownLine size={14} />
            </S.IconButton>
          </S.Controls>
        </S.Item>
      ))}
    </S.List>
  );
};
