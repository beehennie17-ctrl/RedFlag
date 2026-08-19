const crypto = require('crypto');

const SESSION_VERSION = 1;
const SESSION_TTL_SECONDS = 60 * 60;

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64url');
}

function sign(encodedPayload, secret) {
  return crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

function assertSecret(secret) {
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Error('Checkout sessions are not configured.');
  }
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function createCheckoutSession({ email, answers }, secret, now = Date.now()) {
  assertSecret(secret);
  const issuedAt = Math.floor(now / 1000);
  const payload = {
    v: SESSION_VERSION,
    email,
    answers,
    iat: issuedAt,
    exp: issuedAt + SESSION_TTL_SECONDS,
    jti: crypto.randomBytes(16).toString('hex')
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

function verifyCheckoutSession(token, secret, now = Date.now()) {
  assertSecret(secret);
  if (typeof token !== 'string' || token.length > 12000) {
    throw new Error('Invalid checkout session.');
  }

  const parts = token.split('.');
  if (parts.length !== 2 || !safeEqual(parts[1], sign(parts[0], secret))) {
    throw new Error('Invalid checkout session.');
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  } catch {
    throw new Error('Invalid checkout session.');
  }

  const nowSeconds = Math.floor(now / 1000);
  if (
    payload.v !== SESSION_VERSION ||
    typeof payload.email !== 'string' ||
    !payload.answers ||
    typeof payload.answers !== 'object' ||
    typeof payload.iat !== 'number' ||
    typeof payload.exp !== 'number' ||
    payload.exp <= nowSeconds ||
    payload.iat > nowSeconds + 60
  ) {
    throw new Error('Checkout session has expired or is invalid.');
  }

  return payload;
}

module.exports = {
  SESSION_TTL_SECONDS,
  createCheckoutSession,
  verifyCheckoutSession
};
