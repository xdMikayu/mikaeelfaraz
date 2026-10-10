// Loads the forecasting kit from the built data files, for scripts that need projections.
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeKit } from '../../src/lib/sport/kit.mjs';

export { makeCtx } from '../../src/lib/sport/kit.mjs';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
export const DATA = join(ROOT, 'public/sport/data/pl');
export const readJson = async (path, d = null) => {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return d;
  }
};

export async function loadKit() {
  const ix = await readJson(join(DATA, 'index.json'));
  const learned = await readJson(join(DATA, 'netxg-model.json'));
  const nx = await readJson(join(DATA, 'netxg.json'));
  return { kit: makeKit(ix, learned), learned, nx };
}
