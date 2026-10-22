// One-off: copy one user's Mifolio data from an old Supabase project to a new one.
//
//   FROM_URL=https://<old>.supabase.co FROM_SERVICE_KEY=… FROM_USER_ID=… \
//   TO_URL=https://<new>.supabase.co   TO_SERVICE_KEY=…   TO_USER_ID=… \
//   node scripts/finance/move-project.mjs          # dry run: counts only
//   node scripts/finance/move-project.mjs --go     # copy
//
// Run the migrations on the new project first, and create your account there (Auth →
// Users → Add user) to get TO_USER_ID. Rows keep their ids; only user_id changes. It
// upserts by primary key, so it is safe to run again. API keys are not copied: make new
// ones. Nothing is deleted from the old project; do that yourself once you've checked.
//
// Service-role keys bypass row-level security. Pass them as environment variables for
// this one run; never commit them or paste them anywhere else.
import { createClient } from '@supabase/supabase-js';

const env = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Set ${k}`);
  return v.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
};
const GO = process.argv.includes('--go');
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const from = createClient(env('FROM_URL'), env('FROM_SERVICE_KEY'), opts);
const to = createClient(env('TO_URL'), env('TO_SERVICE_KEY'), opts);
const FROM_USER = env('FROM_USER_ID');
const TO_USER = env('TO_USER_ID');

// Parents before children; the conflict target is each table's primary key.
const TABLES = [
  ['fin_accounts', 'id'],
  ['fin_merchant_rules', 'id'],
  ['fin_budgets', 'user_id,category'],
  ['fin_holdings', 'id'],
  ['fin_prices', 'user_id,asset,source'],
  ['fin_networth', 'user_id,day'],
  ['fin_transactions', 'id'],
  ['fin_raw_events', 'id'],
];

async function readAll(db, table, pk, userId) {
  const rows = [];
  for (let at = 0; ; at += 1000) {
    // Order by the key (minus user_id, which is fixed here) so pages don't overlap or skip.
    let q = db.from(table).select('*').eq('user_id', userId);
    for (const col of pk.split(',').filter((c) => c !== 'user_id')) q = q.order(col);
    const { data, error } = await q.range(at, at + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

const count = async (db, table, userId) => {
  const { count: n, error } = await db.from(table).select('*', { count: 'exact', head: true }).eq('user_id', userId);
  if (error) throw new Error(`${table}: ${error.message}`);
  return n;
};

if (env('FROM_URL') === env('TO_URL')) throw new Error('FROM_URL and TO_URL are the same project');
const { error: schemaErr } = await to.from('fin_api_keys').select('id').limit(1);
if (schemaErr) throw new Error(`The new project isn't ready (${schemaErr.message}). Run every file in supabase/migrations on it first.`);
const { data: toUser, error: userErr } = await to.auth.admin.getUserById(TO_USER);
if (userErr || !toUser?.user) throw new Error(`TO_USER_ID isn't a user on the new project (${userErr?.message || 'not found'})`);
console.log(`Copying ${FROM_USER.slice(0, 8)}… → ${toUser.user.email} (${TO_USER.slice(0, 8)}…)${GO ? '' : '  [dry run]'}\n`);

// Opening the app before the move creates default cards with new ids; clear those if
// nothing hangs off them yet, so the old cards (and their transactions) can take their place.
const existing = await count(to, 'fin_transactions', TO_USER);
const existingAccounts = await count(to, 'fin_accounts', TO_USER);
if (existingAccounts && !existing) {
  console.log(`New account has ${existingAccounts} empty default card(s); ${GO ? 'removing them' : 'would remove them'} first.`);
  if (GO) {
    const { error } = await to.from('fin_accounts').delete().eq('user_id', TO_USER);
    if (error) throw error;
  }
} else if (existing) {
  console.log(`Note: the new account already has ${existing} transactions; rows with the same id are updated, others are left alone.`);
}

const summary = [];
for (const [table, pk] of TABLES) {
  const rows = (await readAll(from, table, pk, FROM_USER)).map((r) => ({ ...r, user_id: TO_USER }));
  if (GO) {
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await to.from(table).upsert(rows.slice(i, i + 500), { onConflict: pk });
      if (error) throw new Error(`${table}: ${error.message}`);
    }
  }
  const after = GO ? await count(to, table, TO_USER) : null;
  summary.push({ table, old: rows.length, new: after, ok: GO ? after >= rows.length : null });
  console.log(`${table.padEnd(20)} ${String(rows.length).padStart(6)} rows${GO ? `  → new project has ${after}${after >= rows.length ? '  ✓' : '  ✗ MISSING ROWS'}` : ''}`);
}

if (GO) {
  const bad = summary.filter((s) => !s.ok);
  console.log(bad.length ? `\n✗ ${bad.length} table(s) didn't copy fully. Nothing was deleted; fix and run again.` : '\n✓ Everything copied. Check the app on the new project before deleting anything from the old one.');
} else {
  console.log('\nDry run only. Add --go to copy.');
}
