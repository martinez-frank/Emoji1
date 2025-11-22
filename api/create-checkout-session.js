import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// ---------- Supabase client (service role) ----------
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

// ---------- Stripe client ----------
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

// ---------- Price + Promo maps from ENV ----------
const PRICE_MAP = {
  starter: process.env.STRIPE_PRICE_STARTER,
  standard: process.env.STRIPE_PRICE_STANDARD,
  premium: process.env.STRIPE_PRICE_PREMIUM,
};

const PROMO_MAP = {
  holiday15: process.env.STRIPE_PROMO_HOLIDAY15,
  frankie10: process.env.STRIPE_PROMO_FRANKIE10,
  donni10: process.env.STRIPE_PROMO_DONNI10,
  aaron10: process.env.STRIPE_PROMO_AARON10,
  crew100: process.env.STRIPE_PROMO_CREW100,
};

// ---------- API handler ----------
export default async function handler(req, res) {
  // 1) Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 2) Read JSON body from upload.html
    const {
      email,
      phone,
      packType,
      promoCode,
      expressions,
      imageUrl,
    } = req.body || {};

    // 3) Basic validation
    if (!email || !packType || !PRICE_MAP[packType] || !imageUrl) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const normalizedPromo = promoCode
      ? String(promoCode).trim().toLowerCase()
      : null;

    const priceId = PRICE_MAP[packType];
    const promoId = normalizedPromo ? PROMO_MAP[normalizedPromo] : null;

    // 4) Create pending order in Supabase
    const { data: order, error: insertError } = await supabase
      .from('emoji_orders')
      .insert({
        pack_type: packType,
        expressions: expressions || [],
        email,
        phone,
        image_path: imageUrl,
        status: 'pending_payment',
        promo_code: normalizedPromo,
      })
      .single();

    if (insertError) {
      console.error('[create-checkout-session] Supabase insert error', insertError);
      return res.status(500).json({ error: 'Failed to create order' });
    }

    // 5) Create Stripe Checkout Session
    const frontendBase =
      process.env.FRONTEND_BASE_URL || 'https://frankiemoji.com';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      discounts: promoId ? [{ promotion_code: promoId }] : [],
      success_url: `${frontendBase}/processing.html?orderId=${order.id}`,
      cancel_url: `${frontendBase}/upload.html?canceled=1`,
      metadata: {
        orderId: order.id,
        email,
        phone: phone || '',
        packType,
        promoCode: normalizedPromo || '',
        expressions: JSON.stringify(expressions || []),
        imageUrl,
      },
    });

    // 6) Save Stripe session ID on the order
    const { error: updateError } = await supabase
      .from('emoji_orders')
      .update({ stripe_session_id: session.id })
      .eq('id', order.id);

    if (updateError) {
      console.error('[create-checkout-session] Supabase update error', updateError);
      // not fatal to the user; they can still pay, but log it
    }

    // 7) Return URL for redirect
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('[create-checkout-session] Unexpected error', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
