import { Button } from '@microteia/ui';
import { useClientPortalViewModel } from './ClientPortal.viewmodel';
import { S } from './ClientPortal.styles';

/**
 * The Client record IN THE PORTAL, contributed by `portalView({ collection, surface: 'detail' }, ...)`.
 * The portal draws "Back" around it; this file only draws what the view model returns.
 */
export default function ClientPortal(props: { collection: string; recordId?: string }) {
  const vm = useClientPortalViewModel(props);

  return (
    <S.Wrapper>
      <S.Header>
        <S.Title>{vm.title}</S.Title>
        {vm.city && <S.Muted>{vm.city}</S.Muted>}
      </S.Header>

      <S.Header>
        <S.Muted>{vm.t('portal.orders')}</S.Muted>
        {vm.canOrder && <Button size="sm" onClick={vm.order}>{vm.t('portal.orders.new')}</Button>}
      </S.Header>

      {!vm.loading && vm.items.length === 0 && <S.Muted>{vm.t('portal.orders.empty')}</S.Muted>}
      {vm.items.map((item) => (
        <S.Order key={item.id} type="button" onClick={() => vm.open(item.id)}>{item.text}</S.Order>
      ))}
    </S.Wrapper>
  );
}
