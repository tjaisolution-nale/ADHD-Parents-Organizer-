// Kolizje terminów i najbliższe wolne miejsce (bez AI).

const STEP = 30 * 60000;
const MAX_STEPS = 6; // 3 godziny

export function findClash(busy, start, end) {
  const hit = busy.find((b) => b.start < end && start < b.end);
  return hit ? { title: hit.title } : null;
}

export function nextFreeStart(busy, start, durationMs) {
  for (let k = 1; k <= MAX_STEPS; k++) {
    const candidate = start + k * STEP;
    if (!findClash(busy, candidate, candidate + durationMs)) return candidate;
  }
  return null;
}
