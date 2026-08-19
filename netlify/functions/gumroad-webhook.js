const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  },
  body: JSON.stringify(body)
});

function safeEqual(left, right) {
  if (!left || !right) return false;
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function parsePayload(event) {
  const contentType = String(
    event.headers?.['content-type'] || event.headers?.['Content-Type'] || ''
  ).toLowerCase();
  if (contentType.includes('application/json')) {
    return JSON.parse(event.body || '{}');
  }
  return Object.fromEntries(new URLSearchParams(event.body || ''));
}

function isTrue(value) {
  return value === true || value === 'true' || value === '1' || value === 1;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { success: false, error: 'Method not allowed.' });
  }

  const webhookSecret = process.env.GUMROAD_WEBHOOK_SECRET;
  const suppliedSecret =
    event.queryStringParameters?.secret ||
    event.headers?.['x-redflag-webhook-secret'] ||
    event.headers?.['X-RedFlag-Webhook-Secret'];
  if (!safeEqual(suppliedSecret, webhookSecret)) {
    return jsonResponse(401, { success: false, error: 'Unauthorized.' });
  }

  const productId = process.env.GUMROAD_PRODUCT_ID;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!productId || !supabaseUrl || !supabaseKey) {
    return jsonResponse(503, { success: false, error: 'Webhook is not configured.' });
  }

  let payload;
  try {
    payload = parsePayload(event);
  } catch {
    return jsonResponse(400, { success: false, error: 'Invalid payload.' });
  }

  const saleId = payload.sale_id;
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  if (!saleId || !email || payload.product_id !== productId) {
    return jsonResponse(400, { success: false, error: 'Sale does not match this product.' });
  }

  let status = 'paid';
  if (isTrue(payload.refunded)) status = 'refunded';
  else if (isTrue(payload.chargebacked)) status = 'chargebacked';
  else if (isTrue(payload.disputed)) status = 'disputed';

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error } = await supabase.from('purchases').upsert(
      {
        payment_id: saleId,
        email,
        product: payload.product_name || 'RedFlag Access',
        payment_provider: 'gumroad',
        status,
        created_at: payload.sale_timestamp || new Date().toISOString()
      },
      { onConflict: 'payment_id' }
    );

    if (error) {
      console.error('Supabase webhook error:', error);
      return jsonResponse(500, { success: false, error: 'Failed to record purchase.' });
    }

    return jsonResponse(200, { success: true });
  } catch (error) {
    console.error('Gumroad webhook error:', error);
    return jsonResponse(500, { success: false, error: 'Webhook failed.' });
  }
};
