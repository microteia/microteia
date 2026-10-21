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
  /**
   * 'key' and 'ref' belong to React itself, not to a component's props. Without this, passing 'key'
   * to any component with a declared props interface is rejected - 'Property key does not exist on
   * type CardProps' - which is the first thing anyone hits when rendering a list.
   */
  interface IntrinsicAttributes {
    key?: string | number | null;
  }
  interface IntrinsicClassAttributes<T> {
    ref?: any;
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

  /**
   * These live in the 'React' namespace below and are re-exported here, rather than the other way
   * round: a declaration inside 'declare module' is NOT visible to another module's block, so a type
   * written as 'React.ReactNode' - which is how most of this file writes it - only resolves if the
   * name is a member of that namespace. Declaring it at module level and referring to it as
   * 'React.ReactNode' elsewhere silently produced 'any', and 'skipLibCheck' hid the error.
   */
  export type FC<P = Record<string, unknown>> = React.FC<P>;
  export type ComponentType<P = Record<string, unknown>> = React.ComponentType<P>;
  export type ReactNode = React.ReactNode;
  export type CSSProperties = React.CSSProperties;
  export type ReactElement = React.ReactElement;
  export type Context<T> = React.Context<T>;

  export namespace React {
    export function createElement(type: any, props?: any, ...children: any[]): JSX.Element;
    export type FC<P = Record<string, unknown>> = (props: P) => JSX.Element | null;
    export type ComponentType<P = Record<string, unknown>> = FC<P>;
    export type ReactNode = JSX.Element | string | number | boolean | null | undefined | ReactNode[];
    export type CSSProperties = Record<string, string | number>;
    export type ReactElement = JSX.Element;
    export interface Context<T> {
      Provider: Provider<T>;
      Consumer: Consumer<T>;
    }
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
    export interface SelectHTMLAttributes<T = HTMLSelectElement> extends HTMLAttributes<T> {
      value?: string | number;
      disabled?: boolean;
      multiple?: boolean;
      required?: boolean;
      name?: string;
    }
    export interface FormHTMLAttributes<T = HTMLFormElement> extends HTMLAttributes<T> {
      action?: string;
      method?: string;
      noValidate?: boolean;
      onSubmit?: (event: FormEvent<T>) => void;
    }
    export interface AnchorHTMLAttributes<T = HTMLAnchorElement> extends HTMLAttributes<T> {
      href?: string;
      target?: string;
      rel?: string;
      download?: string | boolean;
    }
    export interface ImgHTMLAttributes<T = HTMLImageElement> extends HTMLAttributes<T> {
      src?: string;
      alt?: string;
      width?: string | number;
      height?: string | number;
      loading?: 'eager' | 'lazy';
    }
    export interface LiHTMLAttributes<T = HTMLLIElement> extends HTMLAttributes<T> {
      value?: string | number;
    }
    export interface TdHTMLAttributes<T = HTMLTableCellElement> extends HTMLAttributes<T> {
      colSpan?: number;
      rowSpan?: number;
      headers?: string;
      scope?: string;
    }
    export interface ThHTMLAttributes<T = HTMLTableCellElement> extends HTMLAttributes<T> {
      colSpan?: number;
      rowSpan?: number;
      scope?: string;
      abbr?: string;
    }
  }
}
`;

const JSX_RUNTIME_DEFS = `declare module 'react/jsx-runtime' {
  import { React } from 'react';

  export function jsx(type: any, props: any, key?: any): JSX.Element;
  export function jsxs(type: any, props: any, key?: any): JSX.Element;
  export const Fragment: React.ComponentType<{ children?: React.ReactNode }>;
}

declare module 'react/jsx-dev-runtime' {
  import { React } from 'react';

  export function jsxDEV(type: any, props: any, key?: any): JSX.Element;
  export const Fragment: React.ComponentType<{ children?: React.ReactNode }>;
}`;

const STYLED_COMPONENTS_DEFS = `declare module 'styled-components' {
  /**
   * Imports the NAMESPACE, not the module: 'HTMLAttributes' and its siblings are members of
   * 'React' inside the 'react' block, so 'import * as React' resolves none of them. Without this
   * line every 'styled.<tag>' takes an error type, the props of an interpolation collapse to 'any'
   * and 'theme' stops completing - which is exactly what happened, unseen, because 'skipLibCheck'
   * silences a broken declaration file.
   */
  import { React } from 'react';

  export interface Theme {
    /** Which theme is in effect, and which side it comes from - useful for choosing opacity. */
    id: string;
    base: 'dark' | 'light';
    colors: {
      background: string;
      surface: string;
      surfaceHover: string;
      cardHover: string;
      /** Outlines an object: a field, a card, a menu, a floating panel. */
      border: string;
      /** Divides regions that already differ in fill - weaker than \`border\`, on purpose. */
      borderSubtle: string;
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
      text: string;
      textSecondary: string;
      textMuted: string;
      inputBackground: string;
      scrollbar: string;
      scrollbarThumb: string;
      shadow: string;
      overlay: string;
      calendarToday: string;
      info: string;
      white: string;
      aiOpenai: string;
      aiAnthropic: string;
      aiGoogle: string;
      aiMistral: string;
      aiCohere: string;
      aiOllama: string;
      aiOther: string;
      /**
       * The palette is OPEN: besides the tokens above, which belong to the kernel, it carries the ones
       * installed extensions contribute - caseStatusWon comes from Cases, contractStatusActive from
       * Contracts. Reading a token nobody contributed returns undefined, so handle the absence.
       */
      [token: string]: string | undefined;
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

  /**
   * The component that a styled template produces.
   *
   * Declared as a callable type, not as an interface extending React.ComponentType: an interface
   * extending a function TYPE alias is not itself callable, and JSX then rejects every styled
   * component with "does not have any construct or call signatures".
   *
   * The index signature is what lets you pass a '$'-prefixed prop through to the template.
   */
  export type StyledComponent<P = Record<string, unknown>> = (
    props: P & { children?: React.ReactNode; key?: string | number } & Record<string, any>,
  ) => JSX.Element;

  /**
   * A value that may appear in a styled template: a literal, or a function of the props.
   *
   * The props include 'theme', so 'theme.colors.primary' completes and a token that does not exist is
   * caught. They also allow any '$'-prefixed prop of your own without being declared up front - the
   * escape hatch for a value that comes from data (a tag colour, for instance).
   */
  export type Interpolation<P> =
    | string | number | boolean | null | undefined
    | ((props: P) => string | number | boolean | null | undefined);

  export interface ThemedStyledFunction<T, O = Record<string, unknown>> {
    <U = Record<string, unknown>>(
      strings: TemplateStringsArray,
      ...interpolations: Interpolation<T & U & { theme: Theme } & Record<string, any>>[]
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
    article: ThemedStyledFunction<React.HTMLAttributes<HTMLElement>>;
    aside: ThemedStyledFunction<React.HTMLAttributes<HTMLElement>>;
    nav: ThemedStyledFunction<React.HTMLAttributes<HTMLElement>>;
    main: ThemedStyledFunction<React.HTMLAttributes<HTMLElement>>;
    ul: ThemedStyledFunction<React.HTMLAttributes<HTMLUListElement>>;
    ol: ThemedStyledFunction<React.HTMLAttributes<HTMLOListElement>>;
    li: ThemedStyledFunction<React.LiHTMLAttributes<HTMLLIElement>>;
    a: ThemedStyledFunction<React.AnchorHTMLAttributes<HTMLAnchorElement>>;
    hr: ThemedStyledFunction<React.HTMLAttributes<HTMLHRElement>>;
    h4: ThemedStyledFunction<React.HTMLAttributes<HTMLHeadingElement>>;
    h5: ThemedStyledFunction<React.HTMLAttributes<HTMLHeadingElement>>;
    h6: ThemedStyledFunction<React.HTMLAttributes<HTMLHeadingElement>>;
    table: ThemedStyledFunction<React.HTMLAttributes<HTMLTableElement>>;
    thead: ThemedStyledFunction<React.HTMLAttributes<HTMLTableSectionElement>>;
    tbody: ThemedStyledFunction<React.HTMLAttributes<HTMLTableSectionElement>>;
    tr: ThemedStyledFunction<React.HTMLAttributes<HTMLTableRowElement>>;
    td: ThemedStyledFunction<React.TdHTMLAttributes<HTMLTableCellElement>>;
    th: ThemedStyledFunction<React.ThHTMLAttributes<HTMLTableCellElement>>;
    img: ThemedStyledFunction<React.ImgHTMLAttributes<HTMLImageElement>>;
    select: ThemedStyledFunction<React.SelectHTMLAttributes<HTMLSelectElement>>;
    form: ThemedStyledFunction<React.FormHTMLAttributes<HTMLFormElement>>;
  }

  const styled: StyledInterface;
  export default styled;
  export { styled };
  export function useTheme(): Theme;
}`;

const UI_MODULE_DEFS = `declare module '@microteia/ui' {
  import { React } from 'react';
  import { RecordCardAction } from '@microteia/data';

  /**
   * The attributes every STYLED component accepts, because each one wraps a real element: a Card is a
   * 'div', a Badge is a 'span', a Button is a 'button'. The index signature is deliberate - a DOM
   * element takes 'data-*' and 'aria-*' too, and pretending otherwise only blocks legitimate code.
   *
   * Declared here instead of extending 'React.HTMLAttributes': inside an ambient 'declare module' the
   * React namespace does not resolve the same way in every project, and 'skipLibCheck' hides the
   * failure - the props silently lose everything but 'children', and the editor rejects an onClick.
   */
  export interface StyledElementProps {
    children?: any;
    className?: string;
    style?: Record<string, string | number>;
    title?: string;
    id?: string;
    role?: string;
    tabIndex?: number;
    hidden?: boolean;
    onClick?: (event: any) => void;
    onMouseEnter?: (event: any) => void;
    onMouseLeave?: (event: any) => void;
    onKeyDown?: (event: any) => void;
    [attribute: string]: any;
  }

  /** Props of the standard button. */
  /** A styled 'button': every button attribute is accepted, besides the ones below. */
  export interface ButtonProps extends StyledElementProps {
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

  /**
   * The widget GRID of a surface. Renders whatever the installed extensions registered under that
   * name, in the order and width set in Settings. It does not receive the widgets: the registry knows
   * them, not the host.
   */
  export interface WidgetSurfaceProps {
    surface: string;
    emptyMessage?: string;
  }
  export function WidgetSurface(props: WidgetSurfaceProps): JSX.Element;

  /**
   * Time-series chart. Each series is a line, with the label and colour decided by whoever owns the
   * data - the component knows nothing about the chart's subject. With more than one series, a
   * legend names them by their label.
   */
  export interface ChartSeries {
    key: string;
    label: string;
    color: string;
  }
  export interface TimeSeriesChartProps {
    data: Array<Record<string, string | number>>;
    xKey: string;
    series: ChartSeries[];
    height?: number;
  }
  export function TimeSeriesChart(props: TimeSeriesChartProps): JSX.Element;

  /** Donut chart: one slice per item, in whatever colour the data says. */
  export interface DonutSlice {
    name: string;
    value: number;
    color: string;
  }
  export interface DonutChartProps {
    data: DonutSlice[];
    height?: number;
  }
  export function DonutChart(props: DonutChartProps): JSX.Element;

  /**
   * Bar chart. It knows nothing about what it draws: one series per number, with the label and the
   * colour decided by whoever holds the data. Set stacked to pile the series instead of placing them
   * side by side. With more than one series, a legend names them by their label.
   */
  export interface BarChartProps {
    data: Array<Record<string, string | number>>;
    xKey: string;
    series: ChartSeries[];
    stacked?: boolean;
    height?: number;
  }
  export function BarChart(props: BarChartProps): JSX.Element;

  /** Props of the info banner. */
  export interface InfoBannerProps {
    message: string;
    variant?: 'warning' | 'info';
  }
  export function InfoBanner(props: InfoBannerProps): JSX.Element;

  /** Props of the composite filter. */
  export interface FilterOption {
    value: string;
    label: string;
    color?: string;
  }

  export interface FilterDef {
    key: string;
    label: string;
    type: 'select' | 'multiselect' | 'text' | 'date' | 'dateRange' | 'number' | 'boolean';
    options?: FilterOption[];
    placeholder?: string;
  }

  export interface FilterToken {
    key: string;
    values: string[];
  }

  export interface CompositeFilterProps {
    defs: FilterDef[];
    tokens: FilterToken[];
    onChange: (tokens: FilterToken[]) => void;
    placeholder?: string;
    /** Where the user's saved filters are stored. Null keeps them out of the saved list. */
    screenKey?: string | null;
  }
  export function CompositeFilter(props: CompositeFilterProps): JSX.Element;

  export interface SearchSelectOption {
    value: string;
    label: string;
    meta?: string;
    color?: string;
    icon?: React.ComponentType<{ size?: number }>;
  }

  /** Props of SearchSelect. */
  export interface SearchSelectProps {
    options: SearchSelectOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    label?: string;
  }
  export function SearchSelect(props: SearchSelectProps): JSX.Element;

  /** Props of MultiSearchSelect. */
  export interface MultiSearchSelectProps {
    options: SearchSelectOption[];
    value: string[];
    onChange: (value: string[]) => void;
    placeholder?: string;
    disabled?: boolean;
  }
  export function MultiSearchSelect(props: MultiSearchSelectProps): JSX.Element;

  /** Props of DateInput. */
  export interface DateInputProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
  }
  export function DateInput(props: DateInputProps): JSX.Element;

  /** Props of Badge. */
  /** A styled 'span': every span attribute is accepted. */
  export interface BadgeProps extends StyledElementProps {
    children?: React.ReactNode;
    color?: string;
  }
  export function Badge(props: BadgeProps): JSX.Element;

  /** Props of ColorDot. */
  /** A styled 'span': every span attribute is accepted. */
  export interface ColorDotProps extends StyledElementProps {
    color: string;
  }
  export function ColorDot(props: ColorDotProps): JSX.Element;

  /** Props of Card. */
  /**
  * A styled 'div', so it takes every div attribute - 'onClick', 'style', 'title', data-*. Declaring
  * only 'children' was wrong, and the symptom was the editor rejecting a clickable card.
  */
  export interface CardProps extends StyledElementProps {
    children?: React.ReactNode;
  }
  export function Card(props: CardProps): JSX.Element;

  /** Props of Input. */
  export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    $hasError?: boolean;
  }
  export function Input(props: InputProps): JSX.Element;

  /** Props of Textarea. */
  export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}
  export function Textarea(props: TextareaProps): JSX.Element;

  /** Props of MaskedInput. */
  export interface MaskedInputProps {
    value: string;
    onChange: (value: string) => void;
    mask: string;
    placeholder?: string;
    disabled?: boolean;
  }
  export function MaskedInput(props: MaskedInputProps): JSX.Element;

  /** Props of CurrencyInput. */
  export interface CurrencyInputProps {
    value: number;
    onChange: (value: number) => void;
    disabled?: boolean;
  }
  export function CurrencyInput(props: CurrencyInputProps): JSX.Element;

  /** Props of Modal. */
  export interface ModalProps {
    title: string;
    onClose: () => void;
    size?: 'small' | 'medium' | 'large' | 'xlarge';
    children?: React.ReactNode;
  }
  export function Modal(props: ModalProps): JSX.Element;

  /** Props of ConfirmModal. */
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

  /** One item of the dropdown menu. */
  export interface DropdownItem {
    id: string;
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    variant?: 'default' | 'danger';
    /** Shown but not clickable - e.g. a record action whose disabledWhen holds. */
    disabled?: boolean;
  }
  /** Props of Dropdown. */
  export interface DropdownProps {
    trigger: React.ReactNode;
    items: DropdownItem[];
    align?: 'left' | 'right';
  }
  export function Dropdown(props: DropdownProps): JSX.Element;

  /**
   * Props of HtmlView - THIRD-PARTY HTML in an isolated frame (no script, no access to the
   * application's origin). The content scrolls inside the frame: the height is fixed by design.
   */
  export interface HtmlViewProps {
    html: string;
    height?: number;
    emptyMessage?: string;
  }
  export function HtmlView(props: HtmlViewProps): JSX.Element;

  /** Props of Spinner. */
  /** A styled 'div': every div attribute is accepted. */
  export interface SpinnerProps extends StyledElementProps {
    /** Diameter in pixels (24 by default) - not a named step. */
    size?: number;
  }
  export function Spinner(props: SpinnerProps): JSX.Element;

  /** Props of Checkbox. */
  export interface CheckboxProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label?: string;
    disabled?: boolean;
  }
  export function Checkbox(props: CheckboxProps): JSX.Element;

  /** Props of EntityListCard. */
  export interface EntityCardAction {
    key: string;
    icon: React.ReactNode;
    title: string;
    onClick: () => void;
    danger?: boolean;
    disabled?: boolean;
  }
  export interface EntityCardMetaRow {
    key: string;
    icon?: React.ReactNode;
    value: React.ReactNode;
  }
  export interface EntityCardTag {
    id: string;
    name: string;
    color: string;
  }

  /**
   * The card takes rendered SLOTS, not a record: it knows nothing about screens or fields, which is
   * what lets a screen put anything in the avatar, the title or the rows. Get the values from
   * useEntityList(...) — getCardTitle, getCardSubtitle, getCardImageUrl, getCardActions.
   */
  export interface EntityListCardProps {
    avatar: React.ReactNode;
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    actions?: EntityCardAction[];
    metaRows: EntityCardMetaRow[];
    tags?: EntityCardTag[];
    /** Below the header, before the meta rows (e.g. status badges). */
    belowHeader?: React.ReactNode;
    /** After the meta rows (e.g. extra fields). */
    extra?: React.ReactNode;
    /** In the footer, after the tags (e.g. an amount). */
    footer?: React.ReactNode;
    /** Colored stripe at the top of the card — severity at a glance. */
    accentColor?: string;
    onClick?: () => void;
  }
  export function EntityListCard(props: EntityListCardProps): JSX.Element;

  /** Props of CustomFieldMetaRows. Build the items with useEntityList(...).getCardItems(record). */
  export interface CustomFieldMetaRowsProps {
    items: {
      key: string;
      label?: string;
      value: string;
      badges?: { label: string; color?: string }[];
      type: 'text' | 'markdown';
    }[];
  }
  export function CustomFieldMetaRows(props: CustomFieldMetaRowsProps): JSX.Element;

  /** Renders Markdown already styled - the same as an annotation's content. */
  export interface MarkdownContentProps {
    children?: string;
  }
  export function MarkdownContent(props: MarkdownContentProps): JSX.Element;

  /**
   * One link, drawn and followed exactly as a link inside MarkdownContent: an href starting with
   * '/microteia/' (e.g. '/microteia/view-dyn:<screen>:<recordId>', the address a mention writes) opens
   * that tab in the workspace; any other href opens in a new window. Use it to show a value written as
   * '[label](href)' without rendering a whole Markdown block. Inside a clickable parent, stop the click
   * propagation around it, or the parent's click runs too.
   */
  export interface MarkdownLinkProps {
    href?: string;
    children?: React.ReactNode;
  }
  export function MarkdownLink(props: MarkdownLinkProps): JSX.Element;

  /** Markdown editor with a formatting bar, mentions (@) and preview. */
  export interface MarkdownEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    readOnly?: boolean;
  }
  export function MarkdownEditor(props: MarkdownEditorProps): JSX.Element;

  /** The user's photo, falling back to their initials when the image is missing or fails. */
  export interface UserAvatarProps {
    src?: string | null;
    name: string;
    size?: number;
    showBorder?: boolean;
    /** Shown when there is no image, or it fails to load. Defaults to the name's initial. */
    fallback?: React.ReactNode;
  }
  export function UserAvatar(props: UserAvatarProps): JSX.Element;

  /** The whole "Documents" tab, fed by useRecordDocuments from '@microteia/data'. */
  export interface DocumentsPanelProps {
    controller: any;
    /** May delete an attached document - the delete permission of the record's collection. */
    canDelete: boolean;
    /** May remove a document TYPE from the organization's shared list. */
    canManageTypes: boolean;
  }
  export function DocumentsPanel(props: DocumentsPanelProps): JSX.Element;

  /**
   * Uploads a 'file' field's content and returns the download URL to store in the field.
   * Get it from useEntityForm(...).fileUpload. Without it, 'file' fields render read-only.
   */
  export interface FieldFileUpload {
    upload: (fieldKey: string, file: File) => Promise<string>;
  }

  /** Props of CustomFieldsSection. */
  export interface CustomFieldsSectionProps {
    fields: any[];
    values: Record<string, any>;
    onChange: (fieldKey: string, value: any) => void;
    errors?: Record<string, string>;
    disabled?: boolean;
    /** Merges several fields at once — powers the onChange field effects. */
    onMergeValues?: (patch: Record<string, any>) => void;
    /** Required for 'file' fields to accept uploads. */
    fileUpload?: FieldFileUpload;
    /**
     * The record does not exist on the server yet. Exposed to the front-only field expressions
     * ('hiddenWhen', 'disabledWhen', 'onChange') as 'isNew', so a field can show up only while the
     * record is being created — or only while editing one that already exists. Pass the 'isNew' of
     * useEntityForm(...). Missing = an existing record.
     */
    isNew?: boolean;
    /**
     * Some field was changed and not saved yet. Exposed to the same front-only field expressions as
     * 'isDirty'. Pass the 'isDirty' of useEntityForm(...). Missing = an untouched form.
     */
    isDirty?: boolean;
  }
  export function CustomFieldsSection(props: CustomFieldsSectionProps): JSX.Element;
  
  /** Alias of CustomFieldsSection. */
  export function EntityForm(props: CustomFieldsSectionProps): JSX.Element;

  /** Props of FieldInput. */
  export interface FieldInputProps {
    field: any;
    value: any;
    onChange: (value: any) => void;
    disabled?: boolean;
    error?: string;
    showLabel?: boolean;
    /** Required for a 'file' field to accept uploads. */
    fileUpload?: FieldFileUpload;
  }
  export function FieldInput(props: FieldInputProps): JSX.Element;

  /** Atoms (base components) for building custom cards. */
  export const CardAtoms: {
    Title(props: { children?: React.ReactNode }): JSX.Element;
    Subtitle(props: { children?: React.ReactNode }): JSX.Element;
    Meta(props: { children?: React.ReactNode }): JSX.Element;
    Tags(props: { children?: React.ReactNode }): JSX.Element;
    Actions(props: { children?: React.ReactNode }): JSX.Element;
  };

  /** Props of EntityListView. */
  export interface EntityListViewProps {
    title: string;
    titleIcon?: React.ReactNode;
    /** A piece attached to the TITLE (a counter, say), rather than next to the "new" button. */
    titleExtra?: React.ReactNode;
    onNew: () => void;
    newTitle: string;
    newIcon?: React.ReactNode;

    filterDefs: FilterDef[];
    filterTokens: FilterToken[];
    onFilterChange: (tokens: FilterToken[]) => void;
    filterPlaceholder: string;
    savedFiltersScreenKey: string;

    isLoading: boolean;
    isEmpty: boolean;
    emptyIcon: React.ReactNode;
    emptyTitle: string;
    emptyActionLabel: string;

    /** 'page' (the default) fills the window; 'embedded' renders inside a detail tab. */
    variant?: 'page' | 'embedded';
    /** The screen creates records. False hides the "new" button - a list only the system feeds. */
    canCreate?: boolean;
    /** 'grid' (the default) lays cards out in columns; 'list' gives each card the full width. */
    layout?: 'grid' | 'list';
    /** Extra actions in the header, before the "new" button. */
    headerExtra?: React.ReactNode;
    /** A band between the header and the filter - where a totals bar goes. */
    belowHeader?: React.ReactNode;

    children: React.ReactNode;
    modals?: React.ReactNode;
  }
  export function EntityListView(props: EntityListViewProps): JSX.Element;

  /** Props of RecordListSurface. */
  export interface RecordListSurfaceProps {
    vm: any;
    definition: any;
    variant?: 'page' | 'embedded';
    renderSubtitle?: (record: any) => React.ReactNode;
    renderBelowHeader?: (record: any) => React.ReactNode;
    /** Rows added to the top of the card - for what a field declaration cannot express. */
    renderMetaRows?: (record: any) => { key: string; icon?: React.ReactNode; value: string }[];
    /** Colour of the stripe atop the card, per record - the accent read before any text. */
    accentColor?: (record: any) => string | undefined;
    onOpenRecord?: (record: any) => void;
    onNewRecord?: () => void;
    /** The screen creates records. False hides the "new" button - a list only the system feeds. */
    canCreate?: boolean;
    /** Empty-state texts, when the screen prefers its own to the generic ones. */
    emptyTitle?: string;
    emptyActionLabel?: string;
    /** Extra actions in the page header, before the "new" button. */
    headerActions?: React.ReactNode;
    /** A band between the header and the filter - where a totals bar goes. */
    summary?: React.ReactNode;
  }
  export function RecordListSurface(props: RecordListSurfaceProps): JSX.Element;

  /** Props of EntityListModals. */
  export interface EntityListModalsProps {
    vm: any;
  }
  export function EntityListModals(props: EntityListModalsProps): JSX.Element;

  /** Resolves a card action's icon. */
  export function cardActionIcon(action: RecordCardAction, size?: number): React.ReactNode;

  /** Props of RecordDetailSurface. */
  export interface RecordDetailSurfaceProps {
    vm: any;
  }
  export function RecordDetailSurface(props: RecordDetailSurfaceProps): JSX.Element;

  /** Props of Icon. */
  export interface IconProps {
    name: string;
    size?: number;
  }
  export function Icon(props: IconProps): JSX.Element;

  export { styled, useTheme } from 'styled-components';
}`;

const DATA_MODULE_DEFS = `declare module '@microteia/data' {
  import { CustomFieldMetaRowsProps, FieldFileUpload, FilterDef, FilterToken } from '@microteia/ui';

  /** Records of any collection described by a screen in the organization. */
  export function useCollection(collection: string): any[];

  /** Writes fields of a record in any collection. */
  export function useUpdateRecord(): (collection: string, recordId: string, data: Record<string, any>) => Promise<void>;

  /** Creates a record in a collection. Authorship (who, name, photo) is stamped by the host. */
  export function useCreateRecord(): (collection: string, data: Record<string, any>) => Promise<any>;

  /** Deletes a record (along with its notes and documents, like the native delete). */
  export function useDeleteRecord(): (collection: string, recordId: string) => Promise<void>;

  /**
   * WHO is using the system - what a screen needs in order to know what is MINE (what I have not read
   * yet, the comment I may edit, the like that is already mine).
   *
   * 'permissions' is here so you can DRAW - show the delete button to whoever may delete. What blocks
   * a write is still the server rule.
   */
  export interface ExtensionViewer {
    id: string;
    name: string;
    photoURL: string | null;
    /** The EFFECTIVE permissions of the viewer. To ask about one of them, use useCan(). */
    permissions: string[];
    /** The current organization - what a server function receives to know where to act. */
    tenantId: string;
    /** The locale in effect for this person (BCP-47: 'en', 'pt-BR'). */
    locale: string;
  }
  export function useCurrentUser(): ExtensionViewer;

  /**
   * "May this person?" - the only authorization question an extension asks.
   *
   * It takes no role: your extension declares the permissions it brings (the 'access.permission'
   * contribution point) and asks about them. Grouping permissions into access profiles is the
   * organization's job, and you never need to know which profiles exist.
   *
   * Every screen collection gets four permissions for free: '<collection>.read', '.create',
   * '.update' and '.delete'.
   */
  export function useCan(): (permission: string) => boolean;

  /**
   * The DOCUMENTS of a record, driven by the same controller as the native "Documents" tab. Handed to
   * the DocumentsPanel component from '@microteia/ui', it gives you the whole tab - upload, type and
   * delete.
   */
  export function useRecordDocuments(collection: string, recordId: string | null, enabled?: boolean): any;

  export interface LookupOption {
    key: string;
    label: string;
    color?: string;
  }
  /**
   * The options of ANY list by collection name - from the kernel ('caseStatuses', 'casePhases',
   * 'caseAreas'...) or created in the organization. The shortcuts below are aliases of this one.
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
    /** The records' collection - differs from screenKey when the screen is a view over another entity. */
    collection: string | null;
    fields: any[];
    records: any[];
    isLoading: boolean;
    /** The options (dropdown/select) of a specific field. */
    optionsFor: (fieldKey: string) => EntityFieldOption[];
    /** Opens a record's detail. */
    openRecord: (recordId: string) => void;
    /** Opens the form for creating a new record. */
    newRecord: () => void;
    /** Opens the form for cloning a record. */
    cloneRecord: (recordId: string) => void;
    /** Deletes a record (no cascade). */
    deleteRecord: (recordId: string) => Promise<void>;
  }
  /**
   * Access a dynamic entity (a custom screen) by its sourceId.
   * Returns the schema, the records and navigation functions.
   */
  export function useEntity(sourceId: string): ExtensionEntity;

  export interface RecordCardAction {
    key: string;
    title: string;
    danger?: boolean;
    disabled?: boolean;
    /** Switch state when the action declares activeWhen: true on, false off; absent, a plain button. */
    active?: boolean;
    /** Present on custom actions - the view resolves it against the curated screen icon set. */
    iconKey?: string;
    onClick: () => void;
  }

  /**
   * What useEntityList returns. Every member is declared, so a misspelt one is a type error rather than
   * an undefined at run time. Hand the whole object to RecordListSurface / EntityListModals as vm.
   */
  export interface RecordListViewModel {
    /** The screen, or null while it loads or when no screen has this sourceId. */
    definition: any | null;
    /** The records' collection - the screen key, or the target collection when it is a view. */
    collection: string;
    isAvailable: boolean;
    isLoading: boolean;
    /**
     * The WHOLE list - locked to the parent when options.parent is given, in the order of
     * options.sortRecords, and blind to the filter the person typed. Use it to count, to find a record
     * by id, to compute totals. To draw the list, use filteredRecords.
     */
    records: any[];
    /**
     * The list the screen DRAWS: records after the filter the person typed (and the defaultFilterTokens),
     * in the order of options.sortRecords. Draw this one even in a parent tab with no filter bar - the
     * list a person can narrow is the one they expect to see.
     */
    filteredRecords: any[];
    filterTokens: FilterToken[];
    filterDefs: FilterDef[];
    setFilterTokens: (tokens: FilterToken[]) => void;
    /** Pass to CompositeFilter as screenKey, so saved filters belong to this screen. */
    savedFiltersScreenKey: string;
    tags: { id: string; name: string; color: string }[];
    /** What this person may do in this collection. Hide what the rules would refuse. */
    canRead: boolean;
    canCreate: boolean;
    canUpdate: boolean;
    canDeleteRecords: boolean;
    /** Opens the form of a new record - with the parent field filled in when options.parent is given. */
    openNewRecord: () => void;
    openRecord: (record: any) => void;
    getCardItems: (record: any) => CustomFieldMetaRowsProps['items'];
    getCardTitle: (record: any) => string;
    getCardSubtitle: (record: any) => string;
    cardSubtitleIconKey: string | null;
    /**
     * The text of ANY field of the screen, formatted by its type (currency, date, option label, name of
     * the referenced record) - not only the ones marked for the list. Empty when the field does not
     * exist or has no value, so whoever composes their own line can simply skip it.
     */
    getFieldText: (record: any, fieldKey: string) => string;
    getCardImageUrl: (record: any) => string | null;
    getCardActions: (record: any) => RecordCardAction[];
    /** State for EntityListModals - read it through vm, not directly. */
    parameterPrompt: any;
    pendingCardAction: { action: any; record: any } | null;
    confirmPendingCardAction: () => void;
    cancelPendingCardAction: () => void;
    tagAdapter: any;
    tagManagerRecord: any | null;
    closeTagManager: () => void;
    recordToDelete: any | null;
    cancelDelete: () => void;
    confirmDelete: () => Promise<void>;
    isDeleting: boolean;
  }

  export interface EntityListOptions {
    /** Tab prefix of the extension's own editor screen (to open/clone into it). */
    editKeyPrefix?: string;
    /**
     * The filters the list OPENS with, when "everything" is not the useful view (Finance opens on the
     * current month). The user changes them freely afterwards - a starting point, not a lock.
     */
    defaultFilterTokens?: { key: string; values: string[] }[];
    /**
     * The order of BOTH records and filteredRecords. Without it, the collection's order applies - most
     * recent first. Declare it instead of sorting by hand, and declare the comparator OUTSIDE the
     * component.
     */
    sortRecords?: (a: any, b: any) => number;
    /**
     * Locks the list to ONE record. A lock, not a filter the user can clear. Card actions see surface
     * 'parentTab' and the relation to the parent, and openNewRecord() opens the form with the field
     * already filled. Made for a tab contributed to a record's detail (see RecordTabProps).
     *
     * fieldKey locks by one field; fieldKeys by several - a record enters when ANY of them points at
     * recordId. "Points" is equality on a single reference and "contains" on a reference with
     * multi: true, which is what gives the other side of a many-to-many link its tab (the projects a
     * person works on, whichever role). openNewRecord() fills the FIRST field (as a one-id list when it
     * is multi), and Unlink removes recordId from every field that points at it - from the list, on a
     * multi field, leaving the other ids where they are.
     */
    parent?: { fieldKey: string; recordId: string } | { fieldKeys: string[]; recordId: string };
  }
  /**
   * List a dynamic entity, with filters and card actions.
   * Returns a complete view model to hand to RecordListSurface.
   */
  export function useEntityList(sourceId: string, options?: EntityListOptions): RecordListViewModel;

  export interface EntityForm {
    screen: any | null;
    screenKey: string;
    fields: any[];
    isNew: boolean;
    /** Some field was changed and not saved yet. Pass to EntityForm so its expressions see it. */
    isDirty: boolean;
    values: Record<string, any>;
    /** The value of a field, by key. */
    getValue: (fieldKey: string) => any;
    /** Sets the value of a field. */
    setValue: (fieldKey: string, value: any) => void;
    errors: Record<string, string>;
    /** Validates the form (required fields). Returns true when valid. */
    validate: () => boolean;
    /** Saves the record (creating or updating). Returns { id }, or null when invalid. */
    save: () => Promise<{ id: string } | null>;
    isSaving: boolean;
    /** Pass to FieldInput/EntityForm so 'file' fields can upload. */
    fileUpload: FieldFileUpload | null;
  }
  /**
   * A form for creating or editing a dynamic entity.
   * Manages state, validation and saving.
   */
  export function useEntityForm(sourceId: string, recordId?: string | null): EntityForm;

  /**
   * The props of a code tab contributed to a record's detail - a 'ui.tab' whose surface is
   * recordSurface('<screen sourceId>'). The tab is only shown for a saved record, never a new one.
   */
  export interface RecordTabProps {
    recordId: string;
    /** The record as stored. The tab re-renders with the new value when it changes. */
    record: Record<string, any>;
    /** The collection the screen's data lives in (honours dataCollection). */
    collection: string;
    /** The sourceId of the screen whose detail hosts the tab. */
    screenSourceId: string;
  }

  export interface EntityDetailVM {
    record: any | null;
    isLoading: boolean;
    [key: string]: any;
  }
  /**
   * A view model for the detail of a dynamic entity.
   * Returns the record and its loading state.
   */
  export function useEntityDetailVM(sourceId: string, recordId: string): EntityDetailVM;

  export interface WorkspaceHook {
    /** Opens a tab in the workspace. */
    openTab: (tabKey: string) => void;
    /** Closes a tab. */
    closeTab: (tabKey: string) => void;
    /** The currently active tab. */
    activeTab: string | null;
    /** Renames an open tab - how a detail view says which record it is showing. */
    setTabTitle: (key: string, title: string) => void;
  }
  /** Control the workspace tabs. */
  export function useWorkspace(): WorkspaceHook;

  /**
   * Opens a record's detail by COLLECTION, without knowing which screen presents it: whichever screen
   * is installed today answers (the generic one, or the custom editor of whoever declares one). This is
   * how you open a record of another entity - a case from a board, the contract behind an entry. A
   * collection with no screen at all opens nothing.
   */
  export function useOpenRecord(): (collection: string, recordId: string) => void;

  export interface CollectionIdentity {
    /** The key of the screen that presents the collection today. */
    screenKey: string;
    title: string;
    titlePlural: string;
    icon: string | null;
  }
  /**
   * How a collection PRESENTS itself - the icon and the name of the screen that describes it today -
   * without knowing which screen that is. Made for a surface that shows records of several origins side
   * by side (an agenda, a feed) and has to tell the user where each one came from. It follows the
   * screen: rename it or change its icon and the answer changes, with no record rewritten. Returns null
   * for a collection no installed screen describes.
   */
  export function useCollectionIdentity(): (collection: string | null | undefined) => CollectionIdentity | null;

  /**
   * Opens the LIST of a collection by name, without knowing which screen presents it. The filters are
   * the message to the destination screen ("open showing only the overdue ones").
   *
   * Opens nothing when the viewer cannot READ the collection - the same silence as a collection no
   * installed screen describes. Ask useCan() for "<collection>.read" to decide what to offer.
   */
  export function useOpenScreenList(): (collection: string, filterTokens?: Array<{ key: string; values: string[] }>) => void;

  /** Notify the user (a toast). */
  export function useNotify(): (message: string, variant?: 'success' | 'error' | 'info') => void;

  /**
   * Persist a view's state across sessions.
   * Stored in localStorage under a prefixed key.
   */
  export function useSavedViewState<T>(key: string, initial: T): [T, (value: T) => void];

  /**
   * Builds the universal link to a tab of the system — the same format notifications use in e-mails
   * and browser notifications: \`<origin>/microteia/<tab>?tenant=<current organization>\`. For a record,
   * pass \`record:<collection>:<recordId>\`: it opens through whichever screen describes that collection
   * when someone clicks, so the link survives a screen being replaced.
   */
  export function generateDeepLink(tabKey: string, tenantId?: string): string;

  export interface PointContribution {
    /** Who declared the contribution. */
    pluginId: string;
    id: string;
    metadata: Record<string, any>;
  }
  /**
   * The contributions to an extension POINT - the door between extensions: one publishes the point in
   * its manifest ('extensionPoints'), another fills it in 'contributes', and neither knows the other.
   * Returns only the declared metadata; implementations do not cross the bridge.
   */
  export function useContributions(point: string): PointContribution[];

  export interface RunActionRequest {
    /** The Action by the package's 'templateId' - the address that is stable across organizations. */
    actionSourceId?: string;
    /** The Action by its real id, when the caller already has it. */
    actionId?: string;
    collection: string;
    recordId: string;
    record: Record<string, any>;
    /** The Action's parameters - what this door has and the card's ready-made button does not. */
    params?: Record<string, any>;
  }
  /**
   * Runs one of the organization's Actions on a record, WITH PARAMETERS. This is the path for a gesture
   * that is not a button (dragging a card to another day has to say which day). Works for workflow
   * Actions; a screen command is refused with a message.
   */
  export function useRunAction(): (request: RunActionRequest) => Promise<{ ok: boolean; message: string | null }>;

  /**
   * Evaluates an action's 'hiddenWhen' expression against a record, in the SAME scope as the native
   * card (the fields at the root, plus record, role, surface and user). Returns true when the action
   * should appear. With no expression, it appears - absence is not hiding.
   *
   * Pass the record's collection as entity: it is what "<entity>" becomes in hasPermission, and it
   * shapes the fields the way the open record shows them (dates as yyyy-mm-dd, empty as '', unchecked
   * as false), so the expression answers the same as on the native card. Without it the record is
   * evaluated as it came.
   */
  export function useActionVisible(): (
    hiddenWhen: string | null | undefined,
    record: Record<string, any>,
    surface?: string,
    entity?: string,
  ) => boolean;
}`;

const FORMAT_MODULE_DEFS = `declare module '@microteia/format' {
  /**
   * Formats a number as currency in the locale in effect.
   * The name carries "BRL" for historical reasons: prefer 'formatCurrency' in new code.
   */
  export function formatCurrencyBRL(value: number): string;

  /**
   * Formats a number as currency in the locale in effect. Without 'currency', uses the locale's default.
   */
  export function formatCurrency(value: number, currency?: string): string;

  /** Converts a currency string to a number (cents). */
  export function parseCurrencyDigits(value: string): number;

  /** Converts a Date to the ISO string an input[type=date] expects (YYYY-MM-DD). */
  export function toDateInputValue(date: Date): string;

  /** A date in the format of the locale in effect. Takes a Date or a string; invalid becomes ''. */
  export function formatDate(value: unknown): string;

  /** Applies a template mask ('###.###.###-##'). */
  export function applyMask(value: string, templates: string[]): string;

  /** Strips everything that is not a digit from a string. */
  export function onlyNumbers(value: string): string;
}`;

const I18N_MODULE_DEFS = `declare module '@microteia/i18n' {
  /**
   * The translator for your namespace - normally your extension's id.
   *
   *   const t = useT('com.acme.contracts');
   *   t('form.title')                 // com.acme.contracts/form.title
   *   t('core.ui/action.save')        // ABSOLUTE key: reuses the kernel's own text
   *   t('items', { count: 3 })        // uses 'items.one' / 'items.other' per the locale's plural
   *
   * The texts come from contributions to the 'i18n.messages' point. A key with no translation returns
   * the key itself - an extension without a catalog keeps working.
   */
  export function useT(namespace: string): (key: string, params?: Record<string, unknown>) => string;

  /**
   * Resolves a declarative label: '@ns/key' becomes a translation, plain text passes through untouched.
   * This is what keeps whatever the organization typed out of translation.
   */
  export function useLabel(): (value: string | null | undefined) => string;

  /** The locale in effect, the available ones, and how to change it. */
  export function useLocale(): {
    locale: string;
    preferred: string | null;
    available: string[];
    setLocale: (locale: string) => void;
  };

  /** Formatters already bound to the locale in effect. */
  export function useLocaleFormat(): {
    formatDate: (value: unknown) => string;
    formatDateTime: (value: unknown) => string;
    formatNumber: (value: number | null | undefined, options?: Intl.NumberFormatOptions) => string;
    formatMoney: (value: number | null | undefined, currency?: string) => string;
    compareText: (a: string, b: string) => number;
    currency: string;
  };
}`;

const PORTAL_MODULE_DEFS = `declare module '@microteia/portal' {
  /**
   * What a PORTAL view reaches. A portal view runs in the browser of a guest from outside the
   * organization: it has no access to @microteia/data, @microteia/report, @microteia/settings or
   * @microteia/functions — importing them fails at compile time. It reads only the projections the
   * portal already exposes to that guest.
   */

  /** A record as a portal view sees it: the projection, addressed by the RECORD id. */
  export interface PortalViewRecord {
    collection: string;
    recordId: string;
    title: string;
    /** Only the fields the screen exposes in the portal. */
    data: Record<string, unknown>;
    /** The label of the record each exposed reference field points to. */
    labels: Record<string, string>;
    updatedAt: Date | null;
    /**
     * The guest may change this record now: the screen allows edits, the organization's condition held
     * when the record was last saved and, with \`onlyOwn\`, the guest created it. It only decides whether
     * to SHOW an edit gesture — the server checks everything again on every change.
     */
    canEdit: boolean;
  }

  export interface PortalScreen {
    id: string;
    collection: string;
    titleSingular: string;
    titlePlural: string;
    icon: string;
    documents: boolean;
    parent: { collection: string } | null;
    fields: Array<{ key: string; label: string; type?: string; required?: boolean; options?: Array<{ key: string; label: string }> }>;
    create: { fields: PortalScreen['fields']; link: { collection: string; label: string } } | null;
    /** Guests may attach documents here, choosing one of these types — never a new one. */
    uploads: { types: Array<{ key: string; label: string }> } | null;
    /** What a guest may change — only fields they see —, and whether only on records they created. */
    edit: { fields: PortalScreen['fields']; onlyOwn: boolean } | null;
  }

  export interface PortalDocument {
    id: string;
    name: string;
    type: string | null;
    description: string | null;
    createdAt: Date | null;
  }

  /** The exposed screen of a collection: titles, exposed fields and what a guest fills in to create. */
  export function usePortalScreen(collection: string): PortalScreen | null;

  /**
   * The records of a collection the guest sees — all of them, or only the children of one record
   * (\`parent\`), such as the invoices of the open supplier.
   */
  export function usePortalRecords(
    collection: string,
    options?: { parent?: { collection: string; recordId: string } },
  ): { records: PortalViewRecord[]; loading: boolean };

  export function usePortalRecord(collection: string, recordId: string): PortalViewRecord | null;

  /** Open, go back and create — the same navigation stack the standard portal shows. */
  export function usePortalNavigation(): {
    openRecord(collection: string, recordId: string): void;
    back(): void;
    /** With \`parentRecordId\`, the new record is linked to it and the form does not ask. */
    create(collection: string, parentRecordId?: string): void;
    /** Opens the standard edit form for a record the guest may change (\`canEdit\`). */
    edit(collection: string, recordId: string): void;
  };

  /**
   * The shared documents of a record, the gesture that opens one and — when the screen allows it — the
   * one that attaches a file with one of the offered types (\`uploadTypes\`, \`null\` when not allowed).
   * There is no delete: a guest never removes a document.
   */
  export function usePortalDocuments(collection: string, recordId: string): {
    documents: PortalDocument[];
    loading: boolean;
    open(documentId: string): Promise<void>;
    uploadTypes: Array<{ key: string; label: string }> | null;
    upload(file: File, type: string): Promise<void>;
  };

  /**
   * Creates a record through the portal. The link is stamped by the server from what the guest sees;
   * a validation refusal arrives already translated in the error message.
   */
  export function usePortalSubmit(): (collection: string, linkRecordId: string, data: Record<string, unknown>) => Promise<void>;

  /**
   * Changes a record through the portal. Only the screen's editable fields are kept — whose the record
   * is can never change —, and the server refuses when the organization's condition no longer holds
   * or, with \`onlyOwn\`, the guest did not create the record. A cleared field goes as \`null\`. A
   * validation refusal arrives already translated in the error message.
   */
  export function usePortalUpdate(): (collection: string, recordId: string, data: Record<string, unknown>) => Promise<void>;

  /**
   * Everything a portal LAYOUT needs to draw itself (\`portalView({ surface: 'layout', key, title }, viewKey)\`).
   * The layout component receives the page as \`children\` and places it; brand, menu, user and theme
   * come from here. The organization picks the layout in Settings > Portal. Keep it responsive: the
   * menu must stay reachable below 900px (a drawer, a sheet) — \`navOpen\`/\`toggleNav\` are there for it.
   */
  export interface PortalShell {
    tenant: { name: string; logoURL: string | null };
    home: { title: string; active: boolean };
    menu: Array<{ id: string; title: string; icon: string; active: boolean }>;
    /** The title of what is open — "Home", or the menu entry. */
    pageTitle: string;
    openEntry(id: string): void;
    goHome(): void;
    user: { name: string; email: string; initials: string; photoURL: string | null };
    /** "Automatic" plus the themes available, as the main app offers them; the choice stays in this browser. */
    themes: Array<{ id: string; label: string; primaryColor: string; backgroundColor: string; active: boolean }>;
    setTheme(id: string): void;
    canSwitchOrganization: boolean;
    switchOrganization(): void;
    signOut(): void;
    navOpen: boolean;
    toggleNav(): void;
    closeNav(): void;
    userMenuOpen: boolean;
    toggleUserMenu(): void;
    /** Pass to the user-menu element (\`ref\`): a click outside it closes the menu. */
    attachUserMenu(node: HTMLElement | null): void;
  }

  export function usePortalShell(): PortalShell;

  /** The organization's logo (or initial) and name; clicking goes home. */
  export function PortalBrand(props: { name: string; logoURL: string | null; onClick: () => void }): JSX.Element;

  /** The standard user corner: who is signed in, theme, switch organization, sign out. */
  export function PortalUserMenu(props: { shell: PortalShell }): JSX.Element;
}`;

const THEME_MODULE_DEFS = `declare module '@microteia/theme' {
  /**
   * Resolves a colour to hex, accepting both theme colours and plain hex.
   * @param color - A theme colour name (e.g. 'primary') or a hex value (e.g. '#ff0000')
   */
  export function resolveColor(color: string, theme: any): string;

  /**
   * The colour of a configured option (a phase, an area, a status).
   * @param configs - The options, each with a key and a color
   * @param key - The option's key
   */
  export function getConfigColor(configs: any[], key: string, theme: any, fallback?: string): string;

  /**
   * A default colour for a tag, derived from its index.
   */
  export function getDefaultTagColor(index: number): string;
}`;


const REPORT_MODULE_DEFS = `declare module '@microteia/report' {
  /**
   * The report pieces — the same ones the platform uses to draw a declared report.
   *
   * Writing a report in code is composition, not reimplementation: you lay out the cover, the text
   * between sections and two datasets side by side, and the parts that draw a number stay the
   * platform's. What this module does NOT give you is the data. Numbers arrive through
   * \`useReport\`, which asks the server — and that is where reading each collection the report
   * covers is required. Code replaces the PRESENTATION of a report, never its dataset.
   */

  /** One group key, as the server sends it: the raw value, plus a label when the server derived one. */
  export interface ReportGroupKey {
    dimension: string;
    key: string;
    label?: string;
  }

  export interface ReportRow {
    keys: ReportGroupKey[];
    values: Record<string, number | null>;
    cells?: Record<string, Record<string, number | null>>;
    count: number;
    level: number;
    subtotal?: boolean;
  }

  export interface ReportResult {
    shape: string;
    columns: ReportGroupKey[][];
    rows: ReportRow[];
    totals: { values: Record<string, number | null>; count: number } | null;
    columnTotals?: Record<string, Record<string, number | null>>;
    records?: Record<string, unknown>[];
    scanned: number;
    /**
     * The scan did NOT hit the ceiling — so the numbers cover everything the filters delimit.
     *
     * Say so when it is false. A partial report that does not admit it is the one failure a reader
     * cannot notice on their own.
     */
    complete: boolean;
    completeGroups: boolean;
    generatedAt: string;
  }

  export interface ReportSpecIssue {
    field: string;
    error: string;
    errorParams?: Record<string, string>;
    severity?: 'error' | 'warning';
  }

  export interface UseReportResult {
    report: { id: string; key: string; title: string } | undefined;
    result: ReportResult | null;
    /** What degraded without stopping the report. Show them — the loss is invisible otherwise. */
    issues: ReportSpecIssue[];
    isLoading: boolean;
    /** A message REFERENCE, or null. Resolve it with \`useLabel\` from '@microteia/i18n'. */
    error: string | null;
    errorParams?: Record<string, string>;
    run: (prompts?: Record<string, unknown>) => Promise<void>;
  }

  /** Runs a report from the organization's catalogue, by its key. */
  export function useReport(reportKey: string, prompts?: Record<string, unknown>): UseReportResult;

  /** The whole declared report: header, warnings, chart and fold. Wrap it in your own chrome. */
  export function ReportView(props: { reportKey: string }): JSX.Element;

  /** The grouped table: levels by indent, subtotals as marked rows, total in the footer. */
  export function ReportTable(props: { spec: unknown; result: ReportResult | null }): JSX.Element;

  /** The pivot: rows crossed with columns, group column pinned to the left. */
  export function ReportMatrix(props: { spec: unknown; result: ReportResult | null }): JSX.Element;

  /** The chart the report declares. A mark this version cannot draw simply does not appear. */
  export function ReportChart(props: { spec: unknown; result: ReportResult | null }): JSX.Element;
}`;

const SETTINGS_MODULE_DEFS = `declare module '@microteia/settings' {
  /**
   * The value in effect for a setting, by its full key ('dashboard.widgets'). Already resolved: the
   * user's preference, else the organization's default, else the declared default.
   *
   * A 'select' with 'multi: true' returns string[]; any other 'select' returns a string. With
   * 'optionsFrom', each value is exactly what the matching field stores on a record — the option KEY
   * for a 'lookup', the record ID for an 'entity' — so compare it to the record with ===.
   */
  export function useSettingValue(key: string): unknown;

  /** One chosen value of a 'select' setting, ready to show. */
  export interface SettingChoice {
    /** What is stored — the same value 'useSettingValue' returns. */
    value: string;
    /** The option label or the record title, already translated. */
    label: string;
    /** The option colour, when the list has colours. */
    color?: string;
    /** The value is stored, but the option or record no longer exists. */
    missing: boolean;
  }

  /**
   * The value in effect for a 'select' setting, one entry per chosen value, with its label and colour
   * — so a card title can read "Recent cases · Open, On hold" without reading the collection again.
   * Empty for a setting that is not a 'select'. 'missing' is only ever true when the options could be
   * read; without permission to read the source, values come back as they are.
   */
  export function useSettingChoices(key: string): SettingChoice[];
}`;

const FUNCTIONS_MODULE_DEFS = `declare module '@microteia/functions' {
  /**
   * A server function, by name. Returns the call ready to use: 'callable(payload)' resolves with
   * whatever the function returned, or rejects with the error it threw.
   *
   * Authentication and role are validated by the function itself, on the server side.
   */
  export function useCallable<Request = any, Response = any>(
    name: string,
  ): (payload?: Request) => Promise<Response>;
}`;

/**
 * O `host` que o `startup(host)` recebe. Era o único código de extensão sem IntelliSense nenhum: o
 * autor descobria a forma do objeto lendo um exemplo. Manter sincronizado com `extensionHost.ts`.
 *
 * Não é um módulo do `HOST_MODULES` — o `startup` recebe o host por PARÂMETRO, não por import. Está
 * aqui como tipo global para que `export default function startup(host: ExtensionHost)` resolva.
 */
const HOST_DEFS = `
interface MicroteiaCommandItem {
  id: string;
  /** A message reference ('@ns/key') or the text itself. 'titleParams' interpolates it. */
  title: string;
  titleParams?: Record<string, string>;
  subtitle?: string;
  group: string;
  icon?: any;
  onSelect: () => void;
  keywords?: string[];
}

/**
 * What 'getItems' receives. It is NOT a component - it is a plain function called on every keystroke -
 * so translation arrives here instead of through a hook.
 *
 *   getItems(query, ctx) {
 *     const title = ctx.t('com.acme.contracts/command.new');   // ABSOLUTE key: your own catalog
 *     if (title.toLowerCase().indexOf(query) === -1) return [];
 *     ...
 *   }
 *
 * Compare the query with the TRANSLATED title, never with a hardcoded phrase: otherwise the command is
 * unreachable for anyone typing what they read on screen.
 */
interface MicroteiaCommandContext {
  openTab: (key: string) => void;
  close: () => void;
  records: any[];
  screenDefinitions: any[];
  /** Translator. A key with no '/' resolves in 'core.ui'; 'namespace/key' resolves anywhere. */
  t: (key: string, params?: Record<string, unknown>) => string;
  /**
   * Resolves a declarative label: '@ns/key' becomes a translation, plain text passes through. Use it
   * before comparing a screen or field label with the query - matching against the raw reference finds
   * nothing.
   */
  label: (value: string | null | undefined, params?: Record<string, unknown>) => string;
  /**
   * 'Can this person?' - the only authorization question a command asks. Offer the command to whoever
   * may use it, and the command palette stops listing what the screen behind it would refuse.
   *
   * Ask by PERMISSION, never by profile. Here lived 'userRole' and 'tenantRole', and they left for the
   * reason the viewer object has no role either: which profiles exist is decided by the organization
   * that installed you, and an extension that compared against one was reading a name it invented.
   */
  can: (permission: string) => boolean;
}

interface MicroteiaCommandProvider {
  /** The group heading. A message reference is resolved before it is shown. */
  group: string;
  getItems: (query: string, context: MicroteiaCommandContext) => MicroteiaCommandItem[];
}

interface MicroteiaMentionResult {
  id: string;
  title: string;
  subtitle?: string;
  tabKey: string;
}

interface MicroteiaMentionProvider {
  /** What the person types after '@'. An identifier, not a label: keep it stable across languages. */
  key: string;
  /** A message reference ('@ns/key') or the text itself. */
  label: string;
  description?: string;
  icon?: string;
  search: (query: string, context: { records: any[]; screenDefinitions: any[] }) => MicroteiaMentionResult[];
}

interface MicroteiaSurfaceWidget {
  surface: string;
  key: string;
  title: string;
  icon?: string;
  defaultEnabled?: boolean;
  defaultSpan?: number;
  component: any;
}

interface MicroteiaSettingsSection {
  key: string;
  title: string;
  description?: string;
  icon?: string;
  order?: number;
  /** Permissions that reveal the section in Settings; one of them is enough. Absent = everyone. */
  requiredPermissions?: string[];
  properties?: any[];
  editor?: any;
}

/** The registration surface handed to 'startup(host)'. Return a function to undo the registration. */
interface ExtensionHost {
  commands: { register: (provider: MicroteiaCommandProvider) => void };
  mentions: { register: (provider: MicroteiaMentionProvider) => void };
  widgets: { register: (widget: MicroteiaSurfaceWidget) => void };
  settings: { register: (section: MicroteiaSettingsSection) => void };
}
`;

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
  I18N_MODULE_DEFS,
  THEME_MODULE_DEFS,
  REPORT_MODULE_DEFS,
  SETTINGS_MODULE_DEFS,
  FUNCTIONS_MODULE_DEFS,
  PORTAL_MODULE_DEFS,
  HOST_DEFS,
].join('\n\n');
