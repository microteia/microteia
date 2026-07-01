import React from 'react';
import {
  RiDashboardLine,
  RiCalendar2Line,
  RiTimeLine,
  RiUserLine,
  RiShieldUserLine,
  RiNewspaperLine,
  RiFolderLine,
  RiMoneyDollarCircleLine,
  RiBuilding2Line,
  RiTeamLine,
  RiInboxLine,
  RiBarChartBoxLine,
  RiFileTextLine,
} from 'react-icons/ri';
import type { UserRole } from '../../domain/entities';
import { DashboardView } from './Dashboard/Dashboard.view';
import { CalendarView } from './Calendar/Calendar.view';
import { PersonsView } from './Persons/Persons.view';
import { ViewPersonView } from './ViewPerson/ViewPerson.view';
import { CasesView } from './Cases/Cases.view';
import { ContractsView } from './Contracts/Contracts.view';
import { ViewContractView } from './ViewContract/ViewContract.view';
import { DeadlinesView } from './Deadlines/Deadlines.view';
import { FinancialsView } from './Financials/Financials.view';
import { NewsView } from './News/News.view';
import { PushesView } from './Pushes/Pushes.view';
import { DashboardPushesView } from './DashboardPushes/DashboardPushes.view';
import { AddNewsView } from './AddNews/AddNews.view';
import { ViewNewsView } from './ViewNews/ViewNews.view';
import { ViewCaseView } from './ViewCase/ViewCase.view';
import { ViewDeadlineView } from './ViewDeadline/ViewDeadline.view';
import { AccessManagementView } from './AccessManagement/AccessManagement.view';
import { ProfileView } from './Profile/Profile.view';
import { TenantSettingsView } from './TenantSettings/TenantSettings.view';

export interface PageDefinition {
  key: string;
  keyPrefix?: string;
  title: string | ((tabKey: string) => string);
  icon: React.ReactNode;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: React.ComponentType<any>;
  fullBleed?: boolean;
  requiredRole?: UserRole;
}

export const PAGE_REGISTRY: PageDefinition[] = [
  { key: 'dashboard',        title: 'Dashboard',           icon: <RiDashboardLine size={20} />,         component: DashboardView        },
  { key: 'calendar',         title: 'Calendário',          icon: <RiCalendar2Line size={20} />,          component: CalendarView         },
  { key: 'persons',          title: 'Pessoas',            icon: <RiTeamLine size={20} />,               component: PersonsView          },
  {
    key: 'new-person',
    title: 'Nova Pessoa',
    icon: <RiTeamLine size={20} />,
    component: ViewPersonView,
  },
  {
    key: '',
    keyPrefix: 'view-person:',
    title: 'Pessoa',
    icon: <RiTeamLine size={20} />,
    component: ViewPersonView,
  },
  { key: 'cases',            title: 'Processos',           icon: <RiFolderLine size={20} />,             component: CasesView            },
  { key: 'contracts',        title: 'Contratos',           icon: <RiFileTextLine size={20} />,           component: ContractsView        },
  {
    key: 'new-contract',
    title: 'Novo Contrato',
    icon: <RiFileTextLine size={20} />,
    component: ViewContractView,
  },
  {
    key: '',
    keyPrefix: 'view-contract:',
    title: 'Contrato',
    icon: <RiFileTextLine size={20} />,
    component: ViewContractView,
  },
  { key: 'deadlines',        title: 'Prazos',              icon: <RiTimeLine size={20} />,               component: DeadlinesView        },
  { key: 'financials',       title: 'Financeiro',          icon: <RiMoneyDollarCircleLine size={20} />,  component: FinancialsView       },
  { key: 'pushes',           title: 'Pushes do Tribunal',  icon: <RiInboxLine size={20} />,              component: PushesView           },
  { key: 'dashboard-pushes', title: 'Dashboard de Pushes', icon: <RiBarChartBoxLine size={20} />,        component: DashboardPushesView  },
  { key: 'news',             title: 'Notícias',            icon: <RiNewspaperLine size={20} />,          component: NewsView             },
  { key: 'tenant-settings',  title: 'Escritório',          icon: <RiBuilding2Line size={20} />,          component: TenantSettingsView,  fullBleed: true },
  { key: '', keyPrefix: 'tenant-settings:', title: 'Escritório', icon: <RiBuilding2Line size={20} />, component: TenantSettingsView, fullBleed: true },
  { key: 'access-management', title: 'Gestão de Acessos', icon: <RiShieldUserLine size={20} />,         component: AccessManagementView, requiredRole: 'SYSTEM' },
  { key: 'profile',          title: 'Meu Perfil',          icon: <RiUserLine size={20} />,               component: ProfileView          },
  {
    key: 'add-news',
    title: 'Nova Notícia',
    icon: <RiNewspaperLine size={20} />,
    component: AddNewsView,
  },
  {
    key: '',
    keyPrefix: 'edit-news:',
    title: 'Editar Notícia',
    icon: <RiNewspaperLine size={20} />,
    component: AddNewsView,
  },
  {
    key: '',
    keyPrefix: 'view-news:',
    title: 'Notícia',
    icon: <RiNewspaperLine size={20} />,
    component: ViewNewsView,
  },
  {
    key: '',
    keyPrefix: 'view-case:',
    title: 'Processo',
    icon: <RiFolderLine size={20} />,
    component: ViewCaseView,
  },
  {
    key: 'new-case',
    title: 'Novo Processo',
    icon: <RiFolderLine size={20} />,
    component: ViewCaseView,
  },
  {
    key: 'new-deadline',
    title: 'Novo Prazo',
    icon: <RiTimeLine size={20} />,
    component: ViewDeadlineView,
  },
  {
    key: '',
    keyPrefix: 'view-deadline:',
    title: 'Prazo',
    icon: <RiTimeLine size={20} />,
    component: ViewDeadlineView,
  },
];

export const getPageByKey = (key: string): PageDefinition | undefined => {
  const exact = PAGE_REGISTRY.find((p) => p.key === key);
  if (exact) return exact;
  return PAGE_REGISTRY.find((p) => p.keyPrefix && key.startsWith(p.keyPrefix));
};
