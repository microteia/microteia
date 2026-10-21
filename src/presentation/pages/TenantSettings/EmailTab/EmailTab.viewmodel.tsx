import { useMemo, useState } from 'react';
import { useT } from '../../../shared/i18n/useT';
import type { SideTabItem } from '../../../components/ui/SideTabs';

export type EmailTabSection = 'server' | 'appearance' | 'templates';

export interface EmailTabViewModel {
  sections: SideTabItem[];
  section: EmailTabSection;
  setSection: (key: string) => void;
  title: string;
  description: string;
}

const SECTIONS: Array<{ key: EmailTabSection; icon: string; label: string; title: string; description: string }> = [
  {
    key: 'server', icon: 'mailSend', label: 'notifications.settings-tab.server',
    title: 'notifications.email.title', description: 'notifications.email.description',
  },
  {
    key: 'appearance', icon: 'palette', label: 'notifications.settings-tab.appearance',
    title: 'notifications.appearance.title', description: 'notifications.appearance.description',
  },
  {
    key: 'templates', icon: 'fileText', label: 'notifications.settings-tab.templates',
    title: 'notifications.templates.title', description: 'notifications.templates.description',
  },
];

/** As partes da configuração de avisos do escritório: um assunto por vez, para a tela não pesar. */
export const useEmailTabViewModel = (): EmailTabViewModel => {
  const t = useT('core.automation');
  const [section, setSection] = useState<EmailTabSection>('server');

  const sections = useMemo(() => SECTIONS.map((one) => ({ key: one.key, icon: one.icon, label: t(one.label) })), [t]);
  const active = SECTIONS.find((one) => one.key === section) ?? SECTIONS[0];

  return {
    sections,
    section,
    setSection: (key) => setSection(key as EmailTabSection),
    title: t(active.title),
    description: t(active.description),
  };
};
