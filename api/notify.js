// /api/notify.js — Send SMS + Email notifications for new / delivered orders

import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';
import { Resend } from 'resend';

// ---------- Env + clients ----------

const supabaseUrl   = process.env.SUPABASE_URL;
const supabaseKey   = process.env.SUPABASE_SERVICE_ROLE;
const adminKey      = process.env.ADMIN_ORDERS_KEY || '';

const twilioSid     = process.env.TWILIO_ACCOUNT_SID;
const twilioToken   = process.env.TWILIO_AUTH_TOKEN;
const twilioFrom    = process.env.TWILIO_FROM_NUMBER; // e.g. +19803507029

const resendKey     = process.env.RESEND_API_KEY;
const resendFrom    = process.env.RESEND_FROM_EMAIL || 'orders@frankiemoji.com';

if (!supabaseUrl || !supabaseKey) {
  console.error('[notify] Missing Supabase env vars');
}

const supabase      = createClient(supabaseUrl, supabaseKey);
const twilioClient  = (twilioSid && twilioToken) ? twilio(twilioSid, twilioToken) : null;
const resend        = resendKey ? new Resend(resendKey) : null;

// ---------- Helpers ----------

function packLabel(packType) {
  const t = (packType || '').toLowerCase();
  if (t === 'starter')  return 'Starter (3 emoji)';
  if (t === 'standard') return 'Standard (9 emoji)';
  if (t === 'premium')  return 'Premium (18 emoji)';
  return (packType || 'Custom') + ' pack';
}

function normalizePhone(phone) {
  if (!phone) return null;
  const raw = phone.toString().replace(/[^\d+]/g, '');

  // Already looks like +1...
  if (raw.startsWith('+')) return raw;

  // US numbers: 10 or 11 digits
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return '+' + digits;
  }
  if (digits.length === 10) {
    return '+1' + digits;
  }

  // Fallback: try to prefix +
  return '+' + digits;
}

// ---------- API handler ----------

 export default async function handler(req, res) {
  // Allow both POST and GET (for browser console / curl), still gated by x-admin-key
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const headerKey = (req.headers['x-admin-key'] || '').toString();
  if (!headerKey || headerKey !== adminKey) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ ok: false, error: 'Server misconfigured' });
  }

  try {
    // 1) Fetch orders that are PAID but not yet notified
    const { data: orders, error } = await supabase
   .from('emoji_orders')
   .select('*')
   .in('status', ['received', 'paid']) // look at both
   .or('sms_sent.is.false,email_sent.is.false')
   .order('created_at', { ascending: true })
   .limit(50);

    if (error) throw error;

    let smsCount = 0;
    let emailCount = 0;

    // 2) Loop through candidates
    for (const order of orders) {
      const { id, pack_type, email, phone, sms_sent, email_sent } = order;

      // --- SMS ---
      if (twilioClient && phone && sms_sent !== true) {
        const to = normalizePhone(phone);
        if (to) {
          try {
            await twilioClient.messages.create({
              to,
              from: twilioFrom,
              body: `Your Frankiemoji order is confirmed! 🎨\n` +
                    `Pack: ${packLabel(pack_type)}.\n` +
                    `We’ll send your artwork preview soon — reply STOP to opt out.`
            });
            smsCount += 1;
            await supabase
              .from('emoji_orders')
              .update({ sms_sent: true })
              .eq('id', id);
          } catch (err) {
            console.error('[notify] SMS failed for order', id, err?.message || err);
          }
        }
      }

      // --- Email ---
      if (resend && email && email_sent !== true) {
        try {
          await resend.emails.send({
            from: resendFrom,
            to: email,
            subject: 'Your Frankiemoji order is confirmed 🎨',
            html: `
              <p>Hi!</p>
              <p>Thanks for ordering a <strong>${packLabel(pack_type)}</strong> from Frankiemoji.</p>
              <p>We’ve received your photo and expressions and will send a preview of your artwork soon.</p>
              <p>If you have any questions, you can reply to this email.</p>
              <p>Frankiemoji — Born with a pencil. Evolved with technology.</p>
            `,
          });
          emailCount += 1;
          await supabase
            .from('emoji_orders')
            .update({ email_sent: true })
            .eq('id', id);
        } catch (err) {
          console.error('[notify] Email failed for order', id, err?.message || err);
        }
      }
    }

    return res.status(200).json({
      ok: true,
      checked: orders.length,
      smsSent: smsCount,
      emailsSent: emailCount,
    });
  } catch (err) {
    console.error('[notify] Unexpected error', err);
    return res.status(500).json({ ok: false, error: 'Unexpected server error' });
  }
}
