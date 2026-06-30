// This function runs on Netlify's servers, never in the browser.
// The Stripe secret key is read from an environment variable —
// it is NEVER written into this file or any code the browser can see.

const Stripe = require('stripe');

const PRODUCTS = {
  brush:  { name: 'Boar Bristle Bamboo Toothbrush (6-pack)', unit_amount: 3000 }, // cents
  tallow: { name: 'Raw Beef Tallow & Honey Balm (120g)',     unit_amount: 1800 }  // cents
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const { items } = JSON.parse(event.body || '{}');

    if (!Array.isArray(items)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request' }) };
    }

    const line_items = items
      .filter(i => i && i.qty > 0 && PRODUCTS[i.id])
      .map(i => ({
        price_data: {
          currency: 'eur',
          product_data: { name: PRODUCTS[i.id].name },
          unit_amount: PRODUCTS[i.id].unit_amount
        },
        quantity: Math.min(i.qty, 20) // sanity cap
      }));

    if (line_items.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Cart is empty' }) };
    }

    const origin = process.env.URL || `https://${event.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      shipping_address_collection: { allowed_countries: ['MT'] },
      phone_number_collection: { enabled: true },
      success_url: `${origin}/success.html`,
      cancel_url: `${origin}/#order`
    });

    return { statusCode: 200, body: JSON.stringify({ url: session.url }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
