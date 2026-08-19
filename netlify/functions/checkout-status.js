const { createClient } = require('@supabase/supabase-js');
const { verifyCheckoutSession } = require('../lib/checkout-session');
const { scoreAnswers } = require('./verify-payment');

const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  },
  body: JSON.stringify(body)
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { paid: false, error: 'Method not allowed.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return jsonResponse(503, { paid: false, error: 'Payment status is not configured.' });
  }

  let body;
  let session;
  try {
    body = JSON.parse(event.body || '{}');
    session = verifyCheckoutSession(body.session_token, process.env.CHECKOUT_SESSION_SECRET);
    scoreAnswers(session.answers);
  } catch (error) {
    return jsonResponse(401, { paid: false, error: error.message });
  }

  // Allow a small clock-skew window, but never let an old purchase unlock a new quiz.
  const earliestPurchase = new Date((session.iat - 10 * 60) * 1000).toISOString();

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
      .from('purchases')
      .select('payment_id,status,created_at')
      .eq('email', session.email)
      .eq('payment_provider', 'gumroad')
      .gte('created_at', earliestPurchase)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Supabase status error:', error);
      return jsonResponse(500, { paid: false, error: 'Could not check payment status.' });
    }

    if (!data) return jsonResponse(200, { paid: false, status: 'pending' });

    const status = String(data.status || '').toLowerCase();
    if (['refunded', 'chargebacked', 'disputed'].includes(status)) {
      return jsonResponse(402, {
        paid: false,
        status,
        error: 'This purchase is no longer eligible for access.'
      });
    }

    if (!['paid', 'completed'].includes(status)) {
      return jsonResponse(200, { paid: false, status: status || 'pending' });
    }

    return jsonResponse(200, {
      paid: true,
      result: scoreAnswers(session.answers)
    });
  } catch (error) {
    console.error('Payment status error:', error);
    return jsonResponse(500, { paid: false, error: 'Could not check payment status.' });
  }
};
