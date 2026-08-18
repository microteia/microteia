import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { hasFlag, requiredFlag } from '../shared/args.js';
import type { ParsedArgs } from '../shared/args.js';
import { blank, bullets, heading, info, step, success, warn } from '../shared/ui.js';
import { GOOGLE_DEFAULT_REGION, MANUAL_PREREQUISITES } from '../kernel/manifest.js';
import { ENVIRONMENT_FILE, readEnvironment, writeEnvironment } from './environment.js';
import {
  assertFirebaseCli,
  assertLoggedIn,
  createWebApp,
  listWebApps,
  webAppSdkConfig,
} from './firebaseCli.js';
import { runtimeConfigFrom } from './runtimeConfigShape.js';
import { workspacePath, writeResolvedConfig } from './workspace.js';

export const connect = async (args: ParsedArgs): Promise<void> => {
  const file = resolve(hasFlag(args, 'file') ? requiredFlag(args, 'file') : join(process.cwd(), ENVIRONMENT_FILE));
  const root = dirname(file);
  const projectId = requiredFlag(args, 'project');

  const environment = await readEnvironment(file);

  heading(`Connecting "${environment.project.name}" to Firebase project ${projectId}`);

  const total = 4;

  step(1, total, 'Checking the Firebase CLI');
  const cliVersion = await assertFirebaseCli();
  await assertLoggedIn();
  success(`firebase-tools ${cliVersion}, signed in`);

  step(2, total, 'Looking for a web app in the project');
  const apps = await listWebApps(projectId);
  let appId = apps[0]?.appId;

  if (appId === undefined) {
    if (hasFlag(args, 'no-create-web-app')) {
      throw new Error(
        `Firebase project "${projectId}" has no web app, and --no-create-web-app was given.\n`
        + 'Create one in the Firebase console, then run "microteia connect" again.',
      );
    }
    appId = await createWebApp(projectId, environment.project.name);
    success(`created a web app in ${projectId} (${appId})`);
  } else {
    success(`using the existing web app ${appId}`);
    if (apps.length > 1) {
      warn(`the project has ${apps.length} web apps; the first one was used.`);
    }
  }

  step(3, total, 'Reading the web SDK configuration');
  const sdkConfig = await webAppSdkConfig(projectId, appId);
  const runtimeConfig = runtimeConfigFrom(sdkConfig, environment.firebase.region);

  await mkdir(workspacePath(root), { recursive: true });
  await writeResolvedConfig(root, runtimeConfig);
  success('configuration resolved');

  step(4, total, `Recording the project in ${ENVIRONMENT_FILE}`);
  await writeEnvironment(file, {
    ...environment,
    firebase: { ...environment.firebase, projectId },
  });
  success(`${environment.environment.id} → ${projectId}`);

  blank();
  info('Before deploying, make sure the Firebase project is prepared. These cannot be done from here:');
  blank();

  for (const prerequisite of MANUAL_PREREQUISITES) {
    info(`  ${prerequisite.optional ? '(optional) ' : ''}${prerequisite.title}`);
    info(`      ${prerequisite.detail.replace(/\n/g, '\n      ')}`);
    blank();
  }

  if (environment.firebase.region !== GOOGLE_DEFAULT_REGION) {
    info(`This installation runs its functions in ${environment.firebase.region}, not in Google's`);
    info(`  ${GOOGLE_DEFAULT_REGION} default. The browser calls them at that region, so the permission to`);
    info('  invoke them has to exist there — see "unauthenticated invocation" above. The deploy grants');
    info('  it, then verifies it from outside, and prints the exact command per function if the grant');
    info('  was refused.');
    blank();
  }

  info('Then:');
  bullets(['microteia deploy --kernel <microteia-kernel-x.y.z.tgz>']);
  blank();
};
