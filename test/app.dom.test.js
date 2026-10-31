// Drives the real index.html + src/app.js in jsdom: typing, buttons and share links.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { loadPage, settle } from './helpers/load-page.js';

const START_URL = 'https://example.test/worth-winning/?n=Shared+deal&c=AED&v=200000&p=50&d=50000&o=10000&f=10000';

let window;
let $;
let type;
let click;
let tick;

before(async () => {
  ({ window, $, type, click, tick } = await loadPage({ url: START_URL }));
});

describe('page wiring', () => {
  test('opens a share link with its numbers already scored', () => {
    assert.equal($('name').value, 'Shared deal');
    assert.equal($('currency').value, 'AED');
    assert.equal($('flag-0').checked, true);
    assert.equal($('result-body').hidden, false);
    // 200,000 x 50% / (50,000 + 10,000) = 1.666…, shown cut to 1.66
    assert.equal($('out-score').textContent, '1.66');
    assert.equal($('out-verdict').textContent, 'Worth pursuing');
    assert.match($('out-cost').textContent, /AED/);
    assert.equal($('mini-score').hidden, false);
    assert.equal($('mini-value').textContent, '1.66');
  });

  test('re-scores as the user types', () => {
    type('egoTax', '40,000');
    // 100,000 / 100,000 = 1.00
    assert.equal($('out-score').textContent, '1.00');
    assert.equal(window.document.querySelector('.result').dataset.verdict, 'thin');
  });

  test('with no lead endpoint set, the report is unlocked for everyone', () => {
    assert.ok(window.document.body.classList.contains('unlocked'));
    click('print');
    assert.equal(window.printCount, 1);
    assert.equal($('unlock-dialog').hasAttribute('open'), false);
  });

  test('keeps the address bar in step with the form', () => {
    assert.match(window.location.search, /e=40%2C000/);
  });

  test('shows a field error and hides the score for a bad number', () => {
    type('directCost', 'lots');
    assert.equal($('directCost').getAttribute('aria-invalid'), 'true');
    assert.match($('directCost-error').textContent, /number/);
    assert.equal($('result-body').hidden, true);
    type('directCost', '50000');
    assert.equal($('directCost-error').textContent, '');
    assert.equal($('result-body').hidden, false);
  });

  test('keeps the slider and the chance box in step', () => {
    type('chance', '20');
    assert.equal($('chance-range').value, '20');
    $('chance-range').value = '65';
    $('chance-range').dispatchEvent(new window.Event('input', { bubbles: true }));
    assert.equal($('chance').value, '65');
  });

  test('suggests an ego tax from ticked red flags and applies it', () => {
    tick('flag-1', true);
    assert.equal($('suggest').hidden, false);
    assert.match($('suggest-text').textContent, /AED\s?10,000/);
    click('use-suggestion');
    assert.equal($('egoTax').value, '10,000');
  });

  test('loads the worked example', () => {
    click('load-example');
    assert.equal($('currency').value, 'SAR');
    // 140,000 / 138,000 = 1.01
    assert.equal($('out-score').textContent, '1.01');
    assert.match($('out-breakeven').textContent, /35%/);
  });

  test('says when even a certain win cannot pay', () => {
    type('value', '100000');
    assert.equal($('out-verdict').textContent, 'Expensive regret');
    assert.match($('out-breakeven').textContent, /certain win/);
  });

  test('writes the red flags and stop rule into the print summary', () => {
    const printed = [...$('print-flags').children].map((item) => item.textContent);
    assert.equal(printed.length, 2);
    assert.match($('print-stop').textContent, /^I walk away if costs pass/);
  });

  test('lists the deal inputs in the print report', () => {
    assert.match($('print-value').textContent, /SAR\s?100,000/);
    assert.equal($('print-chance').textContent, '35%');
    assert.match($('print-direct').textContent, /SAR\s?90,000/);
    assert.match($('print-opportunity').textContent, /SAR\s?30,000/);
    assert.match($('print-ego').textContent, /SAR\s?18,000/);
  });

  test('treats typed text as text, never as HTML', () => {
    type('name', '<img src=x onerror=alert(1)>');
    assert.equal($('out-name').textContent, '<img src=x onerror=alert(1)>');
    assert.equal($('out-name').querySelector('img'), null);
  });

  test('shows the empty state until the key numbers are in', async () => {
    $('wiwi-form').reset();
    await settle();
    assert.equal($('result-empty').hidden, false);
    assert.equal($('result-body').hidden, true);
    assert.equal($('mini-score').hidden, true);
    assert.equal($('currency').value, 'SAR');
  });
});
