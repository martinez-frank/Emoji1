// /api/notify-waitlist.js
// Save waitlist email + send confirmation via Resend

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// ---------- Env ----------
const supabaseUrl   = process.env.SUPABASE_URL;
const supabaseKey   = process.env.SUPABASE_SERVICE_ROLE;
const resendKey     = process.env.RESEND_API_KEY;
const resendFrom    = process.env.RESEND_FROM_EMAIL || 'waitlist@frankiemoji.com';

const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

const resend =
  resendKey ? new Resend(resendKey) : null;

// ---------- CORS ----------
function cors(res) {
  const origin = process.env.FRONTEND_BASE_URL || "https://www.frankiemoji.com";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

// ---------- Handler ----------
export default async function handler(req, res) {
  cors(res);

  // Handle OPTIONS for browsers
  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    return res.end("OK");
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end("Method Not Allowed");
  }

  if (!supabase) {
    res.statusCode = 500;
    return res.json({ ok: false, error: "Server not configured" });
  }

  // Parse JSON body
  let body = {};
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    res.statusCode = 400;
    return res.json({ ok: false, error: "Invalid JSON" });
  }

  const { email, tag = "splash", userAgent, referer } = body;

  if (!email || !email.includes("@")) {
    res.statusCode = 400;
    return res.json({ ok: false, error: "Invalid email" });
  }

  // Insert row
  const { data, error } = await supabase
    .from("notify_waitlist")
    .insert({
      email,
      tag,
      user_agent: userAgent || null,
      referer: referer || null
    })
    .select()
    .single();

  if (error) {
    // Duplicate email is OK — treat as success
    if (error.code === "23505") {
      return res.json({ ok: true, already: true });
    }

    console.error("[notify-waitlist] Insert error:", error);
    res.statusCode = 500;
    return res.json({ ok: false, error: "DB insert failed" });
  }

  // Send welcome email
  if (resend) {
    try {
      await resend.emails.send({
        from: resendFrom,
        to: email,
        subject: "You're on the Frankiemoji Holiday Preview List 🎄✨",
        text: `Thanks for signing up!

You're officially on the list — you’ll be the first to know when the Frankiemoji studio opens.

A Season of Expressions is on the way.  
We can’t wait to show you what we’ve been creating. 🤎✨

– Frankiemoji Studios`
      });
    } catch (err) {
      console.error("[notify-waitlist] Resend error:", err);
    }
  }

  return res.json({ ok: true, inserted: true, id: data.id });
}
