export function treeCh(G) {
  const ch = {};
  const par = {};
  for (let i = 0; i < G; i++) ch[i] = [];
  for (let i = 0; i < G; i++) {
    const l = 2 * i + 1;
    const r = 2 * i + 2;
    if (l < G) { ch[i].push(l); par[l] = i; }
    if (r < G) { ch[i].push(r); par[r] = i; }
  }
  return { ch, par };
}

export function treeLvls(G) {
  const { ch } = treeCh(G);
  const lvs = [];
  let q = [0];
  const v = new Set([0]);
  while (q.length) {
    lvs.push([...q]);
    const nx = [];
    for (const n of q) {
      for (const c of ch[n]) {
        if (!v.has(c)) { v.add(c); nx.push(c); }
      }
    }
    q = nx;
  }
  return lvs;
}
