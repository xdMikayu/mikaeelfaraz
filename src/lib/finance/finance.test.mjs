// Run with: npm test
// Card numbers and balances below are made up — never commit real ones (public repo).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEvent, parseTabbyAlert, parseSibSms, parseMashreqEmail, parseWalletEvent, normalizeMerchant, normalizeMerchantLegacy, parseAmount, splitPastedMessages, dubaiParts } from './parse.mjs';
import { keywordCategory, ruleCategory, merchantKey, isTabbyCharge, isTabbyCardRepayment, planTabbyReconcile, TABBY_NOTES } from './categories.mjs';
import { getPeriod, monthPeriod, rangePeriod } from './periods.mjs';
import { planDuplicateMerges, planRenames, isStatementTwin, sameMerchant } from './dedupe.mjs';
import { summarize, periodBars, monthlyContext } from './analytics.mjs';

const NOW = new Date('2026-09-23T10:00:00Z'); // 14:00 in Dubai

const SIB = 'A txn on your Card XXXX1234 at Digital Dubai for AED  6.30 on 21-Sep at 19:24  is approved. Your available balance is 5432.10';
const MASHREQ = `Dear Customer,

Thank you for banking with Mashreq Bank.

Please note the details of a recent transaction on your Mashreq Card.

Your Mashreq Cashback Card ending with 9876 was used for a purchase of AED 1.00 at DU Apple Pay 800188 AE on 23-SEP-2026 12:39 PM. Available limit is AED  9,876.54

This is a system generated alert. We request you not to reply to this message.`;

test('SIB SMS', () => {
  const r = parseSibSms(SIB, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.account, 'sib');
  assert.equal(r.last4, '1234');
  assert.equal(r.amount, 6.3);
  assert.equal(r.currency, 'AED');
  assert.equal(r.merchant, 'Digital Dubai');
  assert.equal(r.availableBalance, 5432.10);
  // 19:24 Dubai = 15:24 UTC
  assert.equal(r.occurredAt, '2026-09-21T15:24:00.000Z');
});

test('SIB SMS in January read in December rolls to previous year only when in the future', () => {
  const dec = parseSibSms(SIB.replace('21-Sep', '02-Jan'), new Date('2026-12-30T10:00:00Z'));
  assert.equal(dubaiParts(dec.occurredAt).y, 2026);
  const jan = parseSibSms(SIB.replace('21-Sep', '30-Dec'), new Date('2027-01-02T10:00:00Z'));
  assert.equal(dubaiParts(jan.occurredAt).y, 2026);
});

test('SIB declined is ignored', () => {
  const r = parseSibSms(SIB.replace('is approved', 'is declined'), NOW);
  assert.equal(r.ok, false);
  assert.equal(r.status, 'ignored');
});

test('SIB foreign currency', () => {
  const r = parseSibSms(SIB.replace('AED  6.30', 'USD 10.00'), NOW);
  assert.equal(r.currency, 'USD');
  assert.equal(r.amountAed, 36.73);
  assert.equal(r.fxEstimated, false);
});

test('Mashreq email', () => {
  const r = parseMashreqEmail(MASHREQ);
  assert.equal(r.ok, true);
  assert.equal(r.account, 'mashreq');
  assert.equal(r.last4, '9876');
  assert.equal(r.amount, 1);
  assert.equal(r.merchant, 'du');
  assert.equal(r.availableBalance, 9876.54);
  assert.equal(r.wallet, true);
  assert.equal(r.occurredAt, '2026-09-23T08:39:00.000Z');
});

test('Mashreq 12 AM / 12 PM', () => {
  assert.equal(parseMashreqEmail(MASHREQ.replace('12:39 PM', '12:05 AM')).occurredAt, '2026-09-22T20:05:00.000Z');
  assert.equal(parseMashreqEmail(MASHREQ.replace('12:39 PM', '01:05 PM')).occurredAt, '2026-09-23T09:05:00.000Z');
});

test('Wallet event (Tabby)', () => {
  const r = parseWalletEvent({ card: 'Tabby Card', merchant: 'du', amount: 'AED 1.00' }, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.account, 'tabby');
  assert.equal(r.amount, 1);
  assert.equal(r.merchant, 'du');
  assert.equal(r.occurredAt, NOW.toISOString());
  assert.equal(parseWalletEvent({ card: 'Some Other Card', merchant: 'x', amount: '1' }, NOW).ok, false);
});

test('parseEvent routes by content', () => {
  assert.equal(parseEvent({ text: SIB }, NOW).account, 'sib');
  assert.equal(parseEvent({ text: MASHREQ }, NOW).account, 'mashreq');
  assert.equal(parseEvent({ source: 'wallet', card: 'Tabby', merchant: 'Careem', amount: '25.5' }, NOW).account, 'tabby');
  assert.equal(parseEvent({ text: 'Your OTP is 1234' }, NOW).status, 'unparsed');
});

test('amounts', () => {
  assert.deepEqual(parseAmount('AED 1,234.50'), { amount: 1234.5, currency: 'AED' });
  assert.deepEqual(parseAmount('1.00 USD'), { amount: 1, currency: 'USD' });
  assert.deepEqual(parseAmount('$4.99'), { amount: 4.99, currency: 'USD' });
  assert.deepEqual(parseAmount('د.إ.‏ 12.00'), { amount: 12, currency: 'AED' });
});

test('merchant normalization', () => {
  assert.equal(normalizeMerchant('DU Apple Pay 800188 AE'), 'du');
  assert.equal(normalizeMerchant('CAREEM HALA DUBAI AE'), 'Careem Hala');
  assert.equal(normalizeMerchant('Digital Dubai'), 'Digital Dubai');
  assert.equal(normalizeMerchant('KFC 1234 SHARJAH ARE'), 'KFC');
  assert.equal(normalizeMerchant('AL REEF BAKERY'), 'Al Reef Bakery');
  assert.equal(normalizeMerchant('du'), 'du');
  assert.equal(normalizeMerchant('SOME NEW SHOP LLC'), 'Some New Shop');
  assert.equal(normalizeMerchant('ENOC 1043 DUBAI AE'), 'ENOC');
});

test('keyword categories', () => {
  assert.equal(keywordCategory('DU'), 'Bills & Utilities');
  assert.equal(keywordCategory('Dubai Mall Parking'), 'Transport');
  assert.equal(keywordCategory('Talabat Mart'), 'Groceries');
  assert.equal(keywordCategory('Talabat'), 'Food Delivery');
  assert.equal(keywordCategory('Digital Dubai'), 'Government & Fees');
  assert.equal(keywordCategory('Random Shop LLC'), null);
});

test('user rules beat keywords', () => {
  const rules = [{ match: merchantKey('Talabat'), category: 'Groceries', source: 'user' }];
  assert.deepEqual(ruleCategory('Talabat', rules), { category: 'Groceries', source: 'rule' });
});

test('split pasted messages', () => {
  assert.equal(splitPastedMessages(`${SIB}\n${SIB.replace('6.30', '7.00')}`).length, 2);
  assert.equal(splitPastedMessages(`${MASHREQ}\n\n${MASHREQ}`).length, 2);
  assert.equal(splitPastedMessages(MASHREQ).length, 1);
});

test('periods', () => {
  const p = getPeriod('this_month', NOW);
  assert.equal(p.start.toISOString(), '2026-08-31T20:00:00.000Z');
  assert.equal(p.prevStart.toISOString(), '2026-07-31T20:00:00.000Z');
  assert.ok(p.prevEnd < p.start);
  const l = getPeriod('last_month', NOW);
  assert.equal(l.label, 'Aug 2026');
});

test('Tabby charges on bank cards: card payoffs hidden, instalments counted', () => {
  assert.equal(isTabbyCharge('TABBY FZ LLC DUBAI', 'mashreq'), true);
  assert.equal(isTabbyCharge('GEIDEA*TABBY FZ LLC dubai ARE', 'sib'), true);
  assert.equal(isTabbyCharge('Tamara', 'sib'), false); // not tracked as a card, so it is real spending
  assert.equal(isTabbyCharge('DU', 'mashreq'), false);
  assert.equal(isTabbyCharge('Tabby', 'tabby'), false);
  assert.equal(isTabbyCardRepayment('Card repayment', 'tabby', 'credit'), true);
  assert.equal(isTabbyCardRepayment('Card repayment', 'tabby', 'debit'), false);
  assert.equal(isTabbyCardRepayment('Noon', 'tabby', 'credit'), false); // a refund
  const charges = [
    { id: 'a', amount_aed: 457.94, occurred_at: '2026-09-17T08:00:00Z', excluded: true, category: 'Transfers & Fees', notes: 'Tabby repayment, purchase already counted on the Tabby card' },
    { id: 'b', amount_aed: 52.5, occurred_at: '2026-09-16T08:00:00Z', excluded: true, category: 'Transfers & Fees', notes: 'Tabby repayment, purchase already counted on the Tabby card' },
    { id: 'c', amount_aed: 55, occurred_at: '2026-09-19T08:00:00Z', excluded: false, category: 'Shopping', notes: TABBY_NOTES.instalment },
  ];
  const repayments = [{ id: 'r', amount_aed: 457.94, occurred_at: '2026-09-17T12:00:00Z' }];
  const plan = Object.fromEntries(planTabbyReconcile(charges, repayments).map((u) => [u.id, u]));
  assert.equal(plan.a.excluded, true);
  assert.equal(plan.a.notes, TABBY_NOTES.cardPayoff);
  assert.equal(plan.b.excluded, false); // an instalment: now counted
  assert.equal(plan.b.category, 'Shopping');
  assert.equal(plan.c, undefined); // already right
  // A repayment pairs with only one charge, and not one 5 days away.
  const far = [{ id: 'x', amount_aed: 10, occurred_at: '2026-09-01T00:00:00Z', excluded: false, category: 'Shopping', notes: TABBY_NOTES.instalment }];
  assert.equal(planTabbyReconcile(far, [{ id: 'r2', amount_aed: 10, occurred_at: '2026-09-06T00:00:00Z' }]).length, 0);
});

test('Tabby app alert', () => {
  const TABBY = 'Transaction of AED 1.00 At DU Apple Pay was successful. Your available Tabby Card limit is AED 1,234.56.';
  const r = parseTabbyAlert(TABBY, NOW, 'sms');
  assert.equal(r.ok, true);
  assert.equal(r.account, 'tabby');
  assert.equal(r.amount, 1);
  assert.equal(r.merchant, 'du');
  assert.equal(r.availableBalance, 1234.56);
  assert.equal(r.source, 'sms');
  assert.equal(r.occurredAt, NOW.toISOString());
  assert.equal(parseEvent({ source: 'sms', text: TABBY }, NOW).account, 'tabby');
  assert.equal(splitPastedMessages(`${TABBY}\n${TABBY.replace('1.00', '2.00')}`).length, 2);
});

test('Tabby alert with title and body joined without a space', () => {
  const r = parseTabbyAlert('Transaction of AED 12.50At Careem Apple Pay was successful. Your available Tabby Card limit is AED 1,234.56.', NOW);
  assert.equal(r.ok, true);
  assert.equal(r.amount, 12.5);
  assert.equal(r.merchant, 'Careem');
});

test('Tabby notification sent as separate title/body fields', () => {
  const r = parseEvent({ source: 'alert', text: ' ', title: 'Transaction of AED 5.00', body: 'At Careem Apple Pay was successful. Your available Tabby Card limit is AED 900.00.' }, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.account, 'tabby');
  assert.equal(r.amount, 5);
  assert.equal(r.availableBalance, 900);
});

test('Notification sent as a whole object field', () => {
  const r = parseEvent({ source: 'alert', text: '', title: '', body: '', notification: 'Transaction of AED 3.00 At Noon was successful. Your available Tabby Card limit is AED 800.00.' }, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.amount, 3);
});

test('Non-purchase app notifications are skipped, not flagged', () => {
  const r = parseEvent({ source: 'alert', title: 'Tabby Support', body: 'Are you having any trouble receiving OTP?' }, NOW);
  assert.equal(r.status, 'ignored');
  assert.equal(parseEvent({ source: 'alert', title: '', body: '' }, NOW).status, 'unparsed');
});

test('statement rows keep their own source, date and category', () => {
  const r = parseEvent({ source: 'statement', account: 'mashreq', merchant: 'Pelita Air', merchant_raw: 'PELITA AIR-IPG JAKARTA 360', amount: 4839960, currency: 'IDR', occurred_at: '2026-09-15T12:00:00+04:00', category: 'Travel' });
  assert.equal(r.ok, true);
  assert.equal(r.source, 'statement');
  assert.equal(r.account, 'mashreq');
  assert.equal(r.merchant, 'Pelita Air');
  assert.equal(r.merchantRaw, 'PELITA AIR-IPG JAKARTA 360');
  assert.equal(r.category, 'Travel');
  assert.equal(r.fxEstimated, true);
  assert.ok(r.amountAed > 1000 && r.amountAed < 1200);
  assert.equal(r.occurredAt, '2026-09-15T08:00:00.000Z');
  assert.equal(parseEvent({ source: 'statement', account: 'mashreq', amount: 5 }).ok, false); // no date
  assert.equal(keywordCategory('Tamara'), 'Shopping');
});

test('statement refunds and billed AED amounts', () => {
  const refund = parseEvent({ source: 'statement', account: 'sib', merchant: 'Mynted', amount: 122.9, direction: 'credit', occurred_at: '2026-07-17T12:00:00+04:00' });
  assert.equal(refund.direction, 'credit');
  const fx = parseEvent({ source: 'statement', account: 'sib', merchant: 'Days Inn', amount: 390.12, currency: 'EUR', amount_aed: 1756.2, occurred_at: '2026-04-26T12:00:00+04:00' });
  assert.equal(fx.amountAed, 1756.2);
  assert.equal(fx.fxEstimated, false);
  assert.equal(fx.direction, 'debit');
});

test('charts follow the selected period and add up to the headline', () => {
  const now = new Date('2026-09-23T14:00:00+04:00');
  const txs = [];
  for (let k = 0; k < 420; k++) {
    const at = new Date(now.getTime() - k * 22 * 3600 * 1000); // every 22h, so times of day vary
    txs.push({ id: `t${k}`, merchant: `M${k % 5}`, account_id: k % 3 ? 'a' : 'b', amount_aed: 10 + (k % 7), direction: k % 29 ? 'debit' : 'credit', excluded: k % 31 === 0, occurred_at: at.toISOString() });
  }
  for (const key of ['this_month', 'last_month', '3m', '6m', 'ytd', '12m', 'all']) {
    const period = getPeriod(key, now, txs.at(-1).occurred_at);
    const s = summarize(txs, period);
    const bars = periodBars(txs, period, now);
    const sum = bars.buckets.reduce((a, b) => a + b.total, 0);
    assert.ok(Math.abs(sum - s.total) < 1e-6, `${key}: bars add up to the headline`);
    if (key === 'all') assert.equal(bars.average, null); // nothing to compare with
    else assert.ok(bars.average > 0, `${key}: has a comparison average`);
    for (const b of bars.buckets) assert.ok(b.top.length <= 3);
    const ctx = monthlyContext(txs, period, now);
    assert.equal(ctx.buckets.length, 12);
    assert.ok(ctx.highlight.length >= 1);
  }
  const month = periodBars(txs, getPeriod('this_month', now), now);
  assert.equal(month.unit, 'day');
  assert.equal(month.buckets.length, 30); // the whole of September…
  assert.equal(month.buckets.filter((b) => b.future).length, 7); // …with 24–30 Sep still to come
  assert.equal(month.averageLabel, 'Aug average');
  assert.equal(periodBars(txs, getPeriod('3m', now), now).unit, 'week');
  const all = periodBars(txs, getPeriod('all', now, '2025-08-20T10:00:00Z'), now);
  assert.equal(all.unit, 'month');
  assert.equal(all.buckets.length, 14); // Aug 2025 – Sep 2026
  assert.equal(all.buckets[0].label, '2025');
  assert.equal(all.buckets[5].label, '2026'); // January
  assert.deepEqual(monthlyContext(txs, getPeriod('this_month', now), now).highlight, [11]);
  assert.deepEqual(monthlyContext(txs, getPeriod('3m', now), now).highlight, [8, 9, 10, 11]); // 23 Jun – 23 Sep
});

test('Tabby alert: "Transaction of … At …. Your Tabby Card limit is now …" format', () => {
  const r = parseTabbyAlert('Tabby Transaction of AED 420.00 At Digital Dubai. Your Tabby Card limit is now AED 1,408.26. You can now split your purchase into 6 months.', NOW);
  assert.equal(r.ok, true);
  assert.equal(r.amount, 420);
  assert.equal(r.merchant, 'Digital Dubai');
  assert.equal(r.availableBalance, 1408.26);
  assert.equal(r.account, 'tabby');
  // The older wording still works, and a merchant with a dot in its name survives.
  const old = parseTabbyAlert('Your Tabby Card transaction of AED 36.09 at noon.com was successful.', NOW);
  assert.equal(old.ok, true);
  assert.equal(old.merchantRaw, 'noon.com');
});

test('Mashreq debit card alerts are told apart from the Cashback card', () => {
  const credit = parseMashreqEmail('Your Mashreq Cashback Card ending with 1234 was used for a purchase of AED 1.00 at DU Apple Pay 800188 AE on 23-SEP-2026 12:39 PM. Available limit is AED 9,876.54');
  assert.equal(credit.account, 'mashreq');
  assert.equal(credit.availableBalance, 9876.54);
  const debit = parseMashreqEmail('Your Mashreq Debit Card ending with 9876 was used for a purchase of USD 21.00 at OPENAI *CHATGPT SUBSCR US on 05-SEP-2026 09:12 AM. Available balance is AED 5,432.10');
  assert.equal(debit.account, 'mashreq_debit');
  assert.equal(debit.availableBalance, 5432.1);
  assert.equal(debit.last4, '9876');
});

test('merchant names are cleaned for display', () => {
  assert.equal(normalizeMerchant('AMZN MKTP US Amzn.com/bill US'), 'Amazon');
  assert.equal(normalizeMerchant('Openai Chatgpt Subscr + US'), 'OpenAI');
  assert.equal(normalizeMerchant('AGODA.COM 8B Dps-cgk Internet'), 'Agoda');
  assert.equal(normalizeMerchant('SP Guinness World Reco + GB'), 'Guinness World Records');
  assert.equal(normalizeMerchant('GEIDEA*TABBY FZ LLC dubai ARE'), 'Tabby');
  assert.equal(normalizeMerchant('SOME NEW SHOP LLC DUBAI AE'), 'Some New Shop');
  assert.equal(normalizeMerchant('AL MUBARAK CAFE LLC SHARJAH 784'), 'Al Mubarak Cafe');
  assert.equal(normalizeMerchant('Digital Dubai'), 'Digital Dubai');
  assert.equal(normalizeMerchant('Lululemon DUBAI AE'), 'Lululemon');
  assert.equal(keywordCategory('Amazon Grocery'), 'Groceries');
  assert.equal(keywordCategory('Apple Store'), 'Shopping');
  assert.equal(keywordCategory('Apple'), 'Subscriptions');
});

test('statement rows pair with the alert for the same purchase', () => {
  const s = { id: 's', account_id: 'm', amount: 1192.67, currency: 'AED', direction: 'debit', occurred_at: '2026-09-16T08:00:00Z', merchant: 'Agoda', merchant_raw: 'AGODA.COM 8B DPS-CGK INTERNET 276', source: 'statement', sources: ['statement'], category: 'Travel' };
  const l = { id: 'l', account_id: 'm', amount: 1192.67, currency: 'AED', direction: 'debit', occurred_at: '2026-09-15T19:40:00Z', merchant: 'AGODA.COM 8B Dps-cgk Internet', merchant_raw: 'AGODA.COM 8B Dps-cgk Internet', source: 'email', sources: ['email'], category: null, available_balance: 9000 };
  const other = { ...l, id: 'o', merchant: 'Noon', merchant_raw: 'NOON DUBAI AE', occurred_at: '2026-09-15T08:00:00Z' }; // different day and merchant
  const far = { ...l, id: 'f', occurred_at: '2026-09-12T08:00:00Z' }; // too far apart
  const plan = planDuplicateMerges([s, l, other, far]);
  assert.equal(plan.length, 1);
  assert.deepEqual([plan[0].keep, plan[0].drop], ['s', 'l']);
  assert.equal(plan[0].patch.occurred_at, l.occurred_at);
  assert.equal(plan[0].patch.source, 'email');
  assert.deepEqual(plan[0].patch.sources, ['statement', 'email']);
  assert.equal(plan[0].patch.available_balance, 9000);
  assert.ok(!('category' in plan[0].patch)); // the statement's category stays
  // Already merged rows are left alone.
  assert.equal(planDuplicateMerges([{ ...s, source: 'email', sources: ['statement', 'email'] }, l]).length, 0);
  // Same day needs no name match; a different day does.
  assert.equal(isStatementTwin(s, { ...other, occurred_at: '2026-09-16T05:00:00Z' }), true);
  assert.equal(isStatementTwin(s, other), false);
  assert.equal(sameMerchant({ merchant: 'du' }, { merchant_raw: 'DU Apple Pay 800188 AE' }), false); // too short to trust
});

test('rename only rows the old cleaner named', () => {
  const rows = [
    { id: 'a', source: 'email', merchant_raw: 'AMZN MKTP US Amzn.com/bill US', merchant: normalizeMerchantLegacy('AMZN MKTP US Amzn.com/bill US') },
    { id: 'b', source: 'email', merchant_raw: 'AMZN MKTP US Amzn.com/bill US', merchant: 'Books for uni' }, // renamed by hand
    { id: 'c', source: 'statement', merchant_raw: 'TIKETCOM SG 702', merchant: 'Tiket.com' },
  ];
  const plan = planRenames(rows, normalizeMerchantLegacy, normalizeMerchant);
  assert.deepEqual([...plan.entries()], [['Amazon', ['a']]]);
});

test('drill-down periods: one month, one week', () => {
  const now = new Date('2026-09-23T14:00:00+04:00');
  const txs = [];
  for (let k = 0; k < 900; k++) txs.push({ id: `t${k}`, merchant: 'M', account_id: 'a', amount_aed: 10, direction: 'debit', occurred_at: new Date(now - k * 20 * 3600 * 1000).toISOString() });
  const june = monthPeriod(2025, 5, now);
  assert.equal(june.label, 'Jun 2025');
  assert.equal(june.prevLabel, 'May 2025');
  const bars = periodBars(txs, june, now);
  assert.equal(bars.unit, 'day');
  assert.equal(bars.buckets.length, 30);
  assert.ok(Math.abs(bars.buckets.reduce((a, b) => a + b.total, 0) - summarize(txs, june).total) < 1e-6);
  const weekBars = periodBars(txs, getPeriod('3m', now), now);
  const w = weekBars.buckets[3];
  const week = rangePeriod(new Date(w.start), new Date(w.end), w.fullLabel);
  const wb = periodBars(txs, week, now);
  assert.equal(wb.unit, 'day');
  assert.equal(wb.buckets.length, 7);
  assert.ok(Math.abs(wb.buckets.reduce((a, b) => a + b.total, 0) - w.total) < 1e-6);
  assert.ok(wb.average > 0);
});
