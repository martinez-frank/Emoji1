import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

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

  // 2) Create Supabase + Stripe clients INSIDE the handler
  let supabase, stripe;
  try {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE
    );

    stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
  } catch (initErr) {
    console.error('[create-checkout-session] Init error', initErr, {
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasSupabaseRole: !!process.env.SUPABASE_SERVICE_ROLE,
      hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
    });

    return res.status(500).json({
      error: 'Server configuration error',
      detail: initErr.message,
    });
  }

  try {
    // 3) Read JSON body from upload.html (support camelCase + snake_case)
    const {
      email,
      phone,
      packType,
      pack_type,
      promoCode,
      promo_code,
      expressions,
      imageUrl,
      image_url,
    } = req.body || {};

    // ---- Normalize field names ----
    const finalPackType = packType || pack_type || null;
    const rawPromo = promoCode != null ? promoCode : promo_code;
    const finalPromo = rawPromo ? String(rawPromo).trim().toLowerCase() : null;
    const finalImageUrl = imageUrl || image_url || null;

    // 4) Basic validation
    if (!email || !finalPackType || !PRICE_MAP[finalPackType] || !finalImageUrl) {
      console.error('[create-checkout-session] Invalid request payload', {
        email,
        packType: finalPackType,
        hasPrice: !!PRICE_MAP[finalPackType],
        hasImage: !!finalImageUrl,
      });
      return res.status(400).json({ error: 'Invalid request' });
    }

    const priceId = PRICE_MAP[finalPackType];
    const promoId = finalPromo ? PROMO_MAP[finalPromo] : null;

    // 5) Create pending order in Supabase
    const { data: order, error: insertError } = await supabase
      .from('emoji_orders')
      .insert({
        pack_type: finalPackType,
        expressions: expressions || [],
        email,
        phone,
        image_path: finalImageUrl,
        status: 'pending_payment',
        promo_code: finalPromo,
      })
      .select() // ensure we actually get the inserted row back
      .single(); // so order.id is not null

    if (insertError || !order) {
      console.error(
        '[create-checkout-session] Supabase insert error / no order returned',
        { insertError, order }
      );
      return res
        .status(500)
        .json({ error: 'Failed to create order (db_insert)' });
    }

    // 6) Create Stripe Checkout Session
    // Hard-code your live frontend for now so redirect is unambiguous
    const frontendBase = 'https://www.frankiemoji.com';

    let session;
    try {
    session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    discounts: promoId ? [{ promotion_code: promoId }] : [],
    // Include both paid=1 and success=1 (upload.html checks either)
    success_url: `${frontendBase}/upload.html?paid=1&success=1&orderId=${order.id}`,
    cancel_url: `${frontendBase}/upload.html?canceled=1`,
    metadata: {
      orderId: order.id,
      email,
      phone: phone || '',
      packType: finalPackType,
      promoCode: finalPromo || '',
      expressions: JSON.stringify(expressions || []),
      imageUrl: finalImageUrl,
    },
  });

    } catch (stripeErr) {
      console.error(
        '[create-checkout-session] Stripe error creating session',
        stripeErr
      );
      return res.status(500).json({
        error: 'Failed to create Stripe session',
        detail: stripeErr.message,
      });
    }

    // 7) Save Stripe session ID on the order (non-fatal if this fails)
    const { error: updateError } = await supabase
      .from('emoji_orders')
      .update({ stripe_session_id: session.id })
      .eq('id', order.id);

    if (updateError) {
      console.error(
        '[create-checkout-session] Supabase update error',
        updateError
      );
    }

    // 8) Return URL for redirect
    return res.status(200).json({
      ok: true,
      checkoutUrl: session.url,
    });
  } catch (err) {
    console.error('[create-checkout-session] Unexpected error', err);
    return res.status(500).json({
      error: 'Server error (unhandled)',
      detail: err.message,
    });
  }
}
