import { styled } from 'styled-components';
import { useT } from '@microteia/i18n';
import { usePortalRecords } from '@microteia/portal';

const Count = styled.span`
  font-weight: 700;
  font-size: ${({ theme }) => theme.fontSizes['2xl']};
  color: ${({ theme }) => theme.colors.text};
`;

const Caption = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

/**
 * A card on the portal home: how many orders the guest has. Small on purpose — a card shares the row
 * with others on a computer and takes the whole width on a phone, so it never sets a width of its own.
 */
export default function OpenOrdersWidget() {
  const t = useT('com.microteia.portal-example');
  const { records, loading } = usePortalRecords('portalExampleOrder');

  return (
    <div>
      <Count>{loading ? '…' : records.length}</Count>
      <Caption>{t('portal.widget.orders.caption')}</Caption>
    </div>
  );
}
