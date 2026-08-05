const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Get the payment ID from the request body
    const { payment_id } = JSON.parse(event.body);

    if (!payment_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing payment_id' })
      };
    }

    // Get Supabase credentials from environment variables
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Supabase credentials not configured' })
      };
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Look up the payment in the purchases table
    const { data, error } = await supabase
      .from('purchases')
      .select('*')
      .eq('payment_id', payment_id)
      .single();

    if (error || !data) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          verified: false,
          error: 'Payment not found'
        })
      };
    }

    // Check if payment status is 'paid' or 'completed'
    const isVerified = data.status === 'paid' || data.status === 'completed';

    return {
      statusCode: 200,
      body: JSON.stringify({
        verified: isVerified,
        payment: data
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        verified: false,
        error: error.message
      })
    };
  }
};
