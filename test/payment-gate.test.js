const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

let purchaseRow = null;
let recordedPurchase = null;

const fakeSupabase = {
  from() {
    const query = {
      select() { return query; },
      eq() { return query; },
      gte() { return query; },
      order() { return query; },
      limit() { return query; },
      async maybeSingle() { return { data: purchaseRow, error: null }; },
      async upsert(value) {
        recordedPurchase = value;
        return { error: null };
      }
    };
    return query;
  }
};

const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === '@supabase/supabase-js') {
    return { createClient: () => fakeSupabase };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const { createCheckoutSession } = require('../netlify/lib/checkout-session');
const { handler: checkoutStatus } = require('../netlify/functions/checkout-status');
const { handler: gumroadWebhook } = require('../netlify/functions/gumroad-webhook');
Module._load = originalLoad;

const SECRET = 'another-test-secret-that-is-at-least-thirty-two-characters';
const ANSWERS = {
  4: 'single', 7: 'fewmin', 10: 'pretend', 13: 'sleep', 16: 'ignore',
  19: 'voicenotes', 23: 'never', 26: 'zero', 30: 'nosituationships',
  33: 'dontcheck', 36: 'stable', 39: 'months', 42: 'communicate',
  45: 'neverghost', 48: 'neverphone', 52: 'removetrace', 55: 'askabout',
  58: 'picky', 61: 'secure', 64: 'greenflag'
};

function setPaymentEnvironment() {
  process.env.CHECKOUT_SESSION_SECRET = SECRET;
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
}

test('checkout stays locked until Supabase contains a paid purchase', async () => {
  setPaymentEnvironment();
  const token = createCheckoutSession(
    { email: 'buyer@example.com', answers: ANSWERS },
    SECRET
  );

  purchaseRow = null;
  const pending = await checkoutStatus({
    httpMethod: 'POST',
    body: JSON.stringify({ session_token: token })
  });
  assert.equal(pending.statusCode, 200);
  assert.deepEqual(JSON.parse(pending.body), { paid: false, status: 'pending' });

  purchaseRow = {
    payment_id: 'sale-123',
    status: 'paid',
    created_at: new Date().toISOString()
  };
  const paid = await checkoutStatus({
    httpMethod: 'POST',
    body: JSON.stringify({ session_token: token })
  });
  const paidBody = JSON.parse(paid.body);
  assert.equal(paid.statusCode, 200);
  assert.equal(paidBody.paid, true);
  assert.equal(typeof paidBody.result.score, 'number');
});

test('refund status remains locked', async () => {
  setPaymentEnvironment();
  const token = createCheckoutSession(
    { email: 'buyer@example.com', answers: ANSWERS },
    SECRET
  );
  purchaseRow = {
    payment_id: 'sale-123',
    status: 'refunded',
    created_at: new Date().toISOString()
  };

  const response = await checkoutStatus({
    httpMethod: 'POST',
    body: JSON.stringify({ session_token: token })
  });
  assert.equal(response.statusCode, 402);
  assert.equal(JSON.parse(response.body).paid, false);
});

test('webhook verifies a Gumroad license before recording paid status', async () => {
  process.env.GUMROAD_PRODUCT_ID = 'product-123';
  process.env.GUMROAD_WEBHOOK_SECRET = 'webhook-secret';
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  recordedPurchase = null;

  const previousFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    async json() {
      return {
        success: true,
        purchase: {
          sale_id: 'sale-123',
          email: 'buyer@example.com',
          refunded: false,
          disputed: false,
          chargebacked: false
        }
      };
    }
  });

  try {
    const response = await gumroadWebhook({
      httpMethod: 'POST',
      queryStringParameters: { secret: 'webhook-secret' },
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sale_id: 'sale-123',
        email: 'Buyer@Example.com',
        product_id: 'product-123',
        product_name: 'RedFlag Access',
        license_key: 'VALID-LICENSE-KEY'
      })
    });

    assert.equal(response.statusCode, 200);
    assert.equal(recordedPurchase.status, 'paid');
    assert.equal(recordedPurchase.email, 'buyer@example.com');
  } finally {
    global.fetch = previousFetch;
  }
});
