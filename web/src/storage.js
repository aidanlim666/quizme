// localStorage wrapper. Storage can throw or be empty (private mode, blocked site data),
// so every access is guarded and the quiz still works without it, though
// refreshing the page will then give a new question.

const PREFIX = 'quizme.';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage unavailable: ignore */
  }
}

export const storage = {
  /** The in-progress (or just-solved) question: { id, order, wrong, eliminated, revealed, solved, session, solvedAt } */
  getPending: () => read('pending', null),
  setPending: (p) => write('pending', p),

  getRecent: () => read('recent', []),
  setRecent: (ids) => write('recent', ids),

  /** Enabled topic ids. An empty array means all topics. */
  getTopics: () => read('topics', []),
  setTopics: (ids) => write('topics', ids),

  getStats: () => read('stats', { solved: 0, firstTry: 0, streak: 0, best: 0 }),
  setStats: (s) => write('stats', s),
};
