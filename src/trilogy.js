// The other two stages of D. Murali's W-Trilogy, plus the post-mortem from Part 3.
// Part 1, WIFI ("Want It, Find It"): before you chase it. Part 2, WIDI ("Will It, Do It"): while you're in it.
// Question wording and all thresholds here are this tool's own reading of the articles.
import { displayScore, parseAmount, parseChance, verdictFor } from './wiwi.js';

const NARROW_FROM = 1.0;
const REAL_FROM = 1.5;
const SOME_HYPE_FROM = 0.1;
const MOSTLY_HYPE_FROM = 0.5;
const TRAP_FROM = 3;
const MAX_NUMBER_LENGTH = 20;

export const WIFI_QUESTIONS = Object.freeze([
  Object.freeze({ text: 'Would you still want it if it had no name, label or code name?' }),
  Object.freeze({ text: 'Would you still want it if no rival were chasing it?' }),
  Object.freeze({ text: 'Would you still want it if nobody ever found out you won it?' }),
]);

export const WIDI_QUESTIONS = Object.freeze([
  Object.freeze({ text: 'Is "we\'ve already spent too much to stop" the main reason left to keep going?', stopSignal: true }),
  Object.freeze({ text: 'Are you using a team, tool or budget partly because you already have it?', stopSignal: false }),
  Object.freeze({ text: 'Have you announced this publicly, so backing out would be embarrassing?', stopSignal: false }),
  Object.freeze({ text: 'Have you renamed a setback as "a pivot" or "phase 2"?', stopSignal: false }),
  Object.freeze({ text: "Is it hard to say in one sentence why you're doing this, not just how?", stopSignal: false }),
]);

const verdict = (key, label, advice) => Object.freeze({ key, label, advice });

const WIFI_VERDICTS = Object.freeze({
  clear: verdict('clear', 'Clear-eyed', 'You want it for what it does, not for the trophy. Carry the real value into the WIWI score.'),
  delusion: verdict('delusion', 'WIFI warning', 'Part of the pull is the name, the rival or the bragging rights. Price it on what it actually does.'),
});

const HYPE_LEVELS = Object.freeze({
  real: verdict('real', 'Matches reality', 'What it feels worth and what it will earn are close.'),
  some: verdict('some', 'Some hype', 'It feels worth noticeably more than it will earn. Use the lower number.'),
  mostly: verdict('mostly', 'Mostly hype', 'Most of what it feels worth is excitement. Use the real number, not the feeling.'),
});

const WIDI_VERDICTS = Object.freeze({
  go: verdict('go', 'Healthy momentum', 'No warning signs. Keep going, and keep your stop rule in sight.'),
  pause: verdict('pause', 'Pause and re-check', 'A warning sign or two. Re-score the deal with fresh eyes before spending more.'),
  trap: verdict('trap', 'Momentum trap', 'Several warning signs. Ego and momentum may be steering, not the numbers.'),
  stop: verdict('stop', 'WIDI territory: stop and re-decide', "If past spending is the main reason left, that's the signal to stop and decide again from zero."),
});

const POST_MORTEM_VERDICTS = Object.freeze({
  pyrrhic: verdict('pyrrhic', 'Pyrrhic victory', 'You won, but it cost more than it gave. Worth a lesson before the next one.'),
  narrow: verdict('narrow', 'Narrow win', 'It paid for itself, just. Note what nearly tipped it over.'),
  real: verdict('real', 'A real win', 'It delivered clearly more than it cost. Note what made it work.'),
});

const STOP_INDEX = WIDI_QUESTIONS.findIndex((question) => question.stopSignal);

const isComplete = (answers, length) => answers.length === length && answers.every((answer) => answer === true || answer === false);

/** Part 1: the three "would you still want it?" questions, plus the gap between feeling and reality. */
export function wifiCheck({ answers, perceived, actual }) {
  const complete = isComplete(answers, WIFI_QUESTIONS.length);
  const noCount = answers.filter((answer) => answer === false).length;
  const feels = parseAmount(perceived);
  const earns = parseAmount(actual);
  const hasGap = String(perceived ?? '').trim() !== '' && String(actual ?? '').trim() !== '' && feels > 0 && earns !== null;
  const hypeGap = hasGap ? Math.max(0, (feels - earns) / feels) : null;

  let hype = null;
  if (hypeGap !== null) {
    if (hypeGap > MOSTLY_HYPE_FROM) hype = HYPE_LEVELS.mostly;
    else if (hypeGap > SOME_HYPE_FROM) hype = HYPE_LEVELS.some;
    else hype = HYPE_LEVELS.real;
  }

  return {
    complete,
    noCount,
    verdict: complete ? (noCount === 0 ? WIFI_VERDICTS.clear : WIFI_VERDICTS.delusion) : null,
    hypeGap,
    hype,
  };
}

/**
 * Part 2: five escalation warning signs. The stop signal ("spent too much to stop") decides it on its own,
 * so it shows straight away; the others wait until every sign is answered.
 */
export function widiCheck(answers) {
  const yesCount = answers.filter((answer) => answer === true).length;
  const complete = isComplete(answers, WIDI_QUESTIONS.length);
  if (answers[STOP_INDEX] === true) return { complete, yesCount, verdict: WIDI_VERDICTS.stop };
  if (!complete) return { complete, yesCount, verdict: null };
  let result = WIDI_VERDICTS.go;
  if (yesCount >= TRAP_FROM) result = WIDI_VERDICTS.trap;
  else if (yesCount > 0) result = WIDI_VERDICTS.pause;
  return { complete, yesCount, verdict: result };
}

function readAmounts(input, fields) {
  const amounts = {};
  for (const field of fields) {
    const amount = parseAmount(input[field]);
    if (amount === null) return { error: { ok: false, field, error: 'Enter a number of 0 or more.' } };
    amounts[field] = amount;
  }
  return { amounts };
}

/** WIDI re-score: would you start this today, counting only what's still to spend? */
export function freshEyes(input) {
  const { amounts, error } = readAmounts(input, ['value', 'spent', 'remaining', 'remainingOpportunity']);
  if (error) return error;
  if (String(input.value ?? '').trim() === '') return { ok: false, field: 'value', error: "Enter what it's worth if it works." };
  const chance = parseChance(input.chance);
  if (chance === null) return { ok: false, field: 'chance', error: 'Enter a chance from 0 to 100.' };
  const stillToCome = amounts.remaining + amounts.remainingOpportunity;
  if (stillToCome === 0) return { ok: false, field: 'remaining', error: "Enter what's still to spend." };

  const expected = amounts.value * (chance / 100);
  const score = expected / stillToCome;
  return { ok: true, score, withSunk: expected / (stillToCome + amounts.spent), verdict: verdictFor(score) };
}

/** Part 3 post-mortem: what it actually delivered against everything it actually cost. */
export function postMortem(input) {
  const { amounts, error } = readAmounts(input, ['actualValue', 'actualDirect', 'actualOpportunity', 'egoPaid']);
  if (error) return error;
  if (String(input.actualValue ?? '').trim() === '') return { ok: false, field: 'actualValue', error: 'Enter what it actually delivered.' };
  const totalCost = amounts.actualDirect + amounts.actualOpportunity + amounts.egoPaid;
  if (totalCost === 0) return { ok: false, field: 'actualDirect', error: 'Enter at least one actual cost.' };

  const score = amounts.actualValue / totalCost;
  let result = POST_MORTEM_VERDICTS.real;
  if (score < NARROW_FROM) result = POST_MORTEM_VERDICTS.pyrrhic;
  else if (score < REAL_FROM) result = POST_MORTEM_VERDICTS.narrow;
  return { ok: true, score, totalCost, verdict: result };
}

const PERCENT = 100;

/** One plain line per finished stage, for the lead sheet and the PDF. Blank for stages not done. */
export function summarizeTrilogy(state) {
  const wifi = wifiCheck({ answers: state.wifi, perceived: state.perceived, actual: state.actual });
  const wifiParts = [];
  if (wifi.verdict) {
    wifiParts.push(wifi.noCount === 0 ? wifi.verdict.label : `${wifi.verdict.label} (${wifi.noCount} of ${WIFI_QUESTIONS.length} answered no)`);
  }
  if (wifi.hype) wifiParts.push(`hype gap ${Math.round(wifi.hypeGap * PERCENT)}%`);

  const widi = widiCheck(state.widi);
  const fresh = freshEyes({
    value: state.freshValue,
    chance: state.freshChance,
    spent: state.spent,
    remaining: state.remaining,
    remainingOpportunity: state.remainingOpportunity,
  });
  const widiParts = [];
  if (widi.verdict) widiParts.push(`${widi.verdict.label} (${widi.yesCount} of ${WIDI_QUESTIONS.length} warning signs)`);
  if (fresh.ok) widiParts.push(`fresh-eyes score ${displayScore(fresh.score)}`);

  const pm = postMortem(state);
  return {
    wifi: wifiParts.join('; '),
    widi: widiParts.join('; '),
    postMortem: pm.ok ? `${displayScore(pm.score)} ${pm.verdict.label}` : '',
  };
}

// --- Share-link state for the trilogy fields ---

const NUMBER_KEYS = Object.freeze({
  perceived: 'wp',
  actual: 'wa',
  freshValue: 'fv',
  freshChance: 'fc',
  spent: 'fs',
  remaining: 'fr',
  remainingOpportunity: 'fo',
  actualValue: 'mv',
  actualDirect: 'md',
  actualOpportunity: 'mo',
  egoPaid: 'me',
});

export function emptyTrilogy() {
  return {
    wifi: WIFI_QUESTIONS.map(() => null),
    widi: WIDI_QUESTIONS.map(() => null),
    ...Object.fromEntries(Object.keys(NUMBER_KEYS).map((field) => [field, ''])),
  };
}

const encodeAnswers = (answers) => answers.map((answer) => (answer === true ? 'y' : answer === false ? 'n' : '-')).join('');

function decodeAnswers(text, length) {
  return Array.from({ length }, (_, index) => {
    if (text[index] === 'y') return true;
    if (text[index] === 'n') return false;
    return null;
  });
}

export function encodeTrilogy(state) {
  const params = new URLSearchParams();
  if (state.wifi.some((answer) => answer !== null)) params.set('wf', encodeAnswers(state.wifi));
  if (state.widi.some((answer) => answer !== null)) params.set('wd', encodeAnswers(state.widi));
  for (const [field, key] of Object.entries(NUMBER_KEYS)) {
    const value = String(state[field] ?? '').trim();
    if (value !== '') params.set(key, value);
  }
  return params.toString();
}

export function decodeTrilogy(query) {
  const params = new URLSearchParams(String(query ?? '').replace(/^\?/, ''));
  return {
    wifi: decodeAnswers(params.get('wf') ?? '', WIFI_QUESTIONS.length),
    widi: decodeAnswers(params.get('wd') ?? '', WIDI_QUESTIONS.length),
    ...Object.fromEntries(Object.entries(NUMBER_KEYS).map(
      ([field, key]) => [field, (params.get(key) ?? '').slice(0, MAX_NUMBER_LENGTH)],
    )),
  };
}
