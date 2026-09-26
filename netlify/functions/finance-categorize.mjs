// Netlify Scheduled Function: every 15 minutes, categorize new transactions
// for the owner (saved rules + keywords, then Claude for unknown merchants), and keep
// today's net worth snapshot current. Calls no AI when there is nothing to categorize.
import { getAdmin, categorizePending, reconcileTabby, tidyUp } from '../../src/lib/finance/server.mjs';
import { snapshotNetWorth } from '../../src/lib/finance/networth-server.mjs';

export default async () => {
  const owner = process.env.FINANCE_OWNER_USER_ID;
  if (!owner) {
    console.log('FINANCE_OWNER_USER_ID not set; skipping');
    return;
  }
  const db = getAdmin();
  const tidy = await tidyUp(db, owner); // first, so renamed merchants get categorized by their new name
  const result = await categorizePending(db, owner, { maxMerchants: 60 });
  const tabby = await reconcileTabby(db, owner);
  // Net worth last, and on its own: a price source being down must not stop the rest.
  const networth = await snapshotNetWorth(db, owner).catch((e) => ({ error: e.message }));
  console.log('finance-categorize', JSON.stringify({ ...result, tabby, tidy, networth }));
};

export const config = { schedule: '*/15 * * * *' };
