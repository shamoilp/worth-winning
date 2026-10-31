// Loads the real index.html + src/app.js into jsdom. Each test file runs in its own process,
// so app.js (a module that runs once on import) gets a fresh page per file.
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

export async function loadPage({ url, endpoint = '' }) {
  const page = html.replace(
    /<meta name="lead-endpoint" content="[^"]*">/,
    `<meta name="lead-endpoint" content="${endpoint}">`,
  );
  const dom = new JSDOM(page, { url, pretendToBeVisual: true });
  const { window } = dom;
  for (const key of ['window', 'document', 'location', 'history', 'Option', 'navigator', 'localStorage']) {
    Object.defineProperty(globalThis, key, { value: window[key], configurable: true, writable: true });
  }
  window.print = () => { window.printCount = (window.printCount ?? 0) + 1; };
  await import('../../src/app.js');

  const $ = (id) => window.document.getElementById(id);
  const fire = (id, type, EventType = window.Event) => $(id).dispatchEvent(new EventType(type, { bubbles: true }));
  return {
    window,
    $,
    type(id, text) { $(id).value = text; fire(id, 'input'); },
    click(id) { fire(id, 'click', window.MouseEvent); },
    tick(id, checked) { $(id).checked = checked; fire(id, 'change'); },
    submit(id) { fire(id, 'submit', window.SubmitEvent ?? window.Event); },
  };
}

export const settle = () => new Promise((resolve) => setTimeout(resolve, 10));
