// Contact form checks and the payload sent to the lead sheet. Pure functions, unit-tested.
import { displayScore, parseAmount, parseChance } from './wiwi.js';

export const MAX_LEAD_NAME_LENGTH = 80;
export const MAX_EMAIL_LENGTH = 120;
const MIN_PHONE_DIGITS = 7;
const MAX_PHONE_DIGITS = 15;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_CHARACTERS = /^\+?[\d\s().-]+$/;

const trimmed = (text) => String(text ?? '').trim();

function isPhone(text) {
  const digits = text.replace(/\D/g, '').length;
  return PHONE_CHARACTERS.test(text) && digits >= MIN_PHONE_DIGITS && digits <= MAX_PHONE_DIGITS;
}

/** Checks the unlock form. Returns { ok, errors } with one message per bad field. */
export function validateLead(lead) {
  const errors = {};
  const name = trimmed(lead.name);
  const email = trimmed(lead.email);
  const whatsapp = trimmed(lead.whatsapp);

  if (!name) errors.name = 'Enter your name.';
  else if (name.length > MAX_LEAD_NAME_LENGTH) errors.name = `Keep your name under ${MAX_LEAD_NAME_LENGTH} characters.`;

  if (!email && !whatsapp) errors.email = 'Enter an email or a WhatsApp number.';
  else if (email && (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email))) errors.email = 'Check the email address.';

  if (whatsapp && !isPhone(whatsapp)) errors.whatsapp = 'Enter the number with its country code, like +966 50 123 4567.';
  if (lead.consent !== true) errors.consent = 'Tick the box to agree, or close this window.';

  return { ok: Object.keys(errors).length === 0, errors };
}

/**
 * Whether to unlock after the sheet replies. 'busy' means the flood limit was hit (probably spam),
 * so the visitor is let through rather than locked out; their row is lost, but the gate is soft anyway.
 */
export function isAcceptedReply(reply) {
  return Boolean(reply && (reply.ok === true || reply.error === 'busy'));
}

/** Everything the lead sheet stores: who they are, what they unlocked, and the deal they scored. */
export function buildLeadPayload({ state, result, lead, action, page }) {
  return {
    name: trimmed(lead.name),
    email: trimmed(lead.email),
    whatsapp: trimmed(lead.whatsapp),
    wantsReview: lead.wantsReview === true,
    consent: lead.consent === true,
    action,
    dealName: trimmed(state.name),
    currency: state.currency,
    value: parseAmount(state.value),
    chance: parseChance(state.chance),
    directCost: parseAmount(state.directCost),
    opportunityCost: parseAmount(state.opportunityCost),
    egoTax: parseAmount(state.egoTax),
    score: displayScore(result.score),
    verdict: result.verdict.label,
    redFlags: state.flags.filter(Boolean).length,
    stopRule: trimmed(state.stopRule),
    page,
    website: String(lead.website ?? ''),
  };
}
