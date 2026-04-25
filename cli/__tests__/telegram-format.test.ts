import { describe, expect, it } from 'vitest';
import { escapeHtml, formatError, formatResult } from '../src/telegram/format.js';

describe('telegram format', () => {
  it('renders an empty array as a soft "(no rows)" message', () => {
    expect(formatResult([])).toBe('<i>(no rows)</i>');
  });

  it('renders an object array as a Markdown table inside a <pre>', () => {
    const out = formatResult([
      { name: 'Alice', amount: 120.5, status: 'paid' },
      { name: 'Bob', amount: 45.0, status: 'pending' },
    ]);
    expect(out).toContain('<pre>');
    expect(out).toContain('name');
    expect(out).toContain('Alice');
    expect(out).toContain('paid');
    expect(out).toContain('2 rows');
  });

  it('truncates with footer when more than maxRows', () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `row${i}` }));
    const out = formatResult(rows);
    expect(out).toContain('showing 30 of 100 rows');
  });

  it('handles scalar arrays via JSON fallback', () => {
    const out = formatResult([1, 2, 3, 'foo']);
    expect(out).toContain('<pre>');
    expect(out).toContain('foo');
  });

  it('handles single objects via JSON fallback', () => {
    const out = formatResult({ total: 1377, n: 3 });
    expect(out).toContain('1377');
    expect(out).toContain('"n": 3');
  });

  it('escapes HTML in cell values so user data cannot inject markup', () => {
    const out = formatResult([{ payload: '<script>alert(1)</script>' }]);
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;script&gt;');
  });

  it('formatError wraps in <pre> with the ❌ prefix', () => {
    const out = formatError(new Error('boom'));
    expect(out).toMatch(/^❌/);
    expect(out).toContain('<pre>');
    expect(out).toContain('boom');
  });

  it('escapeHtml handles ampersand, lt, gt', () => {
    expect(escapeHtml('a & b < c > d')).toBe('a &amp; b &lt; c &gt; d');
  });

  it('truncates very wide cells with an ellipsis', () => {
    const long = 'x'.repeat(100);
    const out = formatResult([{ huge: long }]);
    // Default max col width is 24; the rendered cell should not contain the full 100 chars.
    expect(out).toContain('xxxxxxxxxxxxxxxxxxxxxxx…');
  });
});
