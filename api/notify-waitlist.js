// /api/notify-waitlist.js
// Save waitlist email + send confirmation via Resend

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// ---------- Env ----------

const supabaseUrl  = process.env.SUPABASE_URL;
const supabaseKey  = process.env.SUPABASE_SERVICE_ROLE;
const resendKey    = process.env.RESEND_API_KEY;
const resendFrom   = process.env.RESEND_FROM_EMAIL || 'waitlist@frankiemoji.com';

const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const resend =
  resendKey ? new Resend(resendKey) : null;

function cors(res) {
  const origin = process.env.FRONTEND_BASE_URL || 'https://www.frankiemoji.com';
  res.setHeader('Access-Control-Allow-Origin', origin);
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

// Safely read body whether this is a plain Node function or Next-style
async function readBody(req) {
  if (req.body && typeof req.body === 'object') {
    // Next.js API route style – already parsed
    return req.body;
  }

  if (typeof req.body === 'string') {
    // Some runtimes put the raw string on req.body
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  // Raw Node.js IncomingMessage – read the stream
  return await new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
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
  cors(res);

  console.log('[notify-waitlist] incoming', {
    method: req.method,
    url: req.url,
  });

  if (req.method === 'OPTIONS') {
    // Preflight
    res.statusCode = 200;
    res.end('OK');
    return;
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, {
      ok: false,
      error: `Method ${req.method} Not Allowed`,
    });
  }

  if (!supabase) {
    console.error('[notify-waitlist] Supabase env missing');
    return sendJson(res, 500, {
      ok: false,
      error: 'Server not configured',
    });
  }

  let body;
  try {
    body = await readBody(req);
  } catch (err) {
    console.error('[notify-waitlist] JSON parse error', err);
    return sendJson(res, 400, { ok: false, error: 'Invalid JSON body' });
  }

  const {
    email,
    tag = 'splash',
    userAgent = '',
    referer = '',
  } = body || {};

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return sendJson(res, 400, { ok: false, error: 'Invalid email' });
  }

  try {
    // ----- Insert into Supabase -----
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

    if (error) {
      console.error('[notify-waitlist] Supabase insert error', error);
      return sendJson(res, 500, {
        ok: false,
        error: 'Database error',
      });
    }

    // ----- Optional confirmation email -----
    if (resend && resendKey) {
      try {
        await resend.emails.send({
          from: resendFrom,
          to: email,
          subject: 'You’re on the Frankiemoji holiday list ✨',
          text:
            `Thanks for joining the Frankiemoji holiday preview list!\n\n` +
            `You’ll be one of the first to know when the studio opens.\n\n` +
            `– Frankiemoji Studios`,
        });
      } catch (err) {
        console.error('[notify-waitlist] Resend error', err);
        // don’t fail the whole request if email send fails
      }
    }

    return sendJson(res, 200, {
      ok: true,
      email,
      tag,
      row: data,
    });
  } catch (err) {
    console.error('[notify-waitlist] Unexpected error', err);
    return sendJson(res, 500, {
      ok: false,
      error: 'Unexpected server error',
    });
  }
}
