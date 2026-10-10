// Expected goals from what ESPN's commentary feed gives for each shot: where it was taken
// (fieldPositionX/Y as % of a 105 x 68 m pitch, attacking towards x = 100) and the words
// Opta's commentary uses for body part and situation ("header", "with a cross", ...).
//
// Logistic model fitted on 25,513 open-play and set-piece shots from StatsBomb's open data
// (2015/16 Premier League, Serie A, Bundesliga and Ligue 1, World Cup 2022, Euro 2024), and
// checked on 6,454 shots from 258 held-out matches:
//   log loss 0.264 (StatsBomb's own xG 0.248, base rate 0.312), AUC 0.776 (StatsBomb 0.811),
//   610 xG for 607 goals, team-match totals correlate 0.90 with StatsBomb's.
// It knows nothing about defenders or the keeper's position, so treat it as an estimate.

const GOAL_W = 7.32;

const COEF = {
  intercept: -1.36803,
  dist: -0.11274,
  angle: 1.79237,
  header: -0.78176,
  headerDist: -0.03621,
  freeKick: 0.90186,
  corner: -0.73092,
  setPiece: -0.08712,
  fastBreak: 0.37978,
  cross: -0.25426,
  through: 1.11333,
};

export const PENALTY_XG = 0.75; // 413 penalties in the same data, 75.1% scored

/** Distance (m) to the centre of goal and the angle (radians) the goal mouth subtends. */
export function shotGeometry(xPct, yPct) {
  const dx = 105 - (xPct / 100) * 105;
  const dy = (yPct / 100) * 68 - 34;
  const dist = Math.hypot(dx, dy);
  let angle = Math.atan2(GOAL_W * dx, dx * dx + dy * dy - (GOAL_W / 2) ** 2);
  if (angle < 0) angle += Math.PI;
  return { dist, angle };
}

/** Reads the commentary sentence for the features the model uses. */
export function shotTraits(text = '') {
  const t = text.toLowerCase();
  return {
    penalty: /\bpenalty\b/.test(t) && !/won a penalty|penalty conceded|wins a penalty/.test(t),
    header: /\bheader\b/.test(t),
    freeKick: /direct free kick/.test(t),
    corner: /following a corner/.test(t),
    setPiece: /following a set piece/.test(t),
    fastBreak: /fast break/.test(t),
    cross: /with a cross/.test(t),
    through: /through ball/.test(t),
  };
}

export function xgFor({ x, y, text }) {
  const tr = shotTraits(text);
  if (tr.penalty) return PENALTY_XG;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const { dist, angle } = shotGeometry(x, y);
  const h = tr.header ? 1 : 0;
  const z =
    COEF.intercept +
    COEF.dist * dist +
    COEF.angle * angle +
    COEF.header * h +
    COEF.headerDist * h * dist +
    COEF.freeKick * (tr.freeKick ? 1 : 0) +
    COEF.corner * (tr.corner ? 1 : 0) +
    COEF.setPiece * (tr.setPiece ? 1 : 0) +
    COEF.fastBreak * (tr.fastBreak ? 1 : 0) +
    COEF.cross * (tr.cross ? 1 : 0) +
    COEF.through * (tr.through ? 1 : 0);
  return 1 / (1 + Math.exp(-z));
}
