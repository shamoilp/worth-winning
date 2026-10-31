import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  WIFI_QUESTIONS,
  WIDI_QUESTIONS,
  wifiCheck,
  widiCheck,
  freshEyes,
  postMortem,
  encodeTrilogy,
  decodeTrilogy,
  emptyTrilogy,
  summarizeTrilogy,
} from '../src/trilogy.js';

describe('WIFI check (before you chase it)', () => {
  test('waits until every filter question is answered', () => {
    const check = wifiCheck({ answers: [true, null, true], perceived: '', actual: '' });
    assert.equal(check.complete, false);
    assert.equal(check.verdict, null);
  });

  test('all yes is clear-eyed', () => {
    const check = wifiCheck({ answers: [true, true, true], perceived: '', actual: '' });
    assert.equal(check.verdict.key, 'clear');
  });

  test('any no is a WIFI warning, and names how many props it leans on', () => {
    const check = wifiCheck({ answers: [true, false, false], perceived: '', actual: '' });
    assert.equal(check.verdict.key, 'delusion');
    assert.equal(check.noCount, 2);
  });

  test('measures the hype gap between what it feels worth and what it will earn', () => {
    const check = wifiCheck({ answers: [true, true, true], perceived: '500,000', actual: '200,000' });
    assert.equal(check.hypeGap, 0.6);
    assert.equal(check.hype.key, 'mostly');
  });

  test('labels small and middling hype gaps', () => {
    assert.equal(wifiCheck({ answers: [], perceived: '100', actual: '95' }).hype.key, 'real');
    assert.equal(wifiCheck({ answers: [], perceived: '100', actual: '70' }).hype.key, 'some');
  });

  test('a real value above the feeling is not hype', () => {
    const check = wifiCheck({ answers: [], perceived: '100', actual: '150' });
    assert.equal(check.hypeGap, 0);
    assert.equal(check.hype.key, 'real');
  });

  test('no hype gap without both numbers', () => {
    assert.equal(wifiCheck({ answers: [], perceived: '', actual: '100' }).hype, null);
    assert.equal(wifiCheck({ answers: [], perceived: 'abc', actual: '100' }).hype, null);
  });

  test('has three filter questions, each with its wording', () => {
    assert.equal(WIFI_QUESTIONS.length, 3);
    assert.ok(WIFI_QUESTIONS.every((question) => typeof question.text === 'string' && question.text !== ''));
  });
});

describe('WIDI check (while you are in it)', () => {
  const none = WIDI_QUESTIONS.map(() => false);

  test('waits until every warning sign is answered', () => {
    assert.equal(widiCheck([false, null, false, false, false]).verdict, null);
  });

  test('no warning signs means healthy momentum', () => {
    assert.equal(widiCheck(none).verdict.key, 'go');
  });

  test('one or two signs means pause and re-check', () => {
    assert.equal(widiCheck([false, true, false, false, false]).verdict.key, 'pause');
    assert.equal(widiCheck([false, true, true, false, false]).verdict.key, 'pause');
  });

  test('three or more signs is a momentum trap', () => {
    assert.equal(widiCheck([false, true, true, true, false]).verdict.key, 'trap');
  });

  test('"already spent too much to stop" is a stop signal on its own', () => {
    const check = widiCheck([true, false, false, false, false]);
    assert.equal(check.verdict.key, 'stop');
    assert.equal(check.yesCount, 1);
  });

  test('the stop signal shows straight away, before the other signs are answered', () => {
    const check = widiCheck([true, null, null, null, null]);
    assert.equal(check.verdict.key, 'stop');
    assert.equal(check.complete, false);
  });

  test('the first question is the stop signal', () => {
    assert.equal(WIDI_QUESTIONS[0].stopSignal, true);
    assert.equal(WIDI_QUESTIONS.length, 5);
  });
});

describe('fresh-eyes re-score', () => {
  const input = { value: '400,000', chance: '40', spent: '150,000', remaining: '60,000', remainingOpportunity: '20,000' };

  test('scores only what is still to spend, ignoring money already gone', () => {
    const result = freshEyes(input);
    assert.equal(result.ok, true);
    // 160,000 / 80,000
    assert.equal(result.score, 2);
    assert.equal(result.verdict.key, 'win');
  });

  test('also shows how the score looks if past spending is wrongly counted', () => {
    // 160,000 / 230,000
    assert.ok(Math.abs(freshEyes(input).withSunk - 160000 / 230000) < 1e-9);
  });

  test('needs a remaining cost', () => {
    const result = freshEyes({ ...input, remaining: '', remainingOpportunity: '0' });
    assert.equal(result.ok, false);
    assert.equal(result.field, 'remaining');
  });

  test('flags invalid numbers by field', () => {
    assert.equal(freshEyes({ ...input, spent: '-1' }).field, 'spent');
    assert.equal(freshEyes({ ...input, chance: '120' }).field, 'chance');
  });

  test('is not ready until value and chance are entered', () => {
    assert.equal(freshEyes({ ...input, value: '' }).ok, false);
  });
});

describe('post-mortem (after it is done)', () => {
  test('scores what it actually delivered against what it actually cost', () => {
    const result = postMortem({ actualValue: '300,000', actualDirect: '200,000', actualOpportunity: '50,000', egoPaid: '50,000' });
    assert.equal(result.ok, true);
    assert.equal(result.score, 1);
    assert.equal(result.verdict.key, 'narrow');
  });

  test('below 1.0 is a Pyrrhic victory', () => {
    const result = postMortem({ actualValue: '100', actualDirect: '200', actualOpportunity: '', egoPaid: '' });
    assert.equal(result.verdict.key, 'pyrrhic');
  });

  test('1.5 and above is a real win', () => {
    const result = postMortem({ actualValue: '300', actualDirect: '100', actualOpportunity: '', egoPaid: '' });
    assert.equal(result.verdict.key, 'real');
  });

  test('needs a value and at least one cost', () => {
    assert.equal(postMortem({ actualValue: '', actualDirect: '100' }).ok, false);
    assert.equal(postMortem({ actualValue: '100', actualDirect: '' }).ok, false);
    assert.equal(postMortem({ actualValue: '100', actualDirect: 'x' }).field, 'actualDirect');
  });
});

describe('trilogy share-link state', () => {
  const state = {
    ...emptyTrilogy(),
    wifi: [true, false, null],
    perceived: '500000',
    actual: '200000',
    widi: [false, true, true, false, null],
    spent: '150000',
    remaining: '60000',
    remainingOpportunity: '20000',
    freshValue: '400000',
    freshChance: '40',
    actualValue: '300000',
    actualDirect: '200000',
    actualOpportunity: '50000',
    egoPaid: '50000',
  };

  test('round-trips through a query string', () => {
    assert.deepEqual(decodeTrilogy(encodeTrilogy(state)), state);
  });

  test('an empty state encodes to nothing', () => {
    assert.equal(encodeTrilogy(emptyTrilogy()), '');
  });

  test('ignores unknown answer characters and fills missing answers as unanswered', () => {
    const decoded = decodeTrilogy('wf=yx');
    assert.deepEqual(decoded.wifi, [true, null, null]);
    assert.deepEqual(decoded.widi, [null, null, null, null, null]);
  });

  test('cuts overlong numbers', () => {
    assert.equal(decodeTrilogy(`wp=${'9'.repeat(100)}`).perceived.length, 20);
  });
});

describe('summarizeTrilogy (one line per stage, for the sheet and the report)', () => {
  test('is blank for stages not done', () => {
    assert.deepEqual(summarizeTrilogy(emptyTrilogy()), { wifi: '', widi: '', postMortem: '' });
  });

  test('summarises each finished stage', () => {
    const summary = summarizeTrilogy({
      ...emptyTrilogy(),
      wifi: [true, false, true],
      perceived: '500000',
      actual: '200000',
      widi: [false, true, false, false, false],
      freshValue: '400000',
      freshChance: '40',
      remaining: '60000',
      remainingOpportunity: '20000',
      actualValue: '100',
      actualDirect: '200',
    });
    assert.equal(summary.wifi, 'WIFI warning (1 of 3 answered no); hype gap 60%');
    assert.equal(summary.widi, 'Pause and re-check (1 of 5 warning signs); fresh-eyes score 2.00');
    assert.equal(summary.postMortem, '0.50 Pyrrhic victory');
  });

  test('includes a stage once it has a result, even if other parts are blank', () => {
    const summary = summarizeTrilogy({ ...emptyTrilogy(), perceived: '100', actual: '95' });
    assert.equal(summary.wifi, 'hype gap 5%');
  });
});
