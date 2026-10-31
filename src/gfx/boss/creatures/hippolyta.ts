import { Builder, Flow, P, deg, type AnimCtx, type CreatureDef, type Pose } from '../rig';
import type { CreatureModule } from './index';

/**
 * IX. Hippolyta, Queen of the Amazons — in the red-figure convention: frontal torso, head in profile facing left,
 * legs in a lunge. Spear raised overhead (passing behind the crested helmet), crescent pelta on the forward arm,
 * a short fluttering chiton, and the Girdle of Ares at her waist: three blazing gold stars like Orion's belt.
 * Stars follow a mirrored Orion (Bellatrix — "the female warrior" — at the shield shoulder, Betelgeuse at the spear arm).
 */

type V2 = [number, number];

/** pelta: crescent shield (outer circle minus a higher inner circle), horns up */
function peltaOutline(cx: number, cy: number, R: number, lift: number, r: number, n = 14): number[] {
  // horn points: intersection of |p|=R and |p-(0,lift)|=r
  const hy = (R * R - r * r + lift * lift) / (2 * lift);
  const hx = Math.sqrt(Math.max(0, R * R - hy * hy));
  const aOut0 = Math.atan2(hy, -hx);
  const aOut1 = Math.atan2(hy, hx) + Math.PI * 2;
  const out: number[] = [];
  for (let i = 0; i <= n; i++) {
    const a = aOut0 + ((aOut1 - aOut0) * i) / n;
    out.push(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
  }
  const aIn0 = Math.atan2(hy - lift, hx);
  const aIn1 = Math.atan2(hy - lift, -hx) - Math.PI * 2;
  for (let i = 1; i < n; i++) {
    const a = aIn0 + ((aIn1 - aIn0) * i) / n;
    out.push(cx + Math.cos(a) * r, cy + lift + Math.sin(a) * r);
  }
  return out;
}

export function buildHippolyta(): CreatureDef {
  const B = new Builder();
  const R = B.ROOT;

  // ---------------- skeleton ----------------
  const pelvis = B.bone('pelvis', R, -0.05, -0.15);
  const torso = B.bone('torso', pelvis, -0.08, 0.25);
  const head = B.bone('head', torso, -0.15, 1.62);
  const crest = B.chain('crest', head, [0.1, 2.9, 0.62, 2.72, 0.95, 2.35, 1.15, 1.95]);
  const hair = B.chain('hair', head, [0.05, 2.05, 0.55, 1.8, 1.0, 1.45, 1.35, 0.95]);
  const armF = B.bone('armF', torso, -0.62, 1.38);
  const foreF = B.bone('foreF', armF, -1.2, 0.92);
  const armB = B.bone('armB', torso, 0.45, 1.45);
  const foreB = B.bone('foreB', armB, 1.18, 2.1);
  const hand = B.bone('hand', foreB, 0.72, 3.15);
  const legF = B.bone('legF', pelvis, -0.3, -0.3);
  const shinF = B.bone('shinF', legF, -1.22, -1.22);
  const footF = B.bone('footF', shinF, -1.18, -2.95);
  const legB = B.bone('legB', pelvis, 0.15, -0.35);
  const shinB = B.bone('shinB', legB, 0.75, -1.6);
  const skirt = B.bone('skirt', pelvis, 0.05, -0.3);

  // spear geometry: through the hand, aimed down-left at the hero
  const HAND: V2 = [0.72, 3.18];
  const TIP: V2 = [-4.35, 2.62];
  const dl = Math.hypot(TIP[0] - HAND[0], TIP[1] - HAND[1]);
  const d: V2 = [(TIP[0] - HAND[0]) / dl, (TIP[1] - HAND[1]) / dl];
  const nrm: V2 = [-d[1], d[0]];
  const along = (k: number, side = 0): V2 => [HAND[0] + d[0] * k + nrm[0] * side, HAND[1] + d[1] * k + nrm[1] * side];
  const butt = along(-1.1);
  const bladeBase = along(dl - 0.62);
  const tip = along(dl + 0.02);

  // ---------------- parts (back to front) ----------------
  // flowing hair under the helmet
  B.part(
    'hair',
    { z: -0.3, k: 0.12, thick: 0.15, flow: Flow.Wisp, bright: 0.85, inner: 0.5, blend: 0.25 },
    B.poly(hair[0], [0.0, 2.22, 0.45, 2.02, 0.9, 1.78, 1.25, 1.45, 1.45, 1.05, 1.48, 0.7, 1.25, 0.95, 0.95, 1.25, 0.55, 1.48, 0.12, 1.75], 0.03, 3),
    B.cap(hair[2], 1.05, 1.4, 1.58, 0.6, 0.09, 0.02),
    B.cap(hair[1], 0.7, 1.68, 1.25, 1.28, 0.07, 0.02),
  );
  // horsehair crest plume streaming back
  B.part(
    'crest',
    { z: -0.2, k: 0.08, thick: 0.15, flow: Flow.Wisp, rim: 1.3, inner: 0.6, tint: 0.1, blend: 0.25 },
    B.poly(
      crest[0],
      [-0.48, 2.56, -0.36, 2.84, -0.1, 3.0, 0.25, 3.02, 0.58, 2.9, 0.86, 2.62, 1.04, 2.28, 1.18, 1.92, 1.2, 1.62, 1.0, 1.9, 0.78, 2.22, 0.5, 2.44, 0.15, 2.56, -0.2, 2.52],
      0.02,
      3,
    ),
    B.cap(crest[2], 1.08, 2.0, 1.32, 1.55, 0.06, 0.015),
    B.cap(crest[1], 0.9, 2.42, 1.22, 2.12, 0.05, 0.015),
  );
  // spear (held by the far, raised arm: passes behind the helmet)
  B.part(
    'spear',
    { z: -0.15, k: 0.03, thick: 0.04, rim: 1.35, inner: 0.85, tint: 0.25, fill: 0.6, blend: 0.08 },
    B.cap(hand, ...along(-0.35), ...along(0.35), 0.05, 0.05),
    B.poly(hand, [...bladeBase, ...along(dl - 0.42, 0.13), ...along(dl - 0.18, 0.1), ...tip, ...along(dl - 0.18, -0.1), ...along(dl - 0.42, -0.13)], 0.012, 0),
    B.cap(hand, ...along(dl - 0.68), ...along(dl - 0.56), 0.075, 0.075),
    B.poly(hand, [...along(-1.08, 0.055), ...along(-1.3), ...along(-1.08, -0.055)], 0.01, 0),
  );
  // raised spear arm (far side)
  B.part(
    'armBack',
    { z: -0.1, k: 0.08, thick: 0.15, bright: 0.85, inner: 0.6, blend: 0.12 },
    B.cap(armB, 0.42, 1.45, 1.18, 2.1, 0.17, 0.12),
    B.ell(armB, 0.78, 1.75, 0.16, 0.24, -48),
    B.cap(foreB, 1.18, 2.1, 0.76, 3.08, 0.12, 0.09),
    B.ell(hand, 0.73, 3.16, 0.12, 0.13, 20),
  );
  // back leg (extended behind, on the ball of the foot)
  B.part(
    'legBack',
    { z: -0.2, k: 0.1, thick: 0.2, bright: 0.8, inner: 0.5, rim: 0.95, blend: 0.14 },
    B.cap(legB, 0.18, -0.35, 0.75, -1.6, 0.29, 0.17),
    B.cap(shinB, 0.75, -1.6, 1.3, -2.9, 0.155, 0.085),
    B.ell(shinB, 1.02, -2.05, 0.13, 0.25, 30),
    B.cap(shinB, 1.3, -2.9, 1.1, -3.2, 0.085, 0.07),
    B.cap(shinB, 1.1, -3.2, 0.9, -3.27, 0.065, 0.05),
  );
  // front leg (bent knee, planted)
  B.part(
    'legFront',
    { z: 0.05, k: 0.1, thick: 0.25, inner: 0.6, blend: 0.14, fill: 1.2 },
    B.cap(legF, -0.25, -0.28, -1.22, -1.22, 0.31, 0.18),
    B.cap(shinF, -1.22, -1.22, -1.18, -2.95, 0.165, 0.085),
    B.ell(shinF, -1.1, -1.8, 0.15, 0.34, 0),
    B.cap(footF, -1.15, -3.0, -1.62, -3.25, 0.09, 0.055),
    B.ell(footF, -1.12, -3.17, 0.12, 0.09),
  );
  // torso (frontal, the chiton bodice)
  B.part(
    'torso',
    { z: 0.0, k: 0.12, thick: 0.35, blend: 0.2, rim: 1.25, fill: 1.35 },
    B.poly(torso, [-0.68, 1.5, -0.28, 1.62, 0.08, 1.65, 0.5, 1.57, 0.64, 1.3, 0.5, 0.92, 0.31, 0.48, 0.28, 0.16, -0.42, 0.22, -0.46, 0.52, -0.62, 0.95, -0.78, 1.28], 0.03, 3),
    B.cap(head, -0.2, 1.88, -0.12, 1.55, 0.12, 0.15),
  );
  // short chiton skirt, hem fluttering back
  B.part(
    'skirt',
    { z: 0.08, k: 0.08, thick: 0.25, flow: Flow.Wisp, inner: 0.75, blend: 0.3, rim: 1.2, fill: 1.25 },
    B.poly(
      skirt,
      [-0.46, 0.25, 0.32, 0.14, 0.52, -0.3, 0.9, -0.78, 0.66, -0.86, 0.5, -0.98, 0.2, -0.86, -0.08, -0.98, -0.38, -0.88, -0.66, -0.94, -0.86, -0.82, -0.68, -0.38],
      0.025,
      2,
    ),
  );
  // the Girdle of Ares
  B.part(
    'girdle',
    { z: 0.25, k: 0.03, thick: 0.08, rim: 1.05, inner: 1.0, tint: 0.3, fill: 0.9, blend: 0.1 },
    B.poly(pelvis, [-0.52, 0.4, -0.08, 0.34, 0.38, 0.27, 0.38, 0.08, -0.08, 0.15, -0.51, 0.2], 0.02, 2),
  );
  // head: helmet with crest holder, profile face, cheek guard
  B.part(
    'head',
    { z: 0.2, k: 0.07, thick: 0.25, rim: 1.45, inner: 1.1, tint: 0.15, fill: 1.3, blend: 0.12 },
    B.ell(head, -0.18, 2.17, 0.29, 0.33, 10),
    B.poly(head, [-0.4, 2.36, -0.5, 2.27, -0.53, 2.2, -0.61, 2.1, -0.53, 2.06, -0.55, 2.0, -0.5, 1.96, -0.5, 1.88, -0.36, 1.81, -0.15, 1.9, -0.05, 2.1, -0.15, 2.36], 0.012, 2),
    B.ell(head, -0.15, 2.36, 0.36, 0.27, 8),
    B.cap(head, -0.52, 2.33, -0.12, 2.42, 0.06, 0.05),
    B.poly(head, [0.05, 2.3, 0.3, 2.14, 0.26, 2.0, 0.06, 2.06], 0.02, 0),
    B.tube(head, [-0.38, 2.56, -0.18, 2.74, 0.12, 2.8, 0.4, 2.72], [0.07, 0.08, 0.075, 0.06]),
  );
  // forward arm behind the shield
  B.part(
    'armFront',
    { z: 0.3, k: 0.08, thick: 0.15, inner: 0.6, blend: 0.12 },
    B.cap(armF, -0.62, 1.38, -1.2, 0.92, 0.16, 0.115),
    B.cap(foreF, -1.2, 0.92, -1.62, 1.25, 0.11, 0.085),
  );
  // pelta: crescent shield, horns up
  const SH: V2 = [-1.78, 1.0];
  B.part(
    'shield',
    { z: 0.45, k: 0.02, thick: 0.12, rim: 1.25, inner: 0.9, tint: 0.15, fill: 0.9, blend: 0.1 },
    B.poly(foreF, peltaOutline(SH[0], SH[1], 0.86, 0.46, 0.62, 16), 0.015, 0),
  );

  // ---------------- detail filaments ----------------
  const st = (pts: number[], part: string, w: number, bright: number, extra: { tint?: number; flow?: Flow; taper?: number; smooth?: number } = {}) =>
    B.stroke(pts, { part, w, bright, ...extra });
  // shield: rim band, central boss and the twin volutes
  {
    const ring = peltaOutline(SH[0], SH[1], 0.74, 0.44, 0.72, 12);
    st(ring.slice(0, 26), 'shield', 0.018, 0.75, { smooth: 0 });
    st([SH[0] - 0.42, SH[1] + 0.18, SH[0] - 0.3, SH[1] + 0.02, SH[0] - 0.12, SH[1] - 0.02, SH[0] - 0.1, SH[1] + 0.12], 'shield', 0.02, 0.8, { tint: 0.5 });
    st([SH[0] + 0.42, SH[1] + 0.18, SH[0] + 0.3, SH[1] + 0.02, SH[0] + 0.12, SH[1] - 0.02, SH[0] + 0.1, SH[1] + 0.12], 'shield', 0.02, 0.8, { tint: 0.5 });
  }
  // face profile (forehead, nose, lips, chin) + helmet brim
  st([-0.42, 2.4, -0.5, 2.27, -0.6, 2.11, -0.54, 2.06, -0.55, 2.0, -0.5, 1.95, -0.5, 1.88, -0.38, 1.82], 'head', 0.016, 1.1, { tint: 0.5, smooth: 3 });
  // face: eye under the helmet brim, lips
  st([-0.46, 2.22, -0.4, 2.23, -0.34, 2.21], 'head', 0.018, 1.6, { tint: 0.9, smooth: 0 });
  st([-0.4, 2.42, -0.15, 2.47, 0.15, 2.42], 'head', 0.016, 0.6);
  // chiton folds and neckline
  st([-0.4, 1.55, -0.12, 1.4, 0.2, 1.52], 'torso', 0.018, 0.55);
  st([-0.3, 1.15, -0.15, 0.75, -0.2, 0.4], 'torso', 0.016, 0.35);
  st([0.15, 1.2, 0.2, 0.8, 0.12, 0.42], 'torso', 0.016, 0.3);
  st([-0.4, 0.05, -0.55, -0.45, -0.66, -0.88], 'skirt', 0.016, 0.45, { flow: Flow.Wisp });
  st([-0.05, 0.05, -0.05, -0.45, -0.08, -0.92], 'skirt', 0.016, 0.4, { flow: Flow.Wisp });
  st([0.25, 0.0, 0.45, -0.4, 0.62, -0.8], 'skirt', 0.016, 0.45, { flow: Flow.Wisp });
  // girdle clasps
  st([-0.48, 0.28, -0.08, 0.245, 0.35, 0.18], 'girdle', 0.022, 1.1, { tint: 0.8 });
  // crest & hair strands
  st([-0.3, 2.8, 0.1, 2.92, 0.5, 2.82, 0.8, 2.55, 1.0, 2.2, 1.12, 1.8], 'crest', 0.02, 0.85, { flow: Flow.Wisp, taper: 0.6 });
  st([-0.1, 2.68, 0.3, 2.74, 0.62, 2.6, 0.85, 2.3, 1.0, 1.95], 'crest', 0.018, 0.6, { flow: Flow.Wisp, taper: 0.6 });
  st([0.2, 2.0, 0.6, 1.8, 1.0, 1.55, 1.3, 1.15], 'hair', 0.018, 0.7, { flow: Flow.Wisp, taper: 0.6 });
  // legs: knee + sandal straps
  st([-1.25, -2.7, -1.15, -2.75, -1.05, -2.72], 'legFront', 0.016, 0.7, { smooth: 0 });
  st([-1.25, -2.95, -1.15, -2.98, -1.05, -2.95], 'legFront', 0.016, 0.7, { smooth: 0 });
  st([-0.85, -0.95, -1.1, -1.15, -1.2, -1.4], 'legFront', 0.016, 0.45);
  // spear shaft: a dense filament (a long SDF outline would starve the figure of rim particles)
  B.stroke([...butt, ...along(dl - 0.62)], { part: 'spear', w: 0.035, bright: 1.25, tint: 0.55, smooth: 0, density: 1.6, z: 0.02 });

  // ---------------- key stars: a mirrored Orion ----------------
  B.star('alnitak', 0.27, 0.18, 2.25, { part: 'girdle', gold: true, z: 0.4 });
  B.star('alnilam', -0.08, 0.245, 2.5, { part: 'girdle', gold: true, z: 0.4 });
  B.star('mintaka', -0.42, 0.3, 2.2, { part: 'girdle', gold: true, z: 0.4 });
  B.star('betelgeuse', 0.45, 1.45, 1.55, { part: 'torso' });
  B.star('bellatrix', -0.62, 1.4, 1.35, { part: 'torso' });
  B.star('meissa', -0.22, 2.25, 0.95, { part: 'head' });
  B.star('elbow', 1.18, 2.1, 0.75, { part: 'armBack' });
  B.star('grip', 0.73, 3.16, 0.95, { part: 'armBack' });
  B.star('spearTip', tip[0], tip[1], 1.35, { part: 'spear' });
  B.star('crestTop', 0.1, 2.95, 0.8, { part: 'crest' });
  B.star('plume', 1.42, 0.85, 0.75, { part: 'hair' });
  B.star('rigel', -1.15, -3.05, 1.6, { part: 'legFront' });
  B.star('saiph', 1.25, -2.9, 1.15, { part: 'legBack' });
  B.star('kneeF', -1.22, -1.22, 0.75, { part: 'legFront' });
  B.star('kneeB', 0.75, -1.6, 0.7, { part: 'legBack' });
  B.star('pi1', SH[0] - 0.62, SH[1] + 0.6, 0.85, { part: 'shield' });
  B.star('pi3', SH[0] - 0.6, SH[1] - 0.5, 0.75, { part: 'shield' });
  B.star('pi4', SH[0], SH[1] - 0.84, 0.95, { part: 'shield' });
  B.star('pi5', SH[0] + 0.6, SH[1] - 0.5, 0.7, { part: 'shield' });
  B.star('pi6', SH[0] + 0.62, SH[1] + 0.6, 0.8, { part: 'shield' });
  B.link('mintaka', 'alnilam', 'alnitak');
  B.link('bellatrix', 'mintaka');
  B.link('betelgeuse', 'alnitak');
  B.link('bellatrix', 'meissa', 'betelgeuse');
  B.link('mintaka', 'kneeF', 'rigel');
  B.link('alnitak', 'kneeB', 'saiph');
  B.link('betelgeuse', 'elbow', 'grip', 'spearTip');
  B.link('meissa', 'crestTop', 'plume');
  B.link('pi1', 'pi3', 'pi4', 'pi5', 'pi6');
  B.link('bellatrix', 'pi6');

  B.starOrder = [
    'alnilam', 'mintaka', 'alnitak', 'bellatrix', 'betelgeuse', 'meissa', 'kneeF', 'kneeB', 'rigel', 'saiph',
    'elbow', 'grip', 'spearTip', 'crestTop', 'plume', 'pi6', 'pi5', 'pi4', 'pi3', 'pi1',
  ].map((n) => B.stars.findIndex((x) => x.name === n));
  B.core = P(-0.07, 0.6, 0.2);
  B.head = P(-0.25, 2.2, 0.3);
  B.mouths.push(P(tip[0], tip[1], 0.2));

  // center the figure in the box
  B.scaleAll(1, 1.15, 0.0);

  return B.build('hippolyta', (p: Pose, c: AnimCtx) => {
    const t = c.t;
    const br = c.breath;
    const fwd = Math.max(0, c.lunge);
    const back = Math.max(0, -c.lunge);
    // stance: weight shifts, leans back on the wind-up, drives forward on the throw
    p.r(pelvis, 0.015 * Math.sin(t * 0.6) - 0.05 * back + 0.07 * fwd + 0.05 * c.hurt);
    p.o(pelvis, 0.12 * back - 0.1 * fwd, -0.04 * fwd - 0.03 * c.low + 0.015 * br, 0);
    p.r(torso, 0.01 * br - 0.1 * back + 0.12 * fwd - 0.04 * c.roar + 0.08 * c.hurt + 0.1 * c.low);
    p.s(torso, 1 + 0.008 * br, 1 + 0.015 * br);
    // legs counter the pelvis so the feet stay planted
    p.r(legF, -0.015 * Math.sin(t * 0.6) + 0.05 * back - 0.12 * fwd);
    p.r(shinF, 0.08 * fwd - 0.03 * back);
    p.r(legB, -0.015 * Math.sin(t * 0.6) + 0.05 * back - 0.05 * fwd);
    // head: scanning, war cry lifts it
    p.r(head, 0.04 * Math.sin(t * 0.7 + 1) - 0.18 * c.roar + 0.06 * back - 0.06 * fwd + 0.12 * c.hurt + 0.15 * c.low);
    // spear: idle aiming bob; drawn back on the wind-up, hurled down at the hero on the strike
    const bob = 0.05 * Math.sin(t * 1.1) + 0.02 * Math.sin(t * 2.3 + 1);
    const jab = c.volley;
    p.r(armB, bob - 0.3 * back + 0.5 * fwd - 0.2 * c.roar + 0.3 * jab + 0.25 * c.low);
    p.r(foreB, 0.6 * bob - 0.25 * back + 0.35 * fwd + 0.25 * jab + 0.1 * c.low);
    p.r(hand, -0.4 * bob + 0.1 * back - 0.12 * fwd - 0.12 * c.roar - 0.1 * jab + 0.1 * c.low);
    // shield: guard raises it, the throw swings it back for balance
    p.r(armF, 0.03 * Math.sin(t * 0.9) - 0.5 * c.guard + 0.25 * fwd - 0.15 * back - 0.2 * c.roar + 0.2 * c.low);
    p.r(foreF, -0.04 * Math.sin(t * 0.9 + 1) - 0.3 * c.guard + 0.1 * fwd);
    // crest & hair stream, faster when charging
    const sp = 1.4 + 2 * c.charge;
    p.wave(crest, 0.06 * (1 + c.charge), t, sp, 0.7, 0.4);
    p.wave(hair, 0.08 * (1 + c.charge), t + 0.5, sp * 1.1, 0.8, 0.4);
    p.r(crest[0], -0.08 * fwd + 0.08 * back);
    p.r(hair[0], -0.1 * fwd + 0.08 * back);
    p.r(skirt, 0.04 * Math.sin(t * 1.7) - 0.06 * fwd + 0.05 * back);
  });
}

export const CREATURE: CreatureModule = { id: 'hippolyta', build: buildHippolyta };
