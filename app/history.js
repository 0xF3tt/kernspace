// Undo stacks for one editing visit. Pure: no DOM, and importing this does not start the app.
// Keys are versionKey(series, presetId) from app/state.js. Entries are { before, after, msg }.

export function commitStack(stacks, key, before, after, msg) {
  const st = (stacks[key] ??= { undo: [], redo: [] });
  st.undo.push({ before, after, msg });
  st.redo = [];
  return st;
}

export function undoStack(stacks, key) {
  const st = stacks[key];
  const entry = st?.undo.pop();
  if (!entry) return null;
  st.redo.push(entry);
  return entry;
}

export function redoStack(stacks, key) {
  const st = stacks[key];
  const entry = st?.redo.pop();
  if (!entry) return null;
  st.undo.push(entry);
  return entry;
}
