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
    // Parse the webhook payload from Gumroad
    const payload = JSON.parse(event.body);

    // Extract the important data from Gumroad
    const {
      sale_id,
      email,
      product_name,
      amount,
      currency
    } = payload;

    if (!sale_id || !email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' })
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

    // Save the purchase to Supabase
    const { data, error } = await supabase
      .from('purchases')
      .insert([
        {
          payment_id: sale_id,
          email: email,
          product: product_name || 'RedFlag Access',
          payment_provider: 'gumroad',
          status: 'paid',
          created_at: new Date().toISOString()
        }
      ]);

    if (error) {
      console.error('Supabase error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to save purchase' })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Purchase recorded successfully'
      })
    };
  } catch (error) {
    console.error('Webhook error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
