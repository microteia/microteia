import { useCallback, useId, useMemo, useState } from 'react';
import { useNotification } from '../../../../stores/useNotification';
import { useT } from '../../../shared/i18n/useT';
import { fileNameFromUrl } from '../../../../domain/services/customFieldValues';
import { fileConfigIsImageOnly, resolveFileConfig } from '../../../../domain/schema/fieldRules';
import type { FieldFileConfig } from '../../../../domain/schema/fieldRules';

export interface FileInputProps {
  /** A URL de download gravada, ou '' quando o campo está vazio. */
  value: string;
  /** A URL nova, ou '' ao remover. */
  onChange: (value: string) => void;
  /** Ausente = somente-leitura: o campo mostra o que tem e não oferece envio. */
  upload?: (file: File) => Promise<string>;
  config?: FieldFileConfig | null;
  disabled?: boolean;
}

export interface FileInputViewModel {
  fileName: string;
  hasValue: boolean;
  isUploading: boolean;
  /** Mostra o botão de enviar: há upload ligado E o campo não está desabilitado. */
  canUpload: boolean;
  /**
   * O formulário NÃO sabe gravar arquivo — distinto de `canUpload`, que também é falso num campo
   * calculado ou num formulário desabilitado. Só este caso merece explicação na tela: o outro é o
   * comportamento normal de um campo desabilitado.
   */
  uploadUnavailable: boolean;
  showImagePreview: boolean;
  /** O `accept` do input nativo, montado das extensões declaradas. Vazio = qualquer arquivo. */
  acceptAttribute: string | undefined;
  acceptedHint: string | null;
  /**
   * O `<label>` do botão aponta para o input escondido por este id — não há `ref` aqui, e é
   * deliberado: um ViewModel que devolve `ref` contamina TODO o objeto para o React Compiler, e a
   * view não conseguiria mais ler nem uma string dele durante o render.
   */
  inputId: string;
  handlePick: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleRemove: () => void;
}

const extensionOf = (name: string): string => {
  const parts = name.toLowerCase().split('.');
  return parts.length > 1 ? (parts.pop() as string) : '';
};

export const useFileInputViewModel = (props: FileInputProps): FileInputViewModel => {
  const { value, onChange, upload, config, disabled } = props;
  const { notify } = useNotification();
  const t = useT('core.ui');
  const inputId = useId();
  const [isUploading, setIsUploading] = useState(false);

  const { extensions, maxSizeMb } = useMemo(() => resolveFileConfig(config), [config]);
  const showImagePreview = useMemo(() => fileConfigIsImageOnly(config), [config]);

  const handlePick = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // O input é zerado em TODO caminho: sem isso, escolher o mesmo arquivo de novo não dispara evento.
    event.target.value = '';
    if (!file || !upload) return;

    if (extensions.length > 0 && !extensions.includes(extensionOf(file.name))) {
      notify(t('file.invalid-type', { extensions: extensions.join(', ') }), 'error');
      return;
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      notify(t('file.too-large', { size: String(maxSizeMb) }), 'error');
      return;
    }

    setIsUploading(true);
    try {
      onChange(await upload(file));
    } catch (err) {
      console.error('[FileInput upload]', err);
      notify(t('file.upload-failed'), 'error');
    } finally {
      setIsUploading(false);
    }
  }, [upload, extensions, maxSizeMb, notify, t, onChange]);

  const handleRemove = useCallback(() => {
    onChange('');
  }, [onChange]);

  return {
    fileName: value ? fileNameFromUrl(value) : '',
    hasValue: value !== '',
    isUploading,
    canUpload: !!upload && !disabled,
    uploadUnavailable: !upload,
    showImagePreview,
    acceptAttribute: extensions.length > 0 ? extensions.map((e) => `.${e}`).join(',') : undefined,
    acceptedHint: extensions.length > 0
      ? t('file.accepted', { extensions: extensions.join(', '), size: String(maxSizeMb) })
      : null,
    inputId,
    handlePick,
    handleRemove,
  };
};
