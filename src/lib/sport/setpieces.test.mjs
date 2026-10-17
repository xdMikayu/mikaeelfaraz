import { test } from 'node:test';
import assert from 'node:assert/strict';
import { situation, matchSetPieces, seasonSetPieces } from './setpieces.mjs';

test('set pieces: the situation comes from the commentary wording', () => {
  assert.equal(situation('Attempt missed. Luka Vuskovic (Brighton and Hove Albion) header from the left side of the six yard box is too high. Assisted by Pascal Groß with a cross following a corner.'), 'corner');
  assert.equal(situation('Attempt missed. Amad Diallo (Manchester United) left footed shot from outside the box is high and wide to the left following a corner.'), 'corner');
  assert.equal(situation('Pascal Struijk (Brighton and Hove Albion) hits the left post with a header from the centre of the box. Assisted by Olivier Boscagli with a cross following a set piece situation.'), 'set');
  assert.equal(situation('Attempt saved. Bukayo Saka (Arsenal) left footed shot from outside the box is saved in the top centre of the goal from a direct free kick.'), 'free');
  assert.equal(situation('Goal! Arsenal 1, Chelsea 0. Bukayo Saka (Arsenal) converts the penalty with a left footed shot to the bottom left corner.'), 'pen');
  assert.equal(situation('Goal! Sunderland 0, Brighton and Hove Albion 2. Jaouen Hadjam (Brighton and Hove Albion) left footed shot from the left side of the box to the bottom right corner. Assisted by Georginio Rutter following a fast break.'), null);
});

const player = (id, name, extra = {}) => ({ id, name, starter: true, on: null, off: null, ...extra });
const shot = (side, minute, who, text, extra = {}) => ({ side, minute, player: who, text, xg: 0.1, header: /header/.test(text), outcome: 'miss', ...extra });

const DETAIL = {
  stats: [{ key: 'wonCorners', home: 7, away: 2 }],
  lineups: {
    home: {
      starters: [player('1', 'Gabriel Magalhães'), player('2', 'Declan Rice'), player('3', 'William Saliba', { off: "60'" })],
      bench: [player('4', 'Jakub Kiwior', { starter: false, on: "60'" }), player('5', 'Unused Sub', { starter: false })],
    },
    away: { starters: [player('9', 'Virgil van Dijk')], bench: [] },
  },
  shots: [
    shot('home', "12'", 'Gabriel Magalhães', 'Attempt missed. Gabriel Magalhães (Arsenal) header from the centre of the box is too high. Assisted by Declan Rice with a cross following a corner.'),
    shot('home', "50'", 'William Saliba', 'Attempt saved. William Saliba (Arsenal) header from very close range is saved. Assisted by Declan Rice with a cross following a set piece situation.', { xg: 0.3 }),
    shot('home', "75'", 'Gabriel Magalhães', 'Goal! Arsenal 1, Liverpool 0. Gabriel Magalhães (Arsenal) header from the centre of the box to the bottom left corner. Assisted by Jakub Kiwior following a corner.', { xg: 0.2, outcome: 'goal' }),
    shot('home', "80'", 'Declan Rice', 'Attempt missed. Declan Rice (Arsenal) right footed shot from outside the box is too high.'),
    shot('home', "88'", 'Declan Rice', 'Attempt saved. Declan Rice (Arsenal) right footed shot from outside the box is saved from a direct free kick.'),
    shot('away', "90'+3'", 'Virgil van Dijk', 'Attempt missed. Virgil van Dijk (Liverpool) header from the centre of the box misses to the left following a corner.'),
  ],
};

test('set pieces: one match keeps corners, set-piece attempts with who set them up, and part-match minutes', () => {
  const sp = matchSetPieces(DETAIL);
  assert.deepEqual(sp.c, [7, 2]);
  assert.deepEqual(sp.s, [
    [1, 12, '1', 'c', 1, 0.1, 0, '2'],
    [1, 50, '3', 's', 1, 0.3, 0, '2'],
    [1, 75, '1', 'c', 1, 0.2, 1, '4'],
    [1, 88, '2', 'f', 0, 0.1, 0, 0],
    [0, 90, '9', 'c', 1, 0.1, 0, 0],
  ]);
  // Saliba off at 60, Kiwior on at 60; the unused substitute isn't there at all.
  assert.deepEqual(sp.w, { 3: [0, 60], 4: [60, 90] });
});

test('set pieces: a season adds up both ends, and shares count only attempts made while a player was on', () => {
  const rows = (home, list) => list.map(([id, name, minutes]) => [id, name, home, 'CB', minutes, 0, 0, 0, 0, 0]);
  const match = {
    h: 'ARS',
    a: 'LIV',
    r: [...rows(1, [['1', 'Gabriel Magalhães', 90], ['2', 'Declan Rice', 90], ['3', 'William Saliba', 60], ['4', 'Jakub Kiwior', 30]]), ...rows(0, [['9', 'Virgil van Dijk', 90]])],
    sp: matchSetPieces(DETAIL),
  };
  const t = seasonSetPieces([match, { ...match, sp: undefined }]);
  const ars = t.ARS;
  assert.equal(ars.m, 1, 'a match without set-piece data is left out');
  assert.equal(ars.c, 7);
  assert.equal(ars.cc, 2);
  assert.equal(ars.a, 3, 'two corners and a set piece; the direct free kick and the open-play shot are not deliveries');
  assert.equal(ars.g, 1);
  assert.equal(ars.hd, 3);
  assert.equal(ars.f, 1);
  assert.equal(t.LIV.aa, 3);
  assert.equal(t.LIV.ga, 1);
  assert.equal(t.LIV.a, 1);
  assert.equal(ars.aa, 1);
  // [id, name, attempts, headers, goals, xG, team attempts while on, minutes]
  assert.deepEqual(ars.targets[0], ['1', 'Gabriel Magalhães', 2, 2, 1, 0.3, 3, 90]);
  assert.deepEqual(ars.targets[1], ['3', 'William Saliba', 1, 1, 0, 0.3, 2, 60]);
  assert.equal(ars.targets.length, 2);
  // Rice set up two, Kiwior one (the goal).
  assert.deepEqual(ars.deliver, [
    ['2', 'Declan Rice', 2, 0],
    ['4', 'Jakub Kiwior', 1, 1],
  ]);
});
