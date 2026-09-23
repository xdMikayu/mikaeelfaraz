// Netlify Scheduled Function: every 15 minutes, categorize new transactions
// for the owner (saved rules + keywords, then Claude for unknown merchants).
// Does nothing — and calls no API — when there is nothing to categorize.
import { getAdmin, categorizePending } from '../../src/lib/finance/server.mjs';

export default async () => {
  const owner = process.env.FINANCE_OWNER_USER_ID;
  if (!owner) {
    console.log('FINANCE_OWNER_USER_ID not set; skipping');
    return;
  }
  const result = await categorizePending(getAdmin(), owner, { maxMerchants: 60 });
  console.log('finance-categorize', JSON.stringify(result));
};

export const config = { schedule: '*/15 * * * *' };
