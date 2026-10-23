"""
Matchday's F1 race prediction, from the session files scripts/f1_sessions.py writes.

Before a race, each driver gets a strength from what's known after qualifying:
  - his grid slot (the log of his qualifying position: the front rows matter most);
  - his qualifying gap to pole, as a share of the pole lap;
  - his long-run pace in practice (FP2, or FP1 on a sprint weekend) against the quickest, as a share;
    a team-mate's run stands in when he had none, and the field's middle when neither had one;
  - his team's race pace over its last three races against the quickest team each time, as a share.
The cars that finish come home in a Plackett–Luce order on those strengths: the chance a driver
beats everyone still behind him is proportional to e^strength. Each car also retires with a
chance learned from past races. Weights and that chance are fitted by scripts/f1_fit.py,
which also tests them on races they never saw; the result is in scripts/f1-model.json.
"""
import json
import math
import os

import numpy as np

FEATURES = ['grid', 'quali', 'longRun', 'form']
FINISHED = ('Finished', 'Lapped')


def load(season_dir, name):
    path = os.path.join(season_dir, f'{name}.json')
    if not os.path.exists(path):
        return None
    with open(path) as f:
        s = json.load(f)
    return None if s.get('missing') else s


def race_pace_by_team(race):
    """Each team's race pace as a share slower than the quickest team (its quicker driver counts)."""
    if not race or not race.get('pace'):
        return {}
    team_of = {d['code']: d['team'] for d in race['drivers']}
    best = {}
    for p in race['pace']:
        t = team_of.get(p['code'])
        if t and (t not in best or p['median'] < best[t]):
            best[t] = p['median']
    if not best:
        return {}
    top = min(best.values())
    return {t: (v - top) / top * 100 for t, v in best.items()}


def features(dirs, season, rnd):
    """
    What's known after qualifying for one race: {code: {grid, quali, longRun, form, team}}, or None
    without a qualifying file. dirs: {season: folder}, so the form can reach back into last season.
    """
    sd = dirs.get(season)
    q = load(sd, f'{rnd}-q') if sd else None
    if not q or not q.get('best'):
        return None
    order = [row[0] for row in q['parts']] if q.get('parts') else [b['code'] for b in q['best']]
    team_of = {d['code']: d['team'] for d in q['drivers']}
    best = {b['code']: b['time'] for b in q['best'] if b['time']}
    pole = min(best.values())

    practice = load(sd, f'{rnd}-fp2') or load(sd, f'{rnd}-fp1')
    runs = {r['code']: r['median'] for r in (practice or {}).get('longRun', [])}
    lr = {}
    if runs:
        top = min(runs.values())
        lr = {c: (v - top) / top * 100 for c, v in runs.items()}
    by_team = {}
    for c, v in lr.items():
        by_team.setdefault(team_of.get(c), []).append(v)
    mid = float(np.median(list(lr.values()))) if lr else 0.0

    # The team's last three races before this one, this season first, then last season's end.
    form = {}
    seen = 0
    for s, r in previous_races(dirs, season, rnd):
        pace = race_pace_by_team(load(dirs[s], f'{r}-race'))
        if not pace:
            continue
        for t, v in pace.items():
            form.setdefault(t, []).append(v)
        seen += 1
        if seen == 3:
            break
    form_mid = float(np.median([np.mean(v) for v in form.values()])) if form else 0.0

    out = {}
    for i, code in enumerate(order):
        t = team_of.get(code)
        mate = [v for v in by_team.get(t, [])]
        out[code] = {
            'team': t,
            'grid': math.log(i + 1),
            'quali': (best[code] - pole) / pole * 100 if code in best else max(((v - pole) / pole * 100 for v in best.values()), default=0) + 0.5,
            'longRun': lr[code] if code in lr else (float(np.mean(mate)) if mate else mid),
            'form': float(np.mean(form[t])) if t in form else form_mid,
        }
    return out


def previous_races(dirs, season, rnd):
    """(season, round) of earlier races, most recent first."""
    for s in sorted(dirs, reverse=True):
        if s > season:
            continue
        rounds = sorted({int(f.split('-')[0]) for f in os.listdir(dirs[s]) if f.endswith('-race.json')}, reverse=True)
        for r in rounds:
            if s < season or r < rnd:
                yield s, r


def outcome(race):
    """The classified finishers in order, and who started but didn't finish (or was disqualified)."""
    finished, out = [], []
    for c in race['classification']:
        status = str(c['status'])
        if status == 'Did not start':
            continue
        (finished if status in FINISHED or status.startswith('+') else out).append(c['code'])
    return finished, out


def strengths(model, feats):
    w = model['weights']
    return {c: -sum(w[k] * f[k] for k in FEATURES) for c, f in feats.items()}


def simulate(model, feats, n=20000, seed=7):
    """Each driver's chance to win, reach the podium and score (top ten), and his expected place."""
    rng = np.random.default_rng(seed)
    codes = list(feats)
    s = np.array([strengths(model, feats)[c] for c in codes])
    k = len(codes)
    # Plackett–Luce draws: order by strength plus Gumbel noise; retirements go to the back.
    noise = rng.gumbel(size=(n, k))
    out = rng.random((n, k)) < model['dnf']
    score = np.where(out, -1e9 + noise, s + noise)
    place = np.argsort(np.argsort(-score, axis=1), axis=1) + 1
    res = []
    for j, c in enumerate(codes):
        p = place[:, j]
        fin = ~out[:, j]
        res.append({
            'code': c,
            'win': float(np.mean((p == 1) & fin)),
            'podium': float(np.mean((p <= 3) & fin)),
            'points': float(np.mean((p <= 10) & fin)),
            'place': float(np.mean(p)),
        })
    res.sort(key=lambda x: (-x['win'], x['place']))
    return res
