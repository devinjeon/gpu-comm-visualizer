import React, { useEffect, useRef, useCallback, useState } from 'react';
import { OP_CFG, ALG_NAMES, spdPct, SPD_DEFAULT } from '../engine/constants';
import { useLang } from '../i18n';

function holdBtn(el, fn) {
  let iv = null, to = null;
  const start = () => { fn(); to = setTimeout(() => { iv = setInterval(fn, 50); }, 400); };
  const stop = () => { clearTimeout(to); clearInterval(iv); to = iv = null; };
  el.addEventListener('mousedown', start);
  el.addEventListener('touchstart', (e) => { e.preventDefault(); start(); });
  el.addEventListener('mouseup', stop);
  el.addEventListener('mouseleave', stop);
  el.addEventListener('touchend', stop);
  el.addEventListener('touchcancel', stop);
  return () => {
    el.removeEventListener('mousedown', start);
    el.removeEventListener('mouseup', stop);
    el.removeEventListener('mouseleave', stop);
    el.removeEventListener('touchend', stop);
    el.removeEventListener('touchcancel', stop);
  };
}

function NumInput({ value, min, disabled, title, onChange }) {
  const [draft, setDraft] = useState(String(value));
  const prevValue = useRef(value);

  // Sync draft when external value changes (e.g. from reset, op change)
  useEffect(() => {
    if (value !== prevValue.current) {
      setDraft(String(value));
      prevValue.current = value;
    }
  }, [value]);

  const commit = useCallback((str) => {
    const n = parseInt(str, 10);
    if (!isNaN(n) && n >= min) {
      onChange(n);
      prevValue.current = n;
    } else {
      // Revert to current value
      setDraft(String(value));
    }
  }, [min, onChange, value]);

  const handleChange = useCallback((e) => {
    const str = e.target.value;
    setDraft(str);
    const n = parseInt(str, 10);
    if (!isNaN(n) && n >= min) {
      onChange(n);
      prevValue.current = n;
    }
  }, [min, onChange]);

  const handleBlur = useCallback(() => {
    commit(draft);
  }, [draft, commit]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  }, []);

  const gDnRef = useRef(null);
  const gUpRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  onChangeRef.current = onChange;
  valueRef.current = value;

  useEffect(() => {
    const cleanups = [];
    if (gDnRef.current) cleanups.push(holdBtn(gDnRef.current, () => onChangeRef.current(Math.max(min, valueRef.current - 1))));
    if (gUpRef.current) cleanups.push(holdBtn(gUpRef.current, () => onChangeRef.current(valueRef.current + 1)));
    return () => cleanups.forEach((c) => c());
  }, [min]);

  return (
    <div className="num-input">
      <button className="sb2 num-btn" ref={gDnRef} disabled={disabled}>&minus;</button>
      <input
        type="number"
        value={draft}
        min={min}
        disabled={disabled}
        title={title}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
      <button className="sb2 num-btn" ref={gUpRef} disabled={disabled}>+</button>
    </div>
  );
}

export default function Controls({
  op, alg, G, C, speedPos, phase,
  onOpChange, onAlgChange, onGChange, onCChange,
  onSpeedChange, onPlay, onPause, onStep, onBack, onReset,
  historyLen, lang, toggleLang,
}) {
  const { t } = useLang();
  const cfg = OP_CFG[op];
  const cLocked = cfg.cLock(alg);
  const tipRef = useRef(null);
  const showTip = useCallback((anchor, text) => {
    let el = tipRef.current;
    if (!el) { el = document.createElement('div'); el.className = 'chunk-tip'; document.body.appendChild(el); tipRef.current = el; }
    el.textContent = text;
    const r = anchor.getBoundingClientRect();
    el.style.left = r.left + 'px';
    el.style.top = (r.bottom + 4) + 'px';
    el.style.display = 'block';
  }, []);
  const hideTip = useCallback(() => { if (tipRef.current) tipRef.current.style.display = 'none'; }, []);
  useEffect(() => () => { if (tipRef.current) { tipRef.current.remove(); tipRef.current = null; } }, []);
  const spdDnRef = useRef(null);
  const spdUpRef = useRef(null);
  const speedPosRef = useRef(speedPos);
  const onSpeedChangeRef = useRef(onSpeedChange);
  speedPosRef.current = speedPos;
  onSpeedChangeRef.current = onSpeedChange;

  useEffect(() => {
    const cleanups = [];
    if (spdDnRef.current) cleanups.push(holdBtn(spdDnRef.current, () => onSpeedChangeRef.current(Math.floor(speedPosRef.current) - 1)));
    if (spdUpRef.current) cleanups.push(holdBtn(spdUpRef.current, () => onSpeedChangeRef.current(Math.ceil(speedPosRef.current) + 1)));
    return () => cleanups.forEach((c) => c());
  }, []);

  const handleOpChange = useCallback((e) => {
    const v = e.target.value;
    onOpChange(v);
  }, [onOpChange]);

  return (
    <div className="controls">
      <div className="num-group">
        <label>{t('op')}</label>
        <select value={op} onChange={handleOpChange}>
          {Object.entries(OP_CFG).map(([k, v]) => (
            <option key={k} value={k}>{v.name}</option>
          ))}
        </select>
      </div>
      <div className="num-group">
        <label>{t('alg')}</label>
        <select value={alg} onChange={(e) => onAlgChange(e.target.value)}>
          {cfg.algs.map((a) => (
            <option key={a} value={a}>{ALG_NAMES[a] || a}</option>
          ))}
        </select>
      </div>
      <div className="num-group">
        <label>GPU:</label>
        <NumInput value={G} min={2} onChange={onGChange} />
      </div>
      <div className="num-group"
        onMouseEnter={(e) => { if (cLocked) showTip(e.currentTarget, t(cfg.cLockReason)); }}
        onMouseLeave={hideTip}
        onTouchStart={(e) => { if (cLocked) showTip(e.currentTarget, t(cfg.cLockReason)); }}
        onTouchEnd={hideTip}
      >
        <label className={cLocked ? 'dis' : ''}>Chunk:</label>
        <NumInput value={C} min={2} disabled={cLocked} title={t('chunkTitle')} onChange={onCChange} />
      </div>
      <div className="sp">
        <label>{t('speed')}</label>
        <button className="sb2" ref={spdDnRef}>&minus;</button>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(speedPos)}
          step="any"
          onChange={(e) => onSpeedChange(+e.target.value)}
        />
        <button className="sb2" ref={spdUpRef}>+</button>
        <span style={{ fontSize: '10px', color: '#aaa', minWidth: '36px' }}>{spdPct(speedPos)}%</span>
        <button className="sb2" title={t('speedReset')} onClick={() => onSpeedChange(SPD_DEFAULT)}>&#8634;</button>
      </div>
      <div className="lang-toggle">
        <button className={lang === 'en' ? 'active' : ''} onClick={lang !== 'en' ? toggleLang : undefined}>EN</button>
        <button className={lang === 'ko' ? 'active' : ''} onClick={lang !== 'ko' ? toggleLang : undefined}>KO</button>
      </div>
      <div className="bg">
        <button className="b bp" onClick={onPlay} disabled={phase === 'running' || phase === 'stepping' || phase === 'done'}>&#9654; {t('play')}</button>
        <button className="b bpa" onClick={onPause} disabled={phase !== 'running' && phase !== 'stepping'}>&#10074;&#10074;</button>
        <button className="b bsb" onClick={onBack} disabled={phase === 'running' || phase === 'stepping' || historyLen === 0}>|&#9664; {t('prev')}</button>
        <button className="b bs" onClick={onStep} disabled={phase === 'running' || phase === 'stepping' || phase === 'done'}>&#9654;| {t('step')}</button>
        <button className="b br" onClick={onReset}>&#8635; {t('reset')}</button>
      </div>
    </div>
  );
}
