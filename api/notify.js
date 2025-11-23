// api/notify.js — Send SMS + Email notifications for new / delivered orders

import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';
import { Resend } from 'resend';

// ---------- Env + clients ----------

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE;
const adminKey = process.env.ADMIN_ORDERS_KEY || '';

const twilioSid = process.env.TWILIO_ACCOUNT_SID;
const twilioToken = process.env.TWILIO_AUTH_TOKEN;
const twilioFrom = process.env.TWILIO_FROM_NUMBER; // e.g. +19803507029

const resendKey = process.env.RESEND_API_KEY;
const resendFrom = process.env.RESEND_FROM_EMAIL || 'orders@frankiemoji.com';

if (!supabaseUrl || !supabaseKey) {
  // This will show up in Vercel logs if env vars are missing
  console.error('[notify] Missing Supabase env vars');
}

const supabase = createClient(supabaseUrl, supabaseKey);
const twilioClient =
  twilioSid && twilioToken ? twilio(twilioSid, twilioToken) : null;
const resend = resendKey ? new Resend(resendKey) : null;

// Helper: nice label for pack_type
function packLabel(packType) {
  if (!packType) return 'emoji';
  const t = String(packType).toLowerCase();
  if (t === 'starter') return 'Starter (3 emoji)';
  if (t === 'standard') return 'Standard (9 emoji)';
  if (t === 'premium') return 'Premium (18 emoji)';
  return `${packType} pack`;
}

// ---------- API handler ----------

export default async function handler(req, res) {
  // 1) Only allow POST, protected by x-admin-key (same as /api/orders)
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const headerKey = (req.headers['x-admin-key'] || '').toString();
  if (!adminKey || headerKey !== adminKey) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      ok: false,
      error: 'Server misconfigured: Supabase env vars missing',
    });
  }

  try {
    // --------------------------------------------------
    // A) Order confirmation notifications (payment received)
    //    Status expected: 'paid'   (from stripe-webhook)
    // --------------------------------------------------
    const { data: confirmationCandidates, error: confirmError } =
      await supabase
        .from('emoji_orders')
        .select('*')
        .eq('status', 'paid')
        .order('created_at', { ascending: true })
        .limit(50); // safety cap per run

    if (confirmError) {
      console.error('[notify] Supabase select (confirm) error', confirmError);
      return res.status(500).json({
        ok: false,
        error: 'Failed to query orders for confirmation',
      });
    }

    let confirmationsProcessed = 0;

    for (const order of confirmationCandidates || []) {
      const needsSms = order.phone && !order.sms_sent;
      const needsEmail = order.email && !order.email_sent;

      if (!needsSms && !needsEmail) continue;

      const updates = {};

      // ---- SMS confirmation ----
      if (needsSms && twilioClient && twilioFrom) {
        try {
          const body = `Frankiemoji: Your ${packLabel(
            order.pack_type
          )} order is confirmed! We'll send your emoji portraits once they're ready.\nReply STOP to opt out, HELP for help.`;

          await twilioClient.messages.create({
            from: twilioFrom,
            to: order.phone,
            body,
          });

          updates.sms_sent = true;
        } catch (smsErr) {
          console.error(
            '[notify] Twilio SMS error for order',
            order.id,
            smsErr
          );
        }
      }

      // ---- Email confirmation ----
      if (needsEmail && resend) {
        try {
          const subject = 'Your Frankiemoji order is confirmed 🎨';
          const html = `
            <p>Hi there,</p>
            <p>Thanks for your Frankiemoji order! We’ve received your ${
              order.pack_type || 'emoji'
            } pack request and payment.</p>
            <p>We’ll hand-craft your expressions and send your emoji pack to this email as soon as it’s ready.</p>
            <p><strong>Order ID:</strong> ${order.id}</p>
            <p>— Frankiemoji™ Studios<br/>Born with a pencil. Evolved with technology.</p>
          `;

          await resend.emails.send({
            from: resendFrom,
            to: order.email,
            subject,
            html,
          });

          updates.email_sent = true;
        } catch (emailErr) {
          console.error(
            '[notify] Resend email error for order',
            order.id,
            emailErr
          );
        }
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateErr } = await supabase
          .from('emoji_orders')
          .update(updates)
          .eq('id', order.id);

        if (updateErr) {
          console.error(
            '[notify] Supabase update error (confirm flags)',
            order.id,
            updateErr
          );
        } else {
          confirmationsProcessed += 1;
        }
      }
    }

    // --------------------------------------------------
    // B) Delivery notifications (optional)
    //    Status: 'received' + delivery_notified = false
    //    (Use when artwork has been delivered to customer.)
    // --------------------------------------------------
    const { data: deliveryCandidates, error: deliveryError } = await supabase
      .from('emoji_orders')
      .select('*')
      .eq('status', 'received')
      .is('delivery_notified', false)
      .order('created_at', { ascending: true })
      .limit(50);

    if (deliveryError) {
      console.error('[notify] Supabase select (delivery) error', deliveryError);
      // Non-fatal: we still report confirmations
    }

    let deliveriesProcessed = 0;

    for (const order of deliveryCandidates || []) {
      const updates = {};

      // Only SMS for delivery by default (can extend to email later)
      if (order.phone && twilioClient && twilioFrom) {
        try {
          const body = `Frankiemoji: Your emoji portraits have been delivered to your email (${order.email ||
            'on file'}). Enjoy! 🎨\nReply STOP to opt out, HELP for help.`;

          await twilioClient.messages.create({
            from: twilioFrom,
            to: order.phone,
            body,
          });

          updates.delivery_notified = true;
        } catch (smsErr) {
          console.error(
            '[notify] Twilio SMS error (delivery) for order',
            order.id,
            smsErr
          );
        }
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateErr } = await supabase
          .from('emoji_orders')
          .update(updates)
          .eq('id', order.id);

        if (updateErr) {
          console.error(
            '[notify] Supabase update error (delivery flags)',
            order.id,
            updateErr
          );
        } else {
          deliveriesProcessed += 1;
        }
      }
    }

    return res.status(200).json({
      ok: true,
      confirmationsProcessed,
      deliveriesProcessed,
    });
  } catch (err) {
    console.error('[notify] handler fatal error', err);
    return res.status(500).json({
      ok: false,
      error: 'Notify endpoint failed',
    });
  }
}
