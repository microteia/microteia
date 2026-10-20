import { DEFAULT_LOCALE, messageBundleContribution } from '../../../../domain/schema/i18n';
import type { Contribution } from '../../../../domain/schema/plugin/contribution';

/** **The Record tabs example catalog, in the source language.** The namespace is the PLUGIN ID. */
export const RECORD_TAB_NAMESPACE = 'com.microteia.record-tab-example';

export const RECORD_TAB_MESSAGES: Record<string, string> = {
  'package.name': 'Record tabs, by example',
  'package.category': 'Interface',
  'package.description':
    'A tab of its own inside a record of another screen: a timeline of milestones in each project, with its own look.',
  'package.summary':
    'How an extension shows something INSIDE a record it does not own. It adds two tabs to the detail of a Project: a timeline of the milestones of that project, drawn by a code view that receives the open record, and a declarative tab drawn from a Widget DSL tree. The Milestone screen is NOT a child of Project — the tab is not the generic child-screen list, it is whatever the extension draws.',

  'screen.project': 'Project',
  'screen.project.plural': 'Projects',
  'screen.milestone': 'Milestone',
  'screen.milestone.plural': 'Milestones',

  'nav.milestones': 'Milestones',

  'field.name': 'Name',
  'field.description': 'Description',
  'field.title': 'Title',
  'field.project': 'Project',
  'field.dueDate': 'Due date',
  'field.priority': 'Priority',
  'field.priority.high': 'High',
  'field.priority.medium': 'Medium',
  'field.priority.low': 'Low',
  'field.done': 'Done',
  'field.relatedProjects': 'Also affects',

  'tab.timeline': 'Timeline',
  'tab.timeline.description': 'The milestones of this project, and the ones that also affect it, newest first.',
  'tab.about': 'About these tabs',
  'tab.about.description': 'A declarative tab, which receives no data.',

  'timeline.new': 'New milestone',
  'timeline.empty': 'No milestone in this project yet.',
  'timeline.complete': 'Mark as done',
  'timeline.reopen': 'Reopen',
  'timeline.no-date': 'No due date',
  'timeline.screen-missing': 'The Milestone screen is not installed in this organization.',

  'about.heading': 'Placed by an extension',
  'about.body':
    'Both tabs are `ui.tab` contributions on `recordSurface(\'microteia:record-tab-example:project\')`. The address is the screen\'s `sourceId`, never its installed key — which is what lets an extension add a tab to a screen of ANOTHER extension.\n\nThe timeline is a code view: it receives `RecordTabProps` and lists the milestones with `useEntityList(sourceId, { parent: { fieldKeys: [\'project\', \'relatedProjects\'], recordId } })`, so the list is locked to this project — the milestones that belong to it and the ones whose `multi` field \'Also affects\' contains it — and a new milestone is born linked to it.\n\nThis tab is a Widget DSL tree, so it receives no data.',
};

export const recordTabMessagesContribution = (): Contribution =>
  messageBundleContribution({
    locale: DEFAULT_LOCALE,
    namespace: RECORD_TAB_NAMESPACE,
    messages: RECORD_TAB_MESSAGES,
  });
