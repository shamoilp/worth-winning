import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  RED_FLAGS,
  CURRENCIES,
  parseAmount,
  parseChance,
  computeWiwi,
  verdictFor,
  suggestEgoTax,
  encodeState,
  decodeState,
  displayScore,
  roundUpPercent,
} from '../src/wiwi.js';

describe('parseAmount', () => {
  test('reads plain and comma-grouped numbers', () => {
    assert.equal(parseAmount('1500'), 1500);
    assert.equal(parseAmount('1,250,000'), 1250000);
    assert.equal(parseAmount(' 99.5 '), 99.5);
    assert.equal(parseAmount(42), 42);
  });

  test('treats blank input as zero', () => {
    assert.equal(parseAmount(''), 0);
    assert.equal(parseAmount('   '), 0);
    assert.equal(parseAmount(undefined), 0);
    assert.equal(parseAmount(null), 0);
  });

  test('returns null for negative or non-numeric input', () => {
    assert.equal(parseAmount('-5'), null);
    assert.equal(parseAmount('abc'), null);
    assert.equal(parseAmount('12abc'), null);
    assert.equal(parseAmount(Infinity), null);
  });

  test('rejects commas that are not thousands separators', () => {
    assert.equal(parseAmount('0,5'), null);
    assert.equal(parseAmount('1,5'), null);
    assert.equal(parseAmount('1,2,3'), null);
    assert.equal(parseAmount('12,50.5'), null);
    assert.equal(parseAmount('12,500.50'), 12500.5);
  });

  test('rejects numbers too large to calculate with', () => {
    assert.equal(parseAmount('9'.repeat(400)), null);
  });
});

describe('displayScore', () => {
  test('cuts to 2 decimals so the shown score never crosses a verdict line', () => {
    assert.equal(displayScore(0.999), '0.99');
    assert.equal(displayScore(1.496), '1.49');
    assert.equal(displayScore(140000 / 138000), '1.01');
  });

  test('is not thrown off by floating-point error', () => {
    assert.equal(displayScore(1.15), '1.15');
    assert.equal(displayScore(1), '1.00');
  });
});

describe('roundUpPercent', () => {
  test('rounds up to a whole percent', () => {
    assert.equal(roundUpPercent(29.2), 30);
    assert.equal(roundUpPercent(30), 30);
  });

  test('is not thrown off by floating-point error', () => {
    assert.equal(roundUpPercent((7 / 100) * 100), 7);
    assert.equal(roundUpPercent(7.000000000000001), 7);
  });
});

describe('parseChance', () => {
  test('accepts 0 to 100', () => {
    assert.equal(parseChance('0'), 0);
    assert.equal(parseChance('35'), 35);
    assert.equal(parseChance(100), 100);
  });

  test('returns null outside 0 to 100 or when not a number', () => {
    assert.equal(parseChance('101'), null);
    assert.equal(parseChance('-1'), null);
    assert.equal(parseChance('x'), null);
    assert.equal(parseChance(''), null);
    assert.equal(parseChance('0,5'), null);
  });
});

describe('verdictFor', () => {
  test('below 1.0 is an expensive regret', () => {
    assert.equal(verdictFor(0).key, 'regret');
    assert.equal(verdictFor(0.99).key, 'regret');
  });

  test('1.0 up to 1.5 is thin', () => {
    assert.equal(verdictFor(1).key, 'thin');
    assert.equal(verdictFor(1.49).key, 'thin');
  });

  test('1.5 and above is worth pursuing', () => {
    assert.equal(verdictFor(1.5).key, 'win');
    assert.equal(verdictFor(12).key, 'win');
  });

  test('every verdict has a label and advice', () => {
    for (const score of [0.5, 1.2, 2]) {
      const verdict = verdictFor(score);
      assert.ok(verdict.label.length > 0);
      assert.ok(verdict.advice.length > 0);
    }
  });
});

describe('computeWiwi', () => {
  const example = {
    value: '400,000',
    chance: '35',
    directCost: '90000',
    opportunityCost: '30000',
    egoTax: '0',
  };

  test('scores a deal as (value x chance) / (direct + opportunity + ego)', () => {
    // Arrange: expected value 140,000 against total cost 120,000
    // Act
    const result = computeWiwi(example);
    // Assert
    assert.equal(result.ok, true);
    assert.equal(result.expectedValue, 140000);
    assert.equal(result.totalCost, 120000);
    assert.equal(result.net, 20000);
    assert.ok(Math.abs(result.score - 140000 / 120000) < 1e-9);
    assert.equal(result.verdict.key, 'thin');
  });

  test('reports the chance of success needed to break even', () => {
    const result = computeWiwi(example);
    assert.equal(result.breakEvenChance, 30);
  });

  test('ego tax pulls the score down', () => {
    const withEgo = computeWiwi({ ...example, egoTax: '60000' });
    assert.ok(withEgo.score < 1);
    assert.equal(withEgo.verdict.key, 'regret');
  });

  test('break-even chance can exceed 100 when the deal can never pay', () => {
    const result = computeWiwi({ ...example, value: '50000' });
    assert.equal(result.breakEvenChance, 240);
  });

  test('zero value gives a zero score and no break-even chance', () => {
    const result = computeWiwi({ ...example, value: '0' });
    assert.equal(result.ok, true);
    assert.equal(result.score, 0);
    assert.equal(result.breakEvenChance, null);
  });

  test('fails when every cost is zero', () => {
    const result = computeWiwi({ ...example, directCost: '', opportunityCost: '0', egoTax: '' });
    assert.equal(result.ok, false);
    assert.equal(result.field, 'directCost');
    assert.match(result.error, /cost/i);
  });

  test('fails with the field name when an amount is invalid', () => {
    const result = computeWiwi({ ...example, opportunityCost: '-10' });
    assert.equal(result.ok, false);
    assert.equal(result.field, 'opportunityCost');
  });

  test('fails when the chance is out of range', () => {
    const result = computeWiwi({ ...example, chance: '150' });
    assert.equal(result.ok, false);
    assert.equal(result.field, 'chance');
  });

  test('does not change the input object', () => {
    const input = { ...example };
    const snapshot = JSON.stringify(input);
    computeWiwi(input);
    assert.equal(JSON.stringify(input), snapshot);
  });
});

describe('suggestEgoTax', () => {
  test('adds 10% of direct costs for each red flag ticked', () => {
    assert.equal(suggestEgoTax('90000', 0), 0);
    assert.equal(suggestEgoTax('90000', 2), 18000);
    assert.equal(suggestEgoTax('90,000', RED_FLAGS.length), 45000);
  });

  test('returns 0 when direct costs are invalid', () => {
    assert.equal(suggestEgoTax('-1', 3), 0);
  });
});

describe('share links', () => {
  const state = {
    name: 'Distribution contract bid',
    currency: 'SAR',
    value: '400000',
    chance: '35',
    directCost: '90000',
    opportunityCost: '30000',
    egoTax: '18000',
    flags: [true, false, true, false, false],
    stopRule: 'Walk away if costs pass SAR 120,000',
  };

  test('round-trips through a query string', () => {
    const query = encodeState(state);
    assert.deepEqual(decodeState(query), state);
  });

  test('decodes a query string with a leading question mark', () => {
    const query = `?${encodeState(state)}`;
    assert.equal(decodeState(query).name, state.name);
  });

  test('falls back to SAR for an unknown currency', () => {
    const decoded = decodeState('c=XYZ&v=10');
    assert.equal(decoded.currency, 'SAR');
    assert.ok(CURRENCIES.includes('SAR'));
  });

  test('cuts overlong text and ignores bad flag characters', () => {
    const decoded = decodeState(`n=${'a'.repeat(500)}&s=${'b'.repeat(2000)}&f=1x1`);
    assert.equal(decoded.name.length, 80);
    assert.equal(decoded.stopRule.length, 500);
    assert.deepEqual(decoded.flags, [true, false, true, false, false]);
  });

  test('an empty query string gives empty fields', () => {
    const decoded = decodeState('');
    assert.equal(decoded.value, '');
    assert.equal(decoded.flags.length, RED_FLAGS.length);
    assert.ok(decoded.flags.every((flag) => flag === false));
  });
});
