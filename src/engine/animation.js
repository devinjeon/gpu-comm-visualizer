import { CC } from './constants.js';

export function snap(gpus, steps, C, si) {
  if (si < 0 || si >= steps.length) return [];
  return steps[si].t.map((t) => {
    if (t.ci_src !== undefined) {
      const sv = gpus[t.src].data[t.ci_src];
      const db = gpus[t.dst].data[t.ci_dst];
      return { ...t, sv, db, res: sv };
    } else if (t.ci >= 0) {
      const sv = gpus[t.src].data[t.ci];
      const db = gpus[t.dst].data[t.ci];
      return { ...t, sv, db, res: t.op === 'reduce' ? db + sv : sv };
    } else {
      const sv = gpus[t.src].data.slice();
      const db = gpus[t.dst].data.slice();
      return { ...t, sv, db, res: t.op === 'reduce' ? sv.map((v, i) => v + db[i]) : sv.slice() };
    }
  });
}

export function apply(gpus, steps, snapInfo, C, si) {
  if (si < 0 || si >= steps.length) return;
  for (let i = 0; i < steps[si].t.length; i++) {
    const t = steps[si].t[i];
    if (t.ci_src !== undefined) {
      gpus[t.dst].data[t.ci_dst] = snapInfo[i].sv;
    } else if (t.op === 'reduce') {
      if (t.ci >= 0) gpus[t.dst].data[t.ci] += gpus[t.src].data[t.ci];
      else for (let j = 0; j < C; j++) gpus[t.dst].data[j] += gpus[t.src].data[j];
    } else {
      if (t.ci >= 0) gpus[t.dst].data[t.ci] = gpus[t.src].data[t.ci];
      else gpus[t.dst].data = gpus[t.src].data.slice();
    }
  }
}

export function addFlash(flashFx, steps, snapInfo, C, si) {
  if (si < 0 || si >= steps.length || !snapInfo.length) return;
  const now = performance.now();
  for (let i = 0; i < steps[si].t.length; i++) {
    const t = steps[si].t[i];
    const inf = snapInfo[i];
    if (t.ci_src !== undefined) {
      flashFx.push({
        gi: t.dst, ci: t.ci_dst, col: CC[t.ci_src % CC.length], t0: now,
        isR: false, sv: inf.sv, ov: inf.db, nv: inf.res,
      });
    } else if (t.ci >= 0) {
      flashFx.push({
        gi: t.dst, ci: t.ci, col: CC[t.ci % CC.length], t0: now,
        isR: t.op === 'reduce', sv: inf.sv, ov: inf.db, nv: inf.res,
      });
    } else {
      for (let ci = 0; ci < C; ci++) {
        flashFx.push({
          gi: t.dst, ci, col: CC[ci % CC.length], t0: now,
          isR: t.op === 'reduce', sv: inf.sv[ci], ov: inf.db[ci], nv: inf.res[ci],
        });
      }
    }
  }
}
