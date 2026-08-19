import { WidgetSurface } from '@microteia/ui';
import { styled } from 'styled-components';

const Page = styled.div`
  padding: ${({ theme }) => theme.spacing.xl};
  height: 100%;
  overflow-y: auto;
`;

export default function DashboardView() {
  return (
    <Page>
      <WidgetSurface
        surface="dashboard"
        emptyMessage="Nenhum widget disponível. Instale extensões (Processos, Prazos, Financeiro…) para o Dashboard ganhar conteúdo."
      />
    </Page>
  );
}
