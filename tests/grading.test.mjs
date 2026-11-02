import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, parseNumber, gradeText, gradeMcq, grade, displayAnswer } from '../web/src/grading.js';

test('normalize: case, whitespace, quotes, trailing punctuation', () => {
  assert.equal(normalize('  Content-Type  '), 'content type');
  assert.equal(normalize('ROUND_ROBIN'), 'round robin');
  assert.equal(normalize('"object"'), 'object');
  assert.equal(normalize('“object”'), 'object'); // iOS smart quotes
  assert.equal(normalize('false.'), 'false');
  assert.equal(normalize('1,  3 ,4'), '1,3,4');
  assert.equal(normalize('a   b\tc'), 'a b c');
  assert.equal(normalize(null), '');
});

test('normalize: keeps minus signs and dotted numbers intact', () => {
  assert.equal(normalize('-1'), '-1');
  assert.equal(normalize('255.255.240.0'), '255.255.240.0');
  assert.equal(normalize('exec()'), 'exec()');
});

test('parseNumber: formats', () => {
  assert.equal(parseNumber('42'), 42);
  assert.equal(parseNumber(' -7 '), -7);
  assert.equal(parseNumber('+5'), 5);
  assert.equal(parseNumber('0.75'), 0.75);
  assert.equal(parseNumber('.5'), 0.5);
  assert.equal(parseNumber('1e3'), 1000);
  assert.equal(parseNumber('0x2F'), 47);
  assert.equal(parseNumber('-0x10'), -16);
  assert.equal(parseNumber('0b101'), 5);
  assert.equal(parseNumber('0o17'), 15);
  assert.equal(parseNumber('3/4'), 0.75);
  assert.equal(parseNumber('1,000,000'), 1_000_000);
  assert.equal(parseNumber('8 ms'), 8);
  assert.equal(parseNumber('2.5x'), 2.5);
  assert.equal(parseNumber('4 MiB'), 4);
});

test('parseNumber: rejects non-numbers', () => {
  for (const bad of ['', '   ', 'abc', 'Infinity', '1/0', 'x5', '0x', '--3']) {
    assert.ok(Number.isNaN(parseNumber(bad)), `expected NaN for ${JSON.stringify(bad)}`);
  }
});

test('gradeText exact', () => {
  const q = { type: 'text', answer: ['Content-Type'] };
  assert.ok(gradeText(q, 'content-type'));
  assert.ok(gradeText(q, 'Content Type'));
  assert.ok(!gradeText(q, 'Content-Length'));
  assert.ok(!gradeText(q, ''));
  assert.ok(!gradeText(q, '   '));
});

test('gradeText exact with multiple accepted answers', () => {
  const q = { type: 'text', answer: ['DISTINCT', 'SELECT DISTINCT'] };
  assert.ok(gradeText(q, 'distinct'));
  assert.ok(gradeText(q, 'select distinct'));
  assert.ok(!gradeText(q, 'unique'));
});

test('gradeText numeric with default and custom tolerance', () => {
  const q = { type: 'text', match: 'numeric', answer: ['5'] };
  assert.ok(gradeText(q, '5'));
  assert.ok(gradeText(q, '5.0'));
  assert.ok(gradeText(q, '10/2'));
  assert.ok(!gradeText(q, '5.01'));
  assert.ok(!gradeText(q, 'five'));
  assert.ok(!gradeText(q, ''));

  const t = { type: 'text', match: 'numeric', tolerance: 0.01, answer: ['2.5'] };
  assert.ok(gradeText(t, '2.505'));
  assert.ok(gradeText(t, '5/2'));
  assert.ok(!gradeText(t, '2.52'));
});

test('gradeText numeric: empty input is never 0', () => {
  const q = { type: 'text', match: 'numeric', answer: ['0'] };
  assert.ok(!gradeText(q, ''));
  assert.ok(gradeText(q, '0'));
});

test('gradeText regex', () => {
  const q = { type: 'text', match: 'regex', answer: ['^(0b)?1111 ?1011$'], display: '11111011' };
  assert.ok(gradeText(q, '11111011'));
  assert.ok(gradeText(q, '1111 1011'));
  assert.ok(gradeText(q, '0b11111011'));
  assert.ok(!gradeText(q, '00000101'));

  const exec = { type: 'text', match: 'regex', answer: ['^exec(l|lp|le|v|vp|ve|vpe)?(\\(\\))?$'] };
  for (const ok of ['exec', 'execve', 'execvp()', 'EXECLP', 'exec()']) assert.ok(gradeText(exec, ok), ok);
  for (const no of ['fork', 'execute', 'spawn']) assert.ok(!gradeText(exec, no), no);
});

test('gradeMcq and grade dispatch', () => {
  const q = { type: 'mcq', choices: ['a', 'b', 'c'], answer: 2 };
  assert.ok(gradeMcq(q, 2));
  assert.ok(!gradeMcq(q, 0));
  assert.ok(!gradeMcq(q, '2'));
  assert.ok(grade(q, 2));
  assert.ok(grade({ type: 'text', answer: ['x'] }, 'X'));
});

test('displayAnswer', () => {
  assert.equal(displayAnswer({ type: 'mcq', choices: ['a', 'b'], answer: 1 }), 'b');
  assert.equal(displayAnswer({ type: 'text', answer: ['404'] }), '404');
  assert.equal(displayAnswer({ type: 'text', answer: ['^x$'], display: 'x' }), 'x');
});
