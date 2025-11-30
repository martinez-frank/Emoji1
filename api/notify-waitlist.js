// /api/notify-waitlist.js
// Save waitlist email + send confirmation via Resend

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// ---------- Env ----------

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE;

const resendKey  = process.env.RESEND_API_KEY;
const resendFrom = process.env.RESEND_FROM_EMAIL || 'waitlist@frankiemoji.com';

const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const resend =
  resendKey ? new Resend(resendKey) : null;

// ---------- Helpers ----------

function setCors(res) {
  const origin = process.env.FRONTEND_BASE_URL || 'https://www.frankiemoji.com';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

// Safely read body whether it's already parsed or a raw stream
async function readBody(req) {
  // Next.js / Vercel-style: body already present
  if (req.body) {
    if (typeof req.body === 'string') {
      try {
        return JSON.parse(req.body);
      } catch {
        return {};
      }
    }
    if (typeof req.body === 'object') {
      return req.body;
    }
  }

  // Plain Node stream fallback
  return await new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// ---------- Handler ----------

export default async function handler(req, res) {
  setCors(res);
  console.log('[notify-waitlist] incoming', req.method, req.url);

  // Preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end('OK');
    return;
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'Method Not Allowed' });
  }

  if (!supabase) {
    console.error('[notify-waitlist] Supabase env missing');
    return sendJson(res, 500, { ok: false, error: 'Server not configured' });
  }

  // Parse body
  let body;
  try {
    body = await readBody(req);
  } catch (err) {
    console.error('[notify-waitlist] Invalid JSON', err);
    return sendJson(res, 400, { ok: false, error: 'Invalid JSON body' });
  }

  const rawEmail = (body.email || '').trim();
  const email = rawEmail.toLowerCase();
  const tag = body.tag || 'splash';
  const userAgent = body.userAgent || '';
  const referer = body.referer || '';

  if (!email || !email.includes('@')) {
    return sendJson(res, 400, { ok: false, error: 'Invalid email' });
  }

  try {
    // Insert into notify_waitlist
    const { data, error } = await supabase
      .from('notify_waitlist')
      .insert([
        {
          email,
          tag,
          user_agent: userAgent,
          referer,
        },
      ])
      .select()
      .single();

    // Unique violation (email already there) — treat as success
    if (error && error.code !== '23505') {
      console.error('[notify-waitlist] Supabase insert error', error);
      return sendJson(res, 500, { ok: false, error: 'Could not save email' });
    }

    // Fire-and-forget confirmation email
    if (resend) {
      try {
        await resend.emails.send({
          from: resendFrom,
          to: email,
          subject: 'You’re on the Frankiemoji holiday list 🎨',
          text: [
            'Thanks for joining the Frankiemoji holiday waitlist!',
            '',
            'We’ll email you as soon as the studio opens so you can start your custom emoji portrait.',
            '',
            'If this wasn’t you, you can safely ignore this email.',
          ].join('\n'),
        });
      } catch (err) {
        console.error('[notify-waitlist] Resend email error', err);
        // Don’t fail the whole request because email failed
      }
    } else {
      console.warn('[notify-waitlist] Resend client not configured, skipping email');
    }

    return sendJson(res, 200, {
      ok: true,
      email,
      saved: true,
      alreadyExists: !!(error && error.code === '23505'),
      row: data || null,
    });
  } catch (err) {
    console.error('[notify-waitlist] Unexpected error', err);
    return sendJson(res, 500, { ok: false, error: 'Unexpected server error' });
  }
}
