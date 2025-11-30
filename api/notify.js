// /api/notify.js
// Holiday waitlist: capture emails from the splash page
// and send a confirmation via Resend.

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// ---------- Env ----------

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE; // server-side key

const resendKey  = process.env.RESEND_API_KEY;
const resendFrom = process.env.RESEND_FROM_EMAIL || 'orders@frankiemoji.com';

// Optional: where the frontend is hosted (for CORS)
const FRONTEND_ORIGIN =
  process.env.FRONTEND_BASE_URL || 'https://www.frankiemoji.com';

// Create clients lazily so missing envs don’t crash import
const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

const resendClient =
  resendKey
    ? new Resend(resendKey)
    : null;

// ---------- Helpers ----------

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', FRONTEND_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type'
  );
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function badRequest(res, message) {
  return sendJson(res, 400, { ok: false, error: message });
}

function serverError(res, message) {
  return sendJson(res, 500, { ok: false, error: message });
}

function isValidEmail(email) {
  if (!email) return false;
  const value = String(email).trim();
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(value);
}

// ---------- Handler ----------

export default async function handler(req, res) {
  setCorsHeaders(res);
  console.log('[notify] Incoming request', {
    method: req.method,
    url: req.url,
  });

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end('OK');
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST,OPTIONS');
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }

  // Parse body (Next.js usually gives an object already)
  let body = {};
  try {
    body =
      typeof req.body === 'string'
        ? JSON.parse(req.body)
        : req.body || {};
  } catch (err) {
    console.error('[notify] JSON parse error', err);
    return badRequest(res, 'Invalid JSON body');
  }

  const { email, tag = 'holiday_splash' } = body;

  if (!isValidEmail(email)) {
    console.warn('[notify] Invalid email', email);
    return badRequest(res, 'Invalid email');
  }

  const trimmedEmail = String(email).trim().toLowerCase();
  const ua = req.headers['user-agent'] || null;
  const referer =
    req.headers['referer'] ||
    req.headers['referrer'] ||
    null;

  console.log('[notify] Capturing email', { email: trimmedEmail, tag });

  try {
    // ----- Store in Supabase (optional but recommended) -----
    if (supabase) {
      // Make sure you have a table similar to:
      // create table notify_waitlist (
      //   id uuid primary key default gen_random_uuid(),
      //   email text unique not null,
      //   tag text,
      //   user_agent text,
      //   referer text,
      //   created_at timestamptz default now()
      // );
      const { error } = await supabase
        .from('notify_waitlist')
        .upsert(
          {
            email: trimmedEmail,
            tag,
            user_agent: ua,
            referer,
          },
          { onConflict: 'email' }
        );

      if (error) {
        console.error('[notify] Supabase upsert error', error);
        // We’ll still try to send the email, but log the failure.
      }
    } else {
      console.warn('[notify] Supabase not configured — skipping DB write');
    }

    // ----- Send confirmation email via Resend -----
    if (resendClient) {
      try {
        await resendClient.emails.send({
          from: resendFrom,
          to: trimmedEmail,
          subject: 'You’re on the Frankiemoji holiday list 🎄',
          text: [
            'Thanks for joining the Frankiemoji holiday preview list!',
            '',
            'You’re in the first wave to hear when the studio opens,',
            'so you can turn your favorite expressions into custom emojis',
            'for you, your friends, and your family.',
            '',
            'We’ll be in touch soon ✨',
            '',
            '— Frankiemoji Studio'
          ].join('\n')
        });
        console.log('[notify] Confirmation email sent to', trimmedEmail);
      } catch (err) {
        console.error('[notify] Error sending Resend email', err);
        // Don’t hard-fail user if email provider hiccups
      }
    } else {
      console.warn('[notify] Resend not configured — skipping email send');
    }

    // ----- Success response -----
    return sendJson(res, 200, {
      ok: true,
      email: trimmedEmail,
      source: tag
    });
  } catch (err) {
    console.error('[notify] Unexpected server error', err);
    return serverError(res, 'Unexpected server error');
  }
}
