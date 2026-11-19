import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseYamlSections } from './cli/src/shared/yaml';
import { BRAND_STAMP_FILE, brandFromSections, buildBrandStamp, type BrandStamp } from './cli/src/console/brand';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string };

const BRAND_DIR = resolve('brand');
const BRAND_FILE = join(BRAND_DIR, 'brand.yaml');

/**
 * A identidade dos NOSSOS ambientes (`npm run dev`, `deploy:*`), lida de `brand/brand.yaml` com o
 * mesmo bloco `brand:` e o mesmo carimbo do `microteia deploy` — as imagens ficam na própria pasta, e
 * os caminhos do bloco são relativos a ela. Sem a pasta, nada muda.
 *
 * NUNCA no modo `dist`: é o build do `microteia pack`, e o pacote tem de sair sem identidade nenhuma —
 * quem a carimba é quem instala. Uma marca nossa ali viajaria para todo escritório.
 */
const installationBrand = (mode: string): Plugin | null => {
  if (mode === 'dist' || !existsSync(BRAND_FILE)) return null;

  // O `web.app` do projeto que o modo escolhe (`.env.dev`, `.env.prod`) — o mesmo endereço padrão que
  // o `microteia deploy` usa. Um domínio próprio entra no `url:` do bloco.
  const projectId = loadEnv(mode, process.cwd(), 'VITE_').VITE_PROJECT_ID;
  let stamp: BrandStamp | null = null;
  const load = async (): Promise<BrandStamp> => {
    stamp ??= await buildBrandStamp(
      BRAND_DIR,
      brandFromSections(parseYamlSections(readFileSync(BRAND_FILE, 'utf8'), 'brand/brand.yaml')),
      'brand/brand.yaml',
      projectId ? `https://${projectId}.web.app` : null,
    );
    return stamp;
  };

  let outDir = 'dist';

  return {
    name: 'microteia-installation-brand',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    async buildStart() {
      await load();
    },
    async transformIndexHtml(html) {
      return (await load()).rewriteHtml(html);
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = (request.url ?? '').split('?')[0];
        void load().then((loaded) => {
          if (path === `/${BRAND_STAMP_FILE}`) {
            response.setHeader('Content-Type', 'text/javascript');
            response.end(loaded.contents);
            return;
          }
          const asset = loaded.assets.find((candidate) => `/${candidate.target}` === path);
          if (!asset) { next(); return; }
          response.setHeader('Content-Type', asset.contentType);
          response.end(readFileSync(asset.source));
        }, next);
      });
    },
    // Depois de o Vite copiar `public/`: é o que sobrepõe o `brand.js` vazio que viaja no pacote.
    async writeBundle() {
      const loaded = await load();
      writeFileSync(join(outDir, BRAND_STAMP_FILE), loaded.contents);
      for (const asset of loaded.assets) {
        const target = join(outDir, asset.target);
        mkdirSync(dirname(target), { recursive: true });
        copyFileSync(asset.source, target);
      }
    },
  };
};

export default defineConfig(({ mode }) => ({
  plugins: [react(), installationBrand(mode)],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  optimizeDeps: {
    include: ['monaco-editor', '@monaco-editor/react'],
  },
}));
