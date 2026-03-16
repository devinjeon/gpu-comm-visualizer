export const CC = [
  '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#06b6d4', '#84cc16',
  '#f97316', '#8b5cf6', '#14b8a6', '#e11d48', '#2563eb', '#16a34a', '#d97706', '#7c3aed',
];

export const CN = [
  '빨강', '파랑', '초록', '노랑', '보라', '분홍', '청록', '연두',
  '주황', '남보라', '민트', '진빨강', '진파랑', '진초록', '진노랑', '진보라',
];

export const OP_CFG = {
  allreduce:     { name: 'AllReduce',     algs: ['ring', 'tree', 'naive'], cLock: (a) => a === 'ring', cLockReason: 'chunkLock.ring' },
  broadcast:     { name: 'Broadcast',     algs: ['naive', 'tree'],         cLock: () => false },
  reduce:        { name: 'Reduce',        algs: ['naive', 'tree'],         cLock: () => false },
  allgather:     { name: 'AllGather',     algs: ['ring'],                  cLock: () => true,  cLockReason: 'chunkLock.ring' },
  reducescatter: { name: 'ReduceScatter', algs: ['ring'],                  cLock: () => true,  cLockReason: 'chunkLock.ring' },
  alltoall:      { name: 'AllToAll',      algs: ['naive'],                 cLock: () => true,  cLockReason: 'chunkLock.onePerGpu' },
  gather:        { name: 'Gather',        algs: ['naive'],                 cLock: () => true,  cLockReason: 'chunkLock.onePerGpu' },
  scatter:       { name: 'Scatter',       algs: ['naive'],                 cLock: () => true,  cLockReason: 'chunkLock.onePerGpu' },
};

export const ALG_NAMES = { ring: 'Ring', tree: 'Tree', naive: 'Naive (Direct)' };

// Logarithmic speed constants
export const SPD_MIN = 1 / (40 * 60);
export const SPD_MAX = 1 / (0.2 * 60);
export const SPD_BASE = 0.005;
export const SPD_RATIO = SPD_MAX / SPD_MIN;
export const SPD_DEFAULT = 100 * Math.log(SPD_BASE / SPD_MIN) / Math.log(SPD_RATIO);

export const FLASH_DUR = 800;

export function spdInc(speedPos) {
  return SPD_MIN * Math.pow(SPD_RATIO, speedPos / 100);
}

export function spdPct(speedPos) {
  return Math.round(spdInc(speedPos) / SPD_BASE * 100);
}

export function pctToPos(pct) {
  if (pct <= 0) return 0;
  return Math.max(0, Math.min(100, 100 * Math.log(pct / 100 * SPD_BASE / SPD_MIN) / Math.log(SPD_RATIO)));
}
