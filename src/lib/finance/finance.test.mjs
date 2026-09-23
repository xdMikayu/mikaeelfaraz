// Run with: npm test
// Card numbers and balances below are made up — never commit real ones (public repo).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEvent, parseTabbyAlert, parseSibSms, parseMashreqEmail, parseWalletEvent, normalizeMerchant, parseAmount, splitPastedMessages, dubaiParts } from './parse.mjs';
import { keywordCategory, ruleCategory, merchantKey, isBnplRepayment } from './categories.mjs';
import { getPeriod } from './periods.mjs';

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
  assert.equal(r.merchant, 'DU');
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
  assert.equal(r.merchant, 'DU');
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
  assert.equal(normalizeMerchant('DU Apple Pay 800188 AE'), 'DU');
  assert.equal(normalizeMerchant('CAREEM HALA DUBAI AE'), 'Careem Hala');
  assert.equal(normalizeMerchant('Digital Dubai'), 'Digital Dubai');
  assert.equal(normalizeMerchant('KFC 1234 SHARJAH ARE'), 'KFC');
  assert.equal(normalizeMerchant('AL REEF BAKERY'), 'Al Reef Bakery');
  assert.equal(normalizeMerchant('du'), 'DU');
  assert.equal(normalizeMerchant('SOME NEW SHOP LLC'), 'Some New Shop LLC');
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

test('BNPL instalments on bank cards are recognised', () => {
  assert.equal(isBnplRepayment('TABBY FZ LLC DUBAI', 'mashreq'), true);
  assert.equal(isBnplRepayment('Tamara', 'sib'), true);
  assert.equal(isBnplRepayment('DU', 'mashreq'), false);
  assert.equal(isBnplRepayment('Tabby', 'tabby'), false);
});

test('Tabby app alert', () => {
  const TABBY = 'Transaction of AED 1.00 At DU Apple Pay was successful. Your available Tabby Card limit is AED 1,234.56.';
  const r = parseTabbyAlert(TABBY, NOW, 'sms');
  assert.equal(r.ok, true);
  assert.equal(r.account, 'tabby');
  assert.equal(r.amount, 1);
  assert.equal(r.merchant, 'DU');
  assert.equal(r.availableBalance, 1234.56);
  assert.equal(r.source, 'sms');
  assert.equal(r.occurredAt, NOW.toISOString());
  assert.equal(parseEvent({ source: 'sms', text: TABBY }, NOW).account, 'tabby');
  assert.equal(splitPastedMessages(`${TABBY}\n${TABBY.replace('1.00', '2.00')}`).length, 2);
});
