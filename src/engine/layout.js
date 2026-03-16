import { treeLvls } from './treeHelpers.js';

export function layoutType(alg, op) {
  if (alg === 'ring' || op === 'alltoall' || op === 'allgather' || op === 'reducescatter') return 'ring';
  if (alg === 'tree') return 'tree';
  return 'star';
}

export function edgeType(alg, op) {
  return layoutType(alg, op);
}

export function cellGeo(gpus, C, gi, ci) {
  const g = gpus[gi];
  const cw = C <= 6 ? 28 : C <= 9 ? 22 : 18;
  const gap = C <= 6 ? 3 : 2;
  const cardW = C * (cw + gap) + 14;
  const cardH = cw + 40;
  const rx = g.x - cardW / 2;
  const ry = g.y - cardH / 2;
  return { x: rx + 7 + ci * (cw + gap), y: ry + 26, w: cw, h: cw, cardW, cardH, rx, ry };
}

export function computeLayout(gpus, G, C, alg, op, W, H) {
  const cw = C <= 6 ? 28 : C <= 9 ? 22 : 18;
  const gp = C <= 6 ? 3 : 2;
  const cardW = C * (cw + gp) + 14;
  const cardH = cw + 40;
  const lt = layoutType(alg, op);

  if (lt === 'ring') {
    const minDist = Math.max(cardW, cardH) + 20;
    const minR = minDist / (2 * Math.sin(Math.PI / G));
    const r = Math.max(minR, Math.min(W, H) * 0.34);
    const cx = W / 2, cy = H / 2;
    for (let i = 0; i < G; i++) {
      const a = 2 * Math.PI * i / G - Math.PI / 2;
      gpus[i].x = cx + r * Math.cos(a);
      gpus[i].y = cy + r * Math.sin(a);
    }
  } else if (lt === 'star') {
    const cx = W / 2, cy = H / 2;
    gpus[0].x = cx; gpus[0].y = cy;
    if (G > 2) {
      const diag = Math.sqrt(cardW * cardW + cardH * cardH);
      const orbitDist = diag + 40;
      const n = G - 1;
      const minR = orbitDist / (2 * Math.sin(Math.PI / n));
      const centerClear = diag + 20;
      const r = Math.max(minR, centerClear, Math.min(W, H) * 0.34);
      for (let i = 1; i < G; i++) {
        const a = 2 * Math.PI * (i - 1) / n - Math.PI / 2;
        gpus[i].x = cx + r * Math.cos(a);
        gpus[i].y = cy + r * Math.sin(a);
      }
      // Shift all GPUs so bounding box is centered on screen
      let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
      for (let i = 0; i < G; i++) {
        bx0 = Math.min(bx0, gpus[i].x); by0 = Math.min(by0, gpus[i].y);
        bx1 = Math.max(bx1, gpus[i].x); by1 = Math.max(by1, gpus[i].y);
      }
      const dx = cx - (bx0 + bx1) / 2;
      const dy = cy - (by0 + by1) / 2;
      for (let i = 0; i < G; i++) { gpus[i].x += dx; gpus[i].y += dy; }
    } else {
      const r = Math.max(Math.max(cardW, cardH) + 30, Math.min(W, H) * 0.25);
      gpus[1].x = cx + r; gpus[1].y = cy;
    }
  } else {
    const lvs = treeLvls(G);
    const margin = Math.max(60, cardW * 0.5);
    const maxN = Math.max(...lvs.map((l) => l.length));
    const needW = (cardW + margin) * maxN + margin;
    const useW = Math.max(W, needW);
    const lh = cardH + margin;
    const treeH = lh * Math.max(lvs.length - 1, 0);
    const topY = (H - treeH) / 2;
    for (let l = 0; l < lvs.length; l++) {
      const y = topY + l * lh;
      const n = lvs[l].length;
      const sp = useW / (n + 1);
      for (let i = 0; i < n; i++) {
        gpus[lvs[l][i]].x = sp * (i + 1);
        gpus[lvs[l][i]].y = y;
      }
    }
  }
}

export function autoFit(gpus, G, C, W, H) {
  if (!gpus.length) return { zoom: 1, panX: 0, panY: 0 };
  const hudPad = 30;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const g of gpus) {
    const geo = cellGeo(gpus, C, g.gi, 0);
    x0 = Math.min(x0, geo.rx - 12);
    y0 = Math.min(y0, geo.ry - 12);
    x1 = Math.max(x1, geo.rx + geo.cardW + 12);
    y1 = Math.max(y1, geo.ry + geo.cardH + 22);
  }
  const sw = x1 - x0, sh = y1 - y0;
  if (sw <= 0 || sh <= 0) return { zoom: 1, panX: 0, panY: 0 };
  const fitH = H - hudPad;
  const zoom = Math.min(W / sw, fitH / sh, 1);
  const panX = (W - sw * zoom) / 2 - x0 * zoom;
  const panY = hudPad + (fitH - sh * zoom) / 2 - y0 * zoom;
  return { zoom, panX, panY };
}

export function bezPt(t, x0, y0, cx, cy, x1, y1) {
  const u = 1 - t;
  return { x: u * u * x0 + 2 * u * t * cx + t * t * x1, y: u * u * y0 + 2 * u * t * cy + t * t * y1 };
}
