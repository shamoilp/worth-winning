// The three trilogy stages on the page: WIFI (before), WIDI (during), WIWI (score + post-mortem).
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { loadPage } from './helpers/load-page.js';

const START_URL = 'https://example.test/wiwi-calculator/?v=400000&p=35&d=90000&o=30000#wifi';

let page;
const visible = (id) => !page.$(id).hidden;

function answer(name, index, yes) {
  page.tick(`${name}-${index}-${yes ? 'yes' : 'no'}`, true);
}

before(async () => {
  page = await loadPage({ url: START_URL });
});

describe('stage tabs', () => {
  test('opens the stage named in the link', () => {
    assert.equal(visible('stage-wifi'), true);
    assert.equal(visible('stage-wiwi'), false);
    assert.equal(page.$('tab-wifi').getAttribute('aria-selected'), 'true');
    assert.equal(page.$('tab-wiwi').getAttribute('aria-selected'), 'false');
  });

  test('switches stage when a tab is clicked, and keeps the stage in the address', () => {
    page.click('tab-widi');
    assert.equal(visible('stage-widi'), true);
    assert.equal(visible('stage-wifi'), false);
    assert.equal(page.window.location.hash, '#widi');
    page.click('tab-wifi');
  });

  test('each tab is wired to the panel it shows', () => {
    for (const stage of ['wifi', 'widi', 'wiwi']) {
      const panel = page.$(page.$(`tab-${stage}`).getAttribute('aria-controls'));
      assert.equal(panel.id, `stage-${stage}`);
      assert.equal(panel.getAttribute('role'), 'tabpanel');
      assert.equal(panel.getAttribute('aria-labelledby'), `tab-${stage}`);
    }
  });

  test('follows the address when the hash changes (back button, edited link)', () => {
    page.window.location.hash = '#widi';
    page.window.dispatchEvent(new page.window.HashChangeEvent('hashchange'));
    assert.equal(visible('stage-widi'), true);
    page.click('tab-wifi');
  });

  test('arrow keys move between tabs', () => {
    const key = (name) => page.$('tab-wifi').dispatchEvent(new page.window.KeyboardEvent('keydown', { key: name, bubbles: true }));
    key('ArrowRight');
    assert.equal(page.$('tab-widi').getAttribute('aria-selected'), 'true');
    key('ArrowLeft');
    assert.equal(page.$('tab-wifi').getAttribute('aria-selected'), 'true');
  });
});

describe('WIFI stage', () => {
  test('waits for all three answers', () => {
    answer('wifi', 0, true);
    assert.equal(visible('wifi-verdict'), false);
  });

  test('any no gives a WIFI warning', () => {
    answer('wifi', 1, false);
    answer('wifi', 2, true);
    assert.equal(visible('wifi-verdict'), true);
    assert.equal(page.$('wifi-label').textContent, 'WIFI warning');
  });

  test('shows the hype gap', () => {
    page.type('perceived', '500,000');
    page.type('actual', '200,000');
    assert.match(page.$('hype-text').textContent, /60%/);
    assert.match(page.$('hype-text').textContent, /Mostly hype/);
  });

  test('carries the real value into the WIWI score', () => {
    page.click('use-actual');
    assert.equal(visible('stage-wiwi'), true);
    assert.equal(page.$('value').value, '200,000');
    // 200,000 x 35% / 120,000 = 0.58
    assert.equal(page.$('out-score').textContent, '0.58');
  });
});

describe('WIDI stage', () => {
  test('"spent too much to stop" alone puts you in WIDI territory', () => {
    page.click('tab-widi');
    answer('widi', 0, true);
    for (const index of [1, 2, 3, 4]) answer('widi', index, false);
    assert.match(page.$('widi-label').textContent, /WIDI territory/);
  });

  test('re-scores with fresh eyes, ignoring money already spent', () => {
    page.type('freshValue', '400,000');
    page.type('freshChance', '40');
    page.type('spent', '150,000');
    page.type('remaining', '60,000');
    page.type('remainingOpportunity', '20,000');
    assert.equal(page.$('fresh-score').textContent, '2.00');
    assert.match(page.$('fresh-sunk').textContent, /0\.69/);
  });
});

describe('post-mortem', () => {
  test('scores a finished deal on what it actually delivered', () => {
    page.click('tab-wiwi');
    page.type('actualValue', '100,000');
    page.type('actualDirect', '120,000');
    assert.equal(page.$('pm-score').textContent, '0.83');
    assert.equal(page.$('pm-label').textContent, 'Pyrrhic victory');
    assert.match(page.$('pm-compare').textContent, /0\.58/);
  });
});

describe('report and share link', () => {
  test('the print report includes every stage that was done', () => {
    assert.match(page.$('print-wifi').textContent, /WIFI warning/);
    assert.match(page.$('print-widi').textContent, /WIDI territory/);
    assert.match(page.$('print-pm').textContent, /Pyrrhic/);
  });

  test('verdicts are announced to screen readers', () => {
    for (const id of ['wifi-verdict', 'widi-verdict', 'fresh-result', 'pm-result']) {
      assert.equal(page.$(id).closest('[role="status"]') !== null, true, `${id} sits in a status region`);
    }
  });

  test('the share link carries the trilogy answers too', () => {
    const search = page.window.location.search;
    assert.match(search, /wf=yny/);
    assert.match(search, /wd=ynnnn/);
    assert.match(search, /mv=100%2C000/);
  });
});
