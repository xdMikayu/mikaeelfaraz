#!/usr/bin/env python3
"""
Fits Matchday's F1 race prediction (scripts/f1_model.py) on past seasons' session files and
tests it walk-forward: every test race is predicted by a model fitted only on races before it, so
the test numbers are what the page would have said at the time. Writes scripts/f1-model.json.

    python scripts/f1_fit.py --data DIR [--test-from 2025] [--out scripts/f1-model.json]

DIR holds a folder per season, as f1_sessions.py writes them.
"""
import argparse
import json
import math
import os
import sys
from datetime import datetime, timezone

import numpy as np
from scipy.optimize import minimize

sys.path.insert(0, os.path.dirname(__file__))
from f1_model import FEATURES, features, load, outcome, simulate  # noqa: E402


def races(dirs):
    """Every race with what was known after qualifying and how it finished, oldest first."""
    for s in sorted(dirs):
        rounds = sorted({int(f.split('-')[0]) for f in os.listdir(dirs[s]) if f.endswith('-race.json')})
        for r in rounds:
            race = load(dirs[s], f'{r}-race')
            feats = features(dirs, s, r)
            if not race or not feats:
                continue
            fin, out = outcome(race)
            fin = [c for c in fin if c in feats]
            out = [c for c in out if c in feats]
            if len(fin) >= 10:
                yield {'season': s, 'round': r, 'event': race['event'], 'feats': feats, 'finished': fin, 'out': out}


def nll(w, data, use, l2, top):
    """
    Plackett–Luce negative log-likelihood of the first `top` places of each finishing order (who
    takes first from everyone, then second from the rest, and so on), plus a small ridge. Fitting
    the front of the order only keeps the backmarkers' shuffles from setting the weights.
    """
    total = 0.0
    for d in data:
        x = np.array([[d['feats'][c][k] for k in use] for c in d['finished']])
        s = -x @ w
        rest = np.logaddexp.accumulate(s[::-1])[::-1]
        total -= float(np.sum((s - rest)[:top]))
    return total + l2 * float(np.sum(w ** 2))


def fit(data, use, l2=0.5, top=10):
    res = minimize(nll, np.zeros(len(use)), args=(data, use, l2, top), method='L-BFGS-B')
    weights = {k: 0.0 for k in FEATURES}
    weights.update({k: float(v) for k, v in zip(use, res.x)})
    starters = sum(len(d['finished']) + len(d['out']) for d in data)
    return {'weights': weights, 'dnf': sum(len(d['out']) for d in data) / max(1, starters)}


def score(model, d):
    sim = {x['code']: x for x in simulate(model, d['feats'], n=8000)}
    winner = d['finished'][0]
    podium = set(d['finished'][:3])
    points = set(d['finished'][:10])
    codes = list(d['feats'])
    return {
        'logLoss': -math.log(max(1e-4, sim[winner]['win'])),
        'winnerChance': sim[winner]['win'],
        'favouriteWon': max(codes, key=lambda c: sim[c]['win']) == winner,
        'podiumBrier': float(np.mean([(sim[c]['podium'] - (c in podium)) ** 2 for c in codes])),
        'pointsBrier': float(np.mean([(sim[c]['points'] - (c in points)) ** 2 for c in codes])),
        'wins': [(sim[c]['win'], c == winner) for c in codes],
    }


def walk_forward(data, use, test_from, min_train=12):
    rows = []
    for i, d in enumerate(data):
        if d['season'] < test_from or i < min_train:
            continue
        model = fit(data[:i], use)
        rows.append(score(model, d))
    if not rows:
        return None
    wins = [w for r in rows for w in r['wins']]
    buckets = []
    for lo, hi in ((0, 0.05), (0.05, 0.15), (0.15, 0.35), (0.35, 0.6), (0.6, 1.01)):
        b = [won for p, won in wins if lo <= p < hi]
        ps = [p for p, won in wins if lo <= p < hi]
        if b:
            buckets.append({'from': lo, 'to': min(hi, 1), 'said': round(float(np.mean(ps)), 3), 'happened': round(float(np.mean(b)), 3), 'n': len(b)})
    return {
        'races': len(rows),
        'logLoss': round(float(np.mean([r['logLoss'] for r in rows])), 3),
        'winnerChance': round(float(np.mean([r['winnerChance'] for r in rows])), 3),
        'favouriteWon': int(sum(r['favouriteWon'] for r in rows)),
        'podiumBrier': round(float(np.mean([r['podiumBrier'] for r in rows])), 4),
        'pointsBrier': round(float(np.mean([r['pointsBrier'] for r in rows])), 4),
        'calibration': buckets,
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--data', required=True, nargs='+', help='folders holding a folder per season')
    ap.add_argument('--test-from', type=int, default=2025)
    ap.add_argument('--out', default=os.path.join(os.path.dirname(__file__), 'f1-model.json'))
    args = ap.parse_args()

    dirs = {}
    for base in args.data:
        for name in os.listdir(base):
            if name.isdigit() and os.path.isdir(os.path.join(base, name)):
                dirs[int(name)] = os.path.join(base, name)
    data = list(races(dirs))
    print(f'{len(data)} races from {sorted(dirs)}')

    # Each candidate set of inputs, tested the same way; the grid alone is the bar to beat.
    sets = {'grid': ['grid'], 'grid+quali': ['grid', 'quali'], 'grid+quali+form': ['grid', 'quali', 'form'], 'all': FEATURES}
    tests = {}
    for name, use in sets.items():
        tests[name] = walk_forward(data, use, args.test_from)
        t = tests[name]
        print(f"{name:18s} races {t['races']}  winner log loss {t['logLoss']}  winner's chance {t['winnerChance']}  favourite won {t['favouriteWon']}  podium Brier {t['podiumBrier']}  points Brier {t['pointsBrier']}")

    # Keep the inputs that improve most on the grid alone, averaged over the three things the page
    # shows (the winner, the podium, the points). With a few dozen test races a gain under 2% is
    # noise (the pick flips as races are added), so the grid alone stays unless something clears it.
    base = tests['grid']
    gain = lambda t: np.mean([(base[k] - t[k]) / base[k] for k in ('logLoss', 'podiumBrier', 'pointsBrier')])
    best = max(sets, key=lambda k: gain(tests[k]))
    if gain(tests[best]) < 0.02:
        best = 'grid'
    for k in sets:
        print(f'{k:18s} average gain on the grid alone {gain(tests[k]) * 100:+.1f}%')
    model = fit(data, sets[best])
    out = {
        'built': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'inputs': sets[best],
        'weights': {k: round(v, 4) for k, v in model['weights'].items()},
        'dnf': round(model['dnf'], 4),
        'trainedOn': {'races': len(data), 'seasons': sorted({d['season'] for d in data})},
        'test': {
            'from': args.test_from,
            'chosen': best,
            'gainOnGrid': round(float(gain(tests[best])), 4),
            **tests[best],
            'gridOnly': {k: tests['grid'][k] for k in ('logLoss', 'winnerChance', 'favouriteWon', 'podiumBrier', 'pointsBrier')},
        },
    }
    with open(args.out, 'w') as f:
        json.dump(out, f, indent=1)
    print(f'chose {best}: {json.dumps(out["weights"])}, retirement chance {out["dnf"]}')


if __name__ == '__main__':
    main()
