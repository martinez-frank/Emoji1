// /api/upload.js — Vercel Edge Function (JSON, not FormData)

// This is your Supabase table name
const TABLE = 'emoji_orders';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  // 1) Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ ok: false, error: 'Method not allowed' }),
      { status: 405, headers: { 'content-type': 'application/json' } }
    );
  }

  try {
    // 2) Read env vars that Vercel injects
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE;

    if (!url || !key) {
      console.error('[upload] Missing Supabase env vars', {
        hasUrl: !!url,
        hasKey: !!key,
      });
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Server misconfigured: missing Supabase env vars',
        }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }

    // 3) Parse JSON body from the client
    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Invalid JSON body' }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }

    // Expected payload from upload.html
    const {
    pack = 'starter',
    email = '',
    phone = '',
    file_url = '',
    expressions = [],
    promo_code = '',       // ← ADD THIS
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

    // 4) Build the row for your emoji_orders table.
    //    Column names here must match Supabase exactly.
    const row = {
    pack_type: pack,
    email,
    phone,
    promo_code,            
    image_path: file_url,
    expressions,          
    status: 'received',
    };
    };

    // 5) Insert into Supabase via REST API (no supabase-js client needed)
    const insertRes = await fetch(`${url}/rest/v1/${TABLE}`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify([row]), // REST API expects an array of rows
    });

    const data = await insertRes.json().catch(() => null);

    if (!insertRes.ok) {
      console.error('[upload] Supabase insert failed', {
        status: insertRes.status,
        data,
      });
      return new Response(
        JSON.stringify({
          ok: false,
          error:
            (data && data.message) ||
            `Supabase insert failed (${insertRes.status})`,
        }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }

    // data is an array of inserted rows because of "return=representation"
    const inserted = Array.isArray(data) ? data[0] : data;
    const orderId = inserted && inserted.id ? inserted.id : null;

    return new Response(
      JSON.stringify({ ok: true, order_id: orderId }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  } catch (err) {
    console.error('[upload] Handler fatal error', err);
    return new Response(
      JSON.stringify({ ok: false, error: 'Upload failed' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}
