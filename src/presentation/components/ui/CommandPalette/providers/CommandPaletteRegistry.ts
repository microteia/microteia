import type { ICommandPaletteProvider } from './ICommandPaletteProvider';
import { NavigationCommandProvider } from './NavigationCommandProvider';
import { NewsCommandProvider } from './NewsCommandProvider';
import { PersonCommandProvider } from './PersonCommandProvider';
import { CaseCommandProvider } from './CaseCommandProvider';
import { ContractCommandProvider } from './ContractCommandProvider';
import { FinancialCommandProvider } from './FinancialCommandProvider';
import { SystemCommandProvider } from './SystemCommandProvider';

export const COMMAND_PALETTE_PROVIDERS: ICommandPaletteProvider[] = [
  NavigationCommandProvider,
  NewsCommandProvider,
  PersonCommandProvider,
  CaseCommandProvider,
  ContractCommandProvider,
  FinancialCommandProvider,
  SystemCommandProvider,
];
