// Pure grading functions. No DOM access, so they run in the browser and in Node tests,
// and a future native version can port them directly.

const SMART_QUOTES = { '‘': "'", '’': "'", '“': '"', '”': '"' };

/**
 * Normalize free-text input so trivial differences don't count as wrong:
 * case, iOS smart quotes, surrounding whitespace/quotes, trailing punctuation,
 * repeated spaces, spacing around commas, and hyphens/underscores between letters
 * ("Round-Robin" == "round robin").
 */
export function normalize(input) {
  return String(input ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[‘’“”]/g, (c) => SMART_QUOTES[c])
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ',')
    .replace(/([a-z])[-_]+(?=[a-z])/g, '$1 ')
    .trim()
    .replace(/^["'`]+/, '')
    .replace(/["'`.,;:!?]+$/, '')
    .trim();
}

/**
 * Parse a numeric answer. Accepts integers, decimals, scientific notation,
 * hex/binary/octal literals (0x1F, 0b101, 0o17), simple fractions (3/4),
 * thousands separators (1,000) and a trailing unit (8 ms, 2.5x, 4 MiB).
 * Returns NaN if the input isn't a number.
 */
export function parseNumber(input) {
  let s = String(input ?? '').trim().toLowerCase().replace(/\s+/g, '');
  if (s === '') return NaN;

  const neg = s.startsWith('-');
  const unsigned = s.replace(/^[-+]/, '');
  // Radix literals (and bare/partial prefixes like "0x", which Number() rejects as NaN).
  if (/^0[xbo][0-9a-f]*$/.test(unsigned)) {
    const n = Number(unsigned);
    return neg ? -n : n;
  }

  if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');

  const frac = s.match(/^([-+]?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
  if (frac) {
    const den = Number(frac[2]);
    return den === 0 ? NaN : Number(frac[1]) / den;
  }

  if (/^[-+]?\.?\d/.test(s)) {
    const n = Number(s);
    if (!Number.isNaN(n)) return n;
  }

  const withUnit = s.match(/^([-+]?\d*\.?\d+(?:e[-+]?\d+)?)[a-zµ%]+$/);
  return withUnit ? Number(withUnit[1]) : NaN;
}

const DEFAULT_TOLERANCE = 1e-6;

export function gradeMcq(question, choiceIndex) {
  return Number.isInteger(choiceIndex) && choiceIndex === question.answer;
}

export function gradeText(question, input) {
  const accepted = question.answer;
  const match = question.match ?? 'exact';
  if (match === 'numeric') {
    const value = parseNumber(input);
    if (Number.isNaN(value)) return false;
    const tol = question.tolerance ?? DEFAULT_TOLERANCE;
    return accepted.some((a) => Math.abs(parseNumber(a) - value) <= tol);
  }
  const normalized = normalize(input);
  if (normalized === '') return false;
  if (match === 'regex') {
    return accepted.some((pattern) => new RegExp(pattern, 'i').test(normalized));
  }
  return accepted.some((a) => normalize(a) === normalized);
}

/** Grade any question. `response` is a choice index for MCQ, or a string for text questions. */
export function grade(question, response) {
  return question.type === 'mcq' ? gradeMcq(question, response) : gradeText(question, response);
}

/** Human-readable correct answer, shown when the answer is revealed. */
export function displayAnswer(question) {
  if (question.display) return question.display;
  if (question.type === 'mcq') return question.choices[question.answer];
  return question.answer[0];
}
