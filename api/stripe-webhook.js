// api/stripe-webhook.js
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// ---------- Supabase client ----------
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE;
const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// ---------- Stripe client ----------
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

// Tell Vercel/Next NOT to parse the body (Stripe needs raw)
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper to read raw body for Stripe signature verification
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

  if (!supabase) {
    console.error('[stripe-webhook] Missing Supabase URL or key');
    return res.status(500).send('Server misconfigured');
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

      const orderId = session.metadata?.orderId || null;
      const amountTotal =
        typeof session.amount_total === 'number' ? session.amount_total : null;
      const discountTotal =
        typeof session.total_details?.amount_discount === 'number'
          ? session.total_details.amount_discount
          : 0;
      const baseAmount =
        amountTotal !== null ? amountTotal + (discountTotal || 0) : null;

      console.log('[stripe-webhook] checkout.session.completed', {
        eventId: event.id,
        orderId,
        amountTotal,
        baseAmount,
        email: session.customer_details?.email || session.metadata?.email,
      });

      if (!orderId) {
        console.warn('[stripe-webhook] Missing orderId in metadata', {
          eventId: event.id,
        });
      } else {
        const { error: updateError } = await supabase
          .from('emoji_orders')
          .update({
            status: 'received',          // treat this as "paid + landed in admin"
            base_price_cents: baseAmount,
            final_price_cents: amountTotal,
          })
          .eq('id', orderId);

        if (updateError) {
          console.error(
            '[stripe-webhook] Supabase update error:',
            updateError
          );
          // We still return 200 so Stripe doesn't hammer retries forever.
        } else {
          console.log('[stripe-webhook] Order updated OK', {
            orderId,
            baseAmount,
            amountTotal,
          });
        }
      }
    }

    return res.json({ received: true });
  } catch (err) {
    console.error('[stripe-webhook] Handler error:', err);
    return res.status(500).send('Server error');
  }
}
