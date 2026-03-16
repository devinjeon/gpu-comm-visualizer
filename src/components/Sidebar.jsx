import React, { useEffect, useRef } from 'react';
import { CC } from '../engine/constants';
import { OP_CFG } from '../engine/constants';
import { chunkDone } from '../engine/dataModel';
import { opDesc } from '../engine/opDesc';
import { useLang } from '../i18n';
import { trackEvent } from '../analytics';

function renderXfers(snapArr, sn, op, G, C, gpus, t) {
  const show = Math.min(snapArr.length, 6);
  const parts = [];
  for (let i = 0; i < show; i++) {
    const inf = snapArr[i];
    const isR = inf.op === 'reduce';
    if (inf.ci_src !== undefined) {
      const col = CC[inf.ci_src % CC.length];
      parts.push(
        <div key={i} className="se-xf" dangerouslySetInnerHTML={{
          __html: `GPU${inf.src}[c${inf.ci_src}]\u2192GPU${inf.dst}[c${inf.ci_dst}]: <span style="color:${col}">${inf.sv}</span> <span class="gc">\u21D2</span>`,
        }} />
      );
    } else if (inf.ci >= 0) {
      const c = `<span style="color:${CC[inf.ci % CC.length]}">c${inf.ci}</span>`;
      if (isR) {
        const done = chunkDone(op, G, C, gpus, inf.dst, inf.ci);
        parts.push(
          <div key={i} className="se-xf" dangerouslySetInnerHTML={{
            __html: `GPU${inf.src}\u2192GPU${inf.dst} ${c}: <span style="color:#fff">${inf.db}</span> <span class="rc">+${inf.sv}</span> = <b style="color:#f59e0b">${inf.res}</b>${done ? ' <span style="color:#ffd700">\u2605</span>' : ''}`,
          }} />
        );
      } else {
        parts.push(
          <div key={i} className="se-xf" dangerouslySetInnerHTML={{
            __html: `GPU${inf.src}\u2192GPU${inf.dst} ${c}: <span style="color:#888">${inf.db}</span> <span class="gc">\u21D2 ${inf.sv}</span>`,
          }} />
        );
      }
    } else {
      if (isR) {
        parts.push(
          <div key={i} className="se-xf" dangerouslySetInnerHTML={{
            __html: `GPU${inf.src}\u2192GPU${inf.dst}: [${inf.db.slice(0, sn).join(',')}] <span class="rc">+[${inf.sv.slice(0, sn).join(',')}]</span> = <b style="color:#f59e0b">[${inf.res.slice(0, sn).join(',')}]</b>`,
          }} />
        );
      } else {
        parts.push(
          <div key={i} className="se-xf" dangerouslySetInnerHTML={{
            __html: `GPU${inf.src}\u2192GPU${inf.dst}: <span style="color:#888">[${inf.db.slice(0, sn).join(',')}]</span> <span class="gc">\u21D2 [${inf.sv.slice(0, sn).join(',')}]</span>`,
          }} />
        );
      }
    }
  }
  if (snapArr.length > show) {
    parts.push(<div key="more" className="se-xf" style={{ color: '#555' }}>{t('moreItems', { n: snapArr.length - show })}</div>);
  }
  return parts;
}

function PhaseDesc({ op, alg, curStep, phase, steps, G }) {
  const { t } = useLang();
  const cp = curStep >= 0 && curStep < steps.length ? steps[curStep].ph : '';
  let items = [];

  switch (op) {
    case 'allreduce':
      if (alg === 'ring') {
        const inR = curStep >= 0 && curStep < G - 1;
        const inG = curStep >= G - 1 && curStep < steps.length;
        items.push(
          <div key="sr" className={`pi rp ${inR ? 'on' : ''}`}>
            <div className="pt" style={{ fontSize: '11px' }}><span className="rc">{t('phase.scatterReduce')}</span></div>
            <div className="pd" style={{ fontSize: '10px' }}>{t('phase.scatterReduceDesc', { n: G - 1 })}</div>
          </div>
        );
        items.push(
          <div key="ag" className={`pi gp ${inG ? 'on' : ''}`}>
            <div className="pt" style={{ fontSize: '11px' }}><span className="gc">{t('phase.allGather')}</span></div>
            <div className="pd" style={{ fontSize: '10px' }}>{t('phase.allGatherDesc', { n: G - 1 })}</div>
          </div>
        );
      } else if (alg === 'naive') {
        items.push(
          <div key="r" className={`pi rp ${cp.includes('Reduce') ? 'on' : ''}`}>
            <div className="pt" style={{ fontSize: '11px' }}><span className="rc">{t('phase.reduceToGpu0')}</span></div>
            <div className="pd" style={{ fontSize: '10px' }}>{t('phase.reduceToGpu0Desc')}</div>
          </div>
        );
        items.push(
          <div key="b" className={`pi gp ${cp.includes('Broadcast') ? 'on' : ''}`}>
            <div className="pt" style={{ fontSize: '11px' }}><span className="gc">{t('phase.broadcastFromGpu0')}</span></div>
            <div className="pd" style={{ fontSize: '10px' }}>{t('phase.broadcastFromGpu0Desc')}</div>
          </div>
        );
      } else {
        items.push(
          <div key="r" className={`pi rp ${cp.includes('Reduce') ? 'on' : ''}`}>
            <div className="pt" style={{ fontSize: '11px' }}><span className="rc">{t('phase.reduceBottomUp')}</span></div>
            <div className="pd" style={{ fontSize: '10px' }}>{t('phase.reduceBottomUpDesc')}</div>
          </div>
        );
        items.push(
          <div key="b" className={`pi gp ${cp.includes('Broadcast') ? 'on' : ''}`}>
            <div className="pt" style={{ fontSize: '11px' }}><span className="gc">{t('phase.broadcastTopDown')}</span></div>
            <div className="pd" style={{ fontSize: '10px' }}>{t('phase.broadcastTopDownDesc')}</div>
          </div>
        );
      }
      break;
    case 'broadcast':
      if (alg === 'tree') {
        items.push(
          <div key="b" className={`pi gp ${phase !== 'idle' ? 'on' : ''}`}>
            <div className="pt" style={{ fontSize: '11px' }}><span className="gc">{t('phase.broadcastTree')}</span></div>
            <div className="pd" style={{ fontSize: '10px' }}>{t('phase.broadcastTreeDesc', { n: steps.length })}</div>
          </div>
        );
      } else {
        items.push(
          <div key="b" className={`pi gp ${phase !== 'idle' ? 'on' : ''}`}>
            <div className="pt" style={{ fontSize: '11px' }}><span className="gc">{t('phase.broadcastNaive')}</span></div>
            <div className="pd" style={{ fontSize: '10px' }}>{t('phase.broadcastNaiveDesc')}</div>
          </div>
        );
      }
      break;
    case 'reduce':
      if (alg === 'tree') {
        items.push(
          <div key="r" className={`pi rp ${phase !== 'idle' ? 'on' : ''}`}>
            <div className="pt" style={{ fontSize: '11px' }}><span className="rc">{t('phase.reduceTree')}</span></div>
            <div className="pd" style={{ fontSize: '10px' }}>{t('phase.reduceTreeDesc', { n: steps.length })}</div>
          </div>
        );
      } else {
        items.push(
          <div key="r" className={`pi rp ${phase !== 'idle' ? 'on' : ''}`}>
            <div className="pt" style={{ fontSize: '11px' }}><span className="rc">{t('phase.reduceNaive')}</span></div>
            <div className="pd" style={{ fontSize: '10px' }}>{t('phase.reduceNaiveDesc')}</div>
          </div>
        );
      }
      break;
    case 'allgather':
      items.push(
        <div key="ag" className={`pi gp ${phase !== 'idle' ? 'on' : ''}`}>
          <div className="pt" style={{ fontSize: '11px' }}><span className="gc">Ring AllGather</span></div>
          <div className="pd" style={{ fontSize: '10px' }}>{t('phase.ringAllGatherDesc', { n: G - 1 })}</div>
        </div>
      );
      break;
    case 'reducescatter':
      items.push(
        <div key="rs" className={`pi rp ${phase !== 'idle' ? 'on' : ''}`}>
          <div className="pt" style={{ fontSize: '11px' }}><span className="rc">Ring Reduce-Scatter</span></div>
          <div className="pd" style={{ fontSize: '10px' }}>{t('phase.ringReduceScatterDesc', { n: G - 1 })}</div>
        </div>
      );
      break;
    case 'alltoall':
      items.push(
        <div key="a2a" className={`pi gp ${phase !== 'idle' ? 'on' : ''}`}>
          <div className="pt" style={{ fontSize: '11px' }}><span className="gc">AllToAll Exchange</span></div>
          <div className="pd" style={{ fontSize: '10px' }}>{t('phase.allToAllDesc')}</div>
        </div>
      );
      break;
    case 'gather':
      items.push(
        <div key="g" className={`pi gp ${phase !== 'idle' ? 'on' : ''}`}>
          <div className="pt" style={{ fontSize: '11px' }}><span className="gc">{t('phase.gatherTitle')}</span></div>
          <div className="pd" style={{ fontSize: '10px' }}>{t('phase.gatherDesc')}</div>
        </div>
      );
      break;
    case 'scatter':
      items.push(
        <div key="s" className={`pi gp ${phase !== 'idle' ? 'on' : ''}`}>
          <div className="pt" style={{ fontSize: '11px' }}><span className="gc">{t('phase.scatterTitle')}</span></div>
          <div className="pd" style={{ fontSize: '10px' }}>{t('phase.scatterDesc')}</div>
        </div>
      );
      break;
  }
  return <>{items}</>;
}

export default function Sidebar({ stateRef, onShowGoal, expanded, onToggle }) {
  const { t } = useLang();
  const state = stateRef.current;

  if (!state) return null;
  const { op, alg, G, C, gpus, steps, curStep, phase, snapInfo, stepLog } = state;
  const sn = Math.min(C, 5);
  const d = opDesc(op, G, C);
  const dStep = phase === 'done' ? steps.length : (curStep >= 0 ? curStep + 1 : 0);

  return (
    <div
      className={`sb${expanded ? ' sb-expanded' : ''}`}
      onTransitionEnd={() => window.dispatchEvent(new Event('resize'))}
    >
      <button className="sb-toggle" onClick={onToggle}>
        {expanded ? t('hideDetails') : t('showDetails')}
      </button>
      <div className="sb-hd">
        <h3>{t('visualization', { title: d.title })}</h3>
        <div className="bx">
          <h4 style={{ color: '#e94560' }}>{d.title}</h4>
          <p>{d.desc}</p>
          <p style={{ color: '#5599dd', fontSize: '10px', marginTop: '4px' }}>&#128218; {d.usecase}</p>
        </div>
        <div className="bx">
          <h4>{t('goal')}</h4>
          <p>{t('gpuChunkCount', { G, C })}<br />{d.goal}</p>
          <div className="fm ctr" style={{ border: '1px solid #22c55e' }}>{d.detail}</div>
          <div style={{ textAlign: 'right', marginTop: '2px' }}>
            <a className="ml" onClick={onShowGoal}>{t('more')}</a>
          </div>
        </div>
        <PhaseDesc op={op} alg={alg} curStep={curStep} phase={phase} steps={steps} G={G} />
        <div className="sb-step">
          <div className="sl">{t('progress')}</div>
          <div className="sv">{t('stepProgress', { current: dStep > 0 ? dStep : '\u2013', total: steps.length })}</div>
        </div>
      </div>
      <div className="sb-log">
        <SidebarLog
          stepLog={stepLog} steps={steps} curStep={curStep} phase={phase}
          snapInfo={snapInfo} sn={sn} d={d} op={op} G={G} C={C} gpus={gpus}
        />
      </div>
    </div>
  );
}

function SidebarLog({ stepLog, steps, curStep, phase, snapInfo, sn, d, op, G, C, gpus }) {
  const { t } = useLang();
  const logRef = useRef(null);

  useEffect(() => {
    if (!logRef.current) return;
    const scrollTarget = logRef.current.querySelector('#doneBox')
      || logRef.current.querySelector('#stepCur')
      || (stepLog.length > 0 ? logRef.current.querySelector('#step' + (stepLog.length - 1)) : null);
    if (scrollTarget) scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  const parts = [];
  let prevPh = '';

  for (let i = 0; i < stepLog.length; i++) {
    const entry = stepLog[i];
    const st = entry.step;
    const isR = st.t[0]?.op === 'reduce';
    const isLast = (i === stepLog.length - 1) && (phase === 'paused' || phase === 'done');
    if (st.ph !== prevPh) {
      if (prevPh !== '') parts.push(<div key={`sep-${i}`} className="ph-sep">{t('phaseStart', { phase: st.ph })}</div>);
      prevPh = st.ph;
    }
    parts.push(
      <div key={`step-${i}`} id={`step${i}`} className={`se ${isR ? 'se-r' : 'se-g'} ${isLast ? 'se-last' : ''}`}>
        <div className="se-hd">
          <span className={isR ? 'rc' : 'gc'}>{t('stepLabel', { n: entry.si + 1 })} {st.ph} {st.si}/{st.tot}</span>
        </div>
        <div className="se-bd">{t('xferDone', { n: st.t.length })}</div>
        {renderXfers(entry.snap, sn, op, G, C, gpus, t)}
      </div>
    );
  }

  const isActive = curStep >= 0 && curStep < steps.length && snapInfo.length && (phase === 'running' || phase === 'stepping' || phase === 'paused');
  const alreadyLogged = stepLog.some((e) => e.si === curStep);
  if (isActive && !alreadyLogged) {
    const st = steps[curStep];
    const isR = st.t[0]?.op === 'reduce';
    if (st.ph !== prevPh && prevPh !== '') parts.push(<div key="sep-cur" className="ph-sep">{t('phaseStart', { phase: st.ph })}</div>);
    parts.push(
      <div key="stepCur" id="stepCur" className={`se ${isR ? 'se-r' : 'se-g'} se-cur`}>
        <div className="se-hd">
          <span className={isR ? 'rc' : 'gc'}>&#9654; {t('stepLabel', { n: curStep + 1 })} {st.ph} {st.si}/{st.tot}</span>
        </div>
        <div className="se-bd">{phase === 'paused' ? t('xferWaiting', { n: st.t.length }) : t('xferProgress', { n: st.t.length })}:</div>
        {renderXfers(snapInfo, sn, op, G, C, gpus, t)}
      </div>
    );
  }

  if (phase === 'done') {
    parts.push(
      <div key="done" id="doneBox" className="db">
        <div className="dt">{t('complete', { title: d.title })}</div>
        <div className="dd">{d.detail}</div>
      </div>
    );
  }
  if (phase === 'idle' && stepLog.length === 0) {
    parts.push(
      <div key="idle" className="bx" style={{ textAlign: 'center', marginTop: '10px' }}>
        <p style={{ color: '#aaa' }}>{t('idleMsg')}</p>
      </div>
    );
  }

  return <div ref={logRef}>{parts}</div>;
}
