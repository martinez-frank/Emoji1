import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// ---------- Supabase client ----------
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

// ---------- Stripe client ----------
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

// Tell Vercel/Next not to parse the body (Stripe needs raw)
export const config = {
  api: {
    bodyParser: false,
  },
};

// helper to read raw body
function buffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    readable.on('end', () => resolve(Buffer.concat(chunks)));
    readable.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  let event;
  try {
    const buf = await buffer(req);
    const sig = req.headers['stripe-signature'];

    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('[stripe-webhook] Signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      const orderId = session.metadata?.orderId;
      const amountTotal = session.amount_total || 0;
      const discountTotal = session.total_details?.amount_discount || 0;
      const baseAmount = amountTotal + discountTotal;
      const paymentIntentId = session.payment_intent || null;

      const firstDiscount = (session.discounts && session.discounts[0]) || null;
      const couponId = firstDiscount?.discount?.coupon?.id || null;
      const promoId = firstDiscount?.promotion_code || null;

      if (orderId) {
        const { error: updateError } = await supabase
          .from('emoji_orders')
          .update({
            status: 'paid', // later: 'queued' → 'generating' → 'ready'
            base_price_cents: baseAmount,
            final_price_cents: amountTotal,
            stripe_payment_intent_id: paymentIntentId,
            stripe_coupon_id: couponId,
            stripe_promo_id: promoId,
          })
          .eq('id', orderId);

        if (updateError) {
          console.error('[stripe-webhook] Supabase update error:', updateError);
        }
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('[stripe-webhook] Handler error:', err);
    res.status(500).send('Server error');
  }
}
