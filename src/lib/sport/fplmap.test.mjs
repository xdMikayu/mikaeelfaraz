import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fplElementsFor, fplPlayersFor } from './fplmap.mjs';

const espn = (id, name, last) => ({ id, name, last });
const fpl = (id, team, first, second, name) => ({ id, team, first, second, name });
const LINEUPS = {
  home: {
    starters: [espn('e1', 'Erling Haaland', 'Haaland'), espn('e2', 'Phil Foden', 'Foden'), espn('e3', 'Matheus Nunes', 'Nunes')],
    bench: [espn('e4', 'Rúben Dias', 'Dias')],
  },
  away: { starters: [espn('e9', 'Florentino', 'Florentino'), espn('e10', 'Dara O’Shea', 'O’Shea')], bench: [] },
};
const FX = { home: 1, away: 2 };
const STATIC = {
  elements: [
    fpl(101, 1, 'Erling', 'Haaland', 'Haaland'),
    fpl(102, 1, 'Phil', 'Foden', 'Foden'),
    fpl(103, 1, 'Matheus Luiz', 'Nunes', 'Matheus N.'), // only the surname finds this one
    fpl(104, 1, 'Rúben', 'dos Santos Gato Alves Dias', 'Rúben'), // in the matchup data's map
    fpl(201, 2, 'Florentino', 'Ibrain Morris Luís', 'Florentino'), // FPL's short name
    fpl(202, 2, 'Dara', "O'Shea", "O'Shea"),
    fpl(203, 2, 'Kieran', 'Nunes', 'K.Nunes'), // a namesake at the other club
  ],
};

test('fplmap: lineup players are found by the map, full name, short name, then a surname', () => {
  const ids = fplElementsFor(LINEUPS, STATIC, FX, { 104: 'e4' });
  assert.deepEqual(ids, { e1: 101, e2: 102, e3: 103, e4: 104, e9: 201, e10: 202 });
});

test('fplmap: a surname shared at the club picks no one, unless only one of them played', () => {
  const shared = { elements: [...STATIC.elements, fpl(105, 1, 'Tiago', 'Nunes', 'T.Nunes')] };
  assert.equal(fplElementsFor(LINEUPS, shared, FX).e3, undefined);
  assert.equal(fplElementsFor(LINEUPS, shared, FX, {}, (id) => id === 103).e3, 103);
});

test('fplmap: live numbers by ESPN id, only for clubs playing once in the gameweek', () => {
  const live = { fixtures: [{ home: 1, away: 2 }], elements: Object.fromEntries(STATIC.elements.map((e) => [e.id, { minutes: 90, bps: e.id }])) };
  const once = fplPlayersFor(LINEUPS, STATIC, live, FX, { 104: 'e4' });
  assert.equal(once.e1.bps, 101);
  assert.equal(once.e3.bps, 103);
  const twice = fplPlayersFor(LINEUPS, STATIC, { ...live, fixtures: [...live.fixtures, { home: 1, away: 3 }] }, FX);
  assert.equal(twice.e1, undefined);
  assert.equal(twice.e9.bps, 201);
});
