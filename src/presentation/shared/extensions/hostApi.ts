import React, { useCallback } from 'react';
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
import { useEntityList } from './useEntityList';
import { useEntityForm } from './useEntityForm';
import { useEntityDetailVM } from './useEntityDetailVM';
import {
  formatCEP,
  formatCNPJ,
  formatCPF,
  formatCurrencyBRL,
  formatPhone,
  onlyNumbers,
  parseCurrencyDigits,
  toDateInputValue,
} from '../../../utils/formatters';
import { useCaseStore } from '../../../stores/useCaseStore';
import { useCaseLookup } from '../../../stores/useCaseLookup';
import { usePersonStore } from '../../../stores/usePersonStore';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useNotification } from '../../../stores/useNotification';
import { generateDeepLink } from '../../../infrastructure/deeplink/deepLinkUtils';
import { useSavedViewState } from './useSavedViewState';
import { useEntity } from './useEntity';
import type { CasePhase } from '../../../domain/entities';

/**
 * A FRONTEIRA DE SANDBOX. Este mapa é tudo que o `require` de uma extensão enxerga — o teto do que o
 * código de terceiro (trusted) pode tocar. Não há `firebase`, `fetch`, `window` cru nem acesso ao
 * container de DI: só React, um kit de UI do próprio Curatino e hooks de dados curados que já passam
 * pelos stores (portanto pelas mesmas regras e permissões da aplicação). Ampliar a superfície é uma
 * decisão consciente de segurança — adicione um módulo aqui, nunca exponha um objeto amplo.
 *
 * Chave desconhecida no `require` é ERRO explícito (ver `evaluateExtensionView`), não `undefined`
 * silencioso: uma extensão que tenta importar algo fora da superfície falha visivelmente.
 */

const useCases = (): {
  cases: ReturnType<typeof useCaseStore>['cases'];
  updatePhase: (caseId: string, phaseKey: string) => Promise<void>;
} => {
  const { cases, updateCase } = useCaseStore();
  const updatePhase = useCallback(
    (caseId: string, phaseKey: string) => updateCase(caseId, { phase: phaseKey as CasePhase }),
    [updateCase],
  );
  return { cases, updatePhase };
};

const useCasePhases = (): ReturnType<typeof useCaseLookup>['phaseConfigs'] =>
  useCaseLookup().phaseConfigs;

const useCaseAreas = (): ReturnType<typeof useCaseLookup>['areaConfigs'] =>
  useCaseLookup().areaConfigs;

const useCaseStatuses = (): ReturnType<typeof useCaseLookup>['statusConfigs'] =>
  useCaseLookup().statusConfigs;

const usePersons = (): ReturnType<typeof usePersonStore>['persons'] => usePersonStore().persons;

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
  useCases,
  useCasePhases,
  useCaseAreas,
  useCaseStatuses,
  usePersons,
  useWorkspace,
  useNotify,
  useSavedViewState,
  generateDeepLink,
} as const;

const formatModule = {
  formatCurrencyBRL,
  parseCurrencyDigits,
  toDateInputValue,
  formatCPF,
  formatCNPJ,
  formatPhone,
  formatCEP,
  onlyNumbers,
} as const;

export const HOST_MODULES: Record<string, unknown> = {
  react: React,
  'react/jsx-runtime': { jsx, jsxs, Fragment },
  'react/jsx-dev-runtime': { jsxDEV: jsx, Fragment },
  'styled-components': { default: styled, styled, useTheme },
  '@curatino/ui': uiModule,
  '@curatino/data': dataModule,
  '@curatino/format': formatModule,
  '@curatino/theme': themeModule,
};
