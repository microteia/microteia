import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTenant } from '../../../../../../stores/useTenant';
import { useNotification } from '../../../../../../stores/useNotification';
import { useScreenDefinitions } from '../../../../../../stores/useScreenDefinitions';
import { useDI } from '../../../../../../infrastructure/di/useDI';
import { usePointContributions } from '../../../../../shared/extensions/usePointContributions';
import { useLabel, useT } from '../../../../../shared/i18n/useT';
import {
  makeGetPortalHomeSettingsUseCase,
  makeSavePortalHomeSettingsUseCase,
} from '../../../../../../domain/usecases/portal/PortalUseCases';
import { portalLinkOf, type PortalScreenLike } from '../../../../../../domain/schema/portal';
import {
  DEFAULT_PORTAL_LAYOUT,
  PORTAL_VIEW_POINT,
  applyPortalPreference,
  portalLayoutId,
  asPortalViewMetadata,
  portalPageEntryId,
  portalScreenEntryId,
  portalWidgetEntryId,
  type PortalListPreference,
} from '../../../../../../domain/schema/portalExtensionPoints';
import type { ScreenDefinition } from '../../../../../../domain/entities';

export interface PortalHomeListItem {
  id: string;
  title: string;
  /** De onde vem — a tela, ou "Página de extensão". */
  origin: string;
  icon: string;
  visible: boolean;
}

export interface PortalHomeSettingsViewModel {
  loading: boolean;
  welcome: string;
  setWelcome: (value: string) => void;
  /** Os layouts: os dois do kernel e os das extensões instaladas. */
  layouts: Array<{ value: string; label: string }>;
  layout: string;
  setLayout: (value: string) => void;
  menu: PortalHomeListItem[];
  widgets: PortalHomeListItem[];
  move: (list: 'menu' | 'widgets', index: number, delta: -1 | 1) => void;
  toggle: (list: 'menu' | 'widgets', id: string) => void;
  saving: boolean;
  save: () => Promise<void>;
}

interface Candidate {
  id: string;
  title: string;
  origin: string;
  icon: string;
  order?: number;
}

const asScreenLike = (screen: ScreenDefinition): PortalScreenLike => ({
  id: screen.id,
  collection: screen.dataCollection || screen.id,
  titleFieldKey: screen.titleFieldKey,
  fields: screen.fields,
  parentEntity: screen.parentEntity,
  parentFieldKey: screen.parentFieldKey,
  portal: screen.portal,
});

/** A lista na ordem do escritório, com as escondidas no lugar em que estavam — para poder religar. */
const arrange = (candidates: Candidate[], preference: PortalListPreference): PortalHomeListItem[] => {
  const hidden = new Set(preference.hidden);
  return applyPortalPreference(candidates, { order: preference.order, hidden: [] })
    .map((candidate) => ({ ...candidate, visible: !hidden.has(candidate.id) }));
};

/**
 * A home do portal, como o escritório a configura: as boas-vindas, a ordem do menu e a dos cartões. A
 * lista de candidatos é a MESMA que o servidor monta para o convidado — as telas de topo do portal e
 * o que as extensões confiáveis contribuem —, e o que se grava é só a preferência sobre ela.
 */
export const usePortalHomeSettingsViewModel = (): PortalHomeSettingsViewModel => {
  const t = useT('core.tenant');
  const label = useLabel();
  const { currentTenant } = useTenant();
  const { notify } = useNotification();
  const { definitions } = useScreenDefinitions();
  const { portalRepository } = useDI();
  const contributions = usePointContributions(PORTAL_VIEW_POINT);

  const uc = useMemo(() => ({
    get: makeGetPortalHomeSettingsUseCase(portalRepository),
    save: makeSavePortalHomeSettingsUseCase(portalRepository),
  }), [portalRepository]);

  const tenantId = currentTenant?.id ?? null;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [welcome, setWelcome] = useState('');
  const [layout, setLayout] = useState<string>(DEFAULT_PORTAL_LAYOUT);
  const [menuPreference, setMenuPreference] = useState<PortalListPreference>({ order: [], hidden: [] });
  const [widgetPreference, setWidgetPreference] = useState<PortalListPreference>({ order: [], hidden: [] });

  useEffect(() => {
    if (!tenantId) return;
    let active = true;
    uc.get.execute(tenantId)
      .then((settings) => {
        if (!active) return;
        setWelcome(settings.welcome);
        setLayout(settings.layout || DEFAULT_PORTAL_LAYOUT);
        setMenuPreference(settings.menu);
        setWidgetPreference(settings.widgets);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tenantId, uc.get]);

  const menuCandidates = useMemo<Candidate[]>(() => {
    const screens = definitions.filter((screen) => !!screen.portal).map(asScreenLike);
    const screenFor = (entity: string) => screens.find((one) => one.id === entity || one.collection === entity);
    const rootDefinitions = definitions.filter((screen) => {
      if (!screen.portal) return false;
      const link = portalLinkOf(asScreenLike(screen));
      return !link || !screenFor(link.targetEntity);
    });
    const pages = contributions.flatMap((contribution) => {
      const metadata = asPortalViewMetadata(contribution.metadata);
      return metadata?.surface === 'page' && metadata.key
        ? [{
          id: portalPageEntryId(contribution.pluginId, metadata.key),
          title: label(metadata.title ?? metadata.key),
          origin: t('portal.settings.extension-page'),
          icon: metadata.icon ?? 'apps',
          order: metadata.order,
        }]
        : [];
    });
    return [
      ...rootDefinitions.map((screen, index) => ({
        id: portalScreenEntryId(screen.dataCollection || screen.id),
        title: label(screen.titlePlural),
        origin: label(screen.titleSingular),
        icon: screen.icon,
        order: index - rootDefinitions.length,
      })),
      ...pages,
    ];
  }, [definitions, contributions, label, t]);

  const layouts = useMemo(() => [
    { value: 'sidebar', label: t('portal.settings.layout.sidebar') },
    { value: 'top', label: t('portal.settings.layout.top') },
    ...contributions.flatMap((contribution) => {
      const metadata = asPortalViewMetadata(contribution.metadata);
      return metadata?.surface === 'layout' && metadata.key
        ? [{ value: portalLayoutId(contribution.pluginId, metadata.key), label: label(metadata.title ?? metadata.key) }]
        : [];
    }),
  ], [contributions, label, t]);

  const widgetCandidates = useMemo<Candidate[]>(() => contributions.flatMap((contribution) => {
    const metadata = asPortalViewMetadata(contribution.metadata);
    return metadata?.surface === 'widget' && metadata.key
      ? [{
        id: portalWidgetEntryId(contribution.pluginId, metadata.key),
        title: label(metadata.title ?? metadata.key),
        origin: contribution.pluginId,
        icon: 'dashboard',
        order: metadata.order,
      }]
      : [];
  }), [contributions, label]);

  const menu = useMemo(() => arrange(menuCandidates, menuPreference), [menuCandidates, menuPreference]);
  const widgets = useMemo(() => arrange(widgetCandidates, widgetPreference), [widgetCandidates, widgetPreference]);

  const preferenceOf = (items: PortalHomeListItem[]): PortalListPreference => ({
    order: items.map((item) => item.id),
    hidden: items.filter((item) => !item.visible).map((item) => item.id),
  });

  const move = useCallback((list: 'menu' | 'widgets', index: number, delta: -1 | 1) => {
    const items = list === 'menu' ? menu : widgets;
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    (list === 'menu' ? setMenuPreference : setWidgetPreference)(preferenceOf(next));
  }, [menu, widgets]);

  const toggle = useCallback((list: 'menu' | 'widgets', id: string) => {
    const items = (list === 'menu' ? menu : widgets)
      .map((item) => (item.id === id ? { ...item, visible: !item.visible } : item));
    (list === 'menu' ? setMenuPreference : setWidgetPreference)(preferenceOf(items));
  }, [menu, widgets]);

  const save = useCallback(async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      await uc.save.execute(tenantId, { welcome: welcome.trim(), menu: preferenceOf(menu), widgets: preferenceOf(widgets), layout });
      notify(t('portal.settings.saved'), 'success');
    } catch {
      notify(t('portal.failed'), 'error');
    } finally {
      setSaving(false);
    }
  }, [tenantId, uc.save, welcome, menu, widgets, layout, notify, t]);

  return { loading, welcome, setWelcome, layouts, layout, setLayout, menu, widgets, move, toggle, saving, save };
};
