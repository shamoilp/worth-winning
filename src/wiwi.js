// WIWI score = (value x chance of success) / (direct cost + opportunity cost + ego tax)
// Formula from "ROI of Ego", Business Advisor (Shrinikethan, ed. D. Murali), 25 Oct 2026.
// Pure functions only: no DOM access, so everything here is unit-tested.

export const REGRET_BELOW = 1.0;
export const WIN_FROM = 1.5;
export const EGO_RATE_PER_FLAG = 0.1;
export const MAX_NAME_LENGTH = 80;
export const MAX_STOP_RULE_LENGTH = 500;
export const DEFAULT_CURRENCY = 'SAR';
export const CURRENCIES = Object.freeze(['SAR', 'AED', 'USD', 'EUR', 'GBP', 'INR']);

export const RED_FLAGS = Object.freeze([
  "I've already told people I'm going ahead.",
  "I've stopped looking for reasons it could fail.",
  'Walking away now would feel like admitting I was wrong.',
  "I'd keep going even if costs doubled, because of what's already spent.",
  "Part of the appeal is making sure a rival doesn't get it.",
]);

const VERDICTS = Object.freeze({
  regret: Object.freeze({
    key: 'regret',
    label: 'Expensive regret',
    advice: 'Below 1.0 the costs outweigh the realistic payoff. You would be paying to win, not winning.',
  }),
  thin: Object.freeze({
    key: 'thin',
    label: 'Thin margin',
    advice: 'It pays on paper, but a small mistake in your estimates flips it. Go ahead only with firm stop rules.',
  }),
  win: Object.freeze({
    key: 'win',
    label: 'Worth pursuing',
    advice: 'The realistic payoff clearly beats the full cost. Write down your stop rule anyway.',
  }),
});

const AMOUNT_FIELDS = Object.freeze([
  ['value', 'What it is really worth'],
  ['directCost', 'Direct costs'],
  ['opportunityCost', 'Opportunity cost'],
  ['egoTax', 'Ego tax'],
]);

// Plain digits, or digits with commas in thousands groups only ("1,250,000" yes, "1,5" no).
const NUMBER_PATTERN = /^(\d+|\d{1,3}(,\d{3})+)(\.\d+)?$/;
const FLOAT_TOLERANCE = 1e-9;

/** Reads a money amount. Blank means 0; negative, non-numeric or overflowing gives null. */
export function parseAmount(raw) {
  if (raw === undefined || raw === null) return 0;
  if (typeof raw === 'number') return Number.isFinite(raw) && raw >= 0 ? raw : null;
  const text = String(raw).trim();
  if (text === '') return 0;
  if (!NUMBER_PATTERN.test(text)) return null;
  const amount = Number(text.replace(/,/g, ''));
  return Number.isFinite(amount) ? amount : null;
}

/** Score for display, cut (not rounded) to 2 decimals so it never shows across a verdict line. */
export function displayScore(score) {
  return (Math.floor(score * 100 + FLOAT_TOLERANCE) / 100).toFixed(2);
}

/** Rounds a percentage up to a whole number, ignoring floating-point noise like 7.000000000000001. */
export function roundUpPercent(percent) {
  return Math.ceil(percent - FLOAT_TOLERANCE);
}

/** Reads a percentage from 0 to 100. Anything else, including blank, gives null. */
export function parseChance(raw) {
  const text = String(raw ?? '').trim();
  if (text === '') return null;
  const chance = parseAmount(text);
  return chance !== null && chance <= 100 ? chance : null;
}

export function verdictFor(score) {
  if (score < REGRET_BELOW) return VERDICTS.regret;
  if (score < WIN_FROM) return VERDICTS.thin;
  return VERDICTS.win;
}

function fail(field, error) {
  return { ok: false, field, error };
}

/** Validates the inputs and returns the score with its breakdown, or the first error found. */
export function computeWiwi(input) {
  const amounts = {};
  for (const [field, label] of AMOUNT_FIELDS) {
    const amount = parseAmount(input[field]);
    if (amount === null) return fail(field, `${label} must be a number of 0 or more.`);
    amounts[field] = amount;
  }

  const chance = parseChance(input.chance);
  if (chance === null) return fail('chance', 'Chance of success must be between 0 and 100.');

  const totalCost = amounts.directCost + amounts.opportunityCost + amounts.egoTax;
  if (totalCost === 0) return fail('directCost', 'Enter at least one cost. Nothing worth winning is free.');

  const expectedValue = amounts.value * (chance / 100);
  const score = expectedValue / totalCost;

  return {
    ok: true,
    score,
    expectedValue,
    totalCost,
    net: expectedValue - totalCost,
    breakEvenChance: amounts.value > 0 ? (totalCost / amounts.value) * 100 : null,
    verdict: verdictFor(score),
  };
}

/** Rule of thumb from this tool (not the article): each red flag adds 10% of direct costs. */
export function suggestEgoTax(directCost, flagCount) {
  const amount = parseAmount(directCost);
  if (amount === null) return 0;
  return Math.round(amount * EGO_RATE_PER_FLAG * flagCount);
}

const PARAM_KEYS = Object.freeze({
  name: 'n',
  currency: 'c',
  value: 'v',
  chance: 'p',
  directCost: 'd',
  opportunityCost: 'o',
  egoTax: 'e',
  stopRule: 's',
});

/** Turns the form state into a query string for a share link. */
export function encodeState(state) {
  const params = new URLSearchParams();
  for (const [field, key] of Object.entries(PARAM_KEYS)) {
    const value = String(state[field] ?? '').trim();
    if (value !== '') params.set(key, value);
  }
  const flags = state.flags ?? [];
  if (flags.some(Boolean)) params.set('f', flags.map((flag) => (flag ? '1' : '0')).join(''));
  return params.toString();
}

/** Reads a share-link query string back into form state, with lengths and currency checked. */
export function decodeState(query) {
  const params = new URLSearchParams(String(query ?? '').replace(/^\?/, ''));
  const read = (field) => params.get(PARAM_KEYS[field]) ?? '';
  const flagText = params.get('f') ?? '';
  const currency = read('currency');

  return {
    name: read('name').slice(0, MAX_NAME_LENGTH),
    currency: CURRENCIES.includes(currency) ? currency : DEFAULT_CURRENCY,
    value: read('value'),
    chance: read('chance'),
    directCost: read('directCost'),
    opportunityCost: read('opportunityCost'),
    egoTax: read('egoTax'),
    flags: RED_FLAGS.map((_, index) => flagText[index] === '1'),
    stopRule: read('stopRule').slice(0, MAX_STOP_RULE_LENGTH),
  };
}
