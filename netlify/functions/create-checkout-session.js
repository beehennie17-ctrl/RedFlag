const { createCheckoutSession } = require('../lib/checkout-session');
const { sanitizeAnswers } = require('./verify-payment');

const DEFAULT_PRODUCT_URL = 'https://benconk.gumroad.com/l/cdmlkx';

const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  },
  body: JSON.stringify(body)
});

function normalizeEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Enter the email you will use at Gumroad.');
  }
  return email;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { success: false, error: 'Method not allowed.' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(400, { success: false, error: 'Invalid request.' });
  }

  let email;
  let answers;
  try {
    email = normalizeEmail(body.email);
    answers = sanitizeAnswers(body.answers);
  } catch (error) {
    return jsonResponse(400, { success: false, error: error.message });
  }

  let sessionToken;
  try {
    sessionToken = createCheckoutSession(
      { email, answers },
      process.env.CHECKOUT_SESSION_SECRET
    );
  } catch (error) {
    console.error('Checkout session error:', error.message);
    return jsonResponse(503, {
      success: false,
      error: 'Automatic checkout is not configured yet.'
    });
  }

  let checkoutUrl;
  try {
    checkoutUrl = new URL(process.env.GUMROAD_PRODUCT_URL || DEFAULT_PRODUCT_URL);
    checkoutUrl.searchParams.set('wanted', 'true');
    checkoutUrl.searchParams.set('email', email);
  } catch {
    return jsonResponse(503, {
      success: false,
      error: 'The checkout link is not configured correctly.'
    });
  }

  return jsonResponse(200, {
    success: true,
    session_token: sessionToken,
    checkout_url: checkoutUrl.toString()
  });
};

exports.normalizeEmail = normalizeEmail;
