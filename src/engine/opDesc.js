import { mkData, getTarget, ownedChunk } from './dataModel.js';
import { tGlobal } from '../i18n';

export function opDesc(op, G, C) {
  const t = tGlobal;
  const S = G * (G + 1) / 2;
  const valsShort = Array.from({ length: Math.min(C, 4) }, (_, i) => i + 1).join(',') + (C > 4 ? '..' : '');
  const valsG = Array.from({ length: Math.min(G, 4) }, (_, i) => i + 1).join(',') + (G > 4 ? '..' : '');

  switch (op) {
    case 'allreduce': return {
      title: 'AllReduce',
      desc: t('allreduce.desc'),
      usecase: t('allreduce.usecase'),
      goal: t('allreduce.goal', { S }),
      detail: t('allreduce.detail', { S }),
    };
    case 'broadcast': return {
      title: 'Broadcast',
      desc: t('broadcast.desc'),
      usecase: t('broadcast.usecase'),
      goal: t('broadcast.goal'),
      detail: t('broadcast.detail', { vals: valsShort }),
    };
    case 'reduce': return {
      title: 'Reduce',
      desc: t('reduce.desc'),
      usecase: t('reduce.usecase'),
      goal: t('reduce.goal'),
      detail: t('reduce.detail', { S }),
    };
    case 'allgather': return {
      title: 'AllGather',
      desc: t('allgather.desc'),
      usecase: t('allgather.usecase'),
      goal: t('allgather.goal'),
      detail: t('allgather.detail', { vals: valsG }),
    };
    case 'reducescatter': return {
      title: 'ReduceScatter',
      desc: t('reducescatter.desc', { G }),
      usecase: t('reducescatter.usecase'),
      goal: t('reducescatter.goal'),
      detail: t('reducescatter.detail', { S }),
    };
    case 'alltoall': return {
      title: 'AllToAll',
      desc: t('alltoall.desc'),
      usecase: t('alltoall.usecase'),
      goal: t('alltoall.goal'),
      detail: t('alltoall.detail'),
    };
    case 'gather': return {
      title: 'Gather',
      desc: t('gather.desc'),
      usecase: t('gather.usecase'),
      goal: t('gather.goal'),
      detail: t('gather.detail', { vals: valsG }),
    };
    case 'scatter': return {
      title: 'Scatter',
      desc: t('scatter.desc'),
      usecase: t('scatter.usecase'),
      goal: t('scatter.goal'),
      detail: t('scatter.detail', { detail: G > 3 ? 'i+1' : (tGlobal('scatter.detail.value') || 'i+1') }),
    };
    default: return { title: op, goal: '', desc: '', usecase: '', detail: '' };
  }
}

export function buildGoalModalHTML(op, G, C) {
  const t = tGlobal;
  const d = opDesc(op, G, C);
  let h = '';
  h += `<h3>${t('modal.goalTitle', { title: d.title })}</h3>`;
  h += `<p>${t('modal.gpuHas', { G, C })}</p>`;
  h += `<p>${d.goal}</p>`;
  h += `<p style="color:#aaa;font-size:12px;margin-top:10px;">${t('modal.initialData')}</p>`;
  h += `<div class="gm-chips">`;
  for (let i = 0; i < Math.min(G, 6); i++) {
    const init = mkData(op, G, C, i);
    h += `<span>GPU${i}: [${init.slice(0, 4).join(',')}${C > 4 ? '..' : ''}]</span>`;
  }
  if (G > 6) h += `<span>${t('modal.andMore', { n: G - 6 })}</span>`;
  h += `</div>`;
  h += `<p style="color:#aaa;font-size:12px;margin-top:8px;">${t('modal.targetState')}</p>`;
  h += `<div class="gm-chips">`;
  for (let i = 0; i < Math.min(G, 6); i++) {
    const oc = ownedChunk(op, i, G);
    if (oc >= 0) {
      h += `<span style="border:1px solid #22c55e">GPU${i}: c${oc} = <b>${getTarget(op, G, C, i, oc)}</b> ${t('modal.restIrrelevant')}</span>`;
    } else {
      const tgt = Array.from({ length: C }, (_, ci) => getTarget(op, G, C, i, ci));
      const init = mkData(op, G, C, i);
      const changed = tgt.some((v, ci) => v !== init[ci]);
      const style = changed ? 'border:1px solid #22c55e' : '';
      h += `<span style="${style}">GPU${i}: [${tgt.slice(0, 4).join(',')}${C > 4 ? '..' : ''}]</span>`;
    }
  }
  if (G > 6) h += `<span>${t('modal.andMore', { n: G - 6 })}</span>`;
  h += `</div>`;
  h += `<div class="gm-result">${d.detail}</div>`;
  h += `<div style="margin-top:12px;font-size:12px;color:#bbb;">`;
  h += `<p>${d.desc}</p>`;
  h += `<p style="color:#5599dd;margin-top:6px;">&#128218; <b>${t('modal.usage')}</b> ${d.usecase}</p>`;
  h += `</div>`;
  return h;
}
