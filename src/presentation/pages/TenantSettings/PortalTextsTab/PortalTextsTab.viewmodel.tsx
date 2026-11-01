import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTenant } from '../../../../stores/useTenant';
import { useAuth } from '../../../../stores/useAuth';
import { useLocale } from '../../../../stores/useLocale';
import { useNotification } from '../../../../stores/useNotification';
import { useContributions } from '../../../../stores/useKernel';
import { useDI } from '../../../../infrastructure/di/useDI';
import { useLabel, useLocaleFormat, useT } from '../../../shared/i18n/useT';
import { errorParamsOf } from '../../../../domain/errors/LocalizedError';
import type { DeletionActor } from '../../../../domain/entities';
import { PORTAL_VIEW_POINT } from '../../../../domain/schema/portalExtensionPoints';
import { I18N_MESSAGES_POINT, messageBundlesOf } from '../../../../domain/schema/i18n/extensionPoints';
import { normalizeLocale } from '../../../../domain/schema/i18n/localeNegotiation';
import { PORTAL_TEXT_MAX_LENGTH, type PortalTextOverride } from '../../../../domain/schema/portalText';
import { languageTitle } from '../../../../domain/usecases/i18n/translationPackage';
import {
  makeListPortalTextsUseCase,
  makeRestorePortalTextUseCase,
  makeSavePortalTextUseCase,
} from '../../../../domain/usecases/portal/PortalUseCases';
import { packageLocalesOf, packageTextOf, portalTextEntries } from './portalTextEntries';
import type { ResolvedPortalNode } from '../../Portal/resolvePortalTemplate';

export interface PortalTextItem {
  ref: string;
  /** Onde o texto aparece: os títulos das páginas e cartões que o citam. */
  title: string;
  /** De que extensão(ões) vem a declaração. */
  origin: string;
  /** Os idiomas em que o escritório escreveu o próprio texto, já por extenso. Vazio = o do pacote. */
  edited: string;
}

export interface PortalTextEditor {
  ref: string;
  title: string;
  locale: string;
  localeOptions: Array<{ value: string; label: string }>;
  text: string;
  /** Nenhum pacote instalado traz o texto neste idioma — sem o do escritório, a página não aparece. */
  missingInPackage: boolean;
  /** O escritório já trocou o texto deste idioma — há o que desfazer. */
  edited: boolean;
  dirty: boolean;
  /** Há texto, mudou, cabe no teto, e nada está sendo gravado. */
  canSave: boolean;
  /** "1.234 de 100.000 caracteres". */
  counter: string;
  overLimit: boolean;
  /** O texto como o convidado o verá — o mesmo desenho do portal, sem HTML e sem imagem. */
  preview: ResolvedPortalNode[];
}

export interface PortalTextsTabViewModel {
  loading: boolean;
  items: PortalTextItem[];
  open: (ref: string) => void;
  close: () => void;
  editor: PortalTextEditor | null;
  setLocale: (locale: string) => void;
  setText: (text: string) => void;
  saving: boolean;
  save: () => Promise<void>;
  restoreOpen: boolean;
  requestRestore: () => void;
  cancelRestore: () => void;
  confirmRestore: () => Promise<void>;
  /** O idioma do texto que o "voltar ao do pacote" vai desfazer, por extenso. */
  restoreLanguage: string;
}

/**
 * Os textos do portal que o escritório pode trocar (`portal.content`). A lista vem das declarações das
 * extensões ligadas; o texto do pacote vem dos bundles instalados; e o que se grava é só o texto do
 * escritório, por idioma — que vence o do pacote naquele idioma, e some com "voltar ao texto do pacote".
 */
export const usePortalTextsTabViewModel = (): PortalTextsTabViewModel => {
  const t = useT('core.tenant');
  const label = useLabel();
  const { formatNumber } = useLocaleFormat();
  const { currentTenant } = useTenant();
  const { user, effectiveName } = useAuth();
  const { locale: uiLocale } = useLocale();
  const { notify } = useNotification();
  const { portalRepository } = useDI();
  const portalContributions = useContributions(PORTAL_VIEW_POINT);
  const messageContributions = useContributions(I18N_MESSAGES_POINT);

  const uc = useMemo(() => ({
    list: makeListPortalTextsUseCase(portalRepository),
    save: makeSavePortalTextUseCase(portalRepository),
    restore: makeRestorePortalTextUseCase(portalRepository),
  }), [portalRepository]);

  const tenantId = currentTenant?.id ?? null;
  const [loading, setLoading] = useState(true);
  const [overrides, setOverrides] = useState<PortalTextOverride[]>([]);
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [chosenLocale, setChosenLocale] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ key: string; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!tenantId) return;
    let active = true;
    uc.list.execute(tenantId)
      .then((loaded) => { if (active) setOverrides(loaded); })
      .catch(() => { if (active) notify(t('portal.texts.failed'), 'error'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tenantId, uc.list, revision, notify, t]);

  const entries = useMemo(() => portalTextEntries(portalContributions), [portalContributions]);
  const bundles = useMemo(() => messageBundlesOf(messageContributions), [messageContributions]);
  const overrideOf = useCallback(
    (ref: string) => overrides.find((override) => override.ref === ref) ?? null,
    [overrides],
  );

  const items = useMemo<PortalTextItem[]>(() => entries.map((entry) => ({
    ref: entry.ref,
    title: entry.titles.map((title) => label(title)).join(' · '),
    origin: entry.pluginIds.join(', '),
    edited: Object.keys(overrideOf(entry.ref)?.texts ?? {}).map(languageTitle).join(', '),
  })), [entries, overrideOf, label]);

  const selected = items.find((item) => item.ref === selectedRef) ?? null;
  const locale = chosenLocale ?? normalizeLocale(uiLocale);

  const editor = useMemo<PortalTextEditor | null>(() => {
    if (!selected) return null;
    const override = overrideOf(selected.ref);
    const packageText = packageTextOf(selected.ref, locale, bundles);
    const baseline = override?.texts[locale] ?? packageText ?? '';
    const key = `${selected.ref}|${locale}`;
    const text = draft?.key === key ? draft.text : baseline;
    const locales = [...new Set([
      normalizeLocale(uiLocale),
      locale,
      ...packageLocalesOf(selected.ref, bundles),
      ...Object.keys(override?.texts ?? {}),
    ])];
    return {
      ref: selected.ref,
      title: selected.title,
      locale,
      localeOptions: locales.map((value) => ({ value, label: languageTitle(value) })),
      text,
      missingInPackage: packageText === null,
      edited: override?.texts[locale] !== undefined,
      dirty: text !== baseline,
      canSave: !saving && text !== baseline && text.trim() !== '' && text.length <= PORTAL_TEXT_MAX_LENGTH,
      counter: t('portal.texts.counter', { length: formatNumber(text.length), max: formatNumber(PORTAL_TEXT_MAX_LENGTH) }),
      overLimit: text.length > PORTAL_TEXT_MAX_LENGTH,
      preview: text.trim() === '' ? [] : [{ kind: 'markdown', key: 'preview', content: text }],
    };
  }, [selected, overrideOf, locale, bundles, draft, uiLocale, t, formatNumber, saving]);

  const open = useCallback((ref: string) => {
    setSelectedRef(ref);
    setChosenLocale(null);
    setDraft(null);
  }, []);

  const close = useCallback(() => {
    setSelectedRef(null);
    setDraft(null);
  }, []);

  const setLocale = useCallback((value: string) => setChosenLocale(value || null), []);

  const setText = useCallback((text: string) => {
    if (selectedRef) setDraft({ key: `${selectedRef}|${locale}`, text });
  }, [selectedRef, locale]);

  const actor = useMemo<DeletionActor>(
    () => ({ uid: user?.id ?? '', name: effectiveName, photoURL: user?.photoURL ?? '' }),
    [user, effectiveName],
  );

  const save = useCallback(async () => {
    if (!tenantId || !editor) return;
    setSaving(true);
    try {
      await uc.save.execute(tenantId, { ref: editor.ref, locale: editor.locale, text: editor.text, actor });
      setDraft(null);
      setRevision((value) => value + 1);
      notify(t('portal.texts.saved'), 'success');
    } catch (error) {
      notify(label((error as Error).message, errorParamsOf(error)), 'error');
    } finally {
      setSaving(false);
    }
  }, [tenantId, editor, uc.save, actor, notify, t, label]);

  const requestRestore = useCallback(() => setRestoreOpen(true), []);
  const cancelRestore = useCallback(() => setRestoreOpen(false), []);

  const confirmRestore = useCallback(async () => {
    setRestoreOpen(false);
    if (!tenantId || !editor) return;
    setSaving(true);
    try {
      await uc.restore.execute(tenantId, { ref: editor.ref, locale: editor.locale, actor });
      setDraft(null);
      setRevision((value) => value + 1);
      notify(t('portal.texts.restored'), 'success');
    } catch {
      notify(t('portal.texts.failed'), 'error');
    } finally {
      setSaving(false);
    }
  }, [tenantId, editor, uc.restore, actor, notify, t]);

  return {
    loading,
    items,
    open,
    close,
    editor,
    setLocale,
    setText,
    saving,
    save,
    restoreOpen,
    requestRestore,
    cancelRestore,
    confirmRestore,
    restoreLanguage: languageTitle(locale),
  };
};
