// /api/notify-waitlist.js
// Save waitlist email + send confirmation via Resend

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// ---------- Env ----------

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE;

const resendKey   = process.env.RESEND_API_KEY;
const resendFrom  = process.env.RESEND_FROM_EMAIL || 'waitlist@frankiemoji.com';

const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

const resend =
  resendKey
    ? new Resend(resendKey)
    : null;

// ---------- CORS ----------

function setCors(res) {
  const origin =
    process.env.FRONTEND_BASE_URL || 'https://www.frankiemoji.com';

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ---------- Handler ----------

export default async function handler(req, res) {
  setCors(res);
  console.log('[notify-waitlist] incoming', { method: req.method, url: req.url });

  // Preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end('OK');
    return;
  }

  // Only POST is allowed
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST,OPTIONS');
    res.end('Method Not Allowed');
    return;
  }

  if (!supabase) {
    console.error('[notify-waitlist] Supabase not configured');
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Server not configured' }));
    return;
  }

  // Parse JSON body
  let body = {};
  try {
    body =
      typeof req.body === 'string'
        ? JSON.parse(req.body)
        : req.body || {};
  } catch (err) {
    console.error('[notify-waitlist] invalid JSON', err);
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
    return;
  }

  const {
    email,
    tag = 'splash',
    userAgent,
    referer,
  } = body;

  if (!email || !email.includes('@')) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Invalid email' }));
    return;
  }

  try {
    // Insert into notify_waitlist
    const { data, error } = await supabase
      .from('notify_waitlist')
      .insert([{
        email,
        tag,
        user_agent: userAgent || null,
        referer: referer || null,
      }])
      .select()
      .single();

    if (error) {
      // Unique-constraint violation => already on list, that’s OK
      if (error.code === '23505') {
        console.log('[notify-waitlist] duplicate email', email);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, duplicate: true }));
        return;
      }

      console.error('[notify-waitlist] insert error', error);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'Database error' }));
      return;
    }

    // Fire-and-forget confirmation email
    if (resend && resendFrom) {
      try {
        await resend.emails.send({
          from: resendFrom,
          to: email,
          subject: 'You’re on the Frankiemoji holiday list 🎄',
          text:
`Thanks for joining the Frankiemoji holiday waitlist.

You’ll be the first to know when the studio opens
and we start shipping emoji portraits.

– Frankiemoji Studio`,
        });
      } catch (err) {
        console.error('[notify-waitlist] Resend error', err);
        // Don’t fail the request if email sending fails
      }
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, id: data.id }));
  } catch (err) {
    console.error('[notify-waitlist] unexpected error', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'Server error' }));
  }
}
