import { useCallback, useMemo, useState } from 'react';
import { useInstalledExtensions } from '../../../stores/useInstalledExtensions';
import { useLocale } from '../../../stores/useLocale';
import { useNotification } from '../../../stores/useNotification';
import { useAuth } from '../../../stores/useAuth';
import { useTenant } from '../../../stores/useTenant';
import { useContributions } from '../../../stores/useKernel';
import { I18N_MESSAGES_POINT, messageBundlesOf } from '../../../domain/schema/i18n/extensionPoints';
import { DEFAULT_LOCALE, isValidLocale, normalizeLocale } from '../../../domain/schema/i18n/localeNegotiation';
import {
  buildTranslationPackage,
  isTranslationOnlyPackage,
  languageTitle,
  resolveLanguageUsage,
  suggestedPluginId,
  translationKeyCount,
} from '../../../domain/usecases/i18n/translationPackage';
import { parsePackage, serializePackage } from '../../../domain/usecases/plugins/packageSerialization';
import { validatePluginPackage } from '../../../sdk/validate';

import { useT, useLabel } from '../../shared/i18n/useT';
export interface InstalledLanguage {
  id: string;
  name: string;
  locale: string;
  keyCount: number;
  active: boolean;
  /** É o pacote que está de fato ditando o idioma agora. Só um pode estar. */
  inUse: boolean;
  /** Contribui para o idioma corrente, mas outro pacote tem precedência sobre as mesmas chaves. */
  shadowed: boolean;
}

export interface TranslationsViewModel {
  canManage: boolean;
  languages: InstalledLanguage[];
  targetLocale: string;
  setTargetLocale: (locale: string) => void;
  targetLocaleName: string;
  isTargetValid: boolean;
  keyCount: number;
  download: () => void;
  pickFile: () => void;
  busy: boolean;
}

export const useTranslationsViewModel = (): TranslationsViewModel => {
  const t = useT('core.i18n');
  const label = useLabel();
  const contributions = useContributions(I18N_MESSAGES_POINT);
  const { installed, install } = useInstalledExtensions();
  const { locale } = useLocale();
  const { notify } = useNotification();
  const { user, effectiveName } = useAuth();
  const { tenantRole } = useTenant();

  const [targetLocale, setTargetLocale] = useState('');
  const [busy, setBusy] = useState(false);

  const canManage = tenantRole === 'admin';

  const bundles = useMemo(() => messageBundlesOf(contributions), [contributions]);

  /**
   * Os idiomas instalados são apenas LISTADOS — sem ação de remover. Uma tradução é uma extensão, e
   * quem remove extensão é a tela de Extensões. Repetir o gesto aqui criaria uma segunda porta para
   * a mesma operação, com o mesmo risco e metade do contexto (nada aqui mostra que a extensão pode
   * trazer outras coisas junto).
   *
   * "Em uso" e "Sem efeito" se decidem por CHAVE DISPUTADA, e não por "é o segundo pacote deste
   * idioma". A regra anterior marcava o primeiro e chamava todos os outros de sem efeito — o que
   * era certo quando dois pacotes do mesmo idioma sempre significavam conflito, e passou a ser
   * falso no dia em que um pacote cobriu só `core.ui` e outro só `core.license`: namespaces
   * disjuntos, os dois valendo, nenhum sombreando nada.
   *
   * Então: um pacote está EM USO se ao menos uma chave dele sobrevive à fusão, e SEM EFEITO se
   * nenhuma sobrevive. A ordem é a mesma de `buildMessageCatalog` — quem chega primeiro vence.
   */
  const languages = useMemo<InstalledLanguage[]>(() => {
    const rows = installed
      .map((extension) => {
        const packBundles = messageBundlesOf(extension.package.manifest.contributes ?? []);
        if (packBundles.length === 0) return null;
        return {
          id: extension.id,
          name: extension.package.manifest.name || extension.id,
          locale: normalizeLocale(packBundles[0].locale),
          keyCount: translationKeyCount(extension.package),
          active: extension.active,
          inUse: false,
          shadowed: false,
          keys: packBundles.flatMap((packBundle) =>
            Object.keys(packBundle.messages).map((key) => `${packBundle.namespace}/${key}`),
          ),
        };
      })
      .filter((row): row is InstalledLanguage & { keys: string[] } => row !== null)
      .sort((a, b) => (a.id < b.id ? -1 : 1));

    const usage = resolveLanguageUsage(rows, locale);
    return rows.map((row): InstalledLanguage => ({
      id: row.id,
      name: row.name,
      locale: row.locale,
      keyCount: row.keyCount,
      active: row.active,
      inUse: usage[row.id]?.inUse ?? false,
      shadowed: usage[row.id]?.shadowed ?? false,
    }));
  }, [installed, locale]);

  const isTargetValid = isValidLocale(targetLocale) && normalizeLocale(targetLocale) !== DEFAULT_LOCALE;

  const targetLocaleName = useMemo(
    () => (isTargetValid ? languageTitle(targetLocale) : ''),
    [isTargetValid, targetLocale],
  );

  /**
   * O que se baixa é uma EXTENSÃO, no mesmo formato de qualquer outra — não um formato de tradução.
   * Vem com os textos preenchidos: a tradução que já existe para o idioma, ou o texto-fonte para o
   * tradutor sobrescrever por cima.
   */
  const draft = useMemo(
    () =>
      isTargetValid
        ? buildTranslationPackage({ bundles, targetLocale, pluginId: suggestedPluginId(targetLocale) })
        : null,
    [bundles, isTargetValid, targetLocale],
  );

  const download = useCallback(() => {
    if (!draft) return;
    const blob = new Blob([serializePackage(draft)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${draft.manifest.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [draft]);

  /**
   * Importar aqui é o MESMO que importar em Extensões — parse, validação de manifest, validação
   * referencial, guarda de tamanho e `install`. A única coisa que esta tela acrescenta é recusar um
   * pacote que não seja de tradução, porque quem está aqui veio instalar um idioma.
   */
  const importFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      setBusy(true);
      try {
        const parsed = parsePackage(await file.text());
        if (!parsed.ok) {
          notify(parsed.error, 'error');
          return;
        }

        const pkg = parsed.package;
        if (!isTranslationOnlyPackage(pkg)) {
          notify(
            t('translations.not-a-language-package'),
            'error',
          );
          return;
        }

        const [problem] = validatePluginPackage(pkg);
        if (problem) {
          notify(label(problem.message, problem.messageParams), 'error');
          return;
        }

        await install({
          package: pkg,
          source: 'private',
          version: pkg.manifest.version,
          authorId: user?.id ?? '',
          authorName: effectiveName,
          authorPhotoURL: null,
        });

        notify(
          t('translations.installed.success', {
            name: pkg.manifest.name,
            count: translationKeyCount(pkg),
          }),
          'success',
        );
      } catch (error) {
        notify((error as Error).message, 'error');
      } finally {
        setBusy(false);
      }
    },
    [notify, install, user, effectiveName, label, t],
  );

  /**
   * O `<input type="file">` é criado no HANDLER, e não montado escondido na View: o ViewModel teria
   * de devolver uma ref, e o React Compiler trata qualquer leitura do objeto devolvido como leitura
   * de ref durante o render — `vm.languages.map(...)` passaria a acusar "Cannot access refs during
   * render". É o mesmo caminho que `download` já faz com o `<a>`.
   */
  const pickFile = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => void importFile(input.files?.[0] ?? null);
    input.click();
  }, [importFile]);

  return {
    canManage,
    languages,
    targetLocale,
    setTargetLocale,
    targetLocaleName,
    isTargetValid,
    keyCount: draft ? translationKeyCount(draft) : 0,
    download,
    pickFile,
    busy,
  };
};
