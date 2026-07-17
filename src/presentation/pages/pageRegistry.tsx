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
  RiLineChartLine,
  RiHistoryLine,
  RiLayoutGridLine,
  RiFlowChart,
  RiCodeBoxLine,
  RiBookLine,
  RiDatabase2Line,
  RiSparkling2Line,
} from 'react-icons/ri';
import type { UserRole } from '../../domain/entities';
import { DashboardView } from './Dashboard/Dashboard.view';
import { CalendarView } from './Calendar/Calendar.view';
import { PersonsView } from './Persons/Persons.view';
import { ViewPersonView } from './Persons/ViewPerson.view';
import { CasesView } from './Cases/Cases.view';
import { ContractsView } from './Contracts/Contracts.view';
import { ViewContractView } from './ViewContract/ViewContract.view';
import { DeadlinesView } from './Deadlines/Deadlines.view';
import { FinancialsView } from './Financials/Financials.view';
import { ViewFinancialView } from './ViewFinancial/ViewFinancial.view';
import { FinancialDashboardView } from './FinancialDashboard/FinancialDashboard.view';
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
import { AuditLogsView } from './AuditLogs/AuditLogs.view';
import { ScreenBuilderView } from './ScreenBuilder/ScreenBuilder.view';
import { DynamicRecordListView } from './DynamicRecordList/DynamicRecordList.view';
import { ViewDynamicRecordView } from './ViewDynamicRecord/ViewDynamicRecord.view';
import { WorkflowsView } from './Workflows/Workflows.view';
import { ViewWorkflowView } from './ViewWorkflow/ViewWorkflow.view';
import { EditWorkflowStepView } from './EditWorkflowStep/EditWorkflowStep.view';
import { ScriptsView } from './Scripts/Scripts.view';
import { ViewScriptView } from './ViewScript/ViewScript.view';
import { DataProcessorView } from './DataProcessor';
import { FunctionReferenceView } from './FunctionReference/FunctionReference.view';
import { DataFunctionReferenceView } from './DataFunctionReference/DataFunctionReference.view';

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
    keyPrefix: 'new-person:clone:',
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
    keyPrefix: 'new-contract:clone:',
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
  { key: 'financial-dashboard', title: 'Dashboard Financeiro', icon: <RiLineChartLine size={20} />,      component: FinancialDashboardView },
  {
    key: 'new-financial',
    title: 'Novo Lançamento',
    icon: <RiMoneyDollarCircleLine size={20} />,
    component: ViewFinancialView,
  },
  {
    key: '',
    keyPrefix: 'new-financial:clone:',
    title: 'Novo Lançamento',
    icon: <RiMoneyDollarCircleLine size={20} />,
    component: ViewFinancialView,
  },
  {
    key: '',
    keyPrefix: 'view-financial:',
    title: 'Lançamento',
    icon: <RiMoneyDollarCircleLine size={20} />,
    component: ViewFinancialView,
  },
  { key: 'pushes',           title: 'Pushes do Tribunal',  icon: <RiInboxLine size={20} />,              component: PushesView           },
  { key: 'dashboard-pushes', title: 'Dashboard de Pushes', icon: <RiBarChartBoxLine size={20} />,        component: DashboardPushesView  },
  { key: 'news',             title: 'Notícias',            icon: <RiNewspaperLine size={20} />,          component: NewsView             },
  { key: 'tenant-settings',  title: 'Escritório',          icon: <RiBuilding2Line size={20} />,          component: TenantSettingsView,  fullBleed: true },
  { key: '', keyPrefix: 'tenant-settings:', title: 'Escritório', icon: <RiBuilding2Line size={20} />, component: TenantSettingsView, fullBleed: true },
  { key: 'access-management', title: 'Gestão de Acessos', icon: <RiShieldUserLine size={20} />,         component: AccessManagementView, requiredRole: 'SYSTEM' },
  { key: 'audit-logs',       title: 'Auditoria',           icon: <RiHistoryLine size={20} />,           component: AuditLogsView        },
  { key: 'screen-builder',   title: 'Form Design',      icon: <RiLayoutGridLine size={20} />,        component: ScreenBuilderView    },
  {
    key: '',
    keyPrefix: 'dyn:',
    title: 'Tela personalizada',
    icon: <RiLayoutGridLine size={20} />,
    component: DynamicRecordListView,
  },
  {
    key: '',
    keyPrefix: 'new-dyn:',
    title: 'Novo registro',
    icon: <RiLayoutGridLine size={20} />,
    component: ViewDynamicRecordView,
  },
  {
    key: '',
    keyPrefix: 'view-dyn:',
    title: 'Registro',
    icon: <RiLayoutGridLine size={20} />,
    component: ViewDynamicRecordView,
  },
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
    key: '',
    keyPrefix: 'new-case:clone:',
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
  { key: 'workflows',        title: 'Automações',          icon: <RiFlowChart size={20} />,             component: WorkflowsView        },
  {
    key: 'new-workflow',
    title: 'Nova Automação',
    icon: <RiFlowChart size={20} />,
    component: ViewWorkflowView,
  },
  {
    key: '',
    keyPrefix: 'new-workflow:clone:',
    title: 'Nova Automação',
    icon: <RiFlowChart size={20} />,
    component: ViewWorkflowView,
  },
  {
    key: '',
    keyPrefix: 'view-workflow:',
    title: 'Automação',
    icon: <RiFlowChart size={20} />,
    component: ViewWorkflowView,
  },
  {
    key: '',
    keyPrefix: 'edit-workflow-step:',
    title: 'Editar Step',
    icon: <RiFlowChart size={20} />,
    component: EditWorkflowStepView,
  },
  { key: 'scripts',          title: 'Scripts',             icon: <RiCodeBoxLine size={20} />,           component: ScriptsView          },
  {
    key: 'new-script',
    title: 'Novo Script',
    icon: <RiCodeBoxLine size={20} />,
    component: ViewScriptView,
  },
  {
    key: '',
    keyPrefix: 'view-script:',
    title: 'Script',
    icon: <RiCodeBoxLine size={20} />,
    component: ViewScriptView,
  },
  {
    key: 'function-reference',
    title: 'Referência de Expressões',
    icon: <RiBookLine size={20} />,
    component: FunctionReferenceView,
  },
  {
    key: 'data-function-reference',
    title: 'Funções de Dados',
    icon: <RiDatabase2Line size={20} />,
    component: DataFunctionReferenceView,
  },
  {
    key: 'data-processor',
    title: 'Processador de Dados',
    icon: <RiSparkling2Line size={20} />,
    component: DataProcessorView,
  },
];

export const getPageByKey = (key: string): PageDefinition | undefined => {
  const exact = PAGE_REGISTRY.find((p) => p.key === key);
  if (exact) return exact;
  return PAGE_REGISTRY.find((p) => p.keyPrefix && key.startsWith(p.keyPrefix));
};
