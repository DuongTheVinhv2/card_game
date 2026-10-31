import { Builder, Flow, P, type CreatureDef } from '../rig';
import { shaggyOutline } from '../shapes';
import type { CreatureModule } from './index';

/**
 * XIII. Heracles — the Kneeler (Engonasin): hero kneeling on one knee facing left, club raised overhead,
 * the Nemean lion-skin worn as hood and cape. Title / victory art (HERO_PALETTE).
 */
export function buildHeracles(): CreatureDef {
  const B = new Builder();
  const R = B.ROOT;
  const pelvis = B.bone('pelvis', R, 0.2, -1.1);
  const chest = B.bone('chest', pelvis, 0.05, -0.3);
  const head = B.bone('head', chest, -0.15, 1.3);
  const abU = B.bone('armBack', chest, 0.85, 1.05);
  const abL = B.bone('armBack2', abU, 1.55, 2.0);
  const hand = B.bone('handBack', abL, 0.8, 2.72);
  const afU = B.bone('armFront', chest, -0.85, 1.0);
  const afL = B.bone('armFront2', afU, -1.75, 0.42);
  const lfU = B.bone('legFront', pelvis, -0.15, -1.1);
  const lfL = B.bone('legFront2', lfU, -1.3, -1.55);
  const lbU = B.bone('legBack', pelvis, 0.5, -1.2);
  const lbL = B.bone('legBack2', lbU, 0.95, -2.95);
  const capePts = [0.55, 1.45, 1.45, 0.85, 2.25, -0.1, 2.8, -1.0];
  const cape = B.chain('cape', chest, capePts);

  // lion-skin cape flowing behind
  {
    const pts = shaggyOutline(1.75, 0.1, 0.95, 1.55, -32, 40, -150, 9, 0.28, 0.25, -0.2, 913);
    B.part(
      'cape',
      { z: -0.5, k: 0.12, thick: 0.25, flow: Flow.Wisp, bright: 0.85, inner: 0.5, blend: 0.35 },
      B.poly(cape[1], pts, 0.03, 3),
      B.cap(cape[0], 0.5, 1.45, 1.4, 0.9, 0.42, 0.55),
      B.cap(cape[2], 2.3, -0.2, 3.1, -1.45, 0.3, 0.06),
    );
  }
  // kneeling back leg
  B.part(
    'legBack',
    { z: -0.3, bright: 0.65, rim: 0.85, inner: 0.45, k: 0.12, thick: 0.3, blend: 0.12 },
    B.cap(lbU, 0.5, -1.2, 0.95, -2.95, 0.45, 0.24),
    B.cap(lbL, 0.95, -2.95, 2.05, -3.1, 0.24, 0.15),
    B.ell(lbL, 2.25, -3.15, 0.3, 0.11, 8),
  );
  // the club, raised overhead (behind the head)
  B.part(
    'club',
    { z: -0.15, k: 0.08, thick: 0.15, tint: 0.2, rim: 1.2, inner: 0.85 },
    B.cap(hand, 0.55, 2.55, 2.45, 3.22, 0.09, 0.3),
    B.circle(hand, 1.75, 3.05, 0.16),
    B.circle(hand, 2.15, 3.42, 0.15),
    B.circle(hand, 2.62, 3.05, 0.16),
    B.circle(hand, 1.35, 2.72, 0.12),
  );
  // club arm (back)
  B.part(
    'armBack',
    { z: -0.08, k: 0.12, thick: 0.25, inner: 0.7, blend: 0.14 },
    B.cap(abU, 0.85, 1.05, 1.55, 2.0, 0.34, 0.25),
    B.cap(abL, 1.55, 2.0, 0.8, 2.72, 0.25, 0.18),
    B.ell(hand, 0.72, 2.75, 0.22, 0.18, 30),
  );
  // torso: heroic V
  B.part(
    'torso',
    { z: 0, k: 0.2, thick: 0.55, fill: 1.05 },
    B.poly(chest, [-1.0, 1.1, -0.35, 1.3, 0.45, 1.3, 1.08, 1.05, 0.95, 0.3, 0.62, -0.55, 0.62, -1.05, -0.25, -1.1, -0.42, -0.5, -0.82, 0.3], 0.08, 4),
    B.ell(pelvis, 0.2, -1.15, 0.72, 0.42),
  );
  // front leg (knee up, foot planted)
  B.part(
    'legFront',
    { z: 0.3, k: 0.12, inner: 0.7, thick: 0.35, blend: 0.12 },
    B.cap(lfU, -0.15, -1.1, -1.3, -1.55, 0.48, 0.28),
    B.cap(lfL, -1.3, -1.55, -1.48, -3.0, 0.27, 0.16),
    B.ell(lfL, -1.78, -3.15, 0.36, 0.12, 0),
  );
  // head + lion-skin hood (the lion's jaws over the brow, mane down the back)
  B.part(
    'head',
    { z: 0.4, k: 0.1, thick: 0.3, inner: 0.95, rim: 1.1 },
    B.ell(head, -0.2, 1.7, 0.36, 0.42, -8),
    B.poly(head, [-0.45, 1.78, -0.6, 1.55, -0.52, 1.35, -0.3, 1.25, -0.05, 1.32], 0.04, 2),
    B.cap(head, -0.05, 1.45, 0.1, 1.05, 0.2, 0.22),
  );
  B.part(
    'hood',
    { z: 0.5, k: 0.1, thick: 0.25, inner: 1.0, rim: 1.15, tint: 0.15, flow: Flow.Wisp },
    B.poly(head, [0.5, 1.35, 0.4, 2.0, 0.12, 2.32, -0.3, 2.3, -0.68, 2.16, -0.95, 1.98, -0.9, 1.88, -0.62, 1.86, -0.32, 1.98, 0.0, 1.8, 0.12, 1.4], 0.04, 3),
    B.circle(head, -0.02, 2.36, 0.12),
    B.circle(head, 0.26, 2.3, 0.11),
    B.tri(head, -0.82, 1.9, -0.72, 1.9, -0.76, 1.68, 0.012),
    B.tri(head, -0.52, 1.92, -0.43, 1.93, -0.47, 1.74, 0.01),
    // forepaws knotted across the chest
    B.cap(chest, 0.35, 1.25, -0.35, 0.85, 0.11, 0.08),
    B.cap(chest, -0.5, 1.2, -0.15, 0.82, 0.1, 0.07),
  );
  // front arm reaching forward
  B.part(
    'armFront',
    { z: 0.5, k: 0.12, thick: 0.3, inner: 0.85, blend: 0.14 },
    B.cap(afU, -0.85, 1.0, -1.75, 0.42, 0.33, 0.24),
    B.cap(afL, -1.75, 0.42, -2.55, 0.62, 0.23, 0.17),
    B.ell(afL, -2.72, 0.66, 0.2, 0.16, 15),
  );

  // details: musculature, face, lion-skin
  B.stroke([-0.62, 1.66, -0.5, 1.68], { part: 'head', w: 0.025, bright: 1.6, tint: 0.7, smooth: 0 });
  B.stroke([-0.7, 2.08, -0.5, 2.05, -0.3, 2.1], { part: 'hood', w: 0.02, bright: 1.2, tint: 0.6 });
  B.stroke([-0.55, 0.95, -0.15, 0.7, 0.35, 0.95], { part: 'torso', w: 0.025, bright: 0.6 });
  B.stroke([-0.1, 0.65, -0.08, -0.6], { part: 'torso', w: 0.02, bright: 0.45, smooth: 0 });
  B.stroke([-0.35, 0.15, 0.3, 0.12], { part: 'torso', w: 0.02, bright: 0.35, smooth: 0 });
  B.stroke([-0.32, -0.3, 0.32, -0.32], { part: 'torso', w: 0.02, bright: 0.35, smooth: 0 });
  B.stroke([-0.55, -1.25, -0.9, -1.4, -1.15, -1.45], { part: 'legFront', w: 0.02, bright: 0.45 });
  B.stroke([1.2, 2.15, 1.35, 1.8, 1.15, 1.45], { part: 'armBack', w: 0.02, bright: 0.45 });
  B.stroke([1.2, 0.9, 1.9, 0.0, 2.4, -0.9], { part: 'cape', w: 0.025, bright: 0.5, flow: Flow.Wisp });
  B.stroke([0.8, 0.7, 1.4, -0.3, 1.8, -1.0], { part: 'cape', w: 0.025, bright: 0.45, flow: Flow.Wisp });

  // stars: the Keystone in the torso, Ras Algethi at the head, club tip, hands, knees, feet
  B.star('rasalgethi', -0.25, 1.62, 1.4, { part: 'head' });
  B.star('lionbrow', -0.88, 1.97, 0.85, { part: 'hood' });
  B.star('pi', -0.55, 0.85, 1.0);
  B.star('eta', 0.55, 0.8, 1.0);
  B.star('zeta', 0.38, -0.4, 1.05);
  B.star('epsilon', -0.28, -0.42, 0.95);
  B.star('shoulderB', 0.95, 1.12, 0.8, { part: 'armBack' });
  B.star('elbowB', 1.55, 2.0, 0.8, { part: 'armBack' });
  B.star('fistB', 0.75, 2.75, 1.0, { part: 'armBack' });
  B.star('clubtip', 2.5, 3.25, 1.35, { part: 'club' });
  B.star('elbowF', -1.75, 0.42, 0.8, { part: 'armFront' });
  B.star('fistF', -2.72, 0.66, 1.05, { part: 'armFront' });
  B.star('kneeF', -1.3, -1.55, 0.9, { part: 'legFront' });
  B.star('footF', -1.82, -3.15, 0.85, { part: 'legFront' });
  B.star('kneeB', 0.95, -2.95, 0.85, { part: 'legBack' });
  B.star('footB', 2.3, -3.15, 0.7, { part: 'legBack' });
  B.link('pi', 'eta', 'zeta', 'epsilon', 'pi');
  B.link('lionbrow', 'rasalgethi', 'pi');
  B.link('eta', 'shoulderB', 'elbowB', 'fistB', 'clubtip');
  B.link('pi', 'elbowF', 'fistF');
  B.link('epsilon', 'kneeF', 'footF');
  B.link('zeta', 'kneeB', 'footB');

  B.core = P(0.05, 0.25);
  B.head = P(-0.3, 1.75, 0.5);
  B.mouths.push(P(2.2, 3.1, 0.5), P(-2.7, 0.66, 0.6));
  B.scaleAll(1.04, -0.12, -0.05);

  return B.build('heracles', (p, c) => {
    const t = c.t;
    const br = c.breath;
    const fwd = Math.max(0, c.lunge);
    const back = Math.max(0, -c.lunge);
    p.s(chest, 1 + 0.012 * br, 1 + 0.018 * br);
    p.r(chest, 0.015 * Math.sin(t * 0.6) + 0.06 * back - 0.08 * fwd + 0.05 * c.hurt);
    p.r(head, 0.03 * Math.sin(t * 0.7 + 1) - 0.08 * c.roar + 0.05 * c.hurt);
    // club: poised, rises on the wind-up, smashes down on the strike
    const poise = 0.05 * Math.sin(t * 1.1);
    p.r(abU, -poise - 0.35 * back + 2.35 * fwd - 0.15 * c.roar);
    p.r(abL, 0.04 * Math.sin(t * 1.1 + 0.4) - 0.25 * back + 0.55 * fwd);
    p.r(hand, 0.03 * Math.sin(t * 1.3) + 0.5 * fwd);
    p.o(hand, 0, 0, 1.2 * fwd);
    p.r(afU, 0.04 * Math.sin(t * 0.9 + 2) + 0.12 * back - 0.1 * fwd + 0.25 * c.roar);
    p.r(afL, 0.05 * Math.sin(t * 0.9 + 2.5) + 0.2 * c.roar);
    p.r(lfU, -0.02 * br);
    // cape billows
    p.wave(cape, 0.05 + 0.04 * c.charge + 0.05 * c.roar, t, 1.4, 0.8, 0.4);
  });
}

export const CREATURE: CreatureModule = { id: 'heracles', build: buildHeracles };
