// api/orders.js – List recent emoji orders for admin (Edge Function)
import { createClient } from 'supabase/supabase-js';

export const config = { runtime: 'edge' };

const TABLE = 'emoji_orders';

// Small helper to return JSON responses
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export default async function handler(req) {
  try {
    // 1) Only allow GET
    if (req.method !== 'GET') {
      return json({ ok: false, error: 'Method not allowed' }, 405);
    }

    // 2) Simple admin auth via header
    //    Accept both lowercase and capitalized header names
    const adminHeader =
      (req.headers.get('x-admin-key') ||
        req.headers.get('X-Admin-Key') ||
        '').toString();

    const adminSecret = process.env.ADMIN_ORDERS_KEY || '';

    if (!adminHeader || adminHeader !== adminSecret) {
      return json({ ok: false, error: 'Unauthorized' }, 401);
    }

    // 3) Supabase env vars (service role)
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE; // same as upload.js

    if (!url || !key) {
      console.error('[orders] Missing Supabase env vars', {
        hasUrl: !!url,
        hasKey: !!key,
      });
      return json(
        { ok: false, error: 'Server misconfigured: missing Supabase env vars' },
        500
      );
    }

    // 4) Supabase client (service role, no session)
    const sb = createClient(url, key, {
      auth: { persistSession: false },
    });

    // 5) Query latest orders
    const { data, error } = await sb
      .from(TABLE)
      .select('id, created_at, pack_type, expressions, email, phone')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('[orders] Supabase select error:', error);
      return json({ ok: false, error: 'Failed to load orders' }, 500);
    }

    // 6) Success
    return json({ ok: true, orders: data || [] }, 200);
  } catch (err) {
    console.error('[orders] handler fatal error:', err);
    return json({ ok: false, error: 'Orders endpoint failed' }, 500);
  }
}
