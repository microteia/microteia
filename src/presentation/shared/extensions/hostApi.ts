import React, { useCallback, useMemo } from 'react';
import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import styled, { useTheme } from 'styled-components';
import { Button } from '../../components/ui/Button';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { CompositeFilter } from '../../components/ui/CompositeFilter';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { MultiSearchSelect } from '../../components/ui/MultiSearchSelect';
import { DateInput } from '../../components/ui/DateInput';
import { Badge, ColorDot } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Input, Textarea } from '../../components/ui/Input';
import { MaskedInput } from '../../components/ui/MaskedInput';
import { CurrencyInput } from '../../components/ui/CurrencyInput';
import { Modal } from '../../components/ui/Modal';
import { Dropdown } from '../../components/ui/Dropdown';
import { HtmlView } from '../../components/ui/HtmlView';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Spinner } from '../../components/ui/Spinner';
import { Checkbox } from '../../components/ui/Checkbox';
import { EntityListCard } from '../../components/ui/EntityListCard';
import { CustomFieldMetaRows } from '../../components/ui/CustomFieldMetaRows';
import { CustomFieldsSection } from '../../components/ui/CustomFieldsSection';
import { FieldInput } from '../../components/ui/FieldInput';
import { CardAtoms } from '../../components/ui/EntityListCard/atoms';
import { MarkdownContent } from '../../components/ui/MarkdownContent';
import { MarkdownEditor } from '../../components/ui/MarkdownEditor';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { WidgetSurface } from '../../components/ui/WidgetSurface';
import { DonutChart, TimeSeriesChart } from '../../components/ui/Chart';
import { EntityListView } from '../../components/layout/EntityListView';
import { DocumentsPanel } from '../../components/layout/EntityDetailPanels/DocumentsPanel';
import { RecordListSurface } from '../../components/layout/RecordListSurface';
import { EntityListModals } from '../../components/layout/RecordListSurface/EntityListModals';
import { cardActionIcon } from '../../components/layout/RecordListSurface/cardActionIcon';
import { RecordDetailSurface } from '../../components/layout/RecordDetailSurface';
import { Icon } from './HostIcon';
import { resolveColor, getConfigColor, getDefaultTagColor } from '../../../shared/styles/colorUtils';
import { applyMaskTemplate } from '../../../domain/schema/fieldRules';
import { useEntityList } from './useEntityList';
import { useEntityForm } from './useEntityForm';
import { useEntityDetailVM } from './useEntityDetailVM';
import {
  formatCurrencyBRL,
  formatDate,
  onlyNumbers,
  parseCurrencyDigits,
  toDateInputValue,
} from '../../../utils/formatters';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useOpenRecord } from '../useOpenRecord';
import { useOpenScreenList } from '../useOpenScreenList';
import { useAuth } from '../../../stores/useAuth';
import { useTenant } from '../../../stores/useTenant';
import { useNotification } from '../../../stores/useNotification';
import { useRecordDocumentsPort } from '../entityScreen/useRecordPorts';
import { useEntityDocuments } from '../entityScreen/useEntityDocuments';
import type { EntityDocumentsController } from '../entityScreen/types';
import { generateDeepLink } from '../../../infrastructure/deeplink/deepLinkUtils';
import { useSavedViewState } from './useSavedViewState';
import { usePointContributions } from './usePointContributions';
import { useRunRecordAction } from './useRunRecordAction';
import { useActionGate } from './useActionGate';
import { useEntity } from './useEntity';
import { useLookups } from '../../../stores/useLookups';
import { useSettingValue } from '../settings/useSettingValue';
import { useRecords } from '../../../stores/useRecords';
import type { EntityRecord, EntityRecordValues, LookupOption } from '../../../domain/entities';

/**
 * ATENÇÃO: ao adicionar/remover/modificar módulos aqui, atualize também as definições TypeScript
 * em `extensionTypeDefs.ts` para manter o IntelliSense sincronizado com a API real disponível.
 *
 * A API CURADA. Este mapa é tudo que o `require` de uma extensão resolve: React, um kit de UI do
 * próprio Microteia e hooks de dados que já passam pelos stores (portanto pelas mesmas regras e
 * permissões da aplicação). Ampliar a superfície é decisão consciente — adicione um módulo aqui,
 * nunca exponha um objeto amplo.
 *
 * NÃO confunda com sandbox: isto é allowlist de IMPORTS, não de escopo. `fetch`, `window` e
 * `localStorage` seguem acessíveis como globais (ver `evaluateExtensionView`). O que impede código
 * arbitrário de rodar é a procedência — `extensionCodeTrust`.
 *
 * Chave desconhecida no `require` é ERRO explícito (ver `evaluateExtensionView`), não `undefined`
 * silencioso: uma extensão que tenta importar algo fora da superfície falha visivelmente.
 */

/**
 * Os registros de QUALQUER coleção descrita por uma tela do escritório, e a gravação parcial de um
 * deles. É a porta genérica de dados da ponte: nenhuma entidade de negócio tem hook próprio aqui —
 * quem sabe o que é um processo é a extensão que o declara, não o kernel.
 */
const useCollection = (collection: string): EntityRecord[] => {
  const { recordsByCollection } = useRecords();
  return useMemo(() => recordsByCollection[collection] ?? [], [recordsByCollection, collection]);
};

const useUpdateRecord = (): ((collection: string, recordId: string, data: EntityRecordValues) => Promise<void>) => {
  const { updateRecord } = useRecords();
  return useCallback(
    (collection, recordId, data) => updateRecord(collection, recordId, data),
    [updateRecord],
  );
};

const useCreateRecord = (): ((collection: string, data: EntityRecordValues) => Promise<EntityRecord>) => {
  const { createRecord } = useRecords();
  return useCallback((collection, data) => createRecord(collection, data), [createRecord]);
};

const useDeleteRecord = (): ((collection: string, recordId: string) => Promise<void>) => {
  const { deleteRecord } = useRecords();
  return useCallback((collection, recordId) => deleteRecord(collection, recordId), [deleteRecord]);
};

/**
 * QUEM está usando o sistema. É o que uma tela precisa para saber o que é MEU: a notícia que eu ainda
 * não li, o comentário que eu posso editar, a curtida que já é minha. Sem isso, "por usuário" só
 * existia como código dentro do kernel.
 *
 * É identificação, não permissão: quem barra a gravação é a regra do Firestore, e uma extensão que
 * decidisse acesso por este objeto estaria decidindo no lugar errado.
 */
export interface ExtensionViewer {
  id: string;
  name: string;
  photoURL: string | null;
  /** Papel GLOBAL: `SYSTEM`, `SUPPORT` ou `USER`. */
  role: string;
  /** Papel no escritório corrente: `admin`, `lawyer`, `secretary` ou `user`. */
  tenantRole: string;
}

const useCurrentUser = (): ExtensionViewer => {
  const { user, userRole, effectiveName, effectivePhotoURL } = useAuth();
  const { tenantRole } = useTenant();
  return useMemo(
    () => ({
      id: user?.id ?? '',
      name: effectiveName,
      photoURL: effectivePhotoURL,
      role: userRole ?? '',
      tenantRole: tenantRole ?? '',
    }),
    [user, userRole, effectiveName, effectivePhotoURL, tenantRole],
  );
};

/**
 * Os DOCUMENTOS de um registro — a mesma subcoleção e o mesmo controlador que a aba "Documentos" do
 * detalhe nativo usa. Existe em par com `DocumentsPanel` no `@microteia/ui`: a extensão que desenha o
 * próprio detalhe não precisa reescrever upload, tipo, exclusão e confirmação.
 */
const useRecordDocuments = (
  collection: string,
  recordId: string | null,
  enabled = true,
): EntityDocumentsController => {
  const port = useRecordDocumentsPort(collection);
  return useEntityDocuments({ enabled, recordId, port });
};

/** Opções de QUALQUER lista pelo nome da coleção — do kernel ou criada no tenant. */
const useLookup = (collection: string): LookupOption[] => useLookups().getOptions(collection);

const useNotify = (): ReturnType<typeof useNotification>['notify'] => useNotification().notify;

const uiModule = {
  Button,
  InfoBanner,
  CompositeFilter,
  SearchSelect,
  MultiSearchSelect,
  DateInput,
  Badge,
  ColorDot,
  Card,
  Input,
  Textarea,
  MaskedInput,
  CurrencyInput,
  Modal,
  ConfirmModal,
  Dropdown,
  HtmlView,
  Spinner,
  Checkbox,
  EntityListView,
  EntityListCard,
  WidgetSurface,
  TimeSeriesChart,
  DonutChart,
  CustomFieldMetaRows,
  MarkdownContent,
  MarkdownEditor,
  UserAvatar,
  DocumentsPanel,
  RecordListSurface,
  RecordDetailSurface,
  EntityListModals,
  cardActionIcon,
  CardAtoms,
  FieldInput,
  EntityForm: CustomFieldsSection,
  Icon,
  styled,
  useTheme,
} as const;

/**
 * O valor EM VIGOR de uma configuração, pela chave — já resolvido entre o padrão declarado, o do
 * escritório e o do usuário. A extensão lê o que declarou na própria seção de Configurações; para
 * gravar, quem manda é a tela de Configurações, não o widget.
 */
const settingsModule = {
  useSettingValue,
} as const;

const themeModule = {
  resolveColor,
  getConfigColor,
  getDefaultTagColor,
} as const;

const dataModule = {
  useEntity,
  useEntityList,
  useEntityForm,
  useEntityDetailVM,
  useCollection,
  useCreateRecord,
  useUpdateRecord,
  useDeleteRecord,
  useRecordDocuments,
  useCurrentUser,
  useLookup,
  useWorkspace,
  useOpenRecord,
  useOpenScreenList,
  useNotify,
  useSavedViewState,
  generateDeepLink,
  /**
   * O ponto de extensão como PORTA entre extensões: uma publica o ponto, outra o preenche, e
   * nenhuma das duas se conhece. Devolve só a metadata declarada — implementação não atravessa.
   */
  useContributions: usePointContributions,
  useRunAction: useRunRecordAction,
  /** A mesma avaliação de `hiddenWhen` do cartão nativo, para quem desenha a própria superfície. */
  useActionVisible: useActionGate,
} as const;

/**
 * Máscara pelo MOTOR, não por documento: `applyMask('52998224725', ['###.###.###-##'])`. O kernel
 * não conhece CPF, CNPJ nem telefone — quem os conhece é a extensão do país, que declara os
 * templates. Uma extensão que precise mascarar declara o template que quiser.
 */
const formatModule = {
  formatCurrencyBRL,
  formatDate,
  parseCurrencyDigits,
  toDateInputValue,
  applyMask: applyMaskTemplate,
  onlyNumbers,
} as const;

export const HOST_MODULES: Record<string, unknown> = {
  react: React,
  'react/jsx-runtime': { jsx, jsxs, Fragment },
  'react/jsx-dev-runtime': { jsxDEV: jsx, Fragment },
  'styled-components': { default: styled, styled, useTheme },
  '@microteia/ui': uiModule,
  '@microteia/data': dataModule,
  '@microteia/format': formatModule,
  '@microteia/theme': themeModule,
  '@microteia/settings': settingsModule,
};
