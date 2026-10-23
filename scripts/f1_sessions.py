#!/usr/bin/env python3
"""
F1 sessions for Matchday's F1 pages, from F1's own timing archive through FastF1.

After each session it writes one small JSON file for the pages:
  - race and sprint: everyone's position and gap to the leader lap by lap, every lap time, tyre
    stints, pit stops, safety cars and red flags by lap, and race pace (the median of each
    driver's clean laps: no pit laps, no laps under yellow or the safety car, not the first lap);
  - qualifying and sprint qualifying: each driver's best lap with its sectors, his ideal lap from
    his best sectors, his top speed, and the two fastest laps' telemetry (speed, throttle, brake,
    gear) with the time between them along the lap;
  - practice: one-lap pace and long runs (a rough guide to race pace);
and index.json: what's there, with every team's colour and every driver's code.

    python scripts/f1_sessions.py --out DIR [--season 2026] [--round 17] [--force]

The GitHub Action .github/workflows/f1-data.yml runs it every two hours over race weekends and
pushes DIR to the f1-data branch; the site reads it through /api/f1/data. FastF1 is
unofficial: F1 could change its archive, and then this stops until FastF1 catches up.
"""
import argparse
import json
import math
import os
import sys
from datetime import datetime, timedelta, timezone

import fastf1
import numpy as np
import pandas as pd
from fastf1.exceptions import RateLimitExceededError

KEYS = {
    'Practice 1': 'fp1',
    'Practice 2': 'fp2',
    'Practice 3': 'fp3',
    'Sprint Qualifying': 'sq',
    'Sprint Shootout': 'sq',
    'Sprint': 'sprint',
    'Qualifying': 'q',
    'Race': 'race',
}
# Minutes from a session's start until its data is safe to read: its usual length, red flags
# included, and time for F1 to finish writing the archive.
READY = {'fp1': 100, 'fp2': 100, 'fp3': 100, 'sq': 90, 'sprint': 90, 'q': 100, 'race': 210}
# A session is read once when ready and once more the next day, when late corrections are in.
SETTLE = timedelta(hours=20)
# Long runs: at least this many laps in one stint, each within this share of the stint's median.
LONG_RUN = 5
RUN_SPREAD = 1.03


def r3(x):
    return None if x is None or (isinstance(x, float) and math.isnan(x)) or pd.isna(x) else round(float(x), 3)


def secs(td):
    return None if pd.isna(td) else round(td.total_seconds(), 3)


def iso(ts):
    if ts is None or pd.isna(ts):
        return None
    ts = pd.Timestamp(ts)
    if ts.tzinfo is None:
        ts = ts.tz_localize('UTC')
    return ts.tz_convert('UTC').strftime('%Y-%m-%dT%H:%M:%SZ')


def roster(session):
    """Every driver in the session, in the official order where there is one."""
    out = []
    for _, d in session.results.iterrows():
        out.append({
            'code': d['Abbreviation'],
            'id': d['DriverId'] or None,
            'number': str(d['DriverNumber']),
            'name': d['FullName'],
            'first': d['FirstName'],
            'last': d['LastName'],
            'team': d['TeamId'] or None,
            'teamName': d['TeamName'],
            'color': (d['TeamColor'] or '').upper() or None,
        })
    return out


def weather(session):
    w = session.weather_data
    if w is None or w.empty:
        return None
    # The first readings of a session can be zeros before the sensors report.
    w = w[w['TrackTemp'] > 0]
    if w.empty:
        return None
    return {
        'air': [r3(w['AirTemp'].min()), r3(w['AirTemp'].max())],
        'track': [r3(w['TrackTemp'].min()), r3(w['TrackTemp'].max())],
        'rain': bool(w['Rainfall'].any()),
    }


def flag_of(status):
    """The worst condition during a lap, from FastF1's TrackStatus string (it lists each code seen)."""
    s = str(status or '')
    if '5' in s:
        return 'RED'
    if '4' in s:
        return 'SC'
    if '6' in s or '7' in s:
        return 'VSC'
    if '2' in s:
        return 'Y'
    return None


def clean_laps(laps):
    """Laps that show pace: timed, accurate, not in or out of the pits, all green, not lap 1, and
    within 107% of the session's fastest (which drops slow laps behind a crash or with damage)."""
    l = laps.pick_wo_box().pick_track_status('1', how='equals')
    l = l[(l['LapNumber'] > 1) & l['IsAccurate'] & l['LapTime'].notna()]
    return l.pick_quicklaps(1.07) if len(l) else l


def stints_of(laps):
    """Each driver's stints: [compound, first lap, last lap, laps old at the start]."""
    out = {}
    for code, d in laps.groupby('Driver'):
        rows = []
        for _, s in d.groupby('Stint'):
            s = s.sort_values('LapNumber')
            first = s.iloc[0]
            age = first['TyreLife'] - 1 if pd.notna(first['TyreLife']) else None
            rows.append([first['Compound'] if isinstance(first['Compound'], str) else None, int(s['LapNumber'].min()), int(s['LapNumber'].max()), None if age is None else int(age)])
        out[code] = rows
    return out


def race_like(session):
    """A race or a sprint."""
    laps = session.laps
    res = session.results
    total = int(laps['LapNumber'].max()) if len(laps) else 0
    t = laps.assign(t=laps['Time'].dt.total_seconds())
    end = t.pivot_table(index='LapNumber', columns='Driver', values='t', aggfunc='first')
    pos = t.pivot_table(index='LapNumber', columns='Driver', values='Position', aggfunc='first')
    lead_at = end.min(axis=1)
    gaps = end.sub(lead_at, axis=0)
    lap_t = t.assign(s=t['LapTime'].dt.total_seconds()).pivot_table(index='LapNumber', columns='Driver', values='s', aggfunc='first')

    codes = list(res['Abbreviation'])
    grid = {r['Abbreviation']: (int(r['GridPosition']) if pd.notna(r['GridPosition']) and r['GridPosition'] > 0 else None) for _, r in res.iterrows()}
    # A driver with no timed laps (out on lap 1) has no column in a pivot.
    col = lambda df, c: df[c] if c in df.columns else pd.Series(dtype=float)
    by_lap = {}
    for c in codes:
        if c not in end.columns:
            continue
        n = int(end[c].last_valid_index() or 0)
        rng = range(1, n + 1)
        p, g, lt = col(pos, c), col(gaps, c), col(lap_t, c)
        by_lap[c] = {
            'pos': [grid.get(c)] + [None if pd.isna(p.get(i)) else int(p.get(i)) for i in rng],
            'gap': [r3(g.get(i)) for i in rng],
            'time': [r3(lt.get(i)) for i in rng],
        }

    # The leader's lap decides each lap's flag.
    leader_laps = laps[laps['Position'] == 1].set_index('LapNumber')
    flags = [flag_of(leader_laps['TrackStatus'].get(i)) if i in leader_laps.index else None for i in range(1, total + 1)]

    pits = {}
    for code, d in laps.groupby('Driver'):
        d = d.sort_values('LapNumber').reset_index(drop=True)
        stops = []
        for i, lap in d.iterrows():
            if pd.notna(lap['PitInTime']) and i + 1 < len(d) and pd.notna(d.loc[i + 1, 'PitOutTime']):
                stops.append({'lap': int(lap['LapNumber']), 'lane': secs(d.loc[i + 1, 'PitOutTime'] - lap['PitInTime'])})
        if stops:
            pits[code] = stops

    clean = clean_laps(laps)
    pace = []
    for code, d in clean.groupby('Driver'):
        if len(d) < 5:
            continue
        s = d['LapTime'].dt.total_seconds()
        pace.append({'code': code, 'median': r3(s.median()), 'laps': int(len(d)), 'best': r3(s.min())})
    pace.sort(key=lambda x: x['median'])

    fastest = laps.pick_fastest()
    return {
        'laps': total,
        'byLap': by_lap,
        'flags': flags,
        'stints': stints_of(laps),
        'pits': pits,
        'pace': pace,
        'fastest': None if fastest is None or pd.isna(fastest['LapTime']) else {'code': fastest['Driver'], 'lap': int(fastest['LapNumber']), 'time': secs(fastest['LapTime'])},
        'classification': [
            {
                'code': r['Abbreviation'],
                'pos': None if pd.isna(r['Position']) else int(r['Position']),
                'text': r['ClassifiedPosition'],
                'grid': grid.get(r['Abbreviation']),
                'status': r['Status'],
                'points': r3(r['Points']),
                'laps': None if pd.isna(r['Laps']) else int(r['Laps']),
                'time': secs(r['Time']),
            }
            for _, r in res.iterrows()
        ],
    }


def resample_lap(lap, grid):
    """A lap's telemetry at fixed shares of its length (grid runs 0 to 1): speed, throttle, brake,
    gear and elapsed time. Car data comes about four times a second and its distance is summed
    from speed, so each lap is measured against its own length, and its clock is stretched to the
    official lap time: two laps then line up at the line, and their gap there is the official one."""
    tel = lap.get_car_data().add_distance()
    d = tel['Distance'].to_numpy()
    keep = np.r_[True, np.diff(d) > 0]
    d = d[keep] / d[keep].max()
    tel = tel[keep]
    t = tel['Time'].dt.total_seconds().to_numpy()
    t = t * (lap['LapTime'].total_seconds() / t[-1])
    at = lambda col: np.interp(grid, d, tel[col].astype(float).to_numpy())
    return {
        'speed': np.round(at('Speed')).astype(int).tolist(),
        'throttle': np.round(np.clip(at('Throttle'), 0, 100)).astype(int).tolist(),
        'brake': (at('Brake') > 0.5).astype(int).tolist(),
        'gear': np.round(at('nGear')).astype(int).tolist(),
        't': np.interp(grid, d, t),
    }


def qualifying(session, traces=True):
    """Qualifying or sprint qualifying."""
    laps = session.laps
    res = session.results
    parts = laps.split_qualifying_sessions()
    part_of = {}
    for i, p in enumerate(parts):
        if p is not None:
            for idx in p.index:
                part_of[idx] = i + 1
    best = []
    for code, d in laps.groupby('Driver'):
        f = d.pick_fastest()
        if f is None or pd.isna(f['LapTime']):
            continue
        # His best sectors from laps that stood (a lap deleted for track limits doesn't count).
        ok = d[d['Deleted'] != True]  # noqa: E712 (the column holds True, False or NaN)
        sectors = [secs(ok[f'Sector{k}Time'].min()) for k in (1, 2, 3)]
        best.append({
            'code': code,
            'time': secs(f['LapTime']),
            'part': part_of.get(f.name),
            'lap': [secs(f['Sector1Time']), secs(f['Sector2Time']), secs(f['Sector3Time'])],
            'ideal': r3(sum(sectors)) if all(x is not None for x in sectors) else None,
            'sectors': sectors,
            'speed': r3(d['SpeedST'].max()),
            'compound': f['Compound'] if isinstance(f['Compound'], str) else None,
        })
    order = {r['Abbreviation']: (int(r['Position']) if pd.notna(r['Position']) else 99) for _, r in res.iterrows()}
    best.sort(key=lambda x: (order.get(x['code'], 99), x['time']))

    trace = None
    if traces and len(best) >= 2:
        try:
            a = laps.pick_drivers(best[0]['code']).pick_fastest()
            b = laps.pick_drivers(best[1]['code']).pick_fastest()
            length = float(a.get_car_data().add_distance()['Distance'].max())
            grid = np.linspace(0, 1, 360)
            ta = resample_lap(a, grid)
            tb = resample_lap(b, grid)
            trace = {
                'codes': [best[0]['code'], best[1]['code']],
                'distance': np.round(grid * length).astype(int).tolist(),
                'laps': [{k: v for k, v in x.items() if k != 't'} for x in (ta, tb)],
                # Positive: the second driver is behind at that point of the lap.
                'delta': np.round(tb['t'] - ta['t'], 3).tolist(),
            }
        except Exception as e:  # telemetry can be missing for a lap; the rest still stands
            print(f'  no telemetry trace: {e}', file=sys.stderr)

    return {
        'best': best,
        'parts': [[r['Abbreviation'], *[secs(r[k]) for k in ('Q1', 'Q2', 'Q3')]] for _, r in res.iterrows()],
        'trace': trace,
    }


def long_runs(laps):
    """Each driver's long runs: stints of at least LONG_RUN clean laps, cool-down laps left out."""
    runs = []
    for code, d in laps.groupby('Driver'):
        for _, s in d.groupby('Stint'):
            s = s[s['LapTime'].notna() & s['IsAccurate'] & s['PitInTime'].isna() & s['PitOutTime'].isna()]
            s = s[s['TrackStatus'].astype(str) == '1']
            if len(s) < LONG_RUN:
                continue
            t = s['LapTime'].dt.total_seconds()
            keep = t[t <= t.median() * RUN_SPREAD]
            if len(keep) < LONG_RUN:
                continue
            first = s.iloc[0]
            runs.append({
                'code': code,
                'compound': first['Compound'] if isinstance(first['Compound'], str) else None,
                'laps': int(len(keep)),
                'median': r3(keep.median()),
                'from': int(s['LapNumber'].min()),
                'to': int(s['LapNumber'].max()),
                'age': None if pd.isna(first['TyreLife']) else int(first['TyreLife'] - 1),
            })
    return runs


def practice(session):
    laps = session.laps
    best = []
    for code, d in laps.groupby('Driver'):
        f = d.pick_fastest()
        best.append({
            'code': code,
            'time': None if f is None else secs(f['LapTime']),
            'compound': None if f is None or not isinstance(f['Compound'], str) else f['Compound'],
            'laps': int(len(d)),
        })
    best.sort(key=lambda x: (x['time'] is None, x['time'] or 0))
    runs = long_runs(laps)
    # Each driver's longest run (the fastest of equals) is his race-pace read.
    pick = {}
    for r in runs:
        p = pick.get(r['code'])
        if p is None or (r['laps'], -r['median']) > (p['laps'], -p['median']):
            pick[r['code']] = r
    return {'best': best, 'runs': runs, 'longRun': sorted(pick.values(), key=lambda r: r['median'])}


def read(season, rnd, name, key, traces=True):
    s = fastf1.get_session(season, rnd, name)
    traces = traces and key in ('q', 'sq')
    s.load(laps=True, telemetry=traces, weather=True, messages=False)
    out = {
        'season': season,
        'round': rnd,
        'event': s.event['EventName'],
        'session': name,
        'key': key,
        'date': iso(s.date),
        'built': iso(pd.Timestamp.now(tz='UTC')),
        'drivers': roster(s),
        'weather': weather(s),
    }
    if key in ('race', 'sprint'):
        out.update(race_like(s))
    elif key in ('q', 'sq'):
        out.update(qualifying(s, traces))
    else:
        out.update(practice(s))
    return out


def write(path, obj):
    tmp = f'{path}.tmp'
    with open(tmp, 'w') as f:
        json.dump(obj, f, separators=(',', ':'), allow_nan=False)
    os.replace(tmp, path)


def sessions(season):
    """Every session of the season: (round, event name, session name, key, start in UTC)."""
    sched = fastf1.get_event_schedule(season, include_testing=False)
    for _, ev in sched.iterrows():
        for i in range(1, 6):
            name = ev.get(f'Session{i}')
            key = KEYS.get(name)
            start = ev.get(f'Session{i}DateUtc')
            if key and pd.notna(start):
                yield int(ev['RoundNumber']), ev['EventName'], name, key, pd.Timestamp(start).tz_localize('UTC')


def index(out_dir, season):
    """index.json: each round's sessions on file, every team's colour, every driver's code."""
    rounds, teams, drivers = {}, {}, {}
    keys = set(KEYS.values())
    files = [f for f in os.listdir(out_dir) if f.endswith('.json') and f.split('-')[0].isdigit() and f[:-5].split('-', 1)[1] in keys]
    for f in sorted(files, key=lambda f: (int(f.split('-')[0]), f)):
        with open(os.path.join(out_dir, f)) as fh:
            s = json.load(fh)
        r = rounds.setdefault(str(s['round']), {'event': s['event'], 'sessions': {}})
        r['sessions'][s['key']] = {'name': s['session'], 'date': s['date'], 'built': s['built']}
        for d in s['drivers']:
            if d['team'] and d['color']:
                teams[d['team']] = {'name': d['teamName'], 'color': d['color']}
            drivers[d['code']] = {k: d.get(k) for k in ('id', 'number', 'name', 'team')}
    for f in os.listdir(out_dir):
        if f.endswith('-predict.json') and f.split('-')[0] in rounds:
            rounds[f.split('-')[0]]['predict'] = True
    write(os.path.join(out_dir, 'index.json'), {'season': season, 'built': iso(pd.Timestamp.now(tz='UTC')), 'rounds': rounds, 'teams': teams, 'drivers': drivers})


def predict(out_dir, season, race_starts, now):
    """
    After qualifying and before the race starts: each driver's chance to win, reach the podium and
    score, from scripts/f1_model.py with the weights in f1-model.json. Never written once the
    race is under way, so what the page shows afterwards is what it said beforehand.
    """
    from f1_model import features, simulate
    model_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'f1-model.json')
    if not os.path.exists(model_path):
        return
    with open(model_path) as fh:
        model = json.load(fh)
    dirs = {season: out_dir}
    prev = os.path.join(os.path.dirname(out_dir), str(season - 1))
    if os.path.isdir(prev):
        dirs[season - 1] = prev
    for f in os.listdir(out_dir):
        if not f.endswith('-q.json'):
            continue
        rnd = int(f.split('-')[0])
        start = race_starts.get(rnd)
        if start is None or now >= start:
            continue
        path = os.path.join(out_dir, f'{rnd}-predict.json')
        with open(os.path.join(out_dir, f)) as fh:
            q = json.load(fh)
        if os.path.exists(path):
            with open(path) as fh:
                if json.load(fh).get('from') == q['built']:
                    continue
        feats = features(dirs, season, rnd)
        if not feats:
            continue
        res = simulate(model, feats)
        who = {d['code']: d for d in q['drivers']}
        write(path, {
            'season': season,
            'round': rnd,
            'event': q['event'],
            'built': iso(now),
            'from': q['built'],
            'drivers': [
                {**{k: (round(v, 3) if isinstance(v, float) else v) for k, v in r.items()}, **{k: who.get(r['code'], {}).get(k) for k in ('first', 'last', 'team')}}
                for r in res
            ],
            'model': {k: model[k] for k in ('inputs', 'weights', 'dnf', 'trainedOn', 'test')},
        })
        print(f'Predicted round {rnd}', flush=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--out', required=True, help='folder for the JSON (a season folder is made inside)')
    ap.add_argument('--season', type=int, default=datetime.now(timezone.utc).year)
    ap.add_argument('--round', type=int, help='only this round')
    ap.add_argument('--force', action='store_true', help='read sessions again even when on file')
    ap.add_argument('--no-traces', action='store_true', help='skip qualifying telemetry (much less to download)')
    ap.add_argument('--keys', help='only these sessions, e.g. q,race,fp2 (for fitting the race prediction)')
    ap.add_argument('--stale-before', help='read again any file built before this time (ISO), e.g. after changing what is written')
    ap.add_argument('--cache', default=os.environ.get('FASTF1_CACHE', '.fastf1-cache'))
    args = ap.parse_args()

    os.makedirs(args.cache, exist_ok=True)
    fastf1.Cache.enable_cache(args.cache)
    fastf1.set_log_level('ERROR')
    out_dir = os.path.join(args.out, str(args.season))
    os.makedirs(out_dir, exist_ok=True)
    # Sessions that failed to load, with how often: after three tries (six hours of runs) one is
    # left alone, so a session called off for weather isn't asked for forever. --force or
    # --round tries again.
    fail_path = os.path.join(out_dir, 'failures.json')
    failures = json.load(open(fail_path)) if os.path.exists(fail_path) else {}
    now = pd.Timestamp.now(tz='UTC')
    done = 0
    only = set(args.keys.split(',')) if args.keys else None
    race_starts = {}
    for rnd, event, name, key, start in sessions(args.season):
        if key == 'race':
            race_starts[rnd] = start
        if (args.round and rnd != args.round) or (only and key not in only):
            continue
        ready = start + timedelta(minutes=READY[key])
        if now < ready:
            continue
        stem = f'{rnd}-{key}'
        path = os.path.join(out_dir, f'{stem}.json')
        if os.path.exists(path) and not args.force:
            with open(path) as fh:
                built = pd.Timestamp(json.load(fh)['built'])
            stale = args.stale_before and built < pd.Timestamp(args.stale_before)
            # Read once more the day after, when F1's late corrections are in; then leave it.
            if not stale and (built - ready >= SETTLE or now - ready < SETTLE):
                continue
        if failures.get(stem, {}).get('tries', 0) >= 3 and not (args.force or args.round):
            continue
        try:
            print(f'{args.season} round {rnd} {event}: {name}', flush=True)
            write(path, read(args.season, rnd, name, key, traces=not args.no_traces))
            failures.pop(stem, None)
            done += 1
        except RateLimitExceededError:
            # FastF1 allows 500 requests an hour; a long catch-up stops here and the next run goes on.
            print('  FastF1’s hourly request limit reached: the rest waits for the next run', flush=True)
            break
        except Exception as e:
            # One session that won't load (not in the archive yet, or broken) mustn't stop the rest.
            print(f'  skipped: {e}', file=sys.stderr, flush=True)
            failures[stem] = {'tries': failures.get(stem, {}).get('tries', 0) + 1, 'last': iso(now), 'error': str(e)[:300]}
    write(fail_path, failures)
    predict(out_dir, args.season, race_starts, now)
    index(out_dir, args.season)
    print(f'{done} session(s) written', flush=True)


if __name__ == '__main__':
    main()
