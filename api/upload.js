// /api/upload.js — Vercel Edge Function
import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

const TABLE = 'emoji_orders';

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // 1) Supabase (service role) client
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE,
      { auth: { persistSession: false } }
    );

    // 2) Read JSON body from front-end
    const body = await req.json().catch(() => null);

    if (!body) {
      return new Response('Invalid JSON', { status: 400 });
    }

    const {
      pack = 'starter',        // "starter" | "standard" | "premium"
      email = '',
      phone = '',
      file_url,
      expressions = []
    } = body;

    if (!file_url) {
      return new Response('Missing file_url', { status: 400 });
    }

    if (!email) {
      return new Response('Missing email', { status: 400 });
    }

    // 3) Create the order row
    const { data: ins, error: insErr } = await sb
      .from(TABLE)
      .insert({
        pack_type: pack,
        expressions,
        email,
        phone,
        image_path: file_url,  // store Uploadcare URL here
        status: 'received'
      })
      .select('id')
      .single();

    if (insErr) throw insErr;
    const orderId = ins.id;

    // 4) Respond OK
    return new Response(JSON.stringify({ ok: true, order_id: orderId }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });

  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ ok: false, error: 'Upload failed' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}
