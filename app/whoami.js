// The whoami line the studio will draw and export. validMotto (render.js) checks the shape;
// glyphs (boxes.js) checks the face that series actually sets the box in. A face with no
// metrics yet is 'pending': not a pass, and not a claim that a character is missing.
import { glyphs } from './boxes.js';
import { validMotto } from './render.js';

const trim = (s) => (typeof s === 'string' ? s.trim() : '');

// 'empty' | 'ok' | 'length' | 'glyph' | 'pending'
export function mottoStatus(text, face) {
  const mv = trim(text);
  if (!mv) return 'empty';
  if (!validMotto(mv)) return 'length';
  const g = glyphs(face, mv);
  if (g == null) return 'pending';
  return g ? 'ok' : 'glyph';
}

// The motto held in state. An edit that does not pass leaves the previous confirmed line.
// The line that was confirmed, and no longer passes, leaves state; the field still shows it.
export function confirmedMotto(field, current, face) {
  const status = mottoStatus(field, face);
  const mv = trim(field);
  if (status === 'ok') return mv;
  if (status === 'empty') return '';
  if (mv && mv === current) return '';
  return typeof current === 'string' ? current : '';
}

// A saved line goes back into the field even when this series cannot draw it.
// What the viewer typed while the page loaded wins. readWho() decides what is confirmed.
export function fieldMotto(saved, typed) {
  if (trim(typed)) return typed;
  return typeof saved === 'string' ? saved : '';
}

// What to write back to ks-edits. A confirmed line wins over a draft that has not passed.
// When nothing is confirmed, the field is kept so the next visit can say why it did not.
export function mottoToStore(field, confirmed) {
  const typed = trim(field);
  const kept = typeof confirmed === 'string' ? confirmed : '';
  if (!typed) return '';
  if (kept) return kept;
  return typed;
}
