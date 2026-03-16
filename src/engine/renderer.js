import { CC, FLASH_DUR } from './constants.js';
import { treeCh } from './treeHelpers.js';
import { mkData, gpuDone, gpuPartial, chunkDone, getTarget } from './dataModel.js';
import { cellGeo, layoutType, edgeType, bezPt } from './layout.js';
import { tGlobal } from '../i18n';


export function drawScene(ctx, state) {
  const { gpus, G, C, op, alg, steps, curStep, phase, anim, snapInfo, flashFx, zoom, panX, panY } = state;
  const W = ctx.canvas.width / devicePixelRatio;
  const H = ctx.canvas.height / devicePixelRatio;
  ctx.clearRect(0, 0, W, H);
  const blobPos = [];

  ctx.save();
  ctx.translate(panX, panY);
  ctx.scale(zoom, zoom);
  drawEdges(ctx, gpus, G, alg, op);
  drawGPUs(ctx, gpus, G, C, op);
  if (curStep >= 0 && curStep < steps.length && phase !== 'idle') {
    drawXfer(ctx, state, blobPos);
  }
  drawFlash(ctx, flashFx, gpus, C);
  ctx.restore();
  if (state.showMinimap !== false) drawMinimap(ctx, W, H, gpus, G, C, alg, op, zoom, panX, panY, blobPos);
  if (zoom !== 1) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${zoom * 100 < 1 ? (zoom * 100).toFixed(2) : Math.round(zoom * 100)}%  (${tGlobal('canvas.dblClickReset')})`, W - 46, H - 8);
    ctx.restore();
  }
  return blobPos;
}

function drawEdges(ctx, gpus, G, alg, op) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,.06)';
  ctx.lineWidth = 1;
  const et = edgeType(alg, op);
  if (et === 'ring') {
    for (let i = 0; i < G; i++) {
      const j = (i + 1) % G;
      ctx.beginPath(); ctx.moveTo(gpus[i].x, gpus[i].y); ctx.lineTo(gpus[j].x, gpus[j].y); ctx.stroke();
    }
  } else if (et === 'star') {
    for (let i = 1; i < G; i++) {
      ctx.beginPath(); ctx.moveTo(gpus[0].x, gpus[0].y); ctx.lineTo(gpus[i].x, gpus[i].y); ctx.stroke();
    }
  } else {
    const { ch } = treeCh(G);
    for (let i = 0; i < G; i++) {
      for (const c of ch[i]) {
        ctx.beginPath(); ctx.moveTo(gpus[i].x, gpus[i].y); ctx.lineTo(gpus[c].x, gpus[c].y); ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function drawGPUs(ctx, gpus, G, C, op) {
  for (const g of gpus) {
    const geo = cellGeo(gpus, C, g.gi, 0);
    const { cardW, cardH, rx, ry } = geo;
    const done = gpuDone(op, G, C, gpus, g.gi);
    const partial = gpuPartial(op, G, C, gpus, g.gi);

    ctx.save();
    if (done) { ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 14; }
    else if (partial) { ctx.shadowColor = '#f59e0b'; ctx.shadowBlur = 8; }
    ctx.fillStyle = '#0d1b3e';
    ctx.strokeStyle = done ? '#ffd700' : partial ? '#f59e0b44' : '#333355';
    ctx.lineWidth = done ? 2.5 : 1.5;
    ctx.beginPath(); ctx.roundRect(rx, ry, cardW, cardH, 8); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#999'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    let lbl = `GPU ${g.gi}`;
    if (op === 'alltoall') lbl += `  (${g.data.map((v) => v).join(',')})`;
    else if (op === 'broadcast' && g.gi === 0) lbl += '  (Root)';
    else if ((op === 'reduce' || op === 'gather' || op === 'scatter') && g.gi === 0) lbl += '  (Root)';
    else lbl += `  (${tGlobal('canvas.initVal')} ${mkData(op, G, C, g.gi).filter((v) => v !== 0).join(',')})`;
    ctx.fillText(lbl, g.x, ry + 3);

    for (let i = 0; i < C; i++) {
      const v = g.data[i];
      const cg = cellGeo(gpus, C, g.gi, i);
      const col = CC[i % CC.length];
      const isT = chunkDone(op, G, C, gpus, g.gi, i);
      const tgt = getTarget(op, G, C, g.gi, i);

      ctx.fillStyle = col; ctx.globalAlpha = 0.8;
      ctx.fillRect(cg.x, cg.y, cg.w, 3); ctx.globalAlpha = 1;

      const ratio = tgt !== 0 ? Math.min(Math.abs(v) / Math.abs(tgt), 1) : v !== 0 ? 1 : 0;
      ctx.fillStyle = col; ctx.globalAlpha = 0.08 + ratio * 0.45;
      ctx.beginPath(); ctx.roundRect(cg.x, cg.y + 3, cg.w, cg.h - 3, 2); ctx.fill(); ctx.globalAlpha = 1;

      if (isT && v !== 0) {
        ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(cg.x, cg.y, cg.w, cg.h, 3); ctx.stroke();
      }

      ctx.fillStyle = v === mkData(op, G, C, g.gi)[i] ? '#aaa' : '#fff';
      ctx.font = (isT && v !== 0) ? 'bold 11px monospace' : 'bold 10px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(v, cg.x + cg.w / 2, cg.y + cg.h / 2 + 1);

      if (isT && v !== 0) {
        ctx.fillStyle = '#ffd700'; ctx.font = 'bold 8px sans-serif';
        ctx.fillText('\u2605', cg.x + cg.w - 3, cg.y + 7);
      }
    }

    for (let i = 0; i < C; i++) {
      const cg = cellGeo(gpus, C, g.gi, i);
      ctx.fillStyle = CC[i % CC.length]; ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center'; ctx.fillText(`c${i}`, cg.x + cg.w / 2, cg.y + cg.h + 9);
    }
    ctx.restore();
  }
}

function drawXfer(ctx, state, blobPos) {
  const { gpus, G, C, op, alg, steps, curStep, anim: prog, snapInfo } = state;
  if (!snapInfo.length) return;
  const st = steps[curStep];
  const W = ctx.canvas.width / devicePixelRatio;
  const H = ctx.canvas.height / devicePixelRatio;

  for (let ti = 0; ti < st.t.length; ti++) {
    const t = st.t[ti];
    const info = snapInfo[ti];
    const isR = t.op === 'reduce';

    if (t.ci_src !== undefined) {
      const ciS = t.ci_src, ciD = t.ci_dst;
      const col = CC[ciS % CC.length];
      const sc = cellGeo(gpus, C, t.src, ciS), dc = cellGeo(gpus, C, t.dst, ciD);
      const sx = sc.x + sc.w / 2, sy = sc.y + sc.h / 2;
      const ex = dc.x + dc.w / 2, ey = dc.y + dc.h / 2;

      let ep = prog;
      const n = st.t.length;
      if (n > 1) {
        const stag = Math.min(0.08, 0.5 / Math.max(n - 1, 1));
        const travel = 1 - (n - 1) * stag;
        ep = Math.max(0, Math.min(1, (prog - ti * stag) / Math.max(travel, 0.1)));
      }
      if (ep <= 0) continue;

      const mx = (sx + ex) / 2, my = (sy + ey) / 2;
      const ddx = ex - sx, ddy = ey - sy;
      const dlen = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
      const px = -ddy / dlen, py = ddx / dlen;
      const dot = (W / 2 - mx) * px + (H / 2 - my) * py;
      const outS = dot > 0 ? -1 : 1;
      const bulge = Math.max(30, dlen * 0.2);
      const cpx = mx + outS * px * bulge, cpy = my + outS * py * bulge;

      ctx.save();
      ctx.strokeStyle = col; ctx.globalAlpha = 0.35; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(cpx, cpy, ex, ey); ctx.stroke();
      ctx.globalAlpha = 1;

      const bp = bezPt(ep, sx, sy, cpx, cpy, ex, ey);
      const blobR = ep > 0.8 ? 12 * (1 - (ep - 0.8) / 0.2 * 0.7) : 12;
      ctx.shadowColor = col; ctx.shadowBlur = 12 + ep * 6;
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(bp.x, bp.y, blobR, 0, Math.PI * 2); ctx.fill();
      blobPos.push({ x: bp.x, y: bp.y, col }); ctx.shadowBlur = 0;

      ctx.globalAlpha = ep > 0.9 ? 1 - (ep - 0.9) / 0.1 : 1;
      ctx.fillStyle = '#000'; ctx.font = `bold ${Math.round(9 * blobR / 12)}px monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(info.sv, bp.x, bp.y); ctx.globalAlpha = 1;
      ctx.restore();
      continue;
    }

    if (t.ci >= 0) {
      const ci = t.ci;
      const col = CC[ci % CC.length];
      const sc = cellGeo(gpus, C, t.src, ci), dc = cellGeo(gpus, C, t.dst, ci);
      const sx = sc.x + sc.w / 2, sy = sc.y + sc.h / 2;
      const ex = dc.x + dc.w / 2, ey = dc.y + dc.h / 2;

      const mx = (sx + ex) / 2, my = (sy + ey) / 2;
      const ddx = ex - sx, ddy = ey - sy;
      const dlen = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
      const px = -ddy / dlen, py = ddx / dlen;
      const dot = (W / 2 - mx) * px + (H / 2 - my) * py;
      const outS = dot > 0 ? -1 : 1;
      const bulge = Math.max(40, dlen * 0.25);
      const cpx = mx + outS * px * bulge, cpy = my + outS * py * bulge;

      ctx.save();
      ctx.strokeStyle = col; ctx.globalAlpha = 0.45; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(cpx, cpy, ex, ey); ctx.stroke(); ctx.globalAlpha = 1;

      const tax = ex - cpx, tay = ey - cpy;
      const tal = Math.sqrt(tax * tax + tay * tay) || 1;
      const anx = tax / tal, any_ = tay / tal;
      ctx.fillStyle = col; ctx.globalAlpha = 0.75;
      ctx.beginPath(); ctx.moveTo(ex, ey);
      ctx.lineTo(ex - anx * 10 - any_ * 5, ey - any_ * 10 + anx * 5);
      ctx.lineTo(ex - anx * 10 + any_ * 5, ey - any_ * 10 - anx * 5);
      ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;

      ctx.strokeStyle = col; ctx.globalAlpha = 0.35; ctx.lineWidth = 2; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.roundRect(sc.x - 2, sc.y - 2, sc.w + 4, sc.h + 4, 4); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;

      ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 8 + 12 * prog;
      ctx.strokeStyle = col; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.roundRect(dc.x - 2, dc.y - 2, dc.w + 4, dc.h + 4, 4); ctx.stroke(); ctx.restore();

      if (prog > 0.75) {
        const pulse = (prog - 0.75) / 0.25;
        ctx.save(); ctx.globalAlpha = pulse * 0.5; ctx.fillStyle = col;
        ctx.beginPath(); ctx.roundRect(dc.x, dc.y, dc.w, dc.h, 3); ctx.fill(); ctx.restore();
      }

      const bp = bezPt(prog, sx, sy, cpx, cpy, ex, ey);
      const blobR = prog > 0.8 ? 15 * (1 - (prog - 0.8) / 0.2 * 0.7) : 15;
      ctx.shadowColor = col; ctx.shadowBlur = 16 + prog * 8; ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(bp.x, bp.y, blobR, 0, Math.PI * 2); ctx.fill();
      blobPos.push({ x: bp.x, y: bp.y, col }); ctx.shadowBlur = 0;

      ctx.globalAlpha = prog > 0.9 ? 1 - (prog - 0.9) / 0.1 : 1;
      ctx.fillStyle = '#000'; ctx.font = `bold ${Math.round(11 * blobR / 15)}px monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(info.sv, bp.x, bp.y); ctx.globalAlpha = 1;

      if (prog > 0.08 && prog < 0.92) {
        const al = Math.min(1, (prog - 0.08) / 0.2);
        ctx.globalAlpha = al * (prog > 0.75 ? 1 - (prog - 0.75) / 0.17 : 1);
        const ax = bp.x + outS * px * 28, ay = bp.y + outS * py * 28;
        let txt, txt2;
        if (isR) {
          txt = `c${ci}: ${info.db} + ${info.sv} = ${info.res}`;
          txt2 = chunkDone(state.op, state.G, state.C, state.gpus, t.dst, ci) ? tGlobal('canvas.done') : tGlobal('canvas.summing');
        } else {
          txt = `c${ci}: ${info.db} \u21D2 ${info.sv}`;
          txt2 = tGlobal('canvas.replace');
        }
        ctx.font = 'bold 10px monospace'; const tw1 = ctx.measureText(txt).width;
        ctx.font = '9px sans-serif'; const tw2 = ctx.measureText(txt2).width;
        const bw = Math.max(tw1, tw2) + 14, bh = 30;
        ctx.fillStyle = 'rgba(0,0,0,.9)'; ctx.beginPath(); ctx.roundRect(ax - bw / 2, ay - bh / 2, bw, bh, 5); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.font = 'bold 10px monospace'; ctx.fillStyle = isR ? '#f59e0b' : '#22c55e';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, ax, ay - 6);
        ctx.font = '9px sans-serif'; ctx.fillStyle = '#aaa'; ctx.fillText(txt2, ax, ay + 8); ctx.globalAlpha = 1;
      }
      ctx.restore();
    } else {
      let ep = prog;
      if (st.t.length > 1 && (layoutType(alg, op) === 'star')) {
        const n = st.t.length;
        const stag = Math.min(0.15, 0.6 / Math.max(n - 1, 1));
        const travel = 1 - (n - 1) * stag;
        ep = Math.max(0, Math.min(1, (prog - ti * stag) / travel));
      }

      const src = gpus[t.src], dst = gpus[t.dst];
      const ddx = dst.x - src.x, ddy = dst.y - src.y;
      const dlen = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
      const nx = ddx / dlen, ny = ddy / dlen;
      const ppx = -ny, ppy = nx;
      const margin = 46;
      const sx = src.x + nx * margin, sy = src.y + ny * margin;
      const ex = dst.x - nx * margin, ey = dst.y - ny * margin;

      ctx.save();
      const bandW = Math.max(C * 10, 24);
      ctx.strokeStyle = isR ? 'rgba(245,158,11,.1)' : 'rgba(34,197,94,.1)';
      ctx.lineWidth = bandW; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();

      ctx.strokeStyle = isR ? 'rgba(245,158,11,.25)' : 'rgba(34,197,94,.25)';
      ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();

      ctx.fillStyle = isR ? 'rgba(245,158,11,.5)' : 'rgba(34,197,94,.5)';
      ctx.beginPath(); ctx.moveTo(ex, ey);
      ctx.lineTo(ex - nx * 13 - ny * 9, ey - ny * 13 + nx * 9);
      ctx.lineTo(ex - nx * 13 + ny * 9, ey - ny * 13 - nx * 9);
      ctx.closePath(); ctx.fill();

      if (ep > 0) {
        for (let ci = 0; ci < C; ci++) {
          const col = CC[ci % CC.length];
          const sc2 = cellGeo(gpus, C, t.src, ci);
          ctx.strokeStyle = col; ctx.globalAlpha = 0.25; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.roundRect(sc2.x - 1, sc2.y - 1, sc2.w + 2, sc2.h + 2, 3); ctx.stroke(); ctx.globalAlpha = 1;
        }
        for (let ci = 0; ci < C; ci++) {
          const col = CC[ci % CC.length];
          const dc2 = cellGeo(gpus, C, t.dst, ci);
          ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 4 + 6 * ep;
          ctx.strokeStyle = col; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.roundRect(dc2.x - 1, dc2.y - 1, dc2.w + 2, dc2.h + 2, 3); ctx.stroke(); ctx.restore();
        }
      }
      if (ep > 0.75) {
        const pulse = (ep - 0.75) / 0.25;
        for (let ci = 0; ci < C; ci++) {
          const col2 = CC[ci % CC.length]; const dc2 = cellGeo(gpus, C, t.dst, ci);
          ctx.save(); ctx.globalAlpha = pulse * 0.4; ctx.fillStyle = col2;
          ctx.beginPath(); ctx.roundRect(dc2.x, dc2.y, dc2.w, dc2.h, 3); ctx.fill(); ctx.restore();
        }
      }
      if (ep > 0) {
        const maxR = C <= 4 ? 10 : C <= 6 ? 8 : 6;
        const blobR = ep > 0.8 ? maxR * (1 - (ep - 0.8) / 0.2 * 0.7) : maxR;
        const spacing = maxR * 2.3;
        for (let ci = 0; ci < C; ci++) {
          const col = CC[ci % CC.length];
          const offset = (ci - (C - 1) / 2) * spacing;
          const bx = sx + (ex - sx) * ep + ppx * offset;
          const by = sy + (ey - sy) * ep + ppy * offset;
          ctx.shadowColor = col; ctx.shadowBlur = 10 + ep * 6; ctx.fillStyle = col;
          ctx.beginPath(); ctx.arc(bx, by, blobR, 0, Math.PI * 2); ctx.fill();
          blobPos.push({ x: bx, y: by, col }); ctx.shadowBlur = 0;
          ctx.globalAlpha = ep > 0.9 ? 1 - (ep - 0.9) / 0.1 : 1;
          ctx.fillStyle = '#000'; ctx.font = `bold ${blobR > 7 ? 9 : 7}px monospace`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(info.sv[ci], bx, by); ctx.globalAlpha = 1;
        }
      }
      if (ep > 0.1 && ep < 0.9) {
        const al = Math.min(1, (ep - 0.1) / 0.2) * (ep > 0.75 ? 1 - (ep - 0.75) / 0.15 : 1);
        ctx.globalAlpha = al;
        const bcx = sx + (ex - sx) * ep, bcy = sy + (ey - sy) * ep;
        const amx = bcx + ppx * (bandW / 2 + 16), amy = bcy + ppy * (bandW / 2 + 16);
        let txt, txt2;
        const sn = Math.min(C, 3);
        if (isR) {
          txt = `[${info.db.slice(0, sn).join(',')}${C > sn ? '..' : ''}] + [${info.sv.slice(0, sn).join(',')}${C > sn ? '..' : ''}]`;
          txt2 = `= [${info.res.slice(0, sn).join(',')}${C > sn ? '..' : ''}]`;
        } else {
          txt = `\u21D2 [${info.sv.slice(0, sn).join(',')}${C > sn ? '..' : ''}]`;
          txt2 = tGlobal('canvas.fullReplace');
        }
        ctx.font = 'bold 10px monospace'; const tw1 = ctx.measureText(txt).width;
        const tw2 = ctx.measureText(txt2).width; const bw = Math.max(tw1, tw2) + 14;
        ctx.fillStyle = 'rgba(0,0,0,.88)'; ctx.beginPath(); ctx.roundRect(amx - bw / 2, amy - 15, bw, 30, 5); ctx.fill();
        ctx.strokeStyle = isR ? '#f59e0b' : '#22c55e'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = isR ? '#f59e0b' : '#22c55e'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(txt, amx, amy - 5); ctx.font = '9px sans-serif'; ctx.fillStyle = '#bbb';
        ctx.fillText(txt2, amx, amy + 8); ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
  }
}

function drawFlash(ctx, flashFx, gpus, C) {
  const now = performance.now();
  let i = flashFx.length;
  while (i--) { if (now - flashFx[i].t0 >= FLASH_DUR) flashFx.splice(i, 1); }
  for (const f of flashFx) {
    const t = (now - f.t0) / FLASH_DUR;
    const cg = cellGeo(gpus, C, f.gi, f.ci);
    const cx = cg.x + cg.w / 2, cy = cg.y + cg.h / 2;
    ctx.save();
    const ringR = cg.w * 0.55 + t * 22;
    ctx.strokeStyle = f.col; ctx.globalAlpha = Math.pow(1 - t, 0.6) * 0.75; ctx.lineWidth = 3 * (1 - t);
    ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, Math.PI * 2); ctx.stroke();
    if (t > 0.08) {
      const t2 = (t - 0.08) / 0.92; const r2 = cg.w * 0.55 + t2 * 30;
      ctx.globalAlpha = Math.pow(1 - t2, 0.6) * 0.35; ctx.lineWidth = 2 * (1 - t2);
      ctx.beginPath(); ctx.arc(cx, cy, r2, 0, Math.PI * 2); ctx.stroke();
    }
    if (t < 0.3) {
      ctx.globalAlpha = (1 - t / 0.3) * 0.55; ctx.fillStyle = f.col;
      ctx.beginPath(); ctx.roundRect(cg.x - 2, cg.y - 2, cg.w + 4, cg.h + 4, 4); ctx.fill();
    }
    if (t < 0.7) {
      const fade = t < 0.35 ? 1 : 1 - (t - 0.35) / 0.35;
      ctx.globalAlpha = fade;
      const label = f.isR ? `+${f.sv} \u21D2 ${f.nv}` : `\u21D2 ${f.nv}`;
      ctx.font = 'bold 11px monospace'; const lw = ctx.measureText(label).width + 12;
      const ly = cy - cg.h / 2 - 8 - t * 35;
      ctx.fillStyle = 'rgba(0,0,0,.88)'; ctx.beginPath(); ctx.roundRect(cx - lw / 2, ly - 10, lw, 20, 10); ctx.fill();
      ctx.strokeStyle = f.col; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = f.isR ? '#f59e0b' : '#22c55e'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, cx, ly);
    }
    ctx.restore();
  }
}

function drawMinimap(ctx, W, H, gpus, G, C, alg, op, zoom, panX, panY, blobPos) {
  if (G < 2) return;
  let sMinX = Infinity, sMinY = Infinity, sMaxX = -Infinity, sMaxY = -Infinity;
  for (const g of gpus) {
    const geo = cellGeo(gpus, C, g.gi, 0);
    sMinX = Math.min(sMinX, geo.rx); sMinY = Math.min(sMinY, geo.ry);
    sMaxX = Math.max(sMaxX, geo.rx + geo.cardW); sMaxY = Math.max(sMaxY, geo.ry + geo.cardH);
  }
  const pad = 50;
  sMinX -= pad; sMinY -= pad; sMaxX += pad; sMaxY += pad;
  const scW = sMaxX - sMinX, scH = sMaxY - sMinY;
  if (scW <= 0 || scH <= 0) return;
  const mobile = W < 768;
  const mmW = mobile ? 150 : 195, mmH = mobile ? 110 : 143, mmX = 8, mmY = H - mmH - 8;
  const sc = Math.min(mmW / scW, mmH / scH);
  const ox = mmX + (mmW - scW * sc) / 2, oy = mmY + (mmH - scH * sc) / 2;

  ctx.save();
  ctx.fillStyle = 'rgba(10,10,30,.82)'; ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(mmX - 2, mmY - 2, mmW + 4, mmH + 4, 6); ctx.fill(); ctx.stroke();

  function mp(wx, wy) { return { x: ox + (wx - sMinX) * sc, y: oy + (wy - sMinY) * sc }; }
  ctx.beginPath(); ctx.rect(mmX - 2, mmY - 2, mmW + 4, mmH + 4); ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.lineWidth = 0.5;
  const et = edgeType(alg, op);
  if (et === 'ring') {
    for (let i = 0; i < G; i++) {
      const j = (i + 1) % G;
      const a = mp(gpus[i].x, gpus[i].y), b = mp(gpus[j].x, gpus[j].y);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  } else if (et === 'star') {
    for (let i = 1; i < G; i++) {
      const a = mp(gpus[0].x, gpus[0].y), b = mp(gpus[i].x, gpus[i].y);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  } else {
    const { ch } = treeCh(G);
    for (let i = 0; i < G; i++) {
      for (const c of ch[i]) {
        const a = mp(gpus[i].x, gpus[i].y), b = mp(gpus[c].x, gpus[c].y);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
  }
  for (const g of gpus) {
    const p = mp(g.x, g.y);
    ctx.fillStyle = gpuDone(op, G, C, gpus, g.gi) ? '#ffd700' : '#4488ff';
    ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  for (const b of blobPos) {
    const p = mp(b.x, b.y);
    ctx.fillStyle = b.col; ctx.globalAlpha = 0.9;
    ctx.shadowColor = b.col; ctx.shadowBlur = 4;
    ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  }
  const vpL = -panX / zoom, vpT = -panY / zoom, vpR = (W - panX) / zoom, vpB = (H - panY) / zoom;
  const tl = mp(vpL, vpT), br = mp(vpR, vpB);
  ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 2]);
  ctx.beginPath(); ctx.rect(tl.x, tl.y, br.x - tl.x, br.y - tl.y); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(`${zoom * 100 < 1 ? (zoom * 100).toFixed(2) : Math.round(zoom * 100)}%`, mmX + 2, mmY);
  ctx.restore();
}
