import { DEFAULT_LOCALE, messageBundleContribution } from '../../../../domain/schema/i18n';
import type { Contribution } from '../../../../domain/schema/plugin/contribution';

/** **The Permissions example catalog, in the source language.** The namespace is the PLUGIN ID. */
export const ACCESS_NAMESPACE = 'com.microteia.access-example';

export const ACCESS_MESSAGES: Record<string, string> = {
  'package.name': 'Permissions, by example',
  'package.category': 'Access',
  'package.description':
    'What a collection gives you for free, and what you have to declare: a named resource, two permissions with their closure, and a page that only opens for one of them.',
  'package.summary':
    'How an extension says who may do what. Authorisation here is by PERMISSION and never by role: the office builds its own profiles, and code only ever asks whether a permission is held. It installs one screen — whose four CRUD permissions the platform derives on its own — plus a named resource for the thing that is not a collection, two declared permissions with the closure each one drags along, and a page gated by one of them.',

  'screen.note': 'Note',
  'screen.note.plural': 'Notes',
  'field.title': 'Title',
  'field.title.placeholder': 'What this note is about',
  'field.body': 'Body',
  'field.published': 'Published',

  'resource.board': 'Notes board',

  'permission.view': 'Open the notes board',
  'permission.view.description':
    'See the board that reads the notes. It cannot show what the holder may not read, so it drags note reading along with it.',
  'permission.publish': 'Publish a note',
  'permission.publish.description':
    'Mark a note as published. Publishing is writing, so it drags reading and updating along with it.',

  'nav.board': 'Notes board',
  'page.board': 'Notes board',

  'board.heading': 'Notes board',
  'board.body':
    'You are seeing this page because you hold **Open the notes board**. Someone without it does not get an error here — the menu item and the page are simply not there for them.\n\nThat is the whole shape of authorisation in this platform: **ask what someone may DO, never who they are**. There is no role to compare against; the office builds its own profiles and puts permissions in them.',
  'board.free': 'Given for free',
  'board.free.value': 'accessNote.read, accessNote.create, accessNote.update, accessNote.delete',
  'board.declared': 'Declared here',
  'board.declared.value': 'access-example.view, access-example.publish',
  'board.note':
    'A permission RESTRICTS and never grants: holding this one still gets you nothing on a note you may not read.',
};

export const accessMessagesContribution = (): Contribution =>
  messageBundleContribution({
    locale: DEFAULT_LOCALE,
    namespace: ACCESS_NAMESPACE,
    messages: ACCESS_MESSAGES,
  });
