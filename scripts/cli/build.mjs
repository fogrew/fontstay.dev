import { chmodSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'rolldown';

const root = new URL('../../', import.meta.url);
const rootPath = fileURLToPath(root);

const rawText = {
  name: 'raw-text',
  load(id) {
    if (!id.endsWith('?raw')) return null;
    return `export default ${JSON.stringify(readFileSync(id.slice(0, -4), 'utf8'))};`;
  },
};

export async function buildCli(out = fileURLToPath(new URL('packages/fontstay/dist/', root))) {
  rmSync(out, { recursive: true, force: true });
  await build({
    cwd: rootPath,
    input: {
      index: 'packages/fontstay/src/index.ts',
      bin: 'packages/fontstay/src/bin.ts',
    },
    platform: 'node',
    external: ['browserslist'],
    tsconfig: 'tsconfig.json',
    plugins: [rawText],
    treeshake: { moduleSideEffects: false },
    moduleTypes: { '.css': 'empty' },
    output: { dir: out, format: 'esm', minify: false },
    logLevel: 'warn',
  });
  chmodSync(`${out}/bin.js`, 0o755);
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await buildCli();
  console.log('packages/fontstay/dist built');
}
