const assert = require('node:assert/strict');
const test = require('node:test');

const {
  SESSION_TTL_SECONDS,
  createCheckoutSession,
  verifyCheckoutSession
} = require('../netlify/lib/checkout-session');
const { handler: createCheckout } = require('../netlify/functions/create-checkout-session');

const SECRET = 'a-test-secret-that-is-at-least-thirty-two-characters';
const ANSWERS = {
  4: 'single',
  7: 'fewmin',
  10: 'pretend',
  13: 'sleep',
  16: 'ignore',
  19: 'voicenotes',
  23: 'never',
  26: 'zero',
  30: 'nosituationships',
  33: 'dontcheck',
  36: 'stable',
  39: 'months',
  42: 'communicate',
  45: 'neverghost',
  48: 'neverphone',
  52: 'removetrace',
  55: 'askabout',
  58: 'picky',
  61: 'secure',
  64: 'greenflag'
};

test('checkout session round-trips trusted email and answers', () => {
  const now = Date.UTC(2026, 7, 19, 12, 0, 0);
  const token = createCheckoutSession(
    { email: 'buyer@example.com', answers: ANSWERS },
    SECRET,
    now
  );
  const payload = verifyCheckoutSession(token, SECRET, now + 1000);

  assert.equal(payload.email, 'buyer@example.com');
  assert.deepEqual(payload.answers, ANSWERS);
  assert.equal(payload.exp - payload.iat, SESSION_TTL_SECONDS);
});

test('tampered and expired checkout sessions are rejected', () => {
  const now = Date.UTC(2026, 7, 19, 12, 0, 0);
  const token = createCheckoutSession(
    { email: 'buyer@example.com', answers: ANSWERS },
    SECRET,
    now
  );

  assert.throws(
    () => verifyCheckoutSession(`${token.slice(0, -1)}x`, SECRET, now),
    /Invalid checkout session/
  );
  assert.throws(
    () => verifyCheckoutSession(token, SECRET, now + (SESSION_TTL_SECONDS + 1) * 1000),
    /expired or is invalid/
  );
});

test('checkout endpoint prefills email without revealing a result', async () => {
  const previousSecret = process.env.CHECKOUT_SESSION_SECRET;
  process.env.CHECKOUT_SESSION_SECRET = SECRET;
  try {
    const response = await createCheckout({
      httpMethod: 'POST',
      body: JSON.stringify({
        email: ' Buyer@Example.com ',
        answers: { ...ANSWERS, injected: 'this must not be signed' }
      })
    });
    const body = JSON.parse(response.body);
    const checkoutUrl = new URL(body.checkout_url);

    assert.equal(response.statusCode, 200);
    assert.equal(body.success, true);
    assert.ok(body.session_token);
    assert.equal(body.result, undefined);
    assert.equal(checkoutUrl.searchParams.get('email'), 'buyer@example.com');
    assert.equal(checkoutUrl.searchParams.get('wanted'), 'true');
    const session = verifyCheckoutSession(body.session_token, SECRET);
    assert.equal(session.answers.injected, undefined);
  } finally {
    if (previousSecret === undefined) delete process.env.CHECKOUT_SESSION_SECRET;
    else process.env.CHECKOUT_SESSION_SECRET = previousSecret;
  }
});
