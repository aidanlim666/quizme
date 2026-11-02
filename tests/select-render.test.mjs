import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickQuestion, pushRecent, shuffledIndices } from '../web/src/select.js';
import { renderRich, renderInline, escapeHtml } from '../web/src/render.js';

const bank = [
  { id: 'a-001', topic: 'a' },
  { id: 'a-002', topic: 'a' },
  { id: 'b-001', topic: 'b' },
];

const seq = (...values) => {
  let i = 0;
  return () => values[i++ % values.length];
};

test('pickQuestion respects enabled topics', () => {
  for (let i = 0; i < 20; i++) {
    assert.equal(pickQuestion(bank, { enabledTopics: ['b'] }).topic, 'b');
  }
});

test('pickQuestion: empty or unknown topic list falls back to all questions', () => {
  assert.ok(pickQuestion(bank, { enabledTopics: [] }));
  assert.ok(pickQuestion(bank, { enabledTopics: ['nope'] }));
});

test('pickQuestion avoids recent ids until the pool is exhausted', () => {
  assert.equal(pickQuestion(bank, { recentIds: ['a-001', 'b-001'] }).id, 'a-002');
  // Everything is recent, so it still returns something.
  assert.ok(pickQuestion(bank, { recentIds: ['a-001', 'a-002', 'b-001'] }));
});

test('pickQuestion uses rng and returns null for empty bank', () => {
  assert.equal(pickQuestion(bank, { rng: () => 0 }).id, 'a-001');
  assert.equal(pickQuestion(bank, { rng: () => 0.99 }).id, 'b-001');
  assert.equal(pickQuestion([], {}), null);
});

test('pushRecent dedupes and caps length', () => {
  assert.deepEqual(pushRecent(['x', 'y'], 'x', 5), ['y', 'x']);
  assert.deepEqual(pushRecent(['a', 'b', 'c'], 'd', 3), ['b', 'c', 'd']);
});

test('shuffledIndices is a permutation', () => {
  for (let n = 1; n <= 6; n++) {
    const order = shuffledIndices(n);
    assert.deepEqual([...order].sort((a, b) => a - b), Array.from({ length: n }, (_, i) => i));
  }
  assert.deepEqual(shuffledIndices(3, seq(0.99)), [0, 1, 2]);
});

test('escapeHtml', () => {
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
});

test('renderInline: code, bold, and escaping', () => {
  assert.equal(renderInline('`<nav>`'), '<code>&lt;nav&gt;</code>');
  assert.equal(renderInline('**not** a subspace'), '<strong>not</strong> a subspace');
  assert.equal(renderInline('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
});

test('renderRich: paragraphs, code blocks, math left for KaTeX', () => {
  const html = renderRich('What prints?\n\n```js\nif (a < b) console.log("hi");\n```\n\nThen $x^2$.');
  assert.equal(
    html,
    '<p>What prints?</p><pre><code class="language-js">if (a &lt; b) console.log(&quot;hi&quot;);</code></pre><p>Then $x^2$.</p>',
  );
});

test('renderRich: code block directly after text without blank line', () => {
  const html = renderRich('Output?\n```c\nfork();\n```');
  assert.equal(html, '<p>Output?</p><pre><code class="language-c">fork();</code></pre>');
});

test('renderRich: single newlines become <br>', () => {
  assert.equal(renderRich('a\nb'), '<p>a<br>b</p>');
});
