import { WidgetSurface } from '@microteia/ui';
import { useT } from '@microteia/i18n';
import { styled } from 'styled-components';

const Page = styled.div`
  padding: ${({ theme }) => theme.spacing.xl};
  height: 100%;
  overflow-y: auto;
`;

export default function DashboardView() {
  const t = useT('com.microteia.dashboard');

  return (
    <Page>
      <WidgetSurface surface="dashboard" emptyMessage={t('view.empty')} />
    </Page>
  );
}
