// /api/notify.js
// Send SMS + Email notifications for Frankiemoji orders (admin-only)

import { createClient } from '@supabase/supabase-js';
import twilio from 'twilio';
import { Resend } from 'resend';

// ---------- Env ----------

const supabaseUrl   = process.env.SUPABASE_URL;
const supabaseKey   = process.env.SUPABASE_SERVICE_ROLE;

const adminKey      = process.env.ADMIN_ORDERS_KEY || '';

const twilioSid     = process.env.TWILIO_ACCOUNT_SID;
const twilioToken   = process.env.TWILIO_AUTH_TOKEN;
const twilioFrom    = process.env.TWILIO_FROM_NUMBER; // e.g. +1980...

const resendKey     = process.env.RESEND_API_KEY;
const resendFrom    = process.env.RESEND_FROM_EMAIL || 'orders@frankiemoji.com';

// Create clients lazily but **don’t** throw at import time
const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

const twilioClient =
  twilioSid && twilioToken
    ? twilio(twilioSid, twilioToken)
    : null;

const resendClient =
  resendKey
    ? new Resend(resendKey)
    : null;

// ---------- Helpers ----------

function unauthorized(res) {
  res.statusCode = 401;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
}

function badRequest(res, message) {
  res.statusCode = 400;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: false, error: message }));
}

function serverError(res, message) {
  res.statusCode = 500;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: false, error: message }));
}

// Build copy for different notification types
function buildMessages(type, order) {
  const packLabel = order.pack_type || order.packType || 'emoji pack';
  const exprCount = Array.isArray(order.expressions)
    ? order.expressions.length
    : null;

  if (type === 'pack_ready') {
    const subject = 'Your Frankiemoji pack is ready 🎨';
    const text = [
      `Your ${packLabel} is ready!`,
      exprCount ? `We’ve finished ${exprCount} custom expressions.` : '',
      order.download_url
        ? `Download it here: ${order.download_url}`
        : 'We’ll send your download link shortly.'
    ]
      .filter(Boolean)
      .join('\n\n');

    return { subject, text };
  }

  // default: order_received
  const subject = 'We received your Frankiemoji order ✨';
  const text = [
    `Thanks for your order!`,
    `You’re getting a ${packLabel} from Frankiemoji.`,
    exprCount ? `You chose ${exprCount} expressions.` : '',
    'We’ll let you know as soon as your pack is ready.'
  ]
    .filter(Boolean)
    .join('\n\n');

  return { subject, text };
}

// ---------- Handler ----------

export default async function handler(req, res) {
  // Method check
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    res.end('Method Not Allowed');
    return;
  }

  // Env guard (inside handler so it doesn’t break import)
  if (!supabase) {
    console.error('[notify] Supabase env vars missing');
    return serverError(res, 'Server not configured');
  }

  // Admin key check (header or query)
  const incomingKey =
    req.headers['x-admin-key'] ||
    req.headers['x-admin-orders-key'] ||
    req.query.adminKey ||
    req.query.key;

  if (!adminKey || !incomingKey || incomingKey !== adminKey) {
    console.warn('[notify] Invalid admin key');
    return unauthorized(res);
  }

  // Parse body
  let body = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch (err) {
    console.error('[notify] Failed to parse JSON body', err);
    return badRequest(res, 'Invalid JSON body');
  }

  const { orderId, type = 'pack_ready' } = body;

  if (!orderId) {
    return badRequest(res, 'Missing orderId');
  }

  console.log('[notify] Starting notification', { orderId, type });

  try {
    // ----- Fetch order from DB -----
    const { data: order, error } = await supabase
      .from('emoji_orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error || !order) {
      console.error('[notify] Order fetch error', error);
      return serverError(res, 'Order not found');
    }

    const { subject, text } = buildMessages(type, order);

    let emailSent = false;
    let smsSent = false;

    // ----- Send email (Resend) -----
    if (resendClient && order.email) {
      try {
        await resendClient.emails.send({
          from: resendFrom,
          to: order.email,
          subject,
          text
        });
        emailSent = true;
        console.log('[notify] Email sent to', order.email);
      } catch (err) {
        console.error('[notify] Error sending email', err);
      }
    } else {
      console.warn('[notify] Email not sent — missing client or recipient');
    }

    // ----- Send SMS (Twilio) -----
    if (twilioClient && twilioFrom && order.phone) {
      try {
        await twilioClient.messages.create({
          from: twilioFrom,
          to: order.phone,
          body: text
        });
        smsSent = true;
        console.log('[notify] SMS sent to', order.phone);
      } catch (err) {
        console.error('[notify] Error sending SMS', err);
      }
    } else {
      console.warn('[notify] SMS not sent — missing client/from/phone');
    }

    // ----- Respond -----
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        ok: true,
        orderId,
        type,
        emailSent,
        smsSent
      })
    );
  } catch (err) {
    console.error('[notify] Unexpected error', err);
    return serverError(res, 'Unexpected server error');
  }
}
