export const config = { runtime: 'nodejs' };
// api/orders.js – List recent emoji orders for admin
import { createClient } from '@supabase/supabase-js';

const TABLE = 'emoji_orders';

export default async function handler(req) {
  try {
    // 1) Only allow GET
    if (req.method !== 'GET') {
      return new Response(
        JSON.stringify({ ok: false, error: 'Method not allowed' }),
        { status: 405, headers: { 'content-type': 'application/json' } }
      );
    }

    // 2) Simple admin auth via header
    let adminHeader = '';

    // Web-style Request (has headers.get)
    if (req.headers && typeof req.headers.get === 'function') {
      adminHeader = req.headers.get('x-admin-key') || '';
    }
    // Node-style request (plain object)
    else if (req.headers) {
      adminHeader =
        req.headers['x-admin-key'] ||
        req.headers['X-Admin-Key'] ||
        '';
    }

    const adminSecret = process.env.ADMIN_ORDERS_KEY || '';

    if (!adminSecret || adminHeader !== adminSecret) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Unauthorized' }),
        { status: 401, headers: { 'content-type': 'application/json' } }
      );
    }

    // 3) Supabase client (service role)
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE;

    if (!url || !key) {
      console.error('[orders] Missing Supabase env vars', {
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

    const sb = createClient(url, key, { auth: { persistSession: false } });

    // 4) Query recent orders
    const { data, error } = await sb
      .from(TABLE)
      .select('id, created_at, pack_type, expressions, email, phone')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('[orders] Supabase select error:', error);

      return new Response(
        JSON.stringify({ ok: false, error: 'Failed to load orders' }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }

    // 5) Success
    return new Response(
      JSON.stringify({ ok: true, orders: data || [] }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  } catch (err) {
    console.error('[orders] handler fatal error:', err);

    return new Response(
      JSON.stringify({ ok: false, error: 'Server error' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}
