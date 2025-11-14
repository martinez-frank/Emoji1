// /api/upload.js — Vercel Edge Function (JSON, not FormData)
import { createClient } from '@supabase/supabase-js';

const TABLE = 'emoji_orders';

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ ok: false, error: 'Method not allowed' }),
      { status: 405, headers: { 'content-type': 'application/json' } }
    );
  }

   try {
    // 1) Supabase client (service role)
    // *** USE ONLY THESE TWO VARS ***
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE;

    // Debug: log whether env vars are present, and key length
    console.log('[upload] SUPABASE_URL present?', !!url);
    console.log('[upload] SUPABASE_SERVICE_ROLE length:', key ? key.length : 0);

    if (!url || !key) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE env vars',
        }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }

    const sb = createClient(url, key, { auth: { persistSession: false } });
      );
    }

    const sb = createClient(url, key, { auth: { persistSession: false } });

    // 2) Read JSON body
    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Invalid JSON body' }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }

    const {
      pack = 'starter',      // "starter" | "standard" | "premium"
      email = '',
      phone = '',
      file_url,
      expressions = [],
    } = body;

    if (!file_url) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Missing file_url' }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }

    if (!email) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Missing email' }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }

    // 3) Insert order row
    const { data: ins, error: insErr } = await sb
      .from(TABLE)
      .insert({
        pack_type: pack,          // make sure this column exists
        expressions,              // JSON or text[] column
        email,
        phone,
        image_path: file_url,     // make sure this column exists
        status: 'received',
      })
      .select('id')
      .single();

    if (insErr) {
      console.error('Supabase insert error:', insErr);
      return new Response(
        JSON.stringify({ ok: false, error: 'Supabase insert failed' }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, order_id: ins.id }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  } catch (e) {
    console.error('Upload handler fatal error:', e);
    return new Response(
      JSON.stringify({ ok: false, error: 'Upload failed' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}
