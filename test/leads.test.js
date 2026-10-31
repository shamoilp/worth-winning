import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { validateLead, buildLeadPayload, isAcceptedReply } from '../src/leads.js';
import { computeWiwi } from '../src/wiwi.js';

const goodLead = {
  name: 'Fatima Al-Harbi',
  email: 'fatima@example.com',
  whatsapp: '',
  wantsReview: true,
  consent: true,
};

describe('validateLead', () => {
  test('accepts a name, one contact method and consent', () => {
    assert.deepEqual(validateLead(goodLead), { ok: true, errors: {} });
    assert.equal(validateLead({ ...goodLead, email: '', whatsapp: '+966 50 123 4567' }).ok, true);
  });

  test('needs a name', () => {
    const check = validateLead({ ...goodLead, name: '   ' });
    assert.equal(check.ok, false);
    assert.ok(check.errors.name);
  });

  test('needs an email or a WhatsApp number', () => {
    const check = validateLead({ ...goodLead, email: '', whatsapp: '' });
    assert.equal(check.ok, false);
    assert.ok(check.errors.email);
  });

  test('rejects a malformed email or WhatsApp number', () => {
    assert.ok(validateLead({ ...goodLead, email: 'fatima@' }).errors.email);
    assert.ok(validateLead({ ...goodLead, whatsapp: '12' }).errors.whatsapp);
    assert.ok(validateLead({ ...goodLead, whatsapp: 'call me' }).errors.whatsapp);
  });

  test('needs consent', () => {
    const check = validateLead({ ...goodLead, consent: false });
    assert.equal(check.ok, false);
    assert.ok(check.errors.consent);
  });

  test('rejects overlong fields', () => {
    assert.ok(validateLead({ ...goodLead, name: 'a'.repeat(81) }).errors.name);
    assert.ok(validateLead({ ...goodLead, email: `${'a'.repeat(120)}@x.com` }).errors.email);
  });
});

describe('buildLeadPayload', () => {
  const state = {
    name: 'Distribution bid',
    currency: 'SAR',
    value: '400,000',
    chance: '35',
    directCost: '90,000',
    opportunityCost: '30,000',
    egoTax: '18,000',
    flags: [true, false, true, false, false],
    stopRule: 'costs pass SAR 120,000',
  };

  test('combines the contact details with the scored deal', () => {
    // Arrange
    const result = computeWiwi(state);
    // Act
    const payload = buildLeadPayload({
      state,
      result,
      lead: { ...goodLead, name: '  Fatima Al-Harbi ', website: '' },
      action: 'pdf',
      page: 'https://shamoilp.github.io/worth-winning/',
    });
    // Assert
    assert.equal(payload.name, 'Fatima Al-Harbi');
    assert.equal(payload.email, 'fatima@example.com');
    assert.equal(payload.wantsReview, true);
    assert.equal(payload.action, 'pdf');
    assert.equal(payload.dealName, 'Distribution bid');
    assert.equal(payload.value, 400000);
    assert.equal(payload.chance, 35);
    assert.equal(payload.egoTax, 18000);
    assert.equal(payload.score, '1.01');
    assert.equal(payload.verdict, 'Thin margin');
    assert.equal(payload.redFlags, 2);
    assert.equal(payload.stopRule, 'costs pass SAR 120,000');
    assert.equal(payload.website, '');
    assert.equal(payload.wifi, '');
  });

  test('carries the WIFI, WIDI and post-mortem summaries', () => {
    const payload = buildLeadPayload({
      state,
      result: computeWiwi(state),
      lead: goodLead,
      action: 'pdf',
      page: '',
      trilogy: { wifi: 'Clear-eyed', widi: 'Healthy momentum', postMortem: '1.20 Narrow win' },
    });
    assert.equal(payload.wifi, 'Clear-eyed');
    assert.equal(payload.widi, 'Healthy momentum');
    assert.equal(payload.postMortem, '1.20 Narrow win');
  });

  test('passes the hidden spam-trap field through so the server can drop bots', () => {
    const payload = buildLeadPayload({
      state, result: computeWiwi(state), lead: { ...goodLead, website: 'http://spam' }, action: 'link', page: '',
    });
    assert.equal(payload.website, 'http://spam');
  });
});

describe('isAcceptedReply', () => {
  test('accepts a saved lead', () => {
    assert.equal(isAcceptedReply({ ok: true }), true);
  });

  test('lets the visitor through when the sheet is busy, so a spam flood cannot lock everyone out', () => {
    assert.equal(isAcceptedReply({ ok: false, error: 'busy' }), true);
  });

  test('rejects invalid, server errors and junk replies', () => {
    assert.equal(isAcceptedReply({ ok: false, error: 'invalid' }), false);
    assert.equal(isAcceptedReply({ ok: false, error: 'server' }), false);
    assert.equal(isAcceptedReply(null), false);
  });
});
