// Cached procedural texture layers (all deterministic). Each returns a canvas of the
// requested size; heavy per-pixel work happens once per key.
import { cached, makeCanvas, makeNoise, mulberry32, type Ctx } from './util';

/**
 * Speckle layer: each pixel is white or black with a small random alpha. Built with
 * putImageData only (never read back from the GPU), then composited — so texture builds
 * never stall on getImageData.
 */
function speckles(w: number, h: number, variant: number, warm: number): HTMLCanvasElement {
  return cached(`speck|${w}|${h}|${variant}|${warm.toFixed(2)}`, w, h, (g) => {
    const img = g.createImageData(w, h);
    const d = img.data;
    const rnd = mulberry32(9001 + variant * 77);
    const wr = 255, wg = 255 - 18 * warm, wb = 255 - 40 * warm;
    const br = 40 * warm, bgc = 22 * warm, bb = 0;
    for (let i = 0; i < d.length; i += 4) {
      const v = rnd() - 0.5;
      if (v > 0) {
        d[i] = wr; d[i + 1] = wg; d[i + 2] = wb;
      } else {
        d[i] = br; d[i + 1] = bgc; d[i + 2] = bb;
      }
      d[i + 3] = Math.abs(v) * 2 * 26;
    }
    g.putImageData(img, 0, 0);
  });
}

/** monochrome grain (amt ≈ old per-channel amplitude) composited without any read-back */
function grain(g: Ctx, w: number, h: number, amt: number, seed: number, warm = 1) {
  g.save();
  g.globalAlpha = Math.min(1, amt / 11);
  g.drawImage(speckles(w, h, seed % 3, warm >= 0.5 ? 1 : 0), 0, 0);
  g.restore();
}

/** low-resolution fbm field drawn up-scaled (cheap smooth blotches) */
function blotches(w: number, h: number, div: number, seed: number, scale: number, colA: [number, number, number], colB: [number, number, number], oct = 4, contrast = 1): HTMLCanvasElement {
  const sw = Math.ceil(w / div), sh = Math.ceil(h / div);
  const [c, g] = makeCanvas(sw, sh);
  const img = g.createImageData(sw, sh);
  const { fbm } = makeNoise(seed);
  for (let y = 0; y < sh; y++)
    for (let x = 0; x < sw; x++) {
      let v = fbm((x * div) / scale, (y * div) / scale, oct);
      v = Math.max(0, Math.min(1, 0.5 + (v - 0.5) * 2.2 * contrast));
      const i = (y * sw + x) * 4;
      img.data[i] = colA[0] + (colB[0] - colA[0]) * v;
      img.data[i + 1] = colA[1] + (colB[1] - colA[1]) * v;
      img.data[i + 2] = colA[2] + (colB[2] - colA[2]) * v;
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  return c;
}

/** warm ivory parchment with blotches, fine grain and a burnt vignette */
export function parchmentTex(w: number, h: number, seed = 11, tone: 'ivory' | 'light' = 'ivory'): HTMLCanvasElement {
  return cached(`parch|${w}|${h}|${seed}|${tone}`, w, h, (g) => {
    const A: [number, number, number] = tone === 'ivory' ? [233, 218, 186] : [240, 233, 214];
    const B: [number, number, number] = tone === 'ivory' ? [250, 243, 224] : [253, 250, 241];
    g.imageSmoothingQuality = 'high';
    g.drawImage(blotches(w, h, 4, seed, 120, A, B, 5, 0.9), 0, 0, w, h);
    // faint fibre streaks
    g.globalAlpha = 0.18;
    g.drawImage(blotches(w, h, 2, seed + 7, 18, [214, 196, 160], [252, 246, 230], 3, 1.2), 0, 0, w, h);
    g.globalAlpha = 1;
    grain(g, w, h, tone === 'ivory' ? 9 : 6, seed + 3);
    const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.hypot(w, h) * 0.55);
    vg.addColorStop(0, 'rgba(120,80,30,0)');
    vg.addColorStop(1, tone === 'ivory' ? 'rgba(120,76,28,0.26)' : 'rgba(120,90,50,0.14)');
    g.fillStyle = vg;
    g.fillRect(0, 0, w, h);
  });
}

/** veined marble. `dark` = black marble with smoky veins */
export function marbleTex(w: number, h: number, seed = 5, kind: 'white' | 'dark' | 'warm' = 'white'): HTMLCanvasElement {
  return cached(`marble|${w}|${h}|${seed}|${kind}`, w, h, (g) => {
    // computed at half resolution then up-scaled (veins stay crisp enough at card scale)
    const S = 2;
    const sw = Math.ceil(w / S), sh = Math.ceil(h / S);
    const [c, cg] = makeCanvas(sw, sh);
    const { fbm } = makeNoise(seed);
    const n2 = makeNoise(seed + 101);
    const img = cg.createImageData(sw, sh);
    const d = img.data;
    const base = kind === 'white' ? [244, 242, 238] : kind === 'warm' ? [240, 232, 218] : [26, 23, 22];
    const vein = kind === 'white' ? [120, 124, 134] : kind === 'warm' ? [150, 122, 92] : [96, 88, 80];
    const cloud = kind === 'white' ? [222, 222, 224] : kind === 'warm' ? [224, 210, 188] : [40, 36, 33];
    for (let yy = 0; yy < sh; yy++)
      for (let xx = 0; xx < sw; xx++) {
        const x = xx * S, y = yy * S;
        const t = fbm(x / 150, y / 150, 5);
        const cl = n2.fbm(x / 60, y / 60, 3);
        const v1 = Math.abs(Math.sin((x * 0.6 + y * 1.0) / 46 + t * 9));
        const v2 = Math.abs(Math.sin((x * 1.1 - y * 0.35) / 31 + n2.fbm(x / 90, y / 90, 4) * 11));
        const vein1 = Math.pow(1 - v1, 22) * 0.95;
        const vein2 = Math.pow(1 - v2, 34) * 0.55;
        const veinA = Math.min(1, vein1 + vein2);
        const cc = (cl - 0.5) * 1.6;
        const i = (yy * sw + xx) * 4;
        for (let k = 0; k < 3; k++) {
          let v = base[k] + (cloud[k] - base[k]) * Math.max(0, Math.min(1, 0.5 + cc));
          v = v + (vein[k] - v) * veinA;
          d[i + k] = v;
        }
        d[i + 3] = 255;
      }
    cg.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(c, 0, 0, w, h);
    grain(g, w, h, kind === 'dark' ? 6 : 5, seed + 9, 0.2);
  });
}

/** neutral grey (128-centred) mottling for overlay blending */
export function mottleTex(w: number, h: number, seed = 301, scale = 70, amp = 46): HTMLCanvasElement {
  return cached(`mottle|${w}|${h}|${seed}|${scale}|${amp}`, w, h, (g) => {
    const S = 2;
    const sw = Math.ceil(w / S), sh = Math.ceil(h / S);
    const [c, cg] = makeCanvas(sw, sh);
    const { fbm } = makeNoise(seed);
    const img = cg.createImageData(sw, sh);
    for (let y = 0; y < sh; y++)
      for (let x = 0; x < sw; x++) {
        const v = 128 + (fbm((x * S) / scale, (y * S) / scale, 3) - 0.5) * amp * 2;
        const i = (y * sw + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
    cg.putImageData(img, 0, 0);
    g.imageSmoothingQuality = 'high';
    g.drawImage(c, 0, 0, w, h);
    grain(g, w, h, 14, seed + 1, 1 / 0.95);
  });
}

/** pearly white-blue ground for divine cards, with faint radial rays */
export function pearlTex(w: number, h: number): HTMLCanvasElement {
  return cached(`pearl|${w}|${h}`, w, h, (g) => {
    g.drawImage(blotches(w, h, 4, 77, 140, [226, 232, 246], [252, 251, 255], 4, 0.8), 0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    g.save();
    g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      g.beginPath();
      g.moveTo(cx, cy);
      g.arc(cx, cy, h, a - 0.022, a + 0.022);
      g.closePath();
      g.fillStyle = i % 2 ? 'rgba(255,255,255,0.10)' : 'rgba(170,190,235,0.07)';
      g.fill();
    }
    g.restore();
    const vg = g.createRadialGradient(cx, cy, 30, cx, cy, h * 0.7);
    vg.addColorStop(0, 'rgba(255,255,255,0.5)');
    vg.addColorStop(1, 'rgba(150,165,210,0.25)');
    g.fillStyle = vg;
    g.fillRect(0, 0, w, h);
    grain(g, w, h, 4, 78, 0.3);
  });
}

/** ivory with fine guilloché rings (polychrome foil friendly) */
export function guillocheTex(w: number, h: number): HTMLCanvasElement {
  return cached(`guil|${w}|${h}`, w, h, (g) => {
    g.drawImage(parchmentTex(w, h, 23, 'light'), 0, 0);
    const cx = w / 2, cy = h / 2;
    g.lineWidth = 0.8;
    for (let k = 0; k < 3; k++) {
      g.strokeStyle = ['rgba(201,150,47,0.20)', 'rgba(170,120,60,0.14)', 'rgba(210,180,90,0.16)'][k];
      g.beginPath();
      for (let i = 0; i <= 720; i++) {
        const a = (i / 720) * Math.PI * 2;
        const r = 120 + 26 * k + 9 * Math.sin(a * (18 + k * 6)) + 5 * Math.sin(a * 5 + k);
        const x = cx + Math.cos(a) * r * 1.0, y = cy + Math.sin(a) * r * 1.25;
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.stroke();
    }
    for (let ring = 0; ring < 26; ring++) {
      g.strokeStyle = `rgba(190,150,70,${0.05 + (ring % 3 === 0 ? 0.05 : 0)})`;
      g.beginPath();
      g.ellipse(cx, cy, 30 + ring * 9, (30 + ring * 9) * 1.25, 0, 0, Math.PI * 2);
      g.stroke();
    }
  });
}

/** icy crystal ground with triangular facets */
export function crystalTex(w: number, h: number): HTMLCanvasElement {
  return cached(`crys|${w}|${h}`, w, h, (g) => {
    const grd = g.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, '#e9f7ff');
    grd.addColorStop(0.5, '#cfeafa');
    grd.addColorStop(1, '#eef9ff');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    const rnd = mulberry32(4242);
    const nx = 6, ny = 8;
    const P: [number, number][][] = [];
    for (let j = 0; j <= ny; j++) {
      P.push([]);
      for (let i = 0; i <= nx; i++) {
        const edge = i === 0 || j === 0 || i === nx || j === ny;
        P[j].push([(i / nx) * w + (edge ? 0 : (rnd() - 0.5) * (w / nx) * 0.8), (j / ny) * h + (edge ? 0 : (rnd() - 0.5) * (h / ny) * 0.8)]);
      }
    }
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const a = P[j][i], b = P[j][i + 1], c = P[j + 1][i + 1], d = P[j + 1][i];
        const tris = rnd() < 0.5 ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]];
        for (const t of tris) {
          const v = rnd();
          g.beginPath();
          g.moveTo(t[0][0], t[0][1]);
          g.lineTo(t[1][0], t[1][1]);
          g.lineTo(t[2][0], t[2][1]);
          g.closePath();
          g.fillStyle = v < 0.5 ? `rgba(255,255,255,${0.15 + v * 0.5})` : `rgba(120,190,230,${(v - 0.5) * 0.35})`;
          g.fill();
          g.strokeStyle = 'rgba(255,255,255,0.55)';
          g.lineWidth = 1;
          g.stroke();
        }
      }
    grain(g, w, h, 3, 4243, 0.1);
  });
}

/** deep night sky with stars and a faint nebula */
export function starfieldTex(w: number, h: number, seed = 31, hue: 'navy' | 'indigo' = 'navy'): HTMLCanvasElement {
  return cached(`stars|${w}|${h}|${seed}|${hue}`, w, h, (g) => {
    const bg = g.createRadialGradient(w * 0.5, h * 0.42, 20, w * 0.5, h * 0.5, h * 0.75);
    if (hue === 'navy') {
      bg.addColorStop(0, '#1c2a5c');
      bg.addColorStop(0.55, '#0f1838');
      bg.addColorStop(1, '#070b1c');
    } else {
      bg.addColorStop(0, '#2a2466');
      bg.addColorStop(0.55, '#16133e');
      bg.addColorStop(1, '#090820');
    }
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    // nebula wisps
    g.globalCompositeOperation = 'screen';
    g.globalAlpha = 0.42;
    g.drawImage(blotches(w, h, 4, seed, 110, [0, 0, 0], hue === 'navy' ? [60, 70, 140] : [90, 60, 150], 5, 1.4), 0, 0, w, h);
    g.globalAlpha = 0.22;
    g.drawImage(blotches(w, h, 4, seed + 5, 60, [0, 0, 0], [40, 110, 150], 4, 1.6), 0, 0, w, h);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    const rnd = mulberry32(seed + 1);
    const n = Math.round((w * h) / 520);
    for (let i = 0; i < n; i++) {
      const x = rnd() * w, y = rnd() * h;
      const m = Math.pow(rnd(), 3);
      const r = 0.35 + m * 1.5;
      g.fillStyle = `rgba(${220 + rnd() * 35},${225 + rnd() * 30},255,${0.25 + m * 0.75})`;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      if (m > 0.72) {
        const gl = g.createRadialGradient(x, y, 0, x, y, r * 6);
        gl.addColorStop(0, 'rgba(200,220,255,0.35)');
        gl.addColorStop(1, 'rgba(200,220,255,0)');
        g.fillStyle = gl;
        g.fillRect(x - r * 6, y - r * 6, r * 12, r * 12);
      }
    }
    grain(g, w, h, 5, seed + 2, 0.4);
  });
}

/** papyrus sheet: woven horizontal + vertical fibres */
export function papyrusTex(w: number, h: number, seed = 61): HTMLCanvasElement {
  return cached(`papy|${w}|${h}|${seed}`, w, h, (g) => {
    g.drawImage(blotches(w, h, 4, seed, 90, [214, 186, 128], [240, 220, 168], 4, 0.9), 0, 0, w, h);
    const rnd = mulberry32(seed + 4);
    // horizontal strips
    for (let y = 0; y < h; y += 2 + rnd() * 3) {
      g.fillStyle = `rgba(${rnd() < 0.5 ? '120,90,40' : '255,245,210'},${0.05 + rnd() * 0.08})`;
      g.fillRect(0, y, w, 1 + rnd() * 2);
    }
    // vertical strips (underlying layer)
    for (let x = 0; x < w; x += 4 + rnd() * 6) {
      g.fillStyle = `rgba(${rnd() < 0.5 ? '110,80,35' : '255,240,200'},${0.03 + rnd() * 0.05})`;
      g.fillRect(x, 0, 1.5 + rnd() * 2.5, h);
    }
    // strip seams
    for (let x = 30 + rnd() * 20; x < w; x += 70 + rnd() * 30) {
      g.fillStyle = 'rgba(110,80,35,0.10)';
      g.fillRect(x, 0, 2, h);
    }
    grain(g, w, h, 10, seed + 9);
  });
}

/** dark leather / wood ground (scroll cards) */
export function leatherTex(w: number, h: number, seed = 71): HTMLCanvasElement {
  return cached(`leath|${w}|${h}|${seed}`, w, h, (g) => {
    g.drawImage(blotches(w, h, 3, seed, 70, [44, 20, 14], [92, 44, 26], 5, 1.1), 0, 0, w, h);
    g.globalAlpha = 0.3;
    g.drawImage(blotches(w, h, 1, seed + 3, 6, [30, 14, 10], [120, 70, 40], 2, 1.4), 0, 0, w, h);
    g.globalAlpha = 1;
    grain(g, w, h, 10, seed + 5, 0.8);
    const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) * 0.55);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = vg;
    g.fillRect(0, 0, w, h);
  });
}

/** gold leaf: metallic gradient broken into slightly different flakes */
export function goldLeafTex(w: number, h: number, seed = 91): HTMLCanvasElement {
  return cached(`gleaf|${w}|${h}|${seed}`, w, h, (g) => {
    const grd = g.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, '#b8862a');
    grd.addColorStop(0.3, '#f7dc8a');
    grd.addColorStop(0.5, '#d9a842');
    grd.addColorStop(0.72, '#fbe9a8');
    grd.addColorStop(1, '#a87a22');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    const rnd = mulberry32(seed);
    const cell = 26;
    for (let y = -cell; y < h + cell; y += cell)
      for (let x = -cell; x < w + cell; x += cell) {
        const px = x + rnd() * cell, py = y + rnd() * cell;
        g.beginPath();
        const k = 5 + Math.floor(rnd() * 3);
        for (let i = 0; i < k; i++) {
          const a = (i / k) * Math.PI * 2 + rnd() * 0.5;
          const r = cell * (0.45 + rnd() * 0.35);
          const X = px + Math.cos(a) * r, Y = py + Math.sin(a) * r;
          if (i) g.lineTo(X, Y);
          else g.moveTo(X, Y);
        }
        g.closePath();
        const v = rnd();
        g.fillStyle = v < 0.5 ? `rgba(255,248,210,${0.08 + v * 0.18})` : `rgba(120,80,20,${(v - 0.5) * 0.22})`;
        g.fill();
        g.strokeStyle = 'rgba(110,70,15,0.18)';
        g.lineWidth = 0.7;
        g.stroke();
      }
    grain(g, w, h, 8, seed + 1, 0.9);
  });
}

/** polished bronze: warm metallic sweep with soft brushed grain and faint patina */
export function bronzeTex(w: number, h: number, seed = 51): HTMLCanvasElement {
  return cached(`bronze|${w}|${h}|${seed}`, w, h, (g) => {
    const grd = g.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, '#7a3e18');
    grd.addColorStop(0.18, '#d08a4c');
    grd.addColorStop(0.3, '#f6c08c');
    grd.addColorStop(0.45, '#b4672e');
    grd.addColorStop(0.62, '#7d4019');
    grd.addColorStop(0.8, '#dc9b5e');
    grd.addColorStop(1, '#8a4a1e');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    // brushed streaks
    const rnd = mulberry32(seed);
    for (let i = 0; i < 260; i++) {
      const y = rnd() * h, x = rnd() * w, l = 20 + rnd() * 120;
      g.fillStyle = rnd() < 0.5 ? `rgba(255,220,180,${0.04 + rnd() * 0.06})` : `rgba(60,25,8,${0.04 + rnd() * 0.06})`;
      g.fillRect(x, y, l, 1);
    }
    // faint verdigris in the low spots
    g.globalAlpha = 0.12;
    g.globalCompositeOperation = 'screen';
    g.drawImage(blotches(w, h, 3, seed + 2, 50, [0, 0, 0], [40, 140, 110], 4, 2.4), 0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    grain(g, w, h, 8, seed + 3, 0.9);
  });
}

/** dark polished wood with long grain (scroll cards) */
export function woodTex(w: number, h: number, seed = 81): HTMLCanvasElement {
  return cached(`wood|${w}|${h}|${seed}`, w, h, (g) => {
    const S = 2;
    const sw = Math.ceil(w / S), sh = Math.ceil(h / S);
    const [c, cg] = makeCanvas(sw, sh);
    const { fbm } = makeNoise(seed);
    const img = cg.createImageData(sw, sh);
    const d = img.data;
    for (let yy = 0; yy < sh; yy++)
      for (let xx = 0; xx < sw; xx++) {
        const x = xx * S, y = yy * S;
        const warp = fbm(x / 120, y / 260, 3) * 9;
        const ring = Math.sin(x / 7.5 + warp) * 0.5 + 0.5;
        const fine = fbm(x / 2.2, y / 60, 2);
        const v = 0.55 * ring + 0.45 * fine;
        const i = (yy * sw + xx) * 4;
        d[i] = 46 + v * 46;
        d[i + 1] = 26 + v * 26;
        d[i + 2] = 15 + v * 14;
        d[i + 3] = 255;
      }
    cg.putImageData(img, 0, 0);
    g.imageSmoothingQuality = 'high';
    g.drawImage(c, 0, 0, w, h);
    grain(g, w, h, 6, seed + 1, 0.8);
    const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) * 0.55);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.5)');
    g.fillStyle = vg;
    g.fillRect(0, 0, w, h);
  });
}
