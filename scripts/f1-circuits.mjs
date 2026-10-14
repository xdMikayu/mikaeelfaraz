#!/usr/bin/env node
// Builds src/lib/sport/f1-circuits.json, each circuit's outline as an SVG path for the F1 pages,
// from Tomislav Bacinger's f1-circuits (https://github.com/bacinger/f1-circuits, MIT licence,
// copyright (c) 2019-2025 Tomislav Bacinger; not official F1 data).
//
//   curl -sLo /tmp/f1-circuits.geojson https://raw.githubusercontent.com/bacinger/f1-circuits/master/f1-circuits.geojson
//   node scripts/sport/f1-circuits.mjs /tmp/f1-circuits.geojson
//
// Keyed by Jolpica's circuit id (what the calendar gives). Each outline is projected flat (fine at a
// circuit's size), north up, fitted to 100 across its longer side, and simplified to a point every
// metre or so of drawing.

import fs from 'node:fs';

// Jolpica's circuit ids to the dataset's.
const IDS = {
  albert_park: 'au-1953',
  bahrain: 'bh-2002',
  shanghai: 'cn-2004',
  catalunya: 'es-1991',
  monaco: 'mc-1929',
  villeneuve: 'ca-1978',
  ricard: 'fr-1969',
  red_bull_ring: 'at-1969',
  silverstone: 'gb-1948',
  hockenheimring: 'de-1932',
  hungaroring: 'hu-1986',
  spa: 'be-1925',
  monza: 'it-1922',
  marina_bay: 'sg-2008',
  sochi: 'ru-2014',
  suzuka: 'jp-1962',
  americas: 'us-2012',
  rodriguez: 'mx-1962',
  interlagos: 'br-1940',
  yas_marina: 'ae-2009',
  imola: 'it-1953',
  nurburgring: 'de-1927',
  portimao: 'pt-2008',
  mugello: 'it-1914',
  sepang: 'my-1999',
  istanbul: 'tr-2005',
  zandvoort: 'nl-1948',
  jeddah: 'sa-2021',
  miami: 'us-2022',
  losail: 'qa-2004',
  madring: 'es-2026',
  baku: 'az-2016',
  vegas: 'us-2023',
};

/** Douglas-Peucker: drop points within `tol` of the line between their neighbours. */
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Array(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [x1, y1] = pts[a];
    const [x2, y2] = pts[b];
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    let far = -1;
    let at = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((y2 - y1) * pts[i][0] - (x2 - x1) * pts[i][1] + x2 * y1 - y2 * x1) / len;
      if (d > far) [far, at] = [d, i];
    }
    if (far > tol) {
      keep[at] = true;
      stack.push([a, at], [at, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

const file = process.argv[2];
if (!file) {
  console.error('Give the path of f1-circuits.geojson');
  process.exit(1);
}
const geo = JSON.parse(fs.readFileSync(file, 'utf8'));
const byId = Object.fromEntries(geo.features.map((f) => [f.properties.id, f]));
const out = {};
for (const [jolpica, id] of Object.entries(IDS)) {
  const f = byId[id];
  if (!f) {
    console.warn(`missing ${id}`);
    continue;
  }
  const ll = f.geometry.type === 'LineString' ? f.geometry.coordinates : f.geometry.coordinates.flat();
  const lat0 = (ll.reduce((t, c) => t + c[1], 0) / ll.length) * (Math.PI / 180);
  // Flat projection, north up: x east, y south (SVG's y runs down).
  const xy = ll.map(([lon, lat]) => [lon * Math.cos(lat0), -lat]);
  const xs = xy.map((p) => p[0]);
  const ys = xy.map((p) => p[1]);
  const [x0, y0] = [Math.min(...xs), Math.min(...ys)];
  const span = Math.max(Math.max(...xs) - x0, Math.max(...ys) - y0);
  const fit = xy.map(([x, y]) => [((x - x0) / span) * 100, ((y - y0) / span) * 100]);
  // A closed loop ends where it starts; simplify it open (the path's Z closes it again).
  const [a, z] = [fit[0], fit[fit.length - 1]];
  const open = Math.hypot(a[0] - z[0], a[1] - z[1]) < 0.01 ? fit.slice(0, -1) : fit;
  const pts = simplify(open, 0.35);
  const w = Math.max(...pts.map((p) => p[0]));
  const h = Math.max(...pts.map((p) => p[1]));
  const r = (v) => Math.round(v * 10) / 10;
  out[jolpica] = {
    name: f.properties.Name,
    length: f.properties.length ?? null,
    firstGp: f.properties.firstgp ?? null,
    w: r(w),
    h: r(h),
    path: `M${pts.map(([x, y]) => `${r(x)} ${r(y)}`).join('L')}Z`,
  };
}
const dest = new URL('../../src/lib/sport/f1-circuits.json', import.meta.url);
fs.writeFileSync(dest, `${JSON.stringify(out, null, 0)}\n`);
console.log(`${Object.keys(out).length} circuits, ${fs.statSync(dest).size} bytes`);
