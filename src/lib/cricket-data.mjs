// The cricket model's tables, read from disk the first time a route needs them and kept for the
// life of the server. They aren't imported as modules: the player records alone are 12 MB, more than
// the build can parse into its bundles within Netlify's memory. next.config.mjs ships the files with
// the cricket routes (outputFileTracingIncludes).
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DIR = join(process.cwd(), 'src/lib/cricket');
const loaded = new Map();

/** A table by its path under src/lib/cricket without ".json": 'model', 'players/t20-male'. */
export function cricketTable(name) {
  if (!/^[a-z0-9-]+(\/[a-z0-9-]+)?$/.test(name)) return Promise.reject(new Error(`No table ${name}`));
  if (!loaded.has(name)) {
    const table = readFile(join(DIR, `${name}.json`), 'utf8').then(JSON.parse);
    // A failed read is tried again next time rather than remembered.
    table.catch(() => loaded.delete(name));
    loaded.set(name, table);
  }
  return loaded.get(name);
}

/** The model, the grounds and the team ratings, as readMatch takes them. */
export async function modelTables() {
  const [model, grounds, ratings] = await Promise.all([cricketTable('model'), cricketTable('grounds'), cricketTable('ratings')]);
  return { model, grounds: grounds.grounds, ratings };
}
