import { treeCh, treeLvls } from './treeHelpers.js';

export function genSteps(op, alg, G) {
  switch (op) {
    case 'allreduce':
      return alg === 'ring' ? ringAllReduceSteps(G) : alg === 'naive' ? naiveAllReduceSteps(G) : treeAllReduceSteps(G);
    case 'broadcast':
      return alg === 'tree' ? broadcastTreeSteps(G) : broadcastNaiveSteps(G);
    case 'reduce':
      return alg === 'tree' ? reduceTreeSteps(G) : reduceNaiveSteps(G);
    case 'allgather': return allgatherRingSteps(G);
    case 'reducescatter': return reduceScatterRingSteps(G);
    case 'alltoall': return alltoallSteps(G);
    case 'gather': return gatherNaiveSteps(G);
    case 'scatter': return scatterNaiveSteps(G);
    default: return [];
  }
}

function ringAllReduceSteps(G) {
  const o = [];
  for (let s = 0; s < G - 1; s++) {
    const t = [];
    for (let g = 0; g < G; g++) {
      const ci = ((g - s) % G + G) % G;
      t.push({ src: g, dst: (g + 1) % G, ci, op: 'reduce' });
    }
    o.push({ ph: 'Scatter-Reduce', si: s + 1, tot: G - 1, t });
  }
  for (let s = 0; s < G - 1; s++) {
    const t = [];
    for (let g = 0; g < G; g++) {
      const ci = ((g + 1 - s) % G + G) % G;
      t.push({ src: g, dst: (g + 1) % G, ci, op: 'gather' });
    }
    o.push({ ph: 'AllGather', si: s + 1, tot: G - 1, t });
  }
  return o;
}

function treeAllReduceSteps(G) {
  const { ch, par } = treeCh(G);
  const lvs = treeLvls(G);
  const o = [];
  for (let l = lvs.length - 1; l >= 1; l--) {
    const t = [];
    for (const nd of lvs[l]) t.push({ src: nd, dst: par[nd], ci: -1, op: 'reduce' });
    o.push({ ph: 'Reduce (Bottom-Up)', si: lvs.length - l, tot: lvs.length - 1, t });
  }
  for (let l = 0; l < lvs.length - 1; l++) {
    const t = [];
    for (const nd of lvs[l]) {
      for (const c of ch[nd]) t.push({ src: nd, dst: c, ci: -1, op: 'gather' });
    }
    o.push({ ph: 'Broadcast (Top-Down)', si: l + 1, tot: lvs.length - 1, t });
  }
  return o;
}

function naiveAllReduceSteps(G) {
  const o = [];
  const rt = [];
  for (let i = 1; i < G; i++) rt.push({ src: i, dst: 0, ci: -1, op: 'reduce' });
  o.push({ ph: 'Reduce (\u2192 GPU 0)', si: 1, tot: 1, t: rt });
  const bt = [];
  for (let i = 1; i < G; i++) bt.push({ src: 0, dst: i, ci: -1, op: 'gather' });
  o.push({ ph: 'Broadcast (GPU 0 \u2192)', si: 1, tot: 1, t: bt });
  return o;
}

function broadcastNaiveSteps(G) {
  const t = [];
  for (let i = 1; i < G; i++) t.push({ src: 0, dst: i, ci: -1, op: 'gather' });
  return [{ ph: 'Broadcast (GPU 0 \u2192 All)', si: 1, tot: 1, t }];
}

function broadcastTreeSteps(G) {
  const { ch } = treeCh(G);
  const lvs = treeLvls(G);
  const o = [];
  for (let l = 0; l < lvs.length - 1; l++) {
    const t = [];
    for (const nd of lvs[l]) {
      for (const c of ch[nd]) t.push({ src: nd, dst: c, ci: -1, op: 'gather' });
    }
    o.push({ ph: 'Broadcast (Top\u2192Down)', si: l + 1, tot: lvs.length - 1, t });
  }
  return o;
}

function reduceNaiveSteps(G) {
  const t = [];
  for (let i = 1; i < G; i++) t.push({ src: i, dst: 0, ci: -1, op: 'reduce' });
  return [{ ph: 'Reduce (All \u2192 GPU 0)', si: 1, tot: 1, t }];
}

function reduceTreeSteps(G) {
  const { ch, par } = treeCh(G);
  const lvs = treeLvls(G);
  const o = [];
  for (let l = lvs.length - 1; l >= 1; l--) {
    const t = [];
    for (const nd of lvs[l]) t.push({ src: nd, dst: par[nd], ci: -1, op: 'reduce' });
    o.push({ ph: 'Reduce (Bottom\u2192Up)', si: lvs.length - l, tot: lvs.length - 1, t });
  }
  return o;
}

function allgatherRingSteps(G) {
  const o = [];
  for (let s = 0; s < G - 1; s++) {
    const t = [];
    for (let g = 0; g < G; g++) {
      const ci = ((g - s) % G + G) % G;
      t.push({ src: g, dst: (g + 1) % G, ci, op: 'gather' });
    }
    o.push({ ph: 'AllGather', si: s + 1, tot: G - 1, t });
  }
  return o;
}

function reduceScatterRingSteps(G) {
  const o = [];
  for (let s = 0; s < G - 1; s++) {
    const t = [];
    for (let g = 0; g < G; g++) {
      const ci = ((g - s) % G + G) % G;
      t.push({ src: g, dst: (g + 1) % G, ci, op: 'reduce' });
    }
    o.push({ ph: 'Reduce-Scatter', si: s + 1, tot: G - 1, t });
  }
  return o;
}

function alltoallSteps(G) {
  const t = [];
  for (let g = 0; g < G; g++) {
    for (let d = 0; d < G; d++) {
      if (g === d) continue;
      t.push({ src: g, dst: d, ci_src: d, ci_dst: g, op: 'place' });
    }
  }
  return [{ ph: 'AllToAll Exchange', si: 1, tot: 1, t }];
}

function gatherNaiveSteps(G) {
  const t = [];
  for (let i = 1; i < G; i++) t.push({ src: i, dst: 0, ci: i, op: 'gather' });
  return [{ ph: 'Gather (All \u2192 GPU 0)', si: 1, tot: 1, t }];
}

function scatterNaiveSteps(G) {
  const t = [];
  for (let i = 1; i < G; i++) t.push({ src: 0, dst: i, ci: i, op: 'gather' });
  return [{ ph: 'Scatter (GPU 0 \u2192 All)', si: 1, tot: 1, t }];
}
