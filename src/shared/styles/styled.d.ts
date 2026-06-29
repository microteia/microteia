import 'styled-components';
import type { Theme } from './theme';

declare module 'styled-components' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- required pattern for styled-components theme augmentation
  export interface DefaultTheme extends Theme {}
}

declare global {
  const __APP_VERSION__: string;
}
