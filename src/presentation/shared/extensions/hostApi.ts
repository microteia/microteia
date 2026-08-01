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
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Spinner } from '../../components/ui/Spinner';
import { Checkbox } from '../../components/ui/Checkbox';
import { EntityListCard } from '../../components/ui/EntityListCard';
import { CustomFieldMetaRows } from '../../components/ui/CustomFieldMetaRows';
import { CustomFieldsSection } from '../../components/ui/CustomFieldsSection';
import { FieldInput } from '../../components/ui/FieldInput';
import { CardAtoms } from '../../components/ui/EntityListCard/atoms';
import { EntityListView } from '../../components/layout/EntityListView';
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
import { useNotification } from '../../../stores/useNotification';
import { generateDeepLink } from '../../../infrastructure/deeplink/deepLinkUtils';
import { useSavedViewState } from './useSavedViewState';
import { useEntity } from './useEntity';
import { useLookups } from '../../../stores/useLookups';
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
  Spinner,
  Checkbox,
  EntityListView,
  EntityListCard,
  CustomFieldMetaRows,
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
  useUpdateRecord,
  useLookup,
  useWorkspace,
  useOpenRecord,
  useNotify,
  useSavedViewState,
  generateDeepLink,
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
};
