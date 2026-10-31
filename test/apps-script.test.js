// Runs apps-script/Code.gs (Google Apps Script, plain JS) in a sandbox with fake Google services.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');

function loadScript() {
  const rows = [];
  const cache = new Map();
  const logs = [];
  const sheet = {
    name: 'WIWI Calculator Leads',
    getLastRow: () => rows.length,
    appendRow: (row) => rows.push(row),
    setName(name) { this.name = name; },
  };
  const spreadsheet = {
    getSheetByName: (name) => (sheet.name === name ? sheet : null),
    getSheets: () => [sheet],
  };
  const context = {
    console: { error: (...args) => logs.push(args.join(' ')), log: () => {} },
    JSON,
    Date,
    SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    CacheService: {
      getScriptCache: () => ({
        get: (key) => cache.get(key) ?? null,
        put: (key, value) => cache.set(key, value),
      }),
    },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (text) => ({ text, setMimeType() { return this; } }),
    },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, rows, sheet, logs };
}

const post = (context, body) => JSON.parse(context.doPost({ postData: { contents: JSON.stringify(body) } }).text);

const lead = {
  name: 'Fatima Al-Harbi',
  email: 'fatima@example.com',
  whatsapp: '',
  wantsReview: true,
  consent: true,
  action: 'pdf',
  dealName: 'Distribution bid',
  currency: 'SAR',
  value: 400000,
  chance: 35,
  directCost: 90000,
  opportunityCost: 30000,
  egoTax: 18000,
  score: '1.01',
  verdict: 'Thin margin',
  redFlags: 2,
  stopRule: 'costs pass SAR 120,000',
  page: 'https://shamoilp.github.io/wiwi-calculator/',
  website: '',
};

describe('Apps Script lead endpoint', () => {
  let script;
  beforeEach(() => { script = loadScript(); });

  test('saves a valid lead as one row', () => {
    const reply = post(script.context, lead);
    assert.equal(reply.ok, true);
    assert.equal(script.rows.length, 2, 'header row is added, then the lead');
    const row = script.rows[1];
    assert.equal(row[1], 'Fatima Al-Harbi');
    assert.equal(row[4], 'Yes');
    assert.equal(row[8], 400000);
    assert.equal(row[13], '1.01');
  });

  test('stops spreadsheet formulas being injected through text fields', () => {
    post(script.context, { ...lead, name: '=HYPERLINK("http://evil","x")', stopRule: '+1+1' });
    const row = script.rows[1];
    // '' = Sheets' hidden text marker plus a visible apostrophe that survives CSV/Excel export
    assert.equal(row[1], "''=HYPERLINK(\"http://evil\",\"x\")");
    assert.equal(row[16], "''+1+1");
  });

  test('stores only real numbers in number columns', () => {
    post(script.context, { ...lead, value: '=1+1', chance: Infinity });
    const row = script.rows[1];
    assert.equal(row[8], '');
    assert.equal(row[9], '');
  });

  test('cuts overlong text', () => {
    post(script.context, { ...lead, stopRule: 'x'.repeat(1000) });
    assert.equal(script.rows[1][16].length, 500);
  });

  test('rejects a lead without consent or contact details', () => {
    assert.equal(post(script.context, { ...lead, consent: false }).ok, false);
    assert.equal(post(script.context, { ...lead, email: '', whatsapp: '' }).ok, false);
    assert.equal(post(script.context, { ...lead, name: '' }).ok, false);
    assert.equal(script.rows.length, 0);
  });

  test('quietly drops bots that fill the hidden field', () => {
    const reply = post(script.context, { ...lead, website: 'http://spam.example' });
    assert.equal(reply.ok, true);
    assert.equal(script.rows.length, 0);
  });

  test('refuses bad JSON without crashing', () => {
    const reply = JSON.parse(script.context.doPost({ postData: { contents: 'not json' } }).text);
    assert.equal(reply.ok, false);
  });

  test('slows down a flood of submissions', () => {
    let lastReply;
    for (let i = 0; i < 40; i += 1) lastReply = post(script.context, lead);
    assert.equal(lastReply.ok, false);
    assert.equal(lastReply.error, 'busy');
    assert.equal(script.rows.length, 1 + 30);
  });

  test('checks email and WhatsApp formats itself, not just in the browser', () => {
    assert.equal(post(script.context, { ...lead, email: 'x' }).ok, false);
    assert.equal(post(script.context, { ...lead, email: '', whatsapp: '12' }).ok, false);
    assert.equal(script.rows.length, 0);
  });

  test('stores WhatsApp numbers as a click-to-chat link', () => {
    post(script.context, { ...lead, email: '', whatsapp: '+966 50 123 4567' });
    assert.equal(script.rows[1][3], 'https://wa.me/966501234567');
  });

  test('refuses oversized requests', () => {
    const reply = post(script.context, { ...lead, padding: 'x'.repeat(5000) });
    assert.equal(reply.ok, false);
    assert.equal(script.rows.length, 0);
  });

  test('writes to a tab named Leads, naming the first tab on first use', () => {
    post(script.context, lead);
    assert.equal(script.sheet.name, 'Leads');
  });

  test('never logs the request body', () => {
    script.context.doPost({ postData: { contents: '{"name":"Secret Person", broken' } });
    assert.equal(script.logs.length, 1);
    assert.doesNotMatch(script.logs[0], /Secret/);
  });

  test('answers a health check', () => {
    const reply = JSON.parse(script.context.doGet().text);
    assert.equal(reply.ok, true);
  });
});
