import React, { useCallback, useMemo } from 'react';
import { ReportView } from '../../components/ui/ReportView';
import { ReportTable } from '../../components/ui/ReportTable';
import { ReportMatrix } from '../../components/ui/ReportMatrix';
import { ReportChart } from '../../components/ui/ReportChart';
import { useReport } from '../report/useReport';
import { httpsCallable } from 'firebase/functions';
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
import { BarChart, DonutChart, TimeSeriesChart } from '../../components/ui/Chart';
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
  formatCurrency,
  formatCurrencyBRL,
  formatDate,
  onlyNumbers,
  parseCurrencyDigits,
  toDateInputValue,
} from '../../../utils/formatters';
import { useLabel, useLocaleFormat, useT } from '../i18n/useT';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useOpenRecord } from '../useOpenRecord';
import { useOpenScreenList } from '../useOpenScreenList';
import { useAuth } from '../../../stores/useAuth';
import { useTenant } from '../../../stores/useTenant';
import { useAuthorization } from '../../../stores/useAuthorization';
import { useLocale } from '../../../stores/useLocale';
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
 * `permissions` está aqui para a extensão DESENHAR — mostrar o botão de excluir a quem pode excluir.
 * Quem barra a gravação continua sendo a regra do Firestore: uma extensão que decidisse acesso por
 * este objeto estaria decidindo no lugar errado. Aqui moravam `role` e `tenantRole`, e sair foi o
 * ponto: nenhuma extensão precisa saber que perfis existem no escritório de quem a instalou.
 */
export interface ExtensionViewer {
  id: string;
  name: string;
  photoURL: string | null;
  /** As permissões EFETIVAS de quem olha. Para perguntar por uma delas, use `useCan()`. */
  permissions: string[];
  /**
   * O escritório em que se está trabalhando. É o que uma extensão precisa para dizer ao backend
   * EM QUAL escritório ela age — a coleção de dados já vem endereçada pelos hooks, mas uma função
   * do servidor recebe o escritório como argumento.
   */
  tenantId: string;
  /**
   * O idioma em vigor para esta pessoa (BCP-47: `en`, `pt-BR`). Está aqui, e não só em
   * `@microteia/i18n`, porque uma extensão frequentemente precisa dele como DADO — para escolher um
   * texto vindo do próprio registro, ou para mandá-lo ao servidor junto da chamada.
   */
  locale: string;
}

const useCurrentUser = (): ExtensionViewer => {
  const { user, effectiveName, effectivePhotoURL } = useAuth();
  const { currentTenant } = useTenant();
  const { effectivePermissions } = useAuthorization();
  const { locale } = useLocale();
  return useMemo(
    () => ({
      id: user?.id ?? '',
      name: effectiveName,
      photoURL: effectivePhotoURL,
      permissions: effectivePermissions,
      tenantId: currentTenant?.id ?? '',
      locale,
    }),
    [user, effectiveName, effectivePhotoURL, effectivePermissions, currentTenant, locale],
  );
};

/**
 * "Esta pessoa PODE?" — a única pergunta de autorização que uma extensão faz.
 *
 * Ela não recebe perfil nem papel, e é essa a inversão: a extensão declara as permissões que traz
 * (`access.permission`) e pergunta por elas; quem as agrupa em perfis é o escritório, e o autor não
 * precisa saber que perfis existem.
 */
const useCan = (): ((permission: string) => boolean) => useAuthorization().can;

/**
 * Uma FUNÇÃO DO SERVIDOR, pelo nome. É a porta da extensão para o que só o backend pode fazer —
 * guardar um segredo, falar com um serviço externo, escrever onde o navegador não alcança.
 *
 * Genérica de propósito: o kernel não conhece nenhuma função em particular, e quem decide o que a
 * chamada pode fazer é a própria função, que valida autenticação e papel do lado de lá. Isto é
 * ergonomia e auditoria — não é fronteira de segurança: código de extensão roda com `fetch` ao
 * alcance (ver "Fronteira de confiança do código de extensão").
 */
const useCallable = <Request, Response>(
  name: string,
): ((payload?: Request) => Promise<Response>) =>
  useCallback(
    async (payload?: Request) => {
      // A configuração do Firebase entra na CHAMADA, não na carga do módulo: a ponte é importada
      // por quem só quer avaliar uma tela de extensão (o autor de extensões, os testes), e exigir
      // as variáveis de ambiente ali derrubaria os dois.
      const { functions } = await import('../../../infrastructure/firebase/config');
      const result = await httpsCallable<Request | Record<string, never>, Response>(functions, name)(
        payload ?? {},
      );
      return result.data;
    },
    [name],
  );

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

/**
 * `@microteia/report` — o que o CAMINHO EM CÓDIGO compõe.
 *
 * São os MESMOS componentes que o renderizador declarativo usa, e é isso que faz escrever relatório
 * em código ser composição e não reimplementação: o autor monta a capa, o texto entre seções e dois
 * datasets lado a lado, e as peças que desenham número continuam sendo as do kernel.
 *
 * O que ele NÃO dá é acesso ao dado: os números chegam por `useReport`, que chama a callable — e é
 * lá que a leitura de cada coleção é cobrada. O código substitui a APRESENTAÇÃO, nunca o `dataset`.
 */
const reportModule = {
  ReportView,
  ReportTable,
  ReportMatrix,
  ReportChart,
  useReport,
};

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
  BarChart,
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

/**
 * O que só o servidor faz. Um módulo próprio — e não mais um hook dentro de `@microteia/data` —
 * porque a natureza da chamada é outra: aqui a extensão sai da base do escritório e fala com uma
 * função, com o custo e a latência que isso tem.
 */
const functionsModule = {
  useCallable,
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
  useCan,
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
  formatCurrency,
  formatDate,
  parseCurrencyDigits,
  toDateInputValue,
  applyMask: applyMaskTemplate,
  onlyNumbers,
} as const;

/**
 * O idioma como CAPACIDADE da extensão, e não só como dado do visitante.
 *
 * `useT` recebe o namespace de quem chama, o que faz uma extensão traduzir os próprios textos com o
 * mesmo mecanismo do núcleo — e, passando uma chave absoluta (`core.ui/action.save`), reaproveitar o
 * que o núcleo já traduziu em vez de traduzir de novo. Uma extensão que não declara catálogo nenhum
 * continua funcionando: chave sem tradução devolve a própria chave.
 */
const i18nModule = {
  useT,
  useLabel,
  useLocale,
  useLocaleFormat,
} as const;

export const HOST_MODULES: Record<string, unknown> = {
  react: React,
  'react/jsx-runtime': { jsx, jsxs, Fragment },
  'react/jsx-dev-runtime': { jsxDEV: jsx, Fragment },
  'styled-components': { default: styled, styled, useTheme },
  '@microteia/ui': uiModule,
  '@microteia/report': reportModule,
  '@microteia/data': dataModule,
  '@microteia/format': formatModule,
  '@microteia/i18n': i18nModule,
  '@microteia/theme': themeModule,
  '@microteia/settings': settingsModule,
  '@microteia/functions': functionsModule,
};
