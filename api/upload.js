// /api/upload.js — Vercel Edge Function (JSON, not FormData)
import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

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
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE;

    if (!url || !key) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Supabase env vars missing (SUPABASE_URL / SUPABASE_SERVICE_KEY)' }),
        { status: 500, headers: { 'content-type': 'application/json' } }
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
      pack = 'starter',          // "starter" | "standard" | "premium"
      email = '',
      phone = '',
      file_url,
      expressions = []
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
        pack_type: pack,        // make sure this column exists
        expressions,            // JSON or text[] column
        email,
        phone,
        image_path: file_url,   // make sure this column exists
        status: 'received'
      })
      .select('id')
      .single();

    if (insErr) {
      console.error('Supabase insert error:', insErr);
      return new Response(
        JSON.stringify({
          ok: false,
          error: insErr.message || 'Supabase insert failed'
        }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }

    const orderId = ins.id;

    // 4) Success
    return new Response(
      JSON.stringify({ ok: true, order_id: orderId }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );

  } catch (e) {
    console.error('Upload handler exception:', e);
    return new Response(
      JSON.stringify({ ok: false, error: e.message || 'Upload failed' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}
