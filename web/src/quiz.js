import { CONFIG, unlockUrl } from './config.js';
import { grade, displayAnswer } from './grading.js';
import { pickQuestion, pushRecent, shuffledIndices } from './select.js';
import { storage } from './storage.js';
import { renderRich, renderInline, escapeHtml } from './render.js';

const app = document.getElementById('app');
const footer = document.getElementById('footer');

// ---------- data ----------

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

async function loadBank() {
  const manifest = await fetchJson('questions/topics.json');
  const files = await Promise.all(manifest.topics.map((t) => fetchJson(`questions/${t.file}`)));
  const questions = files.flat();
  return {
    topics: manifest.topics,
    topicName: new Map(manifest.topics.map((t) => [t.id, t.name])),
    questions,
    byId: new Map(questions.map((q) => [q.id, q])),
  };
}

// ---------- state ----------

function freshPending(bank, session) {
  const recent = storage.getRecent();
  const q = pickQuestion(bank.questions, { enabledTopics: storage.getTopics(), recentIds: recent });
  storage.setRecent(pushRecent(recent, q.id, CONFIG.recentLimit));
  const order =
    q.type !== 'mcq' ? null : q.shuffle === false ? q.choices.map((_, i) => i) : shuffledIndices(q.choices.length);
  return {
    q,
    pending: { id: q.id, order, wrong: 0, eliminated: [], revealed: false, solved: false, session, solvedAt: null },
  };
}

/**
 * Resume the stored question if it isn't solved yet, so refreshing the page can't skip a hard question.
 * A solved question is kept only briefly (CONFIG.solvedGraceMs) and only for the same session
 * (same ?s= id from the Gate shortcut, or any visit when there is no id). Any other visit gets a new question.
 */
function resolveQuestion(bank, session, now) {
  const p = storage.getPending();
  const q = p && bank.byId.get(p.id);
  const orderOk = q && (q.type !== 'mcq' || (Array.isArray(p.order) && p.order.length === q.choices.length));
  if (q && orderOk) {
    if (!p.solved) return { q, pending: { ...p, session: session ?? p.session } };
    const fresh = now - (p.solvedAt ?? 0) < CONFIG.solvedGraceMs;
    const sameVisit = fresh && (!session || p.session === session);
    if (sameVisit) return { q, pending: p };
  }
  return freshPending(bank, session);
}

function recordSolve(pending) {
  const firstTry = pending.wrong === 0;
  const s = storage.getStats();
  s.solved += 1;
  if (firstTry) s.firstTry += 1;
  s.streak = firstTry ? s.streak + 1 : 0;
  s.best = Math.max(s.best, s.streak);
  storage.setStats(s);
}

// ---------- rendering ----------

function typeset(el) {
  try {
    window.renderMathInElement?.(el, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
      ],
      throwOnError: false,
    });
  } catch { /* KaTeX unavailable: show raw text */ }
  try {
    if (window.hljs) el.querySelectorAll('pre code').forEach((b) => window.hljs.highlightElement(b));
  } catch { /* highlight.js unavailable */ }
}

const LETTERS = 'ABCDEFGH';

function renderQuestion(bank, q, pending) {
  const diff = q.difficulty ?? 1;
  const body =
    q.type === 'mcq'
      ? `<ol class="choices" role="list">${pending.order
          .map(
            (idx, pos) => `
          <li><button type="button" class="choice" data-index="${idx}">
            <span class="letter" aria-hidden="true">${LETTERS[pos]}</span>
            <span class="choice-text">${renderInline(q.choices[idx])}</span>
          </button></li>`,
          )
          .join('')}</ol>`
      : `<form class="answer-form" novalidate>
          <label class="sr-only" for="answer">Your answer</label>
          <input id="answer" name="answer" type="text" autocomplete="off" autocapitalize="off"
                 autocorrect="off" spellcheck="false" enterkeyhint="go" placeholder="Your answer">
          <button type="submit" class="btn">Check</button>
        </form>`;

  app.innerHTML = `
    <header class="top">
      <span class="brand">QuizMe</span>
      <span class="chip">${escapeHtml(bank.topicName.get(q.topic) ?? q.topic)}</span>
      <span class="difficulty" aria-label="Difficulty ${diff} of 3">${'●'.repeat(diff)}${'○'.repeat(3 - diff)}</span>
    </header>
    <article class="card" id="card">
      <div class="prompt rich">${renderRich(q.prompt)}</div>
      ${body}
      <p class="feedback" id="feedback" role="status" aria-live="polite"></p>
      <section class="reveal" id="reveal" hidden>
        <h2>Answer</h2>
        <p class="reveal-answer">${renderInline(displayAnswer(q))}</p>
        <div class="rich explanation">${renderRich(q.explanation)}</div>
      </section>
    </article>
    <section class="success" id="success" hidden>
      <p class="success-title">Correct!</p>
      <div class="rich explanation" id="success-explanation">${renderRich(q.explanation)}</div>
      <a class="btn primary big" id="continue" href="${unlockUrl()}">Continue to Instagram</a>
      <p class="hint">If nothing happens, check that the “${escapeHtml(CONFIG.unlockShortcutName)}” shortcut is installed.
        <a href="setup.html">Setup guide</a></p>
    </section>`;
  typeset(app);
}

function sync(q, p, flash = '') {
  const max = CONFIG.maxWrongAttempts;
  const left = max - p.wrong;

  if (q.type === 'mcq') {
    for (const btn of app.querySelectorAll('.choice')) {
      const idx = Number(btn.dataset.index);
      const isAnswer = idx === q.answer;
      const eliminated = p.eliminated.includes(idx);
      const showCorrect = (p.revealed || p.solved) && isAnswer;
      btn.classList.toggle('wrong', eliminated);
      btn.classList.toggle('correct', showCorrect);
      btn.disabled = p.solved || eliminated || (p.revealed && !isAnswer);
    }
  } else {
    const input = app.querySelector('#answer');
    input.disabled = p.solved;
    input.placeholder = p.revealed && !p.solved ? 'Type the answer shown below' : 'Your answer';
    app.querySelector('.answer-form button').disabled = p.solved;
  }

  let msg = flash;
  if (!msg && !p.solved) {
    if (p.revealed) msg = q.type === 'mcq' ? 'Tap the correct answer to continue.' : 'Type the answer below to continue.';
    else if (p.wrong > 0) msg = `Not quite. ${left} more ${left === 1 ? 'try' : 'tries'} before the answer is shown.`;
    else msg = `Answer correctly to open Instagram. You get ${max} tries before the answer is shown.`;
  }
  app.querySelector('#feedback').textContent = msg;
  app.querySelector('#reveal').hidden = !p.revealed;
  app.querySelector('#success').hidden = !p.solved;
  app.querySelector('#success-explanation').hidden = p.revealed;
  updateStats();
}

function shake() {
  const card = app.querySelector('#card');
  card.classList.remove('shake');
  void card.offsetWidth; // restart the animation
  card.classList.add('shake');
}

let bankRef = null;

function updateStats() {
  const el = footer.querySelector('.stats');
  if (!el) return;
  const s = storage.getStats();
  el.innerHTML = `Solved <strong>${s.solved}</strong> · First-try streak <strong>${s.streak}</strong> · Best <strong>${s.best}</strong>`;
}

function renderFooter() {
  const enabled = new Set(storage.getTopics());
  const all = enabled.size === 0;
  footer.innerHTML = `
    <p class="stats"></p>
    <details class="topics">
      <summary>Topics</summary>
      <p class="hint">Changes apply to your next question.</p>
      <div class="topic-list">
        ${bankRef.topics
          .map(
            (t) => `<label><input type="checkbox" value="${escapeHtml(t.id)}" ${all || enabled.has(t.id) ? 'checked' : ''}> ${escapeHtml(t.name)}</label>`,
          )
          .join('')}
      </div>
    </details>
    <p><a href="setup.html">Setup guide</a></p>`;
}

footer.addEventListener('change', (e) => {
  if (!e.target.matches('.topic-list input')) return;
  const checked = [...footer.querySelectorAll('.topic-list input:checked')].map((i) => i.value);
  const allChecked = checked.length === bankRef.topics.length;
  storage.setTopics(allChecked || checked.length === 0 ? [] : checked);
});

// ---------- interaction ----------

function attach(q, pending) {
  const save = () => storage.setPending(pending);

  const onCorrect = () => {
    pending.solved = true;
    pending.solvedAt = Date.now();
    save();
    recordSolve(pending);
    sync(q, pending);
    const btn = app.querySelector('#continue');
    btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    btn.focus({ preventScroll: true });
  };

  const onWrong = (flash = '') => {
    if (!pending.revealed) {
      pending.wrong += 1;
      if (pending.wrong >= CONFIG.maxWrongAttempts) pending.revealed = true;
    }
    save();
    shake();
    sync(q, pending, flash);
    if (pending.revealed) app.querySelector('#reveal').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  if (q.type === 'mcq') {
    app.querySelector('.choices').addEventListener('click', (e) => {
      const btn = e.target.closest('.choice');
      if (!btn || btn.disabled || pending.solved) return;
      const idx = Number(btn.dataset.index);
      if (grade(q, idx)) return onCorrect();
      if (!pending.eliminated.includes(idx)) pending.eliminated.push(idx);
      onWrong();
    });
  } else {
    const form = app.querySelector('.answer-form');
    const input = app.querySelector('#answer');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (pending.solved) return;
      const value = input.value;
      if (!value.trim()) return;
      if (grade(q, value)) {
        input.blur();
        return onCorrect();
      }
      onWrong(pending.revealed ? 'That’s not it. Type the answer shown below.' : '');
      input.select();
    });
  }
}

function renderError(err) {
  app.innerHTML = `
    <article class="card">
      <p class="brand">QuizMe</p>
      <p>Couldn’t load questions. Check your connection and try again.</p>
      <p class="hint">${escapeHtml(err?.message ?? err)}</p>
      <button type="button" class="btn" id="retry">Retry</button>
    </article>`;
  app.querySelector('#retry').addEventListener('click', () => location.reload());
}

async function main() {
  try {
    bankRef = await loadBank();
    if (!bankRef.questions.length) throw new Error('Question bank is empty');
  } catch (err) {
    renderError(err);
    return;
  }
  const session = new URLSearchParams(location.search).get('s');
  const { q, pending } = resolveQuestion(bankRef, session, Date.now());
  storage.setPending(pending);
  renderFooter();
  renderQuestion(bankRef, q, pending);
  attach(q, pending);
  sync(q, pending);
}

/**
 * Safari may bring this tab back (same URL, or from the back/forward cache) instead of loading it
 * fresh, which would leave an already-solved question on screen. If the solved question is old
 * enough that this must be a new visit, reload to get a new question. The delay leaves room to
 * switch apps briefly right after solving, e.g. to tap "Continue to Instagram".
 */
function reloadIfStale() {
  const p = storage.getPending();
  if (p?.solved && Date.now() - (p.solvedAt ?? 0) > CONFIG.solvedGraceMs) location.reload();
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') reloadIfStale();
});
window.addEventListener('pageshow', (e) => {
  if (e.persisted) reloadIfStale();
});

main();
