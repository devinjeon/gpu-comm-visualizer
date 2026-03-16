export function mkData(op, G, C, i) {
  switch (op) {
    case 'broadcast': return i === 0 ? Array.from({ length: C }, (_, ci) => ci + 1) : new Array(C).fill(0);
    case 'reduce': return new Array(C).fill(i + 1);
    case 'allgather': { const d = new Array(C).fill(0); d[i] = i + 1; return d; }
    case 'reducescatter': return new Array(C).fill(i + 1);
    case 'alltoall': return Array.from({ length: C }, (_, ci) => i * G + ci + 1);
    case 'gather': { const d = new Array(C).fill(0); d[i] = i + 1; return d; }
    case 'scatter': return i === 0 ? Array.from({ length: C }, (_, ci) => ci + 1) : new Array(C).fill(0);
    default: return new Array(C).fill(i + 1);
  }
}

export function getTarget(op, G, C, gi, ci) {
  const S = G * (G + 1) / 2;
  switch (op) {
    case 'broadcast': return ci + 1;
    case 'reduce': return gi === 0 ? S : mkData(op, G, C, gi)[ci];
    case 'allgather': return ci + 1;
    case 'reducescatter': return ci === ((gi + 1) % G) ? S : mkData(op, G, C, gi)[ci];
    case 'alltoall': return ci * G + gi + 1;
    case 'gather': return gi === 0 ? ci + 1 : mkData(op, G, C, gi)[ci];
    case 'scatter': return ci === gi ? gi + 1 : mkData(op, G, C, gi)[ci];
    default: return S;
  }
}

export function noTarget(op, gi) {
  return (op === 'reduce' || op === 'gather') && gi !== 0;
}

export function ownedChunk(op, gi, G) {
  return op === 'reducescatter' ? (gi + 1) % G : -1;
}

export function gpuDone(op, G, C, gpus, gi) {
  if (noTarget(op, gi)) return false;
  const oc = ownedChunk(op, gi, G);
  if (oc >= 0) return gpus[gi].data[oc] === getTarget(op, G, C, gi, oc);
  return gpus[gi].data.every((v, ci) => v === getTarget(op, G, C, gi, ci));
}

export function chunkDone(op, G, C, gpus, gi, ci) {
  if (noTarget(op, gi)) return false;
  const oc = ownedChunk(op, gi, G);
  if (oc >= 0 && ci !== oc) return false;
  return gpus[gi].data[ci] === getTarget(op, G, C, gi, ci);
}

export function gpuPartial(op, G, C, gpus, gi) {
  if (noTarget(op, gi)) return gpus[gi].data.some((v, ci) => v !== mkData(op, G, C, gi)[ci]);
  if (gpuDone(op, G, C, gpus, gi)) return false;
  const oc = ownedChunk(op, gi, G);
  if (oc >= 0) return gpus[gi].data[oc] !== mkData(op, G, C, gi)[oc];
  return gpus[gi].data.some((v, ci) => v !== mkData(op, G, C, gi)[ci]);
}
