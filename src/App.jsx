import React, { useState, useRef, useCallback, useEffect } from 'react';
import Controls from './components/Controls';
import Canvas from './components/Canvas';
import Sidebar from './components/Sidebar';
import GoalModal from './components/GoalModal';
import { OP_CFG, spdInc, spdPct, pctToPos, SPD_DEFAULT } from './engine/constants';
import { mkData } from './engine/dataModel';
import { genSteps } from './engine/stepGenerator';
import { computeLayout, autoFit } from './engine/layout';
import { snap, apply, addFlash } from './engine/animation';
import { opDesc } from './engine/opDesc';
import { useLang } from './i18n';
import { tGlobal } from './i18n';
import { initGA, trackEvent } from './analytics';

function readURL() {
  const p = new URLSearchParams(window.location.search);
  let op = 'allreduce', alg = 'ring', gpu = 5, chunk = 5, speed = SPD_DEFAULT;
  if (p.has('op') && OP_CFG[p.get('op')]) op = p.get('op');
  const cfg = OP_CFG[op];
  if (p.has('alg') && cfg.algs.includes(p.get('alg'))) alg = p.get('alg');
  else alg = cfg.algs[0];
  if (p.has('gpu')) { const g = parseInt(p.get('gpu')); if (g >= 2) gpu = g; }
  if (p.has('chunk')) { const c = parseInt(p.get('chunk')); if (c >= 2) chunk = c; }
  if (p.has('speed')) { const pct = parseInt(p.get('speed')); if (pct > 0 && pct <= 2000) speed = pctToPos(pct); }
  if (cfg.cLock(alg)) chunk = gpu;
  return { op, alg, gpu, chunk, speed };
}

function syncURL(op, alg, G, C, speedPos, lang) {
  const params = new URLSearchParams();
  params.set('op', op); params.set('alg', alg); params.set('gpu', G); params.set('chunk', C); params.set('speed', spdPct(speedPos));
  if (lang) params.set('lang', lang);
  window.history.replaceState(null, '', window.location.pathname + '?' + params.toString());
}

function createInitialState(params) {
  const cfg = OP_CFG[params.op];
  const finalC = cfg.cLock(params.alg) ? params.gpu : params.chunk;
  const gpus = [];
  for (let i = 0; i < params.gpu; i++) gpus.push({ gi: i, data: mkData(params.op, params.gpu, finalC, i), x: 0, y: 0 });
  const steps = genSteps(params.op, params.alg, params.gpu);
  return {
    op: params.op, alg: params.alg, G: params.gpu, C: finalC,
    gpus, steps, curStep: -1, phase: 'idle', anim: 0,
    snapInfo: [], flashFx: [], history: [], stepLog: [],
    zoom: 1, panX: 0, panY: 0,
    speedPos: params.speed,
    _draw: null, _resize: null,
  };
}

export default function App() {
  const init = readURL();
  const [op, setOp] = useState(init.op);
  const [alg, setAlg] = useState(init.alg);
  const [G, setG] = useState(init.gpu);
  const [C, setC] = useState(init.chunk);
  const [speedPos, setSpeedPos] = useState(init.speed);
  const [phase, setPhase] = useState('idle');
  const [modalOpen, setModalOpen] = useState(false);
  const [sbExpanded, setSbExpanded] = useState(false);
  const [, forceUpdate] = useState(0);

  const { lang, t, toggleLang } = useLang();
  const langRef = useRef(lang);
  useEffect(() => { langRef.current = lang; }, [lang]);

  useEffect(() => { initGA(); }, []);

  const stateRef = useRef(createInitialState(init));
  const afIdRef = useRef(null);

  const initEngine = useCallback((newOp, newAlg, newG, newC, newSpeedPos) => {
    if (afIdRef.current) { cancelAnimationFrame(afIdRef.current); afIdRef.current = null; }
    const cfg = OP_CFG[newOp];
    let finalC = newC;
    if (cfg.cLock(newAlg)) finalC = newG;
    const gpus = [];
    for (let i = 0; i < newG; i++) gpus.push({ gi: i, data: mkData(newOp, newG, finalC, i), x: 0, y: 0 });
    const steps = genSteps(newOp, newAlg, newG);

    // Preserve _draw/_resize from Canvas component
    const prevDraw = stateRef.current ? stateRef.current._draw : null;
    const prevResize = stateRef.current ? stateRef.current._resize : null;

    stateRef.current = {
      op: newOp, alg: newAlg, G: newG, C: finalC,
      gpus, steps, curStep: -1, phase: 'idle', anim: 0,
      snapInfo: [], flashFx: [], history: [], stepLog: [],
      zoom: 1, panX: 0, panY: 0,
      speedPos: newSpeedPos,
      _draw: prevDraw, _resize: prevResize,
    };

    setOp(newOp); setAlg(newAlg); setG(newG); setC(finalC); setPhase('idle');
    setSpeedPos(newSpeedPos);
    syncURL(newOp, newAlg, newG, finalC, newSpeedPos, langRef.current);

    // Compute layout and redraw
    requestAnimationFrame(() => {
      const cv = document.getElementById('cv');
      if (cv && stateRef.current) {
        const W = cv.parentElement.clientWidth;
        const H = cv.parentElement.clientHeight;
        computeLayout(stateRef.current.gpus, newG, finalC, newAlg, newOp, W, H);
        const fit = autoFit(stateRef.current.gpus, newG, finalC, W, H);
        stateRef.current.zoom = fit.zoom;
        stateRef.current.panX = fit.panX;
        stateRef.current.panY = fit.panY;
        if (stateRef.current._resize) stateRef.current._resize();
      }
      forceUpdate((n) => n + 1);
    });
  }, []);

  const updateHUD = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    const d = opDesc(s.op, s.G, s.C);
    const hud = document.getElementById('hud');
    if (hud) {
      hud.innerHTML = tGlobal('hud.template', {
        title: d.title, desc: d.desc.split('.')[0] + '.', goal: d.goal, G: s.G, C: s.C,
      });
      const link = document.getElementById('hudMoreLink');
      if (link) link.onclick = () => { trackEvent('open_goal_modal', { operation: s.op, source: 'hud' }); setModalOpen(true); };
    }
  }, []);

  const draw = useCallback(() => {
    if (stateRef.current && stateRef.current._draw) stateRef.current._draw();
  }, []);

  const flashDecay = useCallback(() => {
    const s = stateRef.current;
    if (!s || !s.flashFx.length) return;
    draw();
    requestAnimationFrame(flashDecay);
  }, [draw]);

  const tick = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    if (s.phase !== 'running' && s.phase !== 'stepping') return;
    s.anim += spdInc(s.speedPos);
    if (s.anim >= 1) {
      s.anim = 1; draw();
      addFlash(s.flashFx, s.steps, s.snapInfo, s.C, s.curStep);
      s.history.push(s.gpus.map((g) => g.data.slice()));
      s.stepLog.push({ si: s.curStep, snap: s.snapInfo.slice(), step: s.steps[s.curStep] });
      apply(s.gpus, s.steps, s.snapInfo, s.C, s.curStep);
      s.anim = 0; s.curStep++;
      if (s.phase === 'stepping' || s.curStep >= s.steps.length) {
        s.phase = s.curStep >= s.steps.length ? 'done' : 'paused';
        if (s.phase === 'done') trackEvent('animation_complete', { operation: s.op, algorithm: s.alg, gpu_count: s.G, total_steps: s.steps.length });
        if (s.curStep < s.steps.length) s.snapInfo = snap(s.gpus, s.steps, s.C, s.curStep);
        setPhase(s.phase);
        forceUpdate((n) => n + 1);
        draw();
        flashDecay();
        return;
      }
      s.snapInfo = snap(s.gpus, s.steps, s.C, s.curStep);
      forceUpdate((n) => n + 1);
    }
    draw();
    afIdRef.current = requestAnimationFrame(tick);
  }, [draw, flashDecay]);

  const resetData = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    for (let i = 0; i < s.G; i++) s.gpus[i].data = mkData(s.op, s.G, s.C, i);
  }, []);

  // Controls handlers
  const handleOpChange = useCallback((v) => {
    const cfg = OP_CFG[v];
    const newAlg = cfg.algs[0];
    trackEvent('select_operation', { operation: v, algorithm: newAlg });
    initEngine(v, newAlg, G, C, speedPos);
  }, [G, C, speedPos, initEngine]);

  const handleAlgChange = useCallback((v) => {
    trackEvent('select_algorithm', { operation: op, algorithm: v });
    initEngine(op, v, G, C, speedPos);
  }, [op, G, C, speedPos, initEngine]);

  const handleGChange = useCallback((v) => {
    const newG = Math.max(2, v || 4);
    trackEvent('change_gpu_count', { gpu_count: newG });
    initEngine(op, alg, newG, C, speedPos);
  }, [op, alg, C, speedPos, initEngine]);

  const handleCChange = useCallback((v) => {
    const newC = Math.max(2, v || 4);
    trackEvent('change_chunk_count', { chunk_count: newC });
    initEngine(op, alg, G, newC, speedPos);
  }, [op, alg, G, speedPos, initEngine]);

  const spdTimerRef = useRef(null);
  const handleSpeedChange = useCallback((v) => {
    const newPos = Math.max(0, Math.min(100, v));
    setSpeedPos(newPos);
    if (stateRef.current) stateRef.current.speedPos = newPos;
    syncURL(op, alg, G, C, newPos, langRef.current);
    clearTimeout(spdTimerRef.current);
    spdTimerRef.current = setTimeout(() => trackEvent('change_speed', { speed_position: newPos }), 500);
  }, [op, alg, G, C]);

  const handlePlay = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    if (s.phase === 'idle') {
      s.curStep = 0; s.anim = 0;
      resetData();
      s.history = []; s.stepLog = [];
      s.snapInfo = snap(s.gpus, s.steps, s.C, 0);
    }
    s.phase = 'running';
    setPhase('running');
    forceUpdate((n) => n + 1);
    updateHUD();
    trackEvent('play_animation', { operation: s.op, algorithm: s.alg, gpu_count: s.G, chunk_count: s.C });
    afIdRef.current = requestAnimationFrame(tick);
  }, [resetData, tick, updateHUD]);

  const handlePause = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    if (s.phase === 'running' || s.phase === 'stepping') {
      s.phase = 'paused';
      if (afIdRef.current) cancelAnimationFrame(afIdRef.current);
      trackEvent('pause_animation', { operation: s.op, algorithm: s.alg, step: s.curStep });
      setPhase('paused');
      forceUpdate((n) => n + 1);
    }
  }, []);

  const handleStep = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    if (s.phase === 'idle') {
      s.curStep = 0; s.anim = 0;
      resetData();
      s.history = []; s.stepLog = [];
      s.snapInfo = snap(s.gpus, s.steps, s.C, 0);
    }
    if (s.phase === 'idle' || s.phase === 'paused') {
      if (s.curStep >= s.steps.length) {
        s.phase = 'done'; setPhase('done'); forceUpdate((n) => n + 1); draw(); return;
      }
      s.phase = 'stepping'; s.anim = 0;
      if (!s.snapInfo.length) s.snapInfo = snap(s.gpus, s.steps, s.C, s.curStep);
      setPhase('stepping');
      forceUpdate((n) => n + 1);
      updateHUD();
      trackEvent('step_animation', { operation: s.op, algorithm: s.alg, step: s.curStep });
      afIdRef.current = requestAnimationFrame(tick);
    }
  }, [resetData, draw, tick, updateHUD]);

  const handleBack = useCallback(() => {
    const s = stateRef.current;
    if (!s || s.history.length === 0) return;
    trackEvent('back_step', { operation: s.op, algorithm: s.alg, step: s.curStep });
    if (afIdRef.current) { cancelAnimationFrame(afIdRef.current); afIdRef.current = null; }
    const prev = s.history.pop(); s.stepLog.pop();
    for (let i = 0; i < s.G; i++) s.gpus[i].data = prev[i];
    s.curStep--; s.anim = 0; s.flashFx = [];
    if (s.curStep < 0) { s.phase = 'idle'; s.curStep = -1; s.snapInfo = []; }
    else { s.phase = 'paused'; s.snapInfo = snap(s.gpus, s.steps, s.C, s.curStep); }
    setPhase(s.phase);
    forceUpdate((n) => n + 1);
    draw();
  }, [draw]);

  const handleReset = useCallback(() => {
    trackEvent('reset_animation', { operation: op, algorithm: alg });
    initEngine(op, alg, G, C, speedPos);
  }, [op, alg, G, C, speedPos, initEngine]);

  // Update HUD whenever config or language changes
  useEffect(() => {
    updateHUD();
  }, [op, G, C, lang, updateHUD]);

  // Redraw canvas when language changes (for translated canvas text)
  useEffect(() => {
    draw();
  }, [lang, draw]);

  // Update html lang attribute
  useEffect(() => {
    document.documentElement.lang = lang === 'ko' ? 'ko' : 'en';
  }, [lang]);

  return (
    <>
      <Controls
        op={op} alg={alg} G={G} C={C} speedPos={speedPos} phase={phase}
        onOpChange={handleOpChange} onAlgChange={handleAlgChange}
        onGChange={handleGChange} onCChange={handleCChange}
        onSpeedChange={handleSpeedChange}
        onPlay={handlePlay} onPause={handlePause} onStep={handleStep}
        onBack={handleBack} onReset={handleReset}
        historyLen={stateRef.current ? stateRef.current.history.length : 0}
        lang={lang} toggleLang={() => { const next = lang === 'ko' ? 'en' : 'ko'; trackEvent('toggle_language', { language: next }); toggleLang(); syncURL(op, alg, G, C, speedPos, next); }}
      />
      <div className="main">
        <Canvas stateRef={stateRef} />
        <Sidebar stateRef={stateRef} onShowGoal={() => { trackEvent('open_goal_modal', { operation: op }); setModalOpen(true); }} expanded={sbExpanded} onToggle={() => { trackEvent('toggle_sidebar', { action: sbExpanded ? 'hide' : 'show' }); setSbExpanded(!sbExpanded); }} />
      </div>
      <div className="m-playbar">
        <button className="b bp" onClick={handlePlay} disabled={phase === 'running' || phase === 'stepping' || phase === 'done'}>&#9654;</button>
        <button className="b bpa" onClick={handlePause} disabled={phase !== 'running' && phase !== 'stepping'}>&#10074;&#10074;</button>
        <button className="b bsb" onClick={handleBack} disabled={phase === 'running' || phase === 'stepping' || (stateRef.current ? stateRef.current.history.length : 0) === 0}>|&#9664;</button>
        <button className="b bs" onClick={handleStep} disabled={phase === 'running' || phase === 'stepping' || phase === 'done'}>&#9654;|</button>
        <button className="b br" onClick={handleReset}>&#8635;</button>
      </div>
      <GoalModal open={modalOpen} op={op} G={G} C={C} onClose={() => setModalOpen(false)} />
    </>
  );
}
