// Stan bota w danych statycznych workflow n8n ($getWorkflowStaticData('global')).

const defaults = () => ({
  offset: 0,
  cb: {},
  pending: {},
  last: { b: null, g: null },
  combo: { b: { last: null, level: 0 }, g: { last: null, level: 0 } },
  lastHighFive: null,
  gem: { date: '', count: 0 },
  goals: { week: '', b: 5, g: 5 },
  gtoken: null,
  fatalAt: null,
  forceSlot: null,
  errorAt: null,
});

function fill(target, base) {
  for (const [k, v] of Object.entries(base)) {
    if (!(k in target)) target[k] = v;
    else if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object') fill(target[k], v);
  }
  return target;
}

export function ensureStore(obj) {
  return fill(obj, defaults());
}

export function pruneStore(store, nowMs) {
  for (const map of [store.cb, store.pending]) {
    for (const [k, v] of Object.entries(map)) if (v.exp <= nowMs) delete map[k];
  }
}

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
export function newKey(store) {
  for (;;) {
    let k = '';
    for (let i = 0; i < 6; i++) k += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    if (!(k in store.cb) && !(k in store.pending)) return k;
  }
}
