// The unlock flow: with a lead endpoint set, the PDF and share link need contact details first.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { loadPage, settle } from './helpers/load-page.js';

const ENDPOINT = 'https://script.google.com/macros/s/TEST/exec';
const START_URL = 'https://example.test/wiwi-calculator/?v=300000&p=60&d=80000&o=20000';

const requests = [];
let nextReply = { ok: true };
let page;

function fillLead({ name = 'Fatima Al-Harbi', email = 'fatima@example.com', consent = true } = {}) {
  page.$('lead-name').value = name;
  page.$('lead-email').value = email;
  page.$('lead-consent').checked = consent;
}

before(async () => {
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return { json: async () => nextReply };
  };
  page = await loadPage({ url: START_URL, endpoint: ENDPOINT });
});

describe('unlock flow', () => {
  test('starts locked, and the score is still free', () => {
    assert.equal(page.window.document.body.classList.contains('unlocked'), false);
    assert.equal(page.$('out-score').textContent, '1.80');
  });

  test('does not write deal numbers into the address bar while locked', () => {
    page.type('value', '310000');
    assert.equal(page.window.location.search, '?v=300000&p=60&d=80000&o=20000');
    page.type('value', '300000');
  });

  test('asking for the PDF opens the unlock form instead of printing', () => {
    page.click('print');
    assert.equal(page.$('unlock-dialog').hasAttribute('open'), true);
    assert.match(page.$('unlock-action-text').textContent, /PDF/);
    assert.equal(page.window.printCount ?? 0, 0);
  });

  test('blank details show errors and send nothing', async () => {
    fillLead({ name: '', email: '', consent: false });
    page.submit('unlock-form');
    await settle();
    assert.match(page.$('lead-name-error').textContent, /name/);
    assert.match(page.$('lead-email-error').textContent, /email or a WhatsApp/);
    assert.match(page.$('lead-consent-error').textContent, /agree/);
    assert.equal(requests.length, 0);
  });

  test('a server error keeps the form open and says so', async () => {
    nextReply = { ok: false, error: 'server' };
    fillLead();
    page.submit('unlock-form');
    await settle();
    assert.equal(requests.length, 1);
    assert.equal(page.$('unlock-dialog').hasAttribute('open'), true);
    assert.match(page.$('unlock-status').textContent, /Couldn't save/);
    assert.equal(page.window.printCount ?? 0, 0);
  });

  test('valid details are sent to the sheet, then the PDF prints', async () => {
    nextReply = { ok: true };
    fillLead();
    page.$('lead-review').checked = true;
    page.submit('unlock-form');
    await settle();

    const { url, options } = requests.at(-1);
    const sent = JSON.parse(options.body);
    assert.equal(url, ENDPOINT);
    assert.equal(options.method, 'POST');
    assert.equal(sent.name, 'Fatima Al-Harbi');
    assert.equal(sent.wantsReview, true);
    assert.equal(sent.action, 'pdf');
    assert.equal(sent.score, '1.80');
    assert.equal(sent.value, 300000);

    assert.equal(page.$('unlock-dialog').hasAttribute('open'), false);
    assert.equal(page.window.printCount, 1);
  });

  test('stays unlocked: remembered in this browser, no second form', () => {
    assert.ok(page.window.document.body.classList.contains('unlocked'));
    assert.equal(page.window.localStorage.getItem('wiwi-unlocked'), '1');
    page.click('copy-link');
    assert.equal(page.$('unlock-dialog').hasAttribute('open'), false);
  });

  test('once unlocked, the address bar carries the share link again', () => {
    page.type('chance', '55');
    assert.match(page.window.location.search, /p=55/);
  });

  test('has a hidden spam-trap field that people never see', () => {
    const trap = page.$('lead-website');
    assert.equal(trap.tabIndex, -1);
    assert.equal(trap.closest('[aria-hidden="true"]') !== null, true);
  });
});
