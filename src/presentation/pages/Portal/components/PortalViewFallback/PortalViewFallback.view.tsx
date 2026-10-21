import React from 'react';
import { InfoBanner } from '../../../../components/ui/InfoBanner';
import { useT } from '../../../../shared/i18n/useT';

/** O que aparece no lugar de uma view de extensão que não compilou: o aviso, e o motivo técnico. */
export const PortalViewFallback: React.FC<{ message: string }> = ({ message }) => {
  const t = useT('core.tenant');
  return <InfoBanner variant="warning" message={`${t('portal.view.failed')} (${message})`} />;
};
