import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * O bundle distribuído não pode carregar projeto Firebase nenhum.
 *
 * O risco não é teórico: até a versão 7.46 o Vite inlinava `VITE_*` em tempo de build, e um pacote
 * montado com `TARGET=dev` levaria as credenciais de desenvolvimento embutidas. Como `config.ts` cai
 * no valor inlinado quando ninguém carimba `firebase-config.js`, uma instalação mal carimbada
 * conectaria em SILÊNCIO no Firebase de quem empacotou — escrevendo dados de cliente lá dentro.
 *
 * Por isso a verificação não confia no procedimento (`pack` compila com `TARGET=dist`, e `.env.dist`
 * não existe): ela confere o artefato pronto.
 */

const TEXT_EXTENSIONS = ['.js', '.mjs', '.cjs', '.html', '.css', '.json', '.map', '.txt'];

/** Prefixo de toda chave de API web do Firebase — pega o caso em que não há `.env` local para comparar. */
const FIREBASE_API_KEY_MARKER = 'AIzaSy';

export interface BundleLeak {
  file: string;
  what: string;
}

const isTextFile = (name: string): boolean =>
  TEXT_EXTENSIONS.some((extension) => name.endsWith(extension));

const walk = async (directory: string, prefix = ''): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await walk(join(directory, entry.name), relative));
    else if (isTextFile(entry.name)) files.push(relative);
  }

  return files;
};

/**
 * Os valores dos `.env.*` da raiz. Comparar contra eles é melhor do que procurar um padrão: cobre
 * qualquer ambiente que exista na máquina de quem empacota, inclusive um criado depois disto.
 */
export const environmentSecrets = async (root: string): Promise<string[]> => {
  const entries = await readdir(root, { withFileTypes: true });
  const values = new Set<string>();

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.startsWith('.env.') || entry.name === '.env.example') continue;

    const content = await readFile(join(root, entry.name), 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed === '' || trimmed.startsWith('#')) continue;

      const equals = trimmed.indexOf('=');
      if (equals === -1) continue;

      const value = trimmed.slice(equals + 1).trim().replace(/^["']|["']$/g, '');
      // Valores curtos demais dão falso positivo contra código minificado.
      if (value.length >= 8) values.add(value);
    }
  }

  return [...values];
};

export const findBundleLeaks = async (bundleDir: string, secrets: string[]): Promise<BundleLeak[]> => {
  const files = await walk(bundleDir);
  const leaks: BundleLeak[] = [];

  for (const file of files) {
    const content = await readFile(join(bundleDir, file), 'utf8');

    for (const secret of secrets) {
      if (content.includes(secret)) leaks.push({ file, what: `environment value ${secret.slice(0, 8)}…` });
    }

    if (content.includes(FIREBASE_API_KEY_MARKER)) {
      leaks.push({ file, what: `a Firebase web API key (${FIREBASE_API_KEY_MARKER}…)` });
    }
  }

  return leaks;
};
