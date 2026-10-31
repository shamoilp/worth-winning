// DOM wiring for the trilogy: the stage tabs, the WIFI and WIDI checks, and the post-mortem.
// app.js owns the WIWI form and calls renderTrilogy() on every change.
import { displayScore, parseAmount } from './wiwi.js';
import {
  WIDI_QUESTIONS,
  WIFI_QUESTIONS,
  emptyTrilogy,
  freshEyes,
  postMortem,
  summarizeTrilogy,
  widiCheck,
  wifiCheck,
} from './trilogy.js';
import { $, isBlank } from './ui.js';

export const STAGES = Object.freeze(['wifi', 'widi', 'wiwi']);
const DEFAULT_STAGE = 'wiwi';
const NUMBER_FIELDS = Object.freeze(Object.keys(emptyTrilogy()).filter((field) => field !== 'wifi' && field !== 'widi'));
const FRESH_FIELDS = Object.freeze(['freshValue', 'freshChance', 'spent', 'remaining', 'remainingOpportunity']);
const PM_FIELDS = Object.freeze(['actualValue', 'actualDirect', 'actualOpportunity', 'egoPaid']);
const PERCENT = 100;

// Colour of each verdict box, reusing the three score colours.
const TONES = Object.freeze({
  clear: 'win', delusion: 'regret',
  go: 'win', pause: 'thin', trap: 'regret', stop: 'regret',
  pyrrhic: 'regret', narrow: 'thin', real: 'win',
});
const HYPE_TONES = Object.freeze({ real: 'win', some: 'thin', mostly: 'regret' });

function buildQuestions(name, questions) {
  $(`${name}-questions`).replaceChildren(...questions.map((question, index) => {
    const set = document.createElement('fieldset');
    set.className = 'question';
    const legend = document.createElement('legend');
    legend.textContent = question.text;
    const choices = document.createElement('div');
    choices.className = 'yesno';
    for (const [value, text] of [['yes', 'Yes'], ['no', 'No']]) {
      const label = document.createElement('label');
      const radio = Object.assign(document.createElement('input'), {
        type: 'radio', name: `${name}-${index}`, id: `${name}-${index}-${value}`, value,
      });
      const span = document.createElement('span');
      span.textContent = text;
      label.append(radio, span);
      choices.append(label);
    }
    set.append(legend, choices);
    return set;
  }));
}

const readAnswers = (name, length) => Array.from({ length }, (_, index) => {
  if ($(`${name}-${index}-yes`).checked) return true;
  if ($(`${name}-${index}-no`).checked) return false;
  return null;
});

function applyAnswers(name, answers) {
  answers.forEach((answer, index) => {
    $(`${name}-${index}-yes`).checked = answer === true;
    $(`${name}-${index}-no`).checked = answer === false;
  });
}

export function readTrilogy() {
  return {
    wifi: readAnswers('wifi', WIFI_QUESTIONS.length),
    widi: readAnswers('widi', WIDI_QUESTIONS.length),
    ...Object.fromEntries(NUMBER_FIELDS.map((field) => [field, $(field).value])),
  };
}

export function applyTrilogy(state) {
  applyAnswers('wifi', state.wifi);
  applyAnswers('widi', state.widi);
  NUMBER_FIELDS.forEach((field) => { $(field).value = state[field] ?? ''; });
  if (PM_FIELDS.some((field) => !isBlank(state[field]))) $('pm-details').open = true;
}

function showVerdict(boxId, labelId, adviceId, verdict) {
  $(boxId).hidden = !verdict;
  if (!verdict) return;
  $(boxId).dataset.tone = TONES[verdict.key] ?? verdict.key;
  $(labelId).textContent = verdict.label;
  $(adviceId).textContent = verdict.advice;
}

/** A gentle note once some fields of a group are filled but the group can't be scored yet. */
function showStatus(id, fields, state, check) {
  const started = fields.some((field) => !isBlank(state[field]));
  $(id).textContent = started && !check.ok ? check.error : '';
}

function renderWifi(state) {
  const wifi = wifiCheck({ answers: state.wifi, perceived: state.perceived, actual: state.actual });
  showVerdict('wifi-verdict', 'wifi-label', 'wifi-advice', wifi.verdict);

  const unreadable = ['perceived', 'actual'].some((field) => !isBlank(state[field]) && parseAmount(state[field]) === null);
  let hypeText = '';
  if (unreadable) hypeText = 'Enter both as numbers, like 250,000.';
  else if (wifi.hype) hypeText = `${wifi.hype.label}: a ${Math.round(wifi.hypeGap * PERCENT)}% hype gap. ${wifi.hype.advice}`;
  $('hype-text').textContent = hypeText;
  $('hype-text').dataset.tone = wifi.hype ? HYPE_TONES[wifi.hype.key] : '';

  const actual = parseAmount(state.actual);
  $('use-actual').hidden = isBlank(state.actual) || actual === null || actual === 0;
}

function renderWidi(state) {
  showVerdict('widi-verdict', 'widi-label', 'widi-advice', widiCheck(state.widi).verdict);

  const fresh = freshEyes({
    value: state.freshValue,
    chance: state.freshChance,
    spent: state.spent,
    remaining: state.remaining,
    remainingOpportunity: state.remainingOpportunity,
  });
  showStatus('fresh-status', FRESH_FIELDS, state, fresh);
  $('fresh-result').hidden = !fresh.ok;
  if (!fresh.ok) return;
  $('fresh-result').dataset.tone = fresh.verdict.key;
  $('fresh-score').textContent = displayScore(fresh.score);
  $('fresh-label').textContent = fresh.verdict.label;
  $('fresh-sunk').textContent = (parseAmount(state.spent) ?? 0) > 0
    ? `Counting what's already spent would drag it to ${displayScore(fresh.withSunk)}. Ignore that: the money is gone whether you stop or not.`
    : 'Nothing spent yet, so this is the same as a normal WIWI score.';
}

function compareText(actualScore, plannedScore) {
  if (plannedScore === null) return '';
  const planned = displayScore(plannedScore);
  if (actualScore > plannedScore) return `Your up-front WIWI score was ${planned}, so it did better than planned.`;
  if (actualScore < plannedScore) return `Your up-front WIWI score was ${planned}, so it did worse than planned.`;
  return `Your up-front WIWI score was ${planned}, so it came in as planned.`;
}

function renderPostMortem(state, plannedScore) {
  const pm = postMortem(state);
  showStatus('pm-status', PM_FIELDS, state, pm);
  $('pm-result').hidden = !pm.ok;
  if (!pm.ok) return;
  showVerdict('pm-result', 'pm-label', 'pm-advice', pm.verdict);
  $('pm-score').textContent = displayScore(pm.score);
  $('pm-compare').textContent = compareText(pm.score, plannedScore);
}

function renderPrintLines(state) {
  const summary = summarizeTrilogy(state);
  for (const [key, id] of [['wifi', 'print-wifi'], ['widi', 'print-widi'], ['postMortem', 'print-pm']]) {
    $(id).textContent = summary[key];
    $(`${id}-block`).hidden = summary[key] === '';
  }
  $('print-trilogy').hidden = Object.values(summary).every((line) => line === '');
}

/** Redraws every trilogy result. plannedScore is the current WIWI score, or null if there isn't one. */
export function renderTrilogy(state, plannedScore) {
  renderWifi(state);
  renderWidi(state);
  renderPostMortem(state, plannedScore);
  renderPrintLines(state);
}

// --- Stage tabs ---

export const currentStage = () => document.body.dataset.stage ?? DEFAULT_STAGE;

function stageFromHash() {
  const name = location.hash.replace(/^#/, '');
  return STAGES.includes(name) ? name : DEFAULT_STAGE;
}

export function showStage(name, { updateHash = true } = {}) {
  document.body.dataset.stage = name;
  for (const stage of STAGES) {
    $(`stage-${stage}`).hidden = stage !== name;
    const tab = $(`tab-${stage}`);
    tab.setAttribute('aria-selected', String(stage === name));
    tab.tabIndex = stage === name ? 0 : -1;
  }
  if (!updateHash) return;
  try {
    history.replaceState(null, '', `${location.pathname}${location.search}#${name}`);
  } catch (error) {
    console.warn('Could not update the address bar:', error);
  }
}

function goToStage(name) {
  showStage(name);
  $(`tab-${name}`).scrollIntoView?.({ block: 'start', behavior: 'smooth' });
}

/** Left/right arrows, Home and End move between tabs, as screen-reader users expect. */
function onTabKey(event) {
  const index = STAGES.indexOf(currentStage());
  const moves = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: STAGES.length - 1 };
  if (!(event.key in moves)) return;
  event.preventDefault();
  const next = STAGES[(moves[event.key] + STAGES.length) % STAGES.length];
  showStage(next);
  $(`tab-${next}`).focus();
}

/** Builds the questions, binds the stage controls and opens the stage named in the address. */
export function initStages({ onChange }) {
  buildQuestions('wifi', WIFI_QUESTIONS);
  buildQuestions('widi', WIDI_QUESTIONS);
  for (const id of ['stage-wifi', 'stage-widi']) {
    $(id).addEventListener('input', onChange);
    $(id).addEventListener('change', onChange);
  }
  for (const stage of STAGES) $(`tab-${stage}`).addEventListener('click', () => showStage(stage));
  document.querySelector('.stages').addEventListener('keydown', onTabKey);
  document.querySelectorAll('[data-go]').forEach((button) => {
    button.addEventListener('click', () => goToStage(button.dataset.go));
  });
  $('use-actual').addEventListener('click', () => {
    const actual = parseAmount($('actual').value);
    if (actual === null) return;
    $('value').value = actual.toLocaleString('en');
    goToStage('wiwi');
    onChange();
  });
  // Back/forward and edited links change the hash without reloading the page.
  window.addEventListener('hashchange', () => showStage(stageFromHash(), { updateHash: false }));
  showStage(stageFromHash(), { updateHash: false });
}
