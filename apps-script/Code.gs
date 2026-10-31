// WIWI calculator lead endpoint. Paste into the lead sheet: Extensions > Apps Script.
// Also paste appsscript.json, which limits the script to this one spreadsheet.
// Deploy > New deployment > Web app, Execute as: Me, Who has access: Anyone.
// Each valid POST from the calculator becomes one row in the "Leads" tab.

const SHEET_NAME = 'Leads';
const HEADERS = [
  'Received', 'Name', 'Email', 'WhatsApp', 'Wants review', 'Unlocked for', 'Deal name', 'Currency',
  'Value', 'Chance %', 'Direct cost', 'Opportunity cost', 'Ego tax', 'WIWI score', 'Verdict',
  'Red flags ticked', 'Stop rule', 'Page',
];
const MAX_BODY_CHARS = 4000;
const MAX_TEXT = 120;
const MAX_STOP_RULE = 500;
const MAX_PER_WINDOW = 30;
const WINDOW_SECONDS = 600;
const LOCK_WAIT_MS = 10000;
const RATE_KEY = 'wiwi-submissions';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PHONE_DIGITS = 7;
const MAX_PHONE_DIGITS = 15;

function doPost(e) {
  try {
    const body = e && e.postData ? String(e.postData.contents) : '';
    if (body.length > MAX_BODY_CHARS) return reply_({ ok: false, error: 'invalid' });
    const data = JSON.parse(body);
    if (String(data.website || '') !== '') return reply_({ ok: true }); // spam trap: pretend it worked
    if (!isValid_(data)) return reply_({ ok: false, error: 'invalid' });
    return reply_(saveLead_(buildRow_(data, new Date())) ? { ok: true } : { ok: false, error: 'busy' });
  } catch (error) {
    // Log only the error type: a JSON parse message can quote the request body, which holds personal data.
    console.error(`Lead not saved: ${error && error.name}`);
    return reply_({ ok: false, error: 'server' });
  }
}

function doGet() {
  return reply_({ ok: true, service: 'wiwi-leads' });
}

function isValid_(data) {
  const name = String(data.name || '').trim();
  const email = String(data.email || '').trim();
  const whatsapp = String(data.whatsapp || '').trim();
  if (data.consent !== true || name === '' || name.length > MAX_TEXT) return false;
  if (email === '' && whatsapp === '') return false;
  if (email !== '' && (email.length > MAX_TEXT || !EMAIL_PATTERN.test(email))) return false;
  return whatsapp === '' || phoneDigits_(whatsapp) !== '';
}

/** Saves one row unless the flood limit is hit. The count is checked inside the lock so bursts can't overshoot. */
function saveLead_(row) {
  const lock = LockService.getScriptLock();
  lock.waitLock(LOCK_WAIT_MS);
  try {
    const cache = CacheService.getScriptCache();
    const count = Number(cache.get(RATE_KEY) || 0);
    if (count >= MAX_PER_WINDOW) return false;
    cache.put(RATE_KEY, String(count + 1), WINDOW_SECONDS);
    const sheet = leadSheet_();
    if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
    sheet.appendRow(row);
    return true;
  } finally {
    lock.releaseLock();
  }
}

function leadSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const existing = spreadsheet.getSheetByName(SHEET_NAME);
  if (existing) return existing;
  const first = spreadsheet.getSheets()[0];
  first.setName(SHEET_NAME);
  return first;
}

function buildRow_(data, received) {
  const digits = phoneDigits_(data.whatsapp);
  return [
    received,
    text_(data.name, MAX_TEXT),
    text_(data.email, MAX_TEXT),
    digits ? `https://wa.me/${digits}` : '',
    data.wantsReview === true ? 'Yes' : 'No',
    text_(data.action, MAX_TEXT),
    text_(data.dealName, MAX_TEXT),
    text_(data.currency, MAX_TEXT),
    number_(data.value),
    number_(data.chance),
    number_(data.directCost),
    number_(data.opportunityCost),
    number_(data.egoTax),
    text_(data.score, MAX_TEXT),
    text_(data.verdict, MAX_TEXT),
    number_(data.redFlags),
    text_(data.stopRule, MAX_STOP_RULE),
    text_(data.page, MAX_TEXT),
  ];
}

/** Digits of a phone number (country code included), or '' if it isn't a plausible number. */
function phoneDigits_(value) {
  const text = String(value || '').trim();
  if (!/^\+?[\d\s().-]+$/.test(text)) return '';
  const digits = text.replace(/\D/g, '');
  return digits.length >= MIN_PHONE_DIGITS && digits.length <= MAX_PHONE_DIGITS ? digits : '';
}

/**
 * Text cut to length. A leading = + - @ gets two apostrophes: Sheets hides the first (its
 * "plain text" marker) and shows the second, which also keeps the value inert after a CSV/Excel export.
 */
function text_(value, max) {
  const text = String(value === undefined || value === null ? '' : value).trim().slice(0, max);
  return /^[=+\-@\t\r]/.test(text) ? `''${text}` : text;
}

function number_(value) {
  return typeof value === 'number' && isFinite(value) ? value : '';
}

function reply_(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
