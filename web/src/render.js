// Small Markdown subset for question text. Supported:
//   fenced code blocks (```lang ... ```), `inline code`, **bold**, paragraphs and line breaks.
// Math ($...$ and $$...$$) is left alone here and typeset afterwards by KaTeX auto-render,
// which skips <code>/<pre>. Everything else is HTML-escaped.

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function inline(escaped) {
  return escaped
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

/** Render a block of question text (prompt or explanation) to HTML. */
export function renderRich(src) {
  const blocks = [];
  const withPlaceholders = String(src ?? '').replace(/```([\w+-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const cls = lang ? ` class="language-${escapeHtml(lang)}"` : '';
    blocks.push(`<pre><code${cls}>${escapeHtml(code.replace(/\n$/, ''))}</code></pre>`);
    return `\n\n\u0000${blocks.length - 1}\u0000\n\n`;
  });

  return withPlaceholders
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const block = p.match(/^\u0000(\d+)\u0000$/);
      if (block) return blocks[Number(block[1])];
      return `<p>${inline(escapeHtml(p)).replace(/\n/g, '<br>')}</p>`;
    })
    .join('');
}

/** Render a single line (MCQ choice, revealed answer). No paragraphs. */
export function renderInline(src) {
  return inline(escapeHtml(src ?? ''));
}
