/**
 * Definições TypeScript para o IntelliSense do editor de extensões. Provê autocompletar de código
 * para os módulos disponíveis via `HOST_MODULES` (hostApi.ts). Passado ao Monaco Editor via `extraLib`.
 *
 * ATENÇÃO: manter sincronizado com `hostApi.ts`. Ao adicionar/remover/modificar um módulo lá,
 * atualize as definições aqui para que o IntelliSense reflita a API real disponível para extensões.
 */

const JSX_NAMESPACE = `
declare namespace JSX {
  interface Element {
    type: any;
    props: any;
    key: any;
  }
  interface IntrinsicElements {
    div: any;
    span: any;
    button: any;
    input: any;
    textarea: any;
    label: any;
    p: any;
    h1: any;
    h2: any;
    h3: any;
    h4: any;
    h5: any;
    h6: any;
    section: any;
    header: any;
    footer: any;
    article: any;
    aside: any;
    nav: any;
    main: any;
    ul: any;
    ol: any;
    li: any;
    a: any;
    img: any;
    form: any;
    select: any;
    option: any;
    table: any;
    thead: any;
    tbody: any;
    tr: any;
    td: any;
    th: any;
    svg: any;
    path: any;
    circle: any;
    rect: any;
    [elemName: string]: any;
  }
  interface ElementClass {
    render(): any;
  }
  interface ElementAttributesProperty {
    props: {};
  }
  interface ElementChildrenAttribute {
    children: {};
  }
}
`;

const REACT_DEFS = `declare module 'react' {
  export function useState<S>(initialState: S | (() => S)): [S, (value: S | ((prev: S) => S)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useMemo<T>(factory: () => T, deps: readonly unknown[]): T;
  export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: readonly unknown[]): T;
  export function useRef<T>(initialValue: T): { current: T };
  export function useRef<T>(initialValue: T | null): { readonly current: T | null };
  export function useRef<T = undefined>(): { current: T | undefined };
  export function useContext<T>(context: React.Context<T>): T;
  export function useReducer<R extends React.Reducer<any, any>>(
    reducer: R,
    initialState: React.ReducerState<R>
  ): [React.ReducerState<R>, React.Dispatch<React.ReducerAction<R>>];

  export function createElement(type: any, props?: any, ...children: any[]): JSX.Element;
  export function Fragment(props: { children?: any }): JSX.Element;

  export type FC<P = Record<string, unknown>> = (props: P) => JSX.Element | null;
  export type ComponentType<P = Record<string, unknown>> = FC<P>;
  export type ReactNode = JSX.Element | string | number | boolean | null | undefined | ReactNode[];
  export type CSSProperties = Record<string, string | number>;
  export type ReactElement = JSX.Element;

  export interface Context<T> {
    Provider: React.Provider<T>;
    Consumer: React.Consumer<T>;
  }

  export namespace React {
    export function createElement(type: any, props?: any, ...children: any[]): JSX.Element;
    export type Provider<T> = ComponentType<{ value: T; children?: ReactNode }>;
    export type Consumer<T> = ComponentType<{ children: (value: T) => ReactNode }>;
    export type Reducer<S, A> = (prevState: S, action: A) => S;
    export type ReducerState<R extends Reducer<any, any>> = R extends Reducer<infer S, any> ? S : never;
    export type ReducerAction<R extends Reducer<any, any>> = R extends Reducer<any, infer A> ? A : never;
    export type Dispatch<A> = (value: A) => void;
    export type RefObject<T> = { readonly current: T | null };
    export interface MouseEvent<T = Element> {
      currentTarget: T;
      target: EventTarget;
      preventDefault(): void;
      stopPropagation(): void;
    }
    export interface ChangeEvent<T = Element> {
      currentTarget: T;
      target: EventTarget & T;
    }
    export interface KeyboardEvent<T = Element> {
      key: string;
      code: string;
      preventDefault(): void;
      stopPropagation(): void;
    }
    export interface FormEvent<T = Element> {
      currentTarget: T;
      preventDefault(): void;
    }
    export interface HTMLAttributes<T = HTMLElement> {
      children?: ReactNode;
      className?: string;
      style?: CSSProperties;
      onClick?: (event: MouseEvent<T>) => void;
      onChange?: (event: ChangeEvent<T>) => void;
      onKeyDown?: (event: KeyboardEvent<T>) => void;
      [key: string]: any;
    }
    export interface ButtonHTMLAttributes<T = HTMLButtonElement> extends HTMLAttributes<T> {
      disabled?: boolean;
      type?: 'button' | 'submit' | 'reset';
    }
    export interface InputHTMLAttributes<T = HTMLInputElement> extends HTMLAttributes<T> {
      value?: string | number;
      placeholder?: string;
      disabled?: boolean;
      readOnly?: boolean;
      type?: string;
    }
    export interface TextareaHTMLAttributes<T = HTMLTextAreaElement> extends HTMLAttributes<T> {
      value?: string;
      placeholder?: string;
      disabled?: boolean;
      readOnly?: boolean;
      rows?: number;
    }
    export interface LabelHTMLAttributes<T = HTMLLabelElement> extends HTMLAttributes<T> {
      htmlFor?: string;
    }
  }
}
`;

const JSX_RUNTIME_DEFS = `declare module 'react/jsx-runtime' {
  export function jsx(type: any, props: any, key?: any): JSX.Element;
  export function jsxs(type: any, props: any, key?: any): JSX.Element;
  export const Fragment: React.ComponentType<{ children?: React.ReactNode }>;
}

declare module 'react/jsx-dev-runtime' {
  export function jsxDEV(type: any, props: any, key?: any): JSX.Element;
  export const Fragment: React.ComponentType<{ children?: React.ReactNode }>;
}`;

const STYLED_COMPONENTS_DEFS = `declare module 'styled-components' {
  export interface Theme {
    colors: {
      background: string;
      surface: string;
      surfaceHover: string;
      cardHover: string;
      border: string;
      primary: string;
      primaryHover: string;
      primaryLight: string;
      secondary: string;
      success: string;
      warning: string;
      warningLight: string;
      danger: string;
      dangerLight: string;
      revenue: string;
      revenueLight: string;
      expense: string;
      expenseLight: string;
      text: string;
      textSecondary: string;
      textMuted: string;
      inputBackground: string;
      scrollbar: string;
      scrollbarThumb: string;
      shadow: string;
      overlay: string;
      calendarToday: string;
      calendarEvent: string;
      info: string;
      white: string;
      caseStatusInProgress: string;
      caseStatusWon: string;
      caseStatusLost: string;
      caseStatusSettlement: string;
      caseStatusArchived: string;
      caseStatusSuspended: string;
      contractStatusDraft: string;
      contractStatusReview: string;
      contractStatusAwaitingSignature: string;
      contractStatusActive: string;
      contractStatusSuspended: string;
      contractStatusClosed: string;
      contractStatusCancelled: string;
      contractStatusTerminated: string;
      personStatusActive: string;
      personStatusInactive: string;
      relationshipCliente: string;
      relationshipParte: string;
      relationshipContato: string;
      relationshipFornecedor: string;
      relationshipSocio: string;
      relationshipDefault: string;
      kpiCases: string;
      kpiPersons: string;
      kpiDeadlinesPending: string;
      kpiDeadlinesOverdue: string;
      deadlineStatusPending: string;
      deadlineStatusCompleted: string;
      deadlineStatusOverdue: string;
      deadlineStatusCanceled: string;
      aiOpenai: string;
      aiAnthropic: string;
      aiGoogle: string;
      aiMistral: string;
      aiCohere: string;
      aiOllama: string;
      aiOther: string;
      casePhaseInitial: string;
      casePhaseInstruction: string;
      casePhaseSentence: string;
      casePhaseAppeal: string;
      casePhaseExecution: string;
      casePhaseArchived: string;
    };
    fonts: {
      body: string;
      mono: string;
    };
    fontSizes: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
      '2xl': string;
      '3xl': string;
    };
    spacing: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
      '2xl': string;
    };
    borderRadius: {
      sm: string;
      md: string;
      lg: string;
      xl: string;
      full: string;
    };
    transitions: {
      fast: string;
      normal: string;
      slow: string;
    };
    sidebar: {
      width: string;
      collapsedWidth: string;
    };
    highlights: {
      yellow: string;
      green: string;
      pink: string;
      blue: string;
      orange: string;
    };
    tagColors: Array<{ label: string; value: string }>;
  }

  export interface StyledComponent<P = Record<string, unknown>> extends React.ComponentType<P> {}

  export interface ThemedStyledFunction<T, O = Record<string, unknown>> {
    <U = Record<string, unknown>>(
      first: TemplateStringsArray | ((props: T & U & { theme: Theme }) => any),
      ...rest: any[]
    ): StyledComponent<T & U & O>;
  }

  export interface StyledInterface {
    div: ThemedStyledFunction<React.HTMLAttributes<HTMLDivElement>>;
    span: ThemedStyledFunction<React.HTMLAttributes<HTMLSpanElement>>;
    button: ThemedStyledFunction<React.ButtonHTMLAttributes<HTMLButtonElement>>;
    input: ThemedStyledFunction<React.InputHTMLAttributes<HTMLInputElement>>;
    textarea: ThemedStyledFunction<React.TextareaHTMLAttributes<HTMLTextAreaElement>>;
    label: ThemedStyledFunction<React.LabelHTMLAttributes<HTMLLabelElement>>;
    p: ThemedStyledFunction<React.HTMLAttributes<HTMLParagraphElement>>;
    h1: ThemedStyledFunction<React.HTMLAttributes<HTMLHeadingElement>>;
    h2: ThemedStyledFunction<React.HTMLAttributes<HTMLHeadingElement>>;
    h3: ThemedStyledFunction<React.HTMLAttributes<HTMLHeadingElement>>;
    section: ThemedStyledFunction<React.HTMLAttributes<HTMLElement>>;
    header: ThemedStyledFunction<React.HTMLAttributes<HTMLElement>>;
    footer: ThemedStyledFunction<React.HTMLAttributes<HTMLElement>>;
  }

  const styled: StyledInterface;
  export default styled;
  export { styled };
  export function useTheme(): Theme;
}`;

const UI_MODULE_DEFS = `declare module '@microteia/ui' {
  import * as React from 'react';

  /** Props do botão padrão do sistema. */
  export interface ButtonProps {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    $fullWidth?: boolean;
    $isLoading?: boolean;
    disabled?: boolean;
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
    children?: React.ReactNode;
    type?: 'button' | 'submit' | 'reset';
  }
  export function Button(props: ButtonProps): JSX.Element;

  /** Props da tarja informativa. */
  export interface InfoBannerProps {
    message: string;
    variant?: 'warning' | 'info';
  }
  export function InfoBanner(props: InfoBannerProps): JSX.Element;

  /** Props do filtro composto. */
  export interface CompositeFilterProps {
    screenKey: string;
    filters: any[];
    onFiltersChange: (filters: any[]) => void;
  }
  export function CompositeFilter(props: CompositeFilterProps): JSX.Element;

  export interface SearchSelectOption {
    value: string;
    label: string;
    meta?: string;
    color?: string;
    icon?: React.ComponentType<{ size?: number }>;
  }

  /** Props do SearchSelect. */
  export interface SearchSelectProps {
    options: SearchSelectOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    label?: string;
  }
  export function SearchSelect(props: SearchSelectProps): JSX.Element;

  /** Props do MultiSearchSelect. */
  export interface MultiSearchSelectProps {
    options: SearchSelectOption[];
    value: string[];
    onChange: (value: string[]) => void;
    placeholder?: string;
    disabled?: boolean;
  }
  export function MultiSearchSelect(props: MultiSearchSelectProps): JSX.Element;

  /** Props do DateInput. */
  export interface DateInputProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
  }
  export function DateInput(props: DateInputProps): JSX.Element;

  /** Props do Badge. */
  export interface BadgeProps {
    children?: React.ReactNode;
    color?: string;
  }
  export function Badge(props: BadgeProps): JSX.Element;

  /** Props do ColorDot. */
  export interface ColorDotProps {
    color: string;
  }
  export function ColorDot(props: ColorDotProps): JSX.Element;

  /** Props do Card. */
  export interface CardProps {
    children?: React.ReactNode;
  }
  export function Card(props: CardProps): JSX.Element;

  /** Props do Input. */
  export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    $hasError?: boolean;
  }
  export function Input(props: InputProps): JSX.Element;

  /** Props do Textarea. */
  export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}
  export function Textarea(props: TextareaProps): JSX.Element;

  /** Props do MaskedInput. */
  export interface MaskedInputProps {
    value: string;
    onChange: (value: string) => void;
    mask: string;
    placeholder?: string;
    disabled?: boolean;
  }
  export function MaskedInput(props: MaskedInputProps): JSX.Element;

  /** Props do CurrencyInput. */
  export interface CurrencyInputProps {
    value: number;
    onChange: (value: number) => void;
    disabled?: boolean;
  }
  export function CurrencyInput(props: CurrencyInputProps): JSX.Element;

  /** Props do Modal. */
  export interface ModalProps {
    title: string;
    onClose: () => void;
    size?: 'small' | 'medium' | 'large' | 'xlarge';
    children?: React.ReactNode;
  }
  export function Modal(props: ModalProps): JSX.Element;

  /** Props do ConfirmModal. */
  export interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'default';
    loading?: boolean;
    inputValue?: string;
    inputPlaceholder?: string;
    onInputChange?: (value: string) => void;
    onConfirm: () => void | Promise<void>;
    onCancel: () => void;
  }
  export function ConfirmModal(props: ConfirmModalProps): JSX.Element;

  /** Props do Spinner. */
  export interface SpinnerProps {
    size?: 'sm' | 'md' | 'lg';
  }
  export function Spinner(props: SpinnerProps): JSX.Element;

  /** Props do Checkbox. */
  export interface CheckboxProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label?: string;
    disabled?: boolean;
  }
  export function Checkbox(props: CheckboxProps): JSX.Element;

  /** Props do EntityListCard. */
  export interface EntityListCardProps {
    record: any;
    screenKey: string;
    actions?: any[];
    onClick?: () => void;
  }
  export function EntityListCard(props: EntityListCardProps): JSX.Element;

  /** Props do CustomFieldMetaRows. */
  export interface CustomFieldMetaRowsProps {
    record: any;
    fields: any[];
  }
  export function CustomFieldMetaRows(props: CustomFieldMetaRowsProps): JSX.Element;

  /** Props do CustomFieldsSection. */
  export interface CustomFieldsSectionProps {
    fields: any[];
    values: Record<string, any>;
    errors: Record<string, string>;
    getValue: (key: string) => any;
    setValue: (key: string, value: any) => void;
  }
  export function CustomFieldsSection(props: CustomFieldsSectionProps): JSX.Element;
  
  /** Alias de CustomFieldsSection. */
  export function EntityForm(props: CustomFieldsSectionProps): JSX.Element;

  /** Props do FieldInput. */
  export interface FieldInputProps {
    field: any;
    value: any;
    onChange: (value: any) => void;
    error?: string;
  }
  export function FieldInput(props: FieldInputProps): JSX.Element;

  /** Átomos (componentes base) para construir cards customizados. */
  export const CardAtoms: {
    Title(props: { children?: React.ReactNode }): JSX.Element;
    Subtitle(props: { children?: React.ReactNode }): JSX.Element;
    Meta(props: { children?: React.ReactNode }): JSX.Element;
    Tags(props: { children?: React.ReactNode }): JSX.Element;
    Actions(props: { children?: React.ReactNode }): JSX.Element;
  };

  /** Props do EntityListView. */
  export interface EntityListViewProps {
    variant?: 'page' | 'embedded';
    title?: string;
    titleIcon?: React.ReactNode;
    onNew?: () => void;
    newTitle?: string;
    filterDefs?: any[];
    filterTokens?: any[];
    children?: React.ReactNode;
  }
  export function EntityListView(props: EntityListViewProps): JSX.Element;

  /** Props do RecordListSurface. */
  export interface RecordListSurfaceProps {
    vm: any;
    definition: any;
    variant?: 'page' | 'embedded';
    renderSubtitle?: (record: any) => React.ReactNode;
    renderBelowHeader?: (record: any) => React.ReactNode;
    onOpenRecord?: (record: any) => void;
    onNewRecord?: () => void;
    /** Textos do estado vazio, quando a tela prefere os seus aos genéricos. */
    emptyTitle?: string;
    emptyActionLabel?: string;
  }
  export function RecordListSurface(props: RecordListSurfaceProps): JSX.Element;

  /** Props do EntityListModals. */
  export interface EntityListModalsProps {
    vm: any;
  }
  export function EntityListModals(props: EntityListModalsProps): JSX.Element;

  /** Resolve ícone de ação de card. */
  export function cardActionIcon(actionKey: string): React.ComponentType<{ size?: number }> | null;

  /** Props do RecordDetailSurface. */
  export interface RecordDetailSurfaceProps {
    vm: any;
  }
  export function RecordDetailSurface(props: RecordDetailSurfaceProps): JSX.Element;

  /** Props do Icon. */
  export interface IconProps {
    name: string;
    size?: number;
  }
  export function Icon(props: IconProps): JSX.Element;

  export { styled, useTheme } from 'styled-components';
}`;

const DATA_MODULE_DEFS = `declare module '@microteia/data' {

  /** Registros de qualquer coleção descrita por uma tela do escritório. */
  export function useCollection(collection: string): any[];

  /** Grava campos de um registro de qualquer coleção. */
  export function useUpdateRecord(): (collection: string, recordId: string, data: Record<string, any>) => Promise<void>;

  export interface LookupOption {
    key: string;
    label: string;
    color?: string;
  }
  /**
   * Opções de QUALQUER lista pelo nome da coleção — do kernel ('caseStatuses', 'casePhases',
   * 'caseAreas'…) ou criada no escritório. Os atalhos abaixo são apelidos deste.
   */
  export function useLookup(collection: string): LookupOption[];



  export interface EntityFieldOption {
    key: string;
    label: string;
    color?: string;
  }

  export interface ExtensionEntity {
    screen: any | null;
    screenKey: string | null;
    /** Coleção dos registros — difere de screenKey quando a tela é visão sobre outra entidade. */
    collection: string | null;
    fields: any[];
    records: any[];
    isLoading: boolean;
    /** Retorna as opções (dropdown/select) de um campo específico. */
    optionsFor: (fieldKey: string) => EntityFieldOption[];
    /** Abre o detalhe de um registro. */
    openRecord: (recordId: string) => void;
    /** Abre o formulário de criação de novo registro. */
    newRecord: () => void;
    /** Abre o formulário de clonagem de um registro. */
    cloneRecord: (recordId: string) => void;
    /** Exclui um registro (sem cascata). */
    deleteRecord: (recordId: string) => Promise<void>;
  }
  /**
   * Hook para acessar uma entidade dinâmica (tela customizada) pelo sourceId.
   * Retorna schema, registros e funções de navegação.
   */
  export function useEntity(sourceId: string): ExtensionEntity;

  export interface RecordCardAction {
    key: string;
    label: string;
    icon: string;
    onClick: () => void;
  }

  export interface RecordListViewModel {
    records: any[];
    /** Coleção dos registros — a chave da tela, ou a coleção alvo quando ela é uma visão. */
    collection: string;
    isLoading: boolean;
    filters: any[];
    setFilters: (filters: any[]) => void;
    getCardActions: (record: any) => RecordCardAction[];
    [key: string]: any;
  }

  export interface EntityListOptions {
    /** Prefixo da tela de edição própria da extensão (para abrir/duplicar nela). */
    editKeyPrefix?: string;
  }
  /**
   * Hook para listagem de entidade dinâmica com filtros e ações de card.
   * Retorna ViewModel completo para usar com RecordListSurface.
   */
  export function useEntityList(sourceId: string, options?: EntityListOptions): RecordListViewModel;

  export interface EntityForm {
    screen: any | null;
    screenKey: string;
    fields: any[];
    isNew: boolean;
    values: Record<string, any>;
    /** Retorna o valor de um campo pelo key. */
    getValue: (fieldKey: string) => any;
    /** Define o valor de um campo. */
    setValue: (fieldKey: string, value: any) => void;
    errors: Record<string, string>;
    /** Valida o formulário (obrigatórios). Retorna true se válido. */
    validate: () => boolean;
    /** Salva o registro (cria ou atualiza). Retorna { id } ou null se inválido. */
    save: () => Promise<{ id: string } | null>;
    isSaving: boolean;
  }
  /**
   * Hook para formulário de criar/editar entidade dinâmica.
   * Gerencia estado, validação e gravação.
   */
  export function useEntityForm(sourceId: string, recordId?: string | null): EntityForm;

  export interface EntityDetailVM {
    record: any | null;
    isLoading: boolean;
    [key: string]: any;
  }
  /**
   * Hook para view model de detalhe de entidade dinâmica.
   * Retorna registro e estado de carregamento.
   */
  export function useEntityDetailVM(sourceId: string, recordId: string): EntityDetailVM;

  export interface WorkspaceHook {
    /** Abre uma aba no workspace. */
    openTab: (tabKey: string) => void;
    /** Fecha uma aba. */
    closeTab: (tabKey: string) => void;
    /** Aba ativa atual. */
    activeTab: string | null;
  }
  /** Hook para controlar abas do workspace. */
  export function useWorkspace(): WorkspaceHook;

  /** Função para notificar o usuário (toast). */
  export function useNotify(): (message: string, variant?: 'success' | 'error' | 'info') => void;

  /**
   * Hook para persistir estado de uma view entre sessões.
   * Salva no localStorage com chave prefixada.
   */
  export function useSavedViewState<T>(key: string, initial: T): [T, (value: T) => void];

  /** Gera um deeplink para uma rota do sistema. */
  export function generateDeepLink(path: string): string;
}`;

const FORMAT_MODULE_DEFS = `declare module '@microteia/format' {
  /** Formata número como moeda brasileira (R$ 1.234,56). */
  export function formatCurrencyBRL(value: number): string;

  /** Converte string de moeda para número (centavos). */
  export function parseCurrencyDigits(value: string): number;

  /** Converte Date para string no formato ISO de input[type=date] (YYYY-MM-DD). */
  export function toDateInputValue(date: Date): string;

  /** Formata CPF (123.456.789-00). */
  export function formatCPF(value: string): string;

  /** Formata CNPJ (12.345.678/0001-00). */
  export function formatCNPJ(value: string): string;

  /** Formata telefone ((11) 91234-5678). */
  export function formatPhone(value: string): string;

  /** Formata CEP (12345-678). */
  export function formatCEP(value: string): string;

  /** Remove tudo que não é número de uma string. */
  export function onlyNumbers(value: string): string;
}`;

const THEME_MODULE_DEFS = `declare module '@microteia/theme' {
  /**
   * Resolve uma cor para hex, tratando cores do tema e hex direto.
   * @param color - Nome da cor do tema (ex: 'primary') ou hex (ex: '#ff0000')
   */
  export function resolveColor(color: string, theme: any): string;

  /**
   * Retorna a cor de uma configuração (fase, área, status).
   * @param configs - Array de configurações com key e color
   * @param key - Chave da configuração
   */
  export function getConfigColor(configs: any[], key: string, theme: any, fallback?: string): string;

  /**
   * Retorna uma cor padrão para uma tag/etiqueta baseada no índice.
   */
  export function getDefaultTagColor(index: number): string;
}`;

/**
 * Gera a string completa de definições TypeScript para os módulos disponíveis em extensões.
 * Usada como `extraLib` do Monaco Editor no PluginAuthor para prover IntelliSense.
 */
export const buildExtensionTypeDefs = (): string => [
  JSX_NAMESPACE,
  REACT_DEFS,
  JSX_RUNTIME_DEFS,
  STYLED_COMPONENTS_DEFS,
  UI_MODULE_DEFS,
  DATA_MODULE_DEFS,
  FORMAT_MODULE_DEFS,
  THEME_MODULE_DEFS,
].join('\n\n');
