// Pure question-selection helpers (no DOM, no storage), so they can be unit-tested.

/**
 * Pick the next question.
 * - Only topics in `enabledTopics` (an empty list means all topics).
 * - Skips recently seen ids while there are unseen questions left.
 * @param {object[]} questions full bank
 * @param {{ enabledTopics?: string[], recentIds?: string[], rng?: () => number }} opts
 */
export function pickQuestion(questions, { enabledTopics = [], recentIds = [], rng = Math.random } = {}) {
  const inTopics = enabledTopics.length
    ? questions.filter((q) => enabledTopics.includes(q.topic))
    : questions;
  const pool = inTopics.length ? inTopics : questions;
  if (!pool.length) return null;

  const recent = new Set(recentIds);
  const fresh = pool.filter((q) => !recent.has(q.id));
  const candidates = fresh.length ? fresh : pool;
  return candidates[Math.floor(rng() * candidates.length)];
}

/** Add an id to the recent list. Keeps at most `limit` ids, newest last. */
export function pushRecent(recentIds, id, limit) {
  const next = recentIds.filter((x) => x !== id);
  next.push(id);
  return next.slice(-limit);
}

/** Fisher–Yates shuffle of [0..n-1], used to randomize MCQ choice order. */
export function shuffledIndices(n, rng = Math.random) {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}
