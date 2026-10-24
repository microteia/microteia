import { styled } from 'styled-components';
import { useT } from '@microteia/i18n';
import { usePortalNavigation, usePortalRecords } from '@microteia/portal';

const ORDER_COLLECTION = 'portalExampleOrder';
const SHOWN = 3;

const Count = styled.span`
  font-weight: 700;
  font-size: ${({ theme }) => theme.fontSizes['2xl']};
  color: ${({ theme }) => theme.colors.text};
`;

const Caption = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Rows = styled.ul`
  list-style: none;
  margin: ${({ theme }) => theme.spacing.sm} 0 0;
  padding: 0;
`;

const Row = styled.button`
  display: block;
  width: 100%;
  min-height: 44px;
  padding: ${({ theme }) => theme.spacing.sm} 0;
  border: none;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  background: none;
  text-align: left;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.text};
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

/**
 * A card on the portal home: how many orders the guest has, and the latest ones. Tapping one opens it
 * — `openRecord` works from the home too: the portal takes the guest to the order, and Back returns
 * here. Small on purpose — a card shares the row with others on a computer and takes the whole width
 * on a phone, so it never sets a width of its own.
 */
export default function OpenOrdersWidget() {
  const t = useT('com.microteia.portal-example');
  const { records, loading } = usePortalRecords(ORDER_COLLECTION);
  const navigation = usePortalNavigation();

  const latest = [...records]
    .sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0))
    .slice(0, SHOWN);

  return (
    <div>
      <Count>{loading ? '…' : records.length}</Count>
      <Caption>{t('portal.widget.orders.caption')}</Caption>
      {latest.length > 0 && (
        <Rows>
          {latest.map((order) => (
            <li key={order.recordId}>
              <Row type="button" onClick={() => navigation.openRecord(ORDER_COLLECTION, order.recordId)}>
                {t('portal.orders.quantity', {
                  count: String(order.data.quantity ?? 1),
                  item: String(order.data.item ?? order.title),
                })}
              </Row>
            </li>
          ))}
        </Rows>
      )}
    </div>
  );
}
