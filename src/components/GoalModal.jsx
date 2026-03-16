import React from 'react';
import { buildGoalModalHTML } from '../engine/opDesc';

export default function GoalModal({ open, op, G, C, onClose }) {
  if (!open) return null;
  const html = buildGoalModalHTML(op, G, C);

  return (
    <div className="gm-ov open" onClick={(e) => { if (e.target.className.includes('gm-ov')) onClose(); }}>
      <div className="gm">
        <button className="gm-x" onClick={onClose}>&times;</button>
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}
