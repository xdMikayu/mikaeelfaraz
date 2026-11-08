import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kitHex, fillOf, lineOf, matchKits, contrast, hexToRgb, distance, isWhite, cvdDistance } from './kit-colors.mjs';

const C = (a, b) => contrast(hexToRgb(a), hexToRgb(b));

test('kitHex: screen primaries become kit colours, designed colours stay', () => {
  // ESPN's #0000fa (Everton, Ipswich, Portsmouth) and #ffff00 (Norwich, Fenerbahce).
  const blue = kitHex('0000fa');
  const yellow = kitHex('#ffff00');
  assert.notEqual(blue, '#0000fa');
  assert.notEqual(yellow, '#ffff00');
  assert.ok(distance(hexToRgb(blue), hexToRgb('#1d3fb5')) < 8, blue);
  assert.ok(distance(hexToRgb(yellow), hexToRgb('#f8d916')) < 8, yellow);
  for (const c of ['#144992', '#660e36', '#d11317', '#99c5ea', '#00239c', '#288a00', '#011f68']) assert.equal(kitHex(c), c);
  // Both of ESPN's spellings, and nothing when there's nothing.
  assert.equal(kitHex('d11317'), '#d11317');
  assert.equal(kitHex(''), null);
  assert.equal(kitHex(undefined), null);
  assert.equal(kitHex('red'), null);
});

test('fillOf: a white kit takes the darker alternate, when there is one', () => {
  assert.equal(fillOf({ color: '#ffffff', alt: '#0b1426' }), '#0b1426'); // Spurs
  assert.equal(fillOf({ color: '#ffffff', alt: '#ffcd00' }), '#ffffff'); // Leeds: no darker one
  assert.equal(fillOf({ color: null, alt: '#cc0000' }), '#cc0000');
  assert.equal(fillOf({}), '#3a3a3a');
});

test('matchKits: the away side changes when the kits clash, and keeps one colour everywhere', () => {
  // Brentford (red) v Liverpool (red, white alternate): Liverpool in white, drawn in ink on a white page.
  const k = matchKits({ color: '#f42727', alt: '#0f1c3f' }, { color: '#d11317', alt: '#ffffff' });
  assert.equal(k.away.fill, '#ffffff');
  assert.ok(k.away.white);
  assert.equal(k.away.line, '#111111');
  assert.equal(k.home.line, kitHex('#f42727'));
  // In dark mode the same white kit is drawn white.
  assert.equal(matchKits({ color: '#f42727' }, { color: '#d11317', alt: '#ffffff' }, true).away.line, '#ffffff');
});

test('lineOf: a pale kit gets a deeper shade of itself, not another colour', () => {
  // Man City's sky blue is too pale for a line on white; it stays blue.
  const city = lineOf('#99c5ea');
  assert.ok(C(city, '#ffffff') >= 2.6, city);
  const [r, g, b] = hexToRgb(city);
  assert.ok(b > r && b > g, city);
  // Navy is too dark for a line on near-black; it gets lighter in dark mode.
  const navy = lineOf('#011f68', true);
  assert.ok(C(navy, '#121212') >= 2.6, navy);
  // White and grey kits have no colour to keep.
  assert.equal(lineOf('#ffffff'), '#111111');
  assert.ok(isWhite('#f5f5f5'));
});

test('matchKits: two sides that would look alike are told apart', () => {
  // No colours at all (lower-league cricket): ink and a grey, never the same.
  const k = matchKits({}, {});
  assert.ok(distance(hexToRgb(k.home.line), hexToRgb(k.away.line)) >= 18);
  // Dortmund v Bodo/Glimt: both yellow, Bodo's alternate is white.
  const y = matchKits({ color: '#ffee00', alt: '#272726' }, { color: '#fcee33', alt: '#ffffff' });
  assert.ok(distance(hexToRgb(y.home.line), hexToRgb(y.away.line)) >= 18);
});

test('matchKits: red against green is told apart for someone colour blind, by a shade', () => {
  const cvd = (a, b) => cvdDistance(hexToRgb(a), hexToRgb(b));
  // Liverpool's red and Sporting's green: two browns to someone red-green colour blind.
  const liv = { color: 'c8102e' };
  const spo = { color: '008057' };
  assert.ok(cvd('#c8102e', '#008057') < 15);
  for (const dark of [false, true]) {
    const k = matchKits(liv, spo, dark);
    assert.ok(cvd(k.home.line, k.away.line) >= 17, `${dark ? 'dark' : 'light'}: ${k.home.line} ${k.away.line}`);
    // Each stays its own colour (a shade, not another hue) and readable on the page.
    const surface = dark ? '#121212' : '#ffffff';
    for (const line of [k.home.line, k.away.line]) assert.ok(C(line, surface) >= 2.6, line);
    assert.ok(hexToRgb(k.home.line)[0] > hexToRgb(k.home.line)[1] * 2, `still red: ${k.home.line}`);
    assert.ok(hexToRgb(k.away.line)[1] > hexToRgb(k.away.line)[0] * 2, `still green: ${k.away.line}`);
    // The blocks are the real kits.
    assert.equal(k.home.fill, '#c8102e');
    assert.equal(k.away.fill, '#008057');
  }
  // Red against blue reads to everyone: left alone.
  const k = matchKits({ color: 'e8352a' }, { color: '0a3f92' });
  assert.equal(k.home.line, lineOf('#e8352a'));
  assert.equal(k.away.line, lineOf('#0a3f92'));
});
