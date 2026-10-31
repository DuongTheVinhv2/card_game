// Debug: draws a creature definition's layered SDF silhouette + bones + stars on a 2D canvas.
import type { CreatureDef } from './rig';
import { buildFields } from './sampler';

export interface Debug2DOptions {
  bones?: boolean;
  stars?: boolean;
  strokes?: boolean;
  labels?: boolean;
  res?: number;
}

function hsl(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

export function drawCreature2D(
  ctx: CanvasRenderingContext2D,
  def: CreatureDef,
  x0: number,
  y0: number,
  w: number,
  h: number,
  opts: Debug2DOptions = {},
): void {
  const t0 = performance.now();
  const fields = buildFields(def, opts.res ?? 24);
  const parts = def.parts;
  const np = parts.length;
  const scale = Math.min(w / 10.6, h / 7.4);
  const cx = x0 + w / 2;
  const cy = y0 + h / 2;
  const X = (wx: number) => cx + wx * scale;
  const Y = (wy: number) => cy - wy * scale;
  const iw = Math.floor(w);
  const ih = Math.floor(h);
  const img = ctx.createImageData(iw, ih);
  const ds = new Float32Array(np);
  let maxL = 0;
  for (const p of parts) maxL = Math.max(maxL, p.layer);
  const cols = parts.map((p, i) => hsl((i * 47 + 20) % 360, 45, 18 + 26 * (p.layer / Math.max(1, maxL)) * p.bright));
  const px = 1 / scale;
  for (let j = 0; j < ih; j++) {
    const wy = -(y0 + j + 0.5 - cy) / scale;
    for (let i = 0; i < iw; i++) {
      const wx = (x0 + i + 0.5 - cx) / scale;
      let top = -1;
      let topL = -Infinity;
      for (let k = 0; k < np; k++) {
        const f = fields[k];
        const d = wx < f.x0 || wy < f.y0 || wx > f.x1 || wy > f.y1 ? 9 : f.sample(wx, wy);
        ds[k] = d;
        if (d < 0 && parts[k].layer > topL) {
          topL = parts[k].layer;
          top = k;
        }
      }
      const o = (j * iw + i) * 4;
      let r = 6;
      let g = 8;
      let b = 16;
      if (top >= 0) [r, g, b] = cols[top];
      // visible outlines
      for (let k = 0; k < np; k++) {
        if (Math.abs(ds[k]) > px * 0.9) continue;
        let occ = false;
        for (let m = 0; m < np; m++) {
          if (m !== k && parts[m].layer > parts[k].layer && ds[m] < -px * 0.5) {
            occ = true;
            break;
          }
        }
        if (!occ) {
          r = 255;
          g = 236;
          b = 190;
        }
      }
      img.data[o] = r;
      img.data[o + 1] = g;
      img.data[o + 2] = b;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, Math.floor(x0), Math.floor(y0));

  // reference box (10 x 7) + ground
  ctx.save();
  ctx.strokeStyle = 'rgba(120,140,200,0.35)';
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(X(-5), Y(3.5), 10 * scale, 7 * scale);
  ctx.setLineDash([]);
  ctx.restore();

  if (opts.strokes !== false) {
    ctx.save();
    ctx.strokeStyle = 'rgba(90,230,255,0.85)';
    ctx.lineWidth = 1;
    for (const s of def.strokes) {
      ctx.beginPath();
      for (let i = 0; i < s.pts.length; i += 2) {
        if (i === 0) ctx.moveTo(X(s.pts[i]), Y(s.pts[i + 1]));
        else ctx.lineTo(X(s.pts[i]), Y(s.pts[i + 1]));
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  if (opts.bones !== false) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,80,200,0.8)';
    ctx.fillStyle = 'rgba(255,80,200,0.9)';
    ctx.lineWidth = 1;
    for (const b of def.bones) {
      if (b.parent >= 0) {
        const p = def.bones[b.parent];
        ctx.beginPath();
        ctx.moveTo(X(p.px), Y(p.py));
        ctx.lineTo(X(b.px), Y(b.py));
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(X(b.px), Y(b.py), 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  if (opts.stars !== false) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,220,90,0.9)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < def.lines.length; i += 2) {
      const a = def.stars[def.lines[i]];
      const b = def.stars[def.lines[i + 1]];
      ctx.beginPath();
      ctx.moveTo(X(a.x), Y(a.y));
      ctx.lineTo(X(b.x), Y(b.y));
      ctx.stroke();
    }
    for (const s of def.stars) {
      ctx.fillStyle = s.gold ? '#ffb020' : '#fff3a0';
      ctx.beginPath();
      ctx.arc(X(s.x), Y(s.y), 2 + s.mag * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // anchors
    const cross = (x: number, y: number, c: string) => {
      ctx.strokeStyle = c;
      ctx.beginPath();
      ctx.moveTo(X(x) - 6, Y(y));
      ctx.lineTo(X(x) + 6, Y(y));
      ctx.moveTo(X(x), Y(y) - 6);
      ctx.lineTo(X(x), Y(y) + 6);
      ctx.stroke();
    };
    cross(def.core.x, def.core.y, '#ff4040');
    cross(def.head.x, def.head.y, '#ff40ff');
    for (const m of def.mouths) cross(m.x, m.y, '#ffa040');
    for (const m of def.drips) cross(m.x, m.y, '#40a0ff');
    ctx.restore();
  }

  if (opts.labels) {
    ctx.save();
    ctx.font = '11px monospace';
    ctx.fillStyle = 'rgba(200,255,200,0.9)';
    for (const p of parts) {
      ctx.fillText(`${p.name}(${p.layer})`, X((p.x0 + p.x1) / 2) - 20, Y((p.y0 + p.y1) / 2));
    }
    ctx.restore();
  }
  ctx.save();
  ctx.font = '13px monospace';
  ctx.fillStyle = '#9fb4ff';
  ctx.fillText(`${def.id}  parts:${np} bones:${def.bones.length} stars:${def.stars.length} (${(performance.now() - t0).toFixed(0)}ms)`, x0 + 6, y0 + 16);
  ctx.restore();
}
