// Netlify Scheduled Function: every 15 minutes, for each Mifolio user, finish messages
// whose request was cut off, categorize new transactions (saved rules + keywords, then
// Mifolio AI for unknown merchants), and keep today's net worth snapshot current.
// Calls no AI when there is nothing to categorize.
//
// While the site still points at a shared Supabase project (FINANCE_MULTI_USER not
// "true"), only FINANCE_OWNER_USER_ID is processed.
import { getAdmin, categorizePending, finishStalled, financeUserIds, ownerOnly, reconcileTabby, tidyUp } from '../../src/lib/finance/server.mjs';
import { snapshotNetWorth } from '../../src/lib/finance/networth-server.mjs';

// Scheduled functions get ~30s; stop starting new users after this, so the one in progress can finish.
const BUDGET_MS = 20 * 1000;

async function runFor(db, userId) {
  const stalled = await finishStalled(db, userId).catch((e) => ({ error: e.message })); // first, so they get categorized below
  const tidy = await tidyUp(db, userId); // before categorizing, so renamed merchants get categorized by their new name
  const result = await categorizePending(db, userId, { maxMerchants: 60 });
  const tabby = await reconcileTabby(db, userId);
  // Net worth last, and on its own: a price source being down must not stop the rest.
  const networth = await snapshotNetWorth(db, userId).catch((e) => ({ error: e.message }));
  return { ...result, stalled, tabby, tidy, networth };
}

export default async () => {
  const started = Date.now();
  const db = getAdmin();
  let users;
  if (ownerOnly()) users = [process.env.FINANCE_OWNER_USER_ID];
  else {
    users = await financeUserIds(db);
    // Start somewhere different each run, so nobody is always last in line for the time budget.
    const shift = users.length ? Math.floor(started / (15 * 60 * 1000)) % users.length : 0;
    users = users.slice(shift).concat(users.slice(0, shift));
  }
  if (!users.length) {
    console.log('finance-categorize: no users yet');
    return;
  }
  let done = 0;
  for (const userId of users) {
    if (Date.now() - started > BUDGET_MS) break;
    try {
      console.log('finance-categorize', userId.slice(0, 8), JSON.stringify(await runFor(db, userId)));
    } catch (e) {
      console.error('finance-categorize', userId.slice(0, 8), e.message);
    }
    done++;
  }
  console.log(`finance-categorize: ${done}/${users.length} users in ${Date.now() - started}ms`);
};

export const config = { schedule: '*/15 * * * *' };
