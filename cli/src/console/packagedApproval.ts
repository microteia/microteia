import { relative } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { blank, bullets, failure, info, success, warn } from '../shared/ui.js';
import { readFunctionSource } from './customFunctions.js';
import { activeAccount } from './firestoreRest.js';
import { packagedLabel, packagedSlug } from './packagedPaths.js';
import {
  approvalFlag,
  declaredDependencies,
  decideWithoutAsking,
  writePackagedSource,
} from './packagedSources.js';
import type { PackagedClaim } from './packagedSources.js';

export type HeldReason = 'awaiting-approval' | 'source-invalid';

export interface PackagedSettlement {
  /** As que não sobem nesta execução, e por quê — vira o motivo que a tela da extensão mostra. */
  held: Map<string, HeldReason>;
  /** Quem aprovou, para as aprovadas AGORA. As já aprovadas antes guardam o aprovador que tinham. */
  approvedNow: Map<string, string>;
  /** Quantas fontes foram extraídas para `.microteia/packaged-functions/`. */
  extracted: number;
}

const kb = (text: string): string => `${Math.max(1, Math.round(Buffer.byteLength(text, 'utf8') / 1024))} KB`;

/**
 * O que quem aprova precisa ver ANTES de dizer sim — e é a lista inteira, não um resumo: o que vai ao
 * ar, com que dependência, e de que tipo é cada function. O tipo importa porque muda o alcance: uma
 * callable responde a quem a chama; um gatilho age sozinho sobre os dados; uma agendada age sobre todos
 * os escritórios do projeto.
 */
const describe = async (root: string, projectId: string, claim: PackagedClaim, path: string): Promise<void> => {
  const slug = packagedSlug(claim.pluginId);
  const source = await readFunctionSource(path, packagedLabel(slug), slug, false);
  const kindOf = (name: string): string => {
    if (source.callables.includes(name)) return 'callable — answers whoever calls it';
    const trigger = source.triggers.find((entry) => entry.name === name);
    if (trigger !== undefined) return `${trigger.trigger} — acts on its own when data changes`;
    const unscoped = source.unscoped.find((entry) => entry.name === name);
    if (unscoped !== undefined) return `${unscoped.trigger} — acts on its own, for every organization`;
    return 'not exported by its index.ts';
  };
  const dependencies = Object.entries(declaredDependencies(claim.source));

  blank();
  warn(`${claim.name} ${claim.version} (${claim.pluginId}) brings the source of its own Cloud Functions.`);
  info(`  They run on the server with full access to every organization in ${projectId}.`);
  info(`  sha-256: ${claim.source.hash}`);
  info(`  read it in: ${relative(root, path)}/`);
  info('  files:');
  bullets(Object.keys(claim.source.files).sort().map((file) => `${file} (${kb(claim.source.files[file] ?? '')})`));
  info('  npm dependencies it adds:');
  bullets(dependencies.length === 0 ? ['none beyond the platform\'s own'] : dependencies.map(([name, range]) => `${name} ${range}`));
  info('  functions:');
  bullets(claim.functions.map((name) => `${name} — ${kindOf(name)}`));
};

const ask = async (question: string): Promise<boolean> => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return /^(y|yes)$/i.test((await rl.question(question)).trim());
  } finally {
    rl.close();
  }
};

/**
 * Decide, extrai e — quando ninguém respondeu antes — pergunta. Só a fonte APROVADA fica no disco
 * quando esta função devolve, e é por isso que o resto do `provision` pode lê-la como qualquer outra:
 * `findFunctionSources` só encontra o que passou por aqui.
 *
 * Fora de um terminal não há pergunta: a extensão fica pendente e o comando diz a linha exata que a
 * aprova. Um `--yes` genérico foi recusado de propósito — ele aprovaria também a versão que chegar
 * amanhã, sem ninguém ter lido.
 */
export const settlePackagedSources = async (input: {
  root: string;
  projectId: string;
  claims: PackagedClaim[];
  provided: ReadonlySet<string>;
  flags: ReadonlyMap<string, string>;
  interactive: boolean;
}): Promise<PackagedSettlement> => {
  const settlement: PackagedSettlement = { held: new Map(), approvedNow: new Map(), extracted: 0 };
  let account: string | undefined;
  const approver = async (): Promise<string> => {
    account ??= await activeAccount();
    return account;
  };

  for (const claim of input.claims) {
    const decision = decideWithoutAsking(claim, input.provided, input.flags);

    if (decision?.kind === 'provided') {
      info(`  ${claim.name}: using the source in this installation, not the copy in its package`);
      continue;
    }

    if (decision?.kind === 'invalid') {
      failure(`${claim.name}: the server code in its package cannot be used —`);
      bullets(decision.problems);
      info('  Install the extension again from a file its author built.');
      settlement.held.set(claim.pluginId, 'source-invalid');
      continue;
    }

    if (decision?.kind === 'approved') {
      await writePackagedSource(input.root, claim);
      settlement.extracted += 1;
      if (decision.how === 'flag') {
        settlement.approvedNow.set(claim.pluginId, await approver());
        success(`${claim.name}: server code approved by --approve`);
      }
      continue;
    }

    if (decision?.kind === 'held') {
      warn(`${claim.name}: the hash given to --approve is not the one in its package.`);
      info(`  the package carries ${claim.source.hash} — read it before approving that one.`);
      settlement.held.set(claim.pluginId, 'awaiting-approval');
      continue;
    }

    const review = await writePackagedSource(input.root, claim, 'review');
    await describe(input.root, input.projectId, claim, review);

    if (input.interactive && await ask(`Approve this exact code for ${input.projectId}? [y/N] `)) {
      await writePackagedSource(input.root, claim);
      settlement.extracted += 1;
      settlement.approvedNow.set(claim.pluginId, await approver());
      success(`${claim.name}: server code approved`);
      continue;
    }

    settlement.held.set(claim.pluginId, 'awaiting-approval');
    info('  Not approved — the extension stays pending. To approve it without a prompt:');
    bullets([`microteia provision ${approvalFlag(claim.pluginId, claim.source.hash)}`]);
  }

  return settlement;
};
