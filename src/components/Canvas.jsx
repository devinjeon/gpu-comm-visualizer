import React, { useRef, useEffect, useCallback, useState } from 'react';
import { drawScene } from '../engine/renderer';
import { cellGeo, computeLayout, autoFit } from '../engine/layout';
import { trackEvent } from '../analytics';

export default function Canvas({ stateRef, onViewChange }) {
  const canvasRef = useRef(null);
  const isDragRef = useRef(false);
  const mmDragRef = useRef(false);
  const dragStartRef = useRef({ sx: 0, sy: 0, px: 0, py: 0 });
  const pinchRef = useRef(null);
  const [showMm, setShowMm] = useState(true);
  const showMmRef = useRef(true);

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const state = stateRef.current;
    if (!state || !state.gpus || !state.gpus.length) return;
    state.showMinimap = showMmRef.current;
    const ctx = cv.getContext('2d');
    drawScene(ctx, state);
  }, [stateRef]);

  const resize = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const c = cv.parentElement;
    cv.width = c.clientWidth * devicePixelRatio;
    cv.height = c.clientHeight * devicePixelRatio;
    const ctx = cv.getContext('2d');
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    const state = stateRef.current;
    if (state && state.gpus && state.gpus.length) {
      const W = c.clientWidth, H = c.clientHeight;
      computeLayout(state.gpus, state.G, state.C, state.alg, state.op, W, H);
      // Only auto-fit on first layout (idle with no user interaction)
      if (!state._userZoomed) {
        const fit = autoFit(state.gpus, state.G, state.C, W, H);
        state.zoom = fit.zoom;
        state.panX = fit.panX;
        state.panY = fit.panY;
      }
    }
    draw();
  }, [draw, stateRef]);

  // On mount: compute layout, fit, expose draw/resize, then render
  useEffect(() => {
    const cv = canvasRef.current;
    const state = stateRef.current;
    if (cv && state) {
      state._draw = draw;
      state._resize = resize;
      const W = cv.parentElement.clientWidth;
      const H = cv.parentElement.clientHeight;
      computeLayout(state.gpus, state.G, state.C, state.alg, state.op, W, H);
      const fit = autoFit(state.gpus, state.G, state.C, W, H);
      state.zoom = fit.zoom;
      state.panX = fit.panX;
      state.panY = fit.panY;
    }
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [resize, draw, stateRef]);

  const mmBounds = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return { mmX: 8, mmY: 0, mmW: 195, mmH: 143, W: 0, H: 0 };
    const W = cv.parentElement.clientWidth;
    const H = cv.parentElement.clientHeight;
    const mobile = W < 768;
    const mmW = mobile ? 150 : 195, mmH = mobile ? 110 : 143;
    return { mmX: 8, mmY: H - mmH - 8, mmW, mmH, W, H };
  }, []);

  const mmSceneBounds = useCallback(() => {
    const state = stateRef.current;
    const { gpus, G, C } = state;
    let sMinX = Infinity, sMinY = Infinity, sMaxX = -Infinity, sMaxY = -Infinity;
    for (const g of gpus) {
      const geo = cellGeo(gpus, C, g.gi, 0);
      sMinX = Math.min(sMinX, geo.rx); sMinY = Math.min(sMinY, geo.ry);
      sMaxX = Math.max(sMaxX, geo.rx + geo.cardW); sMaxY = Math.max(sMaxY, geo.ry + geo.cardH);
    }
    const pad = 50;
    sMinX -= pad; sMinY -= pad; sMaxX += pad; sMaxY += pad;
    const mm = mmBounds();
    const scW = sMaxX - sMinX, scH = sMaxY - sMinY;
    const sc = Math.min(mm.mmW / scW, mm.mmH / scH);
    const ox = mm.mmX + (mm.mmW - scW * sc) / 2;
    const oy = mm.mmY + (mm.mmH - scH * sc) / 2;
    return { sMinX, sMinY, sc, ox, oy, mm };
  }, [stateRef, mmBounds]);

  const mmNavTo = useCallback((mx, my) => {
    const b = mmSceneBounds();
    const state = stateRef.current;
    const wx = b.sMinX + (mx - b.ox) / b.sc;
    const wy = b.sMinY + (my - b.oy) / b.sc;
    state.panX = b.mm.W / 2 - wx * state.zoom;
    state.panY = b.mm.H / 2 - wy * state.zoom;
    draw();
  }, [mmSceneBounds, stateRef, draw]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const state = stateRef.current;
    const oldZ = state.zoom;
    state.zoom = state.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12);
    state.panX = mx - (mx - state.panX) * (state.zoom / oldZ);
    state.panY = my - (my - state.panY) * (state.zoom / oldZ);
    state._userZoomed = true;
    draw();
  }, [stateRef, draw]);

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const mm = mmBounds();
    if (mx >= mm.mmX - 2 && mx <= mm.mmX + mm.mmW + 2 && my >= mm.mmY - 2 && my <= mm.mmY + mm.mmH + 2) {
      mmDragRef.current = true;
      mmNavTo(mx, my);
      canvasRef.current.style.cursor = 'crosshair';
      return;
    }
    isDragRef.current = true;
    dragStartRef.current = { sx: e.clientX, sy: e.clientY, px: stateRef.current.panX, py: stateRef.current.panY };
    canvasRef.current.style.cursor = 'grabbing';
  }, [mmBounds, mmNavTo, stateRef]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (mmDragRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        mmNavTo(e.clientX - rect.left, e.clientY - rect.top);
        return;
      }
      if (!isDragRef.current) return;
      const state = stateRef.current;
      const d = dragStartRef.current;
      state.panX = d.px + (e.clientX - d.sx);
      state.panY = d.py + (e.clientY - d.sy);
      state._userZoomed = true;
      draw();
    };
    const handleMouseUp = () => {
      if (mmDragRef.current) { mmDragRef.current = false; if (canvasRef.current) canvasRef.current.style.cursor = 'grab'; }
      if (isDragRef.current) { isDragRef.current = false; if (canvasRef.current) canvasRef.current.style.cursor = 'grab'; }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [stateRef, draw, mmNavTo]);

  const handleDoubleClick = useCallback(() => {
    const state = stateRef.current;
    const cv = canvasRef.current;
    const W = cv.parentElement.clientWidth;
    const H = cv.parentElement.clientHeight;
    const fit = autoFit(state.gpus, state.G, state.C, W, H);
    state.zoom = fit.zoom;
    state.panX = fit.panX;
    state.panY = fit.panY;
    state._userZoomed = false;
    draw();
  }, [stateRef, draw]);

  // Double-tap detection for mobile
  const lastTapRef = useRef(0);

  // Touch events for mobile drag and pinch zoom
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      // Pinch zoom start
      isDragRef.current = false;
      const t0 = e.touches[0], t1 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const rect = canvasRef.current.getBoundingClientRect();
      const mx = (t0.clientX + t1.clientX) / 2 - rect.left;
      const my = (t0.clientY + t1.clientY) / 2 - rect.top;
      pinchRef.current = { dist, mx, my, zoom: stateRef.current.zoom, panX: stateRef.current.panX, panY: stateRef.current.panY };
      return;
    }
    if (e.touches.length === 1) {
      pinchRef.current = null;
      const t = e.touches[0];
      const rect = canvasRef.current.getBoundingClientRect();
      const mx = t.clientX - rect.left, my = t.clientY - rect.top;
      const mm = mmBounds();

      // Minimap drag takes priority over double-tap
      if (showMmRef.current && mx >= mm.mmX - 2 && mx <= mm.mmX + mm.mmW + 2 && my >= mm.mmY - 2 && my <= mm.mmY + mm.mmH + 2) {
        lastTapRef.current = 0;
        mmDragRef.current = true;
        mmNavTo(mx, my);
        return;
      }

      // Double-tap detection (canvas area only)
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        lastTapRef.current = 0;
        isDragRef.current = false;
        handleDoubleClick();
        return;
      }
      lastTapRef.current = now;

      isDragRef.current = true;
      dragStartRef.current = { sx: t.clientX, sy: t.clientY, px: stateRef.current.panX, py: stateRef.current.panY };
    }
  }, [mmBounds, mmNavTo, stateRef, handleDoubleClick]);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const t0 = e.touches[0], t1 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const scale = dist / pinchRef.current.dist;
      const newZoom = pinchRef.current.zoom * scale;
      const state = stateRef.current;
      const mx = pinchRef.current.mx, my = pinchRef.current.my;
      state.zoom = newZoom;
      state.panX = mx - (mx - pinchRef.current.panX) * (newZoom / pinchRef.current.zoom);
      state.panY = my - (my - pinchRef.current.panY) * (newZoom / pinchRef.current.zoom);
      state._userZoomed = true;
      draw();
      return;
    }
    if (mmDragRef.current && e.touches.length === 1) {
      const rect = canvasRef.current.getBoundingClientRect();
      mmNavTo(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
      return;
    }
    if (!isDragRef.current || e.touches.length !== 1) return;
    const t = e.touches[0];
    const state = stateRef.current;
    const d = dragStartRef.current;
    state.panX = d.px + (t.clientX - d.sx);
    state.panY = d.py + (t.clientY - d.sy);
    state._userZoomed = true;
    draw();
  }, [stateRef, draw, mmNavTo]);

  const handleTouchEnd = useCallback((e) => {
    if (e.touches.length < 2) pinchRef.current = null;
    if (e.touches.length === 0) {
      isDragRef.current = false;
      mmDragRef.current = false;
    }
  }, []);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    cv.addEventListener('wheel', handleWheel, { passive: false });
    cv.addEventListener('touchstart', handleTouchStart, { passive: false });
    cv.addEventListener('touchmove', handleTouchMove, { passive: false });
    cv.addEventListener('touchend', handleTouchEnd);
    cv.addEventListener('touchcancel', handleTouchEnd);
    return () => {
      cv.removeEventListener('wheel', handleWheel);
      cv.removeEventListener('touchstart', handleTouchStart);
      cv.removeEventListener('touchmove', handleTouchMove);
      cv.removeEventListener('touchend', handleTouchEnd);
      cv.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd]);

  const toggleMm = useCallback(() => {
    const next = !showMmRef.current;
    showMmRef.current = next;
    setShowMm(next);
    trackEvent('toggle_minimap', { visible: next });
    draw();
  }, [draw]);

  return (
    <div className="cw">
      <canvas
        id="cv"
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%', cursor: 'grab' }}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
      />
      <div id="hud" />
      <button
        className={`mm-toggle${showMm ? '' : ' mm-closed'}`}
        onClick={toggleMm}
        title={showMm ? 'Hide minimap' : 'Show minimap'}
      >
        {showMm ? '\u2013' : '\u25A1'}
      </button>
      <a href="https://github.com/devinjeon/gpu-comm-visualizer" target="_blank" rel="noopener noreferrer" className="gh-link" title="GitHub" onClick={() => trackEvent('click_github_link')}>
        <svg viewBox="0 0 16 16" width="28" height="28" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
      </a>
    </div>
  );
}
