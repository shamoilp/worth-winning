import {
  CURRENCIES,
  DEFAULT_CURRENCY,
  EGO_RATE_PER_FLAG,
  RED_FLAGS,
  computeWiwi,
  decodeState,
  displayScore,
  encodeState,
  parseAmount,
  parseChance,
  roundUpPercent,
  suggestEgoTax,
} from './wiwi.js';

const GAUGE_MAX = 3;
const DEFAULT_CHANCE = 50;
const AMOUNT_FIELDS = Object.freeze(['value', 'directCost', 'opportunityCost', 'egoTax']);
const TEXT_FIELDS = Object.freeze(['name', 'currency', 'chance', 'stopRule', ...AMOUNT_FIELDS]);

const EXAMPLE = Object.freeze({
  name: 'Bid for a regional distribution contract',
  currency: 'SAR',
  value: '400,000',
  chance: '35',
  directCost: '90,000',
  opportunityCost: '30,000',
  egoTax: '18,000',
  flags: [true, false, true, false, false],
  stopRule: 'costs pass SAR 120,000, or there is no signed contract by 31 December',
});

const $ = (id) => document.getElementById(id);
const isBlank = (text) => String(text ?? '').trim() === '';

function formatMoney(amount, currency) {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString('en')}`;
  }
}

function readState() {
  const state = Object.fromEntries(TEXT_FIELDS.map((field) => [field, $(field).value]));
  return { ...state, flags: RED_FLAGS.map((_, index) => $(`flag-${index}`).checked) };
}

function applyState(state) {
  TEXT_FIELDS.forEach((field) => { $(field).value = state[field] ?? ''; });
  state.flags.forEach((checked, index) => { $(`flag-${index}`).checked = checked; });
  syncRangeFromText();
}

function syncRangeFromText() {
  const chance = parseChance($('chance').value);
  $('chance-range').value = chance === null ? DEFAULT_CHANCE : chance;
}

function setFieldError(field, message) {
  $(`${field}-error`).textContent = message;
  $(field).setAttribute('aria-invalid', message ? 'true' : 'false');
}

/** Flags typed-in values that can't be read. Blank fields are not errors here. */
function showFieldErrors(state) {
  let hasError = false;
  for (const field of AMOUNT_FIELDS) {
    const invalid = !isBlank(state[field]) && parseAmount(state[field]) === null;
    setFieldError(field, invalid ? 'Enter a number of 0 or more, like 25,000.' : '');
    hasError ||= invalid;
  }
  const badChance = !isBlank(state.chance) && parseChance(state.chance) === null;
  setFieldError('chance', badChance ? 'Enter a percentage from 0 to 100.' : '');
  return hasError || badChance;
}

function renderSuggestion(state) {
  const flagCount = state.flags.filter(Boolean).length;
  const directCost = parseAmount(state.directCost);
  $('suggest').hidden = flagCount === 0;
  if (flagCount === 0) return;

  const canSuggest = directCost !== null && directCost > 0;
  $('use-suggestion').hidden = !canSuggest;
  if (!canSuggest) {
    $('suggest-text').textContent = 'Enter your direct costs to get a suggested ego tax.';
    return;
  }
  const amount = formatMoney(suggestEgoTax(state.directCost, flagCount), state.currency);
  const rate = Math.round(EGO_RATE_PER_FLAG * 100);
  const flagWord = flagCount === 1 ? 'red flag' : 'red flags';
  $('suggest-text').textContent = `Suggested ego tax: ${amount} (${rate}% of direct costs for each of ${flagCount} ${flagWord}).`;
}

function showEmpty(message) {
  $('result-empty').hidden = false;
  $('result-body').hidden = true;
  $('result-empty').querySelector('p:last-child').textContent = message;
  document.querySelector('.result').removeAttribute('data-verdict');
  $('mini-score').hidden = true;
}

function breakEvenText(result, chance) {
  if (result.breakEvenChance === null) return 'With no payoff, no chance of success can make this worth it.';
  if (result.breakEvenChance > 100) return "Even a certain win wouldn't cover the full cost.";
  const needed = roundUpPercent(result.breakEvenChance);
  return `You need at least a ${needed}% chance of success to break even. You put it at ${chance}%.`;
}

function renderPrintSummary(state) {
  const ticked = RED_FLAGS.filter((_, index) => state.flags[index]);
  const list = $('print-flags');
  list.replaceChildren(...(ticked.length ? ticked : ['None ticked.']).map((text) => {
    const item = document.createElement('li');
    item.textContent = text;
    return item;
  }));
  $('print-stop').textContent = isBlank(state.stopRule) ? 'None written.' : `I walk away if ${state.stopRule.trim()}`;
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  $('print-date').textContent = `Scored on ${today}.`;
}

function showResult(result, state) {
  $('result-empty').hidden = true;
  $('result-body').hidden = false;
  document.querySelector('.result').dataset.verdict = result.verdict.key;

  $('out-name').textContent = state.name.trim();
  $('out-score').textContent = displayScore(result.score);
  $('out-verdict').textContent = result.verdict.label;
  $('out-advice').textContent = result.verdict.advice;
  $('out-marker').style.left = `${(Math.min(result.score, GAUGE_MAX) / GAUGE_MAX) * 100}%`;

  $('out-expected').textContent = formatMoney(result.expectedValue, state.currency);
  $('out-cost').textContent = formatMoney(result.totalCost, state.currency);
  const net = Math.round(result.net) || 0; // `|| 0` turns -0 into 0, so it never shows "-SAR 0"
  $('out-net').textContent = `${net > 0 ? '+' : ''}${formatMoney(net, state.currency)}`;
  $('out-breakeven').textContent = breakEvenText(result, parseChance(state.chance));
  $('mini-value').textContent = displayScore(result.score);
  $('mini-verdict').textContent = result.verdict.label;
  $('mini-score').hidden = false;
  renderPrintSummary(state);
}

function updateAddressBar(state) {
  const query = encodeState(state);
  try {
    history.replaceState(null, '', query ? `?${query}` : location.pathname);
  } catch (error) {
    console.warn('Could not update the address bar:', error);
  }
}

function render() {
  const state = readState();
  $('status').textContent = '';
  renderSuggestion(state);
  updateAddressBar(state);

  if (showFieldErrors(state)) return showEmpty('Fix the highlighted field to see the score.');
  const result = computeWiwi(state);
  if (isBlank(state.value) || isBlank(state.chance) || !result.ok) {
    return showEmpty("Enter what it's worth, your chance of success and at least one cost to see the score.");
  }
  return showResult(result, state);
}

async function copyShareLink() {
  const query = encodeState(readState());
  const link = `${location.origin}${location.pathname}${query ? `?${query}` : ''}`;
  try {
    await navigator.clipboard.writeText(link);
    $('status').textContent = 'Link copied. Anyone who opens it sees these numbers.';
  } catch (error) {
    console.warn('Clipboard write failed:', error);
    $('status').textContent = "Couldn't copy automatically. Copy the link from your address bar.";
  }
}

function buildControls() {
  $('currency').replaceChildren(...CURRENCIES.map((code) => new Option(code, code)));
  $('currency').value = DEFAULT_CURRENCY;
  $('flags').replaceChildren(...RED_FLAGS.map((text, index) => {
    const item = document.createElement('li');
    const label = document.createElement('label');
    const box = Object.assign(document.createElement('input'), { type: 'checkbox', id: `flag-${index}` });
    const span = document.createElement('span');
    span.textContent = text;
    label.append(box, span);
    item.append(label);
    return item;
  }));
}

function bindEvents() {
  const form = $('wiwi-form');
  form.addEventListener('input', (event) => {
    if (event.target.id === 'chance-range') $('chance').value = event.target.value;
    if (event.target.id === 'chance') syncRangeFromText();
    render();
  });
  form.addEventListener('change', render);
  form.addEventListener('reset', () => setTimeout(() => {
    $('currency').value = DEFAULT_CURRENCY;
    syncRangeFromText();
    render();
  }));
  $('use-suggestion').addEventListener('click', () => {
    const state = readState();
    $('egoTax').value = suggestEgoTax(state.directCost, state.flags.filter(Boolean).length).toLocaleString('en');
    render();
  });
  $('load-example').addEventListener('click', () => { applyState(EXAMPLE); render(); });
  $('copy-link').addEventListener('click', copyShareLink);
  $('print').addEventListener('click', () => window.print());
}

buildControls();
applyState(decodeState(location.search));
bindEvents();
render();
