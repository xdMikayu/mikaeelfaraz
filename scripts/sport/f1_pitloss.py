#!/usr/bin/env python3
"""
What a pit stop costs at each track under green flags, for the live view's "if they pit now"
estimate. Reads the race and sprint files f1_sessions.py writes. A stop costs its in-lap and out-lap
against the same driver's green-flag pace either side of it (up to three laps before and three
after). Writes src/lib/sport/f1-pitloss.json: each event's median cost and how many stops it's from.

Stops under a safety car or virtual safety car cost less, by an amount that varies with when the
safety car came out; there are too few of them to say how much, so the live view doesn't guess.

    python scripts/sport/f1_pitloss.py --data DIR [DIR …]

Each DIR holds a folder per season.
"""
import argparse
import glob
import json
import os
from statistics import median

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'lib', 'sport', 'f1-pitloss.json')


def stops(race):
    """(event, seconds lost) for each green-flag stop with the laps around it timed."""
    laps = race['laps']
    flags = race.get('flags') or [None] * laps
    green = lambda lap: 1 <= lap <= len(flags) and flags[lap - 1] in (None, 'Y')
    for code, ss in race['pits'].items():
        t = race['byLap'].get(code, {}).get('time', [])
        pitted = {s['lap'] + k for s in ss for k in (0, 1)}
        time = lambda lap: t[lap - 1] if 1 <= lap <= len(t) else None
        for s in ss:
            lap = s['lap']
            if lap < 2 or not (green(lap) and green(lap + 1)) or not time(lap) or not time(lap + 1):
                continue
            around = [time(x) for x in (*range(lap - 3, lap), *range(lap + 2, lap + 5)) if x > 1 and x not in pitted and green(x) and time(x)]
            if len(around) < 3:
                continue
            lost = time(lap) + time(lap + 1) - 2 * median(around)
            # Repairs, penalties served in the box and timing glitches.
            if 8 <= lost <= 45:
                yield race['event'], lost


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--data', required=True, nargs='+')
    ap.add_argument('--out', default=OUT)
    args = ap.parse_args()

    found = {}
    files = [f for base in args.data for f in glob.glob(os.path.join(base, '*', '*-race.json')) + glob.glob(os.path.join(base, '*', '*-sprint.json'))]
    seasons = sorted({os.path.basename(os.path.dirname(f)) for f in files})
    for f in sorted(files):
        with open(f) as fh:
            race = json.load(fh)
        for event, lost in stops(race):
            found.setdefault(event, []).append(lost)

    out = {event: {'loss': round(median(v), 1), 'stops': len(v)} for event, v in sorted(found.items()) if len(v) >= 5}
    out['_note'] = f'From {len(files)} races and sprints, {seasons[0]}–{seasons[-1]}, by scripts/sport/f1_pitloss.py.'
    with open(args.out, 'w') as fh:
        json.dump(out, fh, indent=1, ensure_ascii=False)
    for event, row in out.items():
        print(event, row)


if __name__ == '__main__':
    main()
