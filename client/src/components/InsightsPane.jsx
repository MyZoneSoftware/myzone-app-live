import React from 'react';

/**
 * Minimal Markdown-to-HTML for headings, bold, italics, lists, code ticks.
 * Intent: clean, professional pane without extra deps.
 */
function mdToHtml(md) {
  if (!md) return '';

  // escape HTML first
  let txt = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g,'&gt;');

  // headings ## ..  (treat ### as h4 for compactness)
  txt = txt
    .replace(/^###\s?(.*)$/gm, '<h4>$1</h4>')
    .replace(/^##\s?(.*)$/gm, '<h3>$1</h3>')
    .replace(/^#\s?(.*)$/gm, '<h2>$1</h2>');

  // inline code `...`
  txt = txt.replace(/`([^`]+)`/g, '<code>$1</code>');

  // bold **...** and italic *...*
  txt = txt.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  txt = txt.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // lists - ... / * ...
  const lines = txt.split('\n');
  let html = '';
  let inList = false;
  for (let i=0;i<lines.length;i++) {
    const line = lines[i].trim();
    const isBullet = /^[-*]\s+/.test(line);
    if (isBullet && !inList) { html += '<ul>'; inList = true; }
    if (!isBullet && inList) { html += '</ul>'; inList = false; }

    if (isBullet) {
      html += `<li>${line.replace(/^[-*]\s+/, '')}</li>`;
    } else if (line.length === 0) {
      html += '<p class="spacer"></p>';
    } else if (/^<h[234]>/.test(line)) {
      html += line;
    } else {
      html += `<p>${line}</p>`;
    }
  }
  if (inList) html += '</ul>';

  return html;
}

export default function InsightsPane({ content, status, error }) {
  let body = '';
  if (status === 'loading') body = '<p class="muted">Analyzing your query…</p>';
  else if (status === 'error') body = `<p class="err">Error: ${error || 'Search failed'}</p>`;
  else body = mdToHtml(content);

  return (
    <section className="insights-pane" role="region" aria-label="AI Insights">
      <div className="insights-head">
        <div className="insights-title">AI Insights</div>
        <div className="insights-status">
          {status === 'loading' ? 'Live AI: analyzing…' :
           status === 'done' ? 'Live AI: updated' :
           status === 'typing' ? 'Live AI: waiting for pause…' : ''}
        </div>
      </div>
      <div
        className="insights-body"
        dangerouslySetInnerHTML={{ __html: body }}
      />
    </section>
  );
}
